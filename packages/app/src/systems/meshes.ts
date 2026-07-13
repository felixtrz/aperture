import type {
  MeshAsset,
  MeshBufferUpdateRange,
  MeshIndexBufferDescriptor,
  MeshVertexStreamDescriptor,
} from "@aperture-engine/render";
import {
  assetHandleKey,
  createMeshHandle,
  type AssetDiagnostic,
  type AssetRegistry,
  type MeshHandle,
} from "@aperture-engine/simulation";

export interface DynamicMeshOptions {
  readonly label?: string;
  readonly initial?: MeshAsset;
  readonly diagnostics?: readonly AssetDiagnostic[];
}

export interface MeshPublishOptions {
  readonly label?: string;
  readonly diagnostics?: readonly AssetDiagnostic[];
}

export interface MeshPublishResult {
  readonly handle: MeshHandle;
  readonly key: string;
  readonly version: number;
}

/**
 * D5: a partial update to one vertex stream of a registered mesh. `data` is
 * optional — when omitted the currently-registered stream's backing typed array
 * is reused (the caller mutates it in place before calling `update`). Providing
 * `data` swaps the backing array; it MUST match the registered stream's byte
 * length and element type (a partial update cannot change the buffer size or
 * layout — that would force a full re-realization). `updateRanges` names the
 * 4-byte-aligned byte windows that actually changed; omit it to re-upload the
 * whole stream, or set it (per-stream) to override the update's shared
 * `updateRanges`.
 */
export interface MeshStreamUpdate {
  readonly id: string;
  readonly data?: MeshVertexStreamDescriptor["data"];
  readonly updateRanges?: readonly MeshBufferUpdateRange[];
}

/** D5: a partial update to the mesh index buffer (same contract as a stream). */
export interface MeshIndexUpdate {
  readonly data?: MeshIndexBufferDescriptor["data"];
  readonly updateRanges?: readonly MeshBufferUpdateRange[];
}

/**
 * D5: the first-class partial-mesh-update payload. Streams (and the index
 * buffer) NOT named here are republished with an empty update-range list so the
 * renderer skips re-uploading them — only the named windows cross to the GPU
 * through the existing update-range plan, and the asset is never re-registered.
 */
export interface MeshUpdateOptions {
  readonly streams?: readonly MeshStreamUpdate[];
  readonly index?: MeshIndexUpdate;
  /** Shared update ranges applied to any named stream/index lacking its own. */
  readonly updateRanges?: readonly MeshBufferUpdateRange[];
  /** Optional replacement local bounds (defaults to the registered mesh's). */
  readonly localAabb?: MeshAsset["localAabb"];
  readonly localSphere?: MeshAsset["localSphere"];
  readonly label?: string;
  readonly diagnostics?: readonly AssetDiagnostic[];
}

export type MeshUpdateDiagnosticCode =
  | "meshUpdate.unknownHandle"
  | "meshUpdate.notReady"
  | "meshUpdate.emptyUpdate"
  | "meshUpdate.unknownStream"
  | "meshUpdate.streamLengthMismatch"
  | "meshUpdate.missingIndexBuffer"
  | "meshUpdate.indexLengthMismatch"
  | "meshUpdate.rangeOutOfBounds"
  | "meshUpdate.rangeMisaligned";

export interface MeshUpdateDiagnostic {
  readonly code: MeshUpdateDiagnosticCode;
  readonly message: string;
  readonly streamId?: string;
}

export interface MeshUpdateResult {
  readonly ok: boolean;
  readonly handle: MeshHandle;
  readonly key: string;
  /** New source-asset version on success, `null` when the update was rejected. */
  readonly version: number | null;
  /** Total bytes across all accepted update ranges (the partial-upload size). */
  readonly bytes: number;
  readonly rangeCount: number;
  readonly diagnostics: readonly MeshUpdateDiagnostic[];
}

export interface DynamicMesh {
  readonly handle: MeshHandle;
  readonly key: string;
  get(): MeshAsset | undefined;
  publish(mesh: MeshAsset, options?: MeshPublishOptions): MeshPublishResult;
  /** D5: partial in-place update through the existing update-range plan. */
  update(update: MeshUpdateOptions): MeshUpdateResult;
}

export interface MeshAccess {
  dynamic(id: string | MeshHandle, options?: DynamicMeshOptions): DynamicMesh;
  get(handle: MeshHandle): MeshAsset | undefined;
  publish(
    id: string | MeshHandle,
    mesh: MeshAsset,
    options?: MeshPublishOptions,
  ): MeshPublishResult;
  /**
   * D5: partial-update a registered mesh's vertex/index buffers in place. The
   * changed byte windows are re-published (a new source version) carrying
   * `updateRanges`, which the renderer streams to the existing GPU buffers via
   * `queue.writeBuffer` — no asset re-registration, no full-buffer re-upload.
   * Invalid ranges (out of bounds, misaligned, stream length/type mismatch,
   * unknown handle/stream) are rejected with a structured diagnostic and NO
   * publish, so a bad range never reaches WebGPU as a raw validation error.
   */
  update(id: string | MeshHandle, update: MeshUpdateOptions): MeshUpdateResult;
}

export function createMeshAccess(registry: AssetRegistry): MeshAccess {
  const access: MeshAccess = {
    dynamic(id, options = {}) {
      const handle = meshHandleFrom(id);
      ensureRegistered(registry, handle, options.label);

      if (options.initial !== undefined) {
        publishMesh(registry, handle, options.initial, {
          ...(options.label === undefined ? {} : { label: options.label }),
          ...(options.diagnostics === undefined
            ? {}
            : { diagnostics: options.diagnostics }),
        });
      }

      return {
        handle,
        key: assetHandleKey(handle),
        get() {
          return access.get(handle);
        },
        publish(mesh, publishOptions = {}) {
          return access.publish(handle, mesh, publishOptions);
        },
        update(meshUpdate) {
          return access.update(handle, meshUpdate);
        },
      };
    },
    get(handle) {
      return registry.get<"mesh", MeshAsset>(handle)?.asset ?? undefined;
    },
    publish(id, mesh, options = {}) {
      const handle = meshHandleFrom(id);
      ensureRegistered(registry, handle, options.label ?? mesh.label);
      return publishMesh(registry, handle, mesh, options);
    },
    update(id, meshUpdate) {
      return updateMesh(registry, meshHandleFrom(id), meshUpdate);
    },
  };

  return access;
}

function meshHandleFrom(id: string | MeshHandle): MeshHandle {
  return typeof id === "string" ? createMeshHandle(id) : id;
}

function ensureRegistered(
  registry: AssetRegistry,
  handle: MeshHandle,
  label: string | undefined,
): void {
  if (registry.has(handle)) {
    return;
  }

  registry.register(handle, {
    ...(label === undefined ? {} : { label }),
  });
}

function publishMesh(
  registry: AssetRegistry,
  handle: MeshHandle,
  mesh: MeshAsset,
  options: MeshPublishOptions,
): MeshPublishResult {
  const entry = registry.markReady(handle, mesh, options.diagnostics ?? []);

  return {
    handle,
    key: assetHandleKey(handle),
    version: entry.version,
  };
}

interface ValidatedRanges {
  readonly ranges: MeshBufferUpdateRange[];
  readonly bytes: number;
}

function updateMesh(
  registry: AssetRegistry,
  handle: MeshHandle,
  update: MeshUpdateOptions,
): MeshUpdateResult {
  const key = assetHandleKey(handle);
  const diagnostics: MeshUpdateDiagnostic[] = [];

  const entry = registry.has(handle)
    ? registry.get<"mesh", MeshAsset>(handle)
    : undefined;

  if (entry === undefined) {
    diagnostics.push({
      code: "meshUpdate.unknownHandle",
      message: `No mesh is registered under '${key}'. Publish one (meshes.dynamic/publish) before calling meshes.update().`,
    });
    return rejected(handle, key, diagnostics);
  }

  const current =
    entry.status === "ready" && entry.asset !== null ? entry.asset : undefined;

  if (current === undefined) {
    diagnostics.push({
      code: "meshUpdate.notReady",
      message: `Mesh '${key}' has no ready asset to update; publish an initial mesh first.`,
    });
    return rejected(handle, key, diagnostics);
  }

  const hasStreams = update.streams !== undefined && update.streams.length > 0;
  const hasIndex = update.index !== undefined;

  if (!hasStreams && !hasIndex) {
    diagnostics.push({
      code: "meshUpdate.emptyUpdate",
      message: `Mesh update for '${key}' named no streams and no index buffer.`,
    });
    return rejected(handle, key, diagnostics);
  }

  const pending = new Map<string, MeshStreamUpdate>();
  for (const stream of update.streams ?? []) {
    pending.set(stream.id, stream);
  }

  let totalBytes = 0;
  let totalRanges = 0;
  const nextStreams: MeshVertexStreamDescriptor[] = [];

  for (const stream of current.vertexStreams) {
    const streamUpdate = pending.get(stream.id);

    if (streamUpdate === undefined) {
      // Unchanged stream: republish with an empty range list so the renderer
      // skips re-uploading it (only the named windows cross to the GPU).
      nextStreams.push({ ...stream, updateRanges: [] });
      continue;
    }

    pending.delete(stream.id);
    const data = streamUpdate.data ?? stream.data;

    if (
      data.byteLength !== stream.data.byteLength ||
      data.constructor !== stream.data.constructor
    ) {
      diagnostics.push({
        code: "meshUpdate.streamLengthMismatch",
        streamId: stream.id,
        message: `Stream '${stream.id}' update data (${data.byteLength} bytes, ${data.constructor.name}) must match the registered stream (${stream.data.byteLength} bytes, ${stream.data.constructor.name}); a partial update cannot change the buffer size or element type.`,
      });
      continue;
    }

    const validated = validateRanges(
      streamUpdate.updateRanges ?? update.updateRanges,
      data.byteLength,
      stream.id,
      diagnostics,
    );

    if (validated === null) {
      continue;
    }

    totalBytes += validated.bytes;
    totalRanges += validated.ranges.length;
    nextStreams.push({ ...stream, data, updateRanges: validated.ranges });
  }

  for (const id of pending.keys()) {
    diagnostics.push({
      code: "meshUpdate.unknownStream",
      streamId: id,
      message: `Mesh '${key}' has no vertex stream '${id}' to update.`,
    });
  }

  let nextIndex: MeshIndexBufferDescriptor | undefined;

  if (current.indexBuffer !== undefined) {
    if (hasIndex && update.index !== undefined) {
      const indexUpdate = update.index;
      const data = indexUpdate.data ?? current.indexBuffer.data;

      if (
        data.byteLength !== current.indexBuffer.data.byteLength ||
        data.constructor !== current.indexBuffer.data.constructor
      ) {
        diagnostics.push({
          code: "meshUpdate.indexLengthMismatch",
          message: `Index buffer update data (${data.byteLength} bytes, ${data.constructor.name}) must match the registered index buffer (${current.indexBuffer.data.byteLength} bytes, ${current.indexBuffer.data.constructor.name}).`,
        });
        nextIndex = current.indexBuffer;
      } else {
        const validated = validateRanges(
          indexUpdate.updateRanges ?? update.updateRanges,
          data.byteLength,
          undefined,
          diagnostics,
        );

        if (validated === null) {
          nextIndex = current.indexBuffer;
        } else {
          totalBytes += validated.bytes;
          totalRanges += validated.ranges.length;
          nextIndex = {
            ...current.indexBuffer,
            data,
            updateRanges: validated.ranges,
          };
        }
      }
    } else {
      nextIndex = { ...current.indexBuffer, updateRanges: [] };
    }
  } else if (hasIndex) {
    diagnostics.push({
      code: "meshUpdate.missingIndexBuffer",
      message: `Mesh '${key}' has no index buffer to update.`,
    });
  }

  // Any invalid input rejects the WHOLE update without publishing, so a bad
  // range never reaches WebGPU as a raw validation error.
  if (diagnostics.length > 0) {
    return rejected(handle, key, diagnostics);
  }

  const nextAsset: MeshAsset = {
    ...current,
    ...(update.label === undefined ? {} : { label: update.label }),
    vertexStreams: nextStreams,
    ...(nextIndex === undefined ? {} : { indexBuffer: nextIndex }),
    ...(update.localAabb === undefined ? {} : { localAabb: update.localAabb }),
    ...(update.localSphere === undefined
      ? {}
      : { localSphere: update.localSphere }),
  };

  const published = publishMesh(registry, handle, nextAsset, {
    ...(update.label === undefined ? {} : { label: update.label }),
    ...(update.diagnostics === undefined
      ? {}
      : { diagnostics: update.diagnostics }),
  });

  return {
    ok: true,
    handle,
    key,
    version: published.version,
    bytes: totalBytes,
    rangeCount: totalRanges,
    diagnostics: [],
  };
}

function validateRanges(
  ranges: readonly MeshBufferUpdateRange[] | undefined,
  byteLength: number,
  streamId: string | undefined,
  diagnostics: MeshUpdateDiagnostic[],
): ValidatedRanges | null {
  // A named stream without explicit ranges re-uploads its whole buffer.
  if (ranges === undefined) {
    return { ranges: [{ byteOffset: 0, byteLength }], bytes: byteLength };
  }

  const accepted: MeshBufferUpdateRange[] = [];
  let bytes = 0;
  let invalid = false;
  const where =
    streamId === undefined ? "index buffer" : `stream '${streamId}'`;

  for (const range of ranges) {
    if (
      !Number.isInteger(range.byteOffset) ||
      !Number.isInteger(range.byteLength) ||
      range.byteOffset < 0 ||
      range.byteLength < 0 ||
      range.byteOffset + range.byteLength > byteLength
    ) {
      diagnostics.push({
        code: "meshUpdate.rangeOutOfBounds",
        ...(streamId === undefined ? {} : { streamId }),
        message: `Update range [${range.byteOffset}, +${range.byteLength}) is outside the ${byteLength}-byte ${where}.`,
      });
      invalid = true;
      continue;
    }

    if (range.byteOffset % 4 !== 0 || range.byteLength % 4 !== 0) {
      diagnostics.push({
        code: "meshUpdate.rangeMisaligned",
        ...(streamId === undefined ? {} : { streamId }),
        message: `Update range [${range.byteOffset}, +${range.byteLength}) for the ${where} must be 4-byte aligned in offset and length.`,
      });
      invalid = true;
      continue;
    }

    if (range.byteLength > 0) {
      accepted.push({
        byteOffset: range.byteOffset,
        byteLength: range.byteLength,
      });
      bytes += range.byteLength;
    }
  }

  return invalid ? null : { ranges: accepted, bytes };
}

function rejected(
  handle: MeshHandle,
  key: string,
  diagnostics: readonly MeshUpdateDiagnostic[],
): MeshUpdateResult {
  return {
    ok: false,
    handle,
    key,
    version: null,
    bytes: 0,
    rangeCount: 0,
    diagnostics,
  };
}
