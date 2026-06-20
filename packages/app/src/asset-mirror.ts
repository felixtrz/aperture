import {
  assetHandleKey,
  deserializeAssetHandle,
  serializeAssetHandle,
  type AssetDiagnostic,
  type AssetHandle,
  type AssetKind,
  type AssetRegistry,
  type AssetRegistryEntry,
  type AssetStatus,
  type MeshHandle,
  type SerializedAssetHandle,
} from "@aperture-engine/simulation";
import type {
  MeshAsset,
  MeshBufferUpdateRange,
  MeshIndexBufferDescriptor,
  MeshVertexStreamDescriptor,
} from "@aperture-engine/render";

const MESH_ASSET_PATCH_KIND = "aperture.meshAssetPatch.v1";

interface SerializedMeshBufferRangePatch {
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly data: Uint8Array;
}

interface SerializedMeshVertexStreamPatch extends Omit<
  MeshVertexStreamDescriptor,
  "data" | "updateRanges"
> {
  readonly updates: readonly SerializedMeshBufferRangePatch[];
}

interface SerializedMeshIndexBufferPatch extends Omit<
  MeshIndexBufferDescriptor,
  "data" | "updateRanges"
> {
  readonly updates: readonly SerializedMeshBufferRangePatch[];
}

interface SerializedMeshAssetPatch extends Omit<
  MeshAsset,
  "kind" | "vertexStreams" | "indexBuffer"
> {
  readonly kind: typeof MESH_ASSET_PATCH_KIND;
  readonly meshLayoutKey: string;
  readonly vertexStreams: readonly SerializedMeshVertexStreamPatch[];
  readonly indexBuffer?: SerializedMeshIndexBufferPatch;
}

interface SerializedSourceAssetEntry {
  readonly handle: SerializedAssetHandle;
  readonly label: string;
  readonly status: AssetStatus;
  readonly version: number;
  readonly asset: unknown;
  readonly dependencies: readonly SerializedAssetHandle[];
  readonly diagnostics: readonly AssetDiagnostic[];
}

export interface SerializedSourceAssetRegistry {
  readonly entries: readonly SerializedSourceAssetEntry[];
}

export interface SourceAssetMirrorReport {
  readonly mirrored: number;
  readonly skipped: number;
}

export interface SourceAssetSerializationState {
  readonly versionsByHandle: Map<string, number>;
  readonly meshLayoutKeysByHandle: Map<string, string>;
}

export function createSourceAssetSerializationState(): SourceAssetSerializationState {
  return {
    versionsByHandle: new Map(),
    meshLayoutKeysByHandle: new Map(),
  };
}

export function serializeSourceAssetRegistry(
  registry: AssetRegistry,
  options: {
    readonly state?: SourceAssetSerializationState;
  } = {},
): SerializedSourceAssetRegistry {
  return {
    entries: registry
      .list()
      .filter((entry) => shouldSerializeSourceAssetEntry(entry, options.state))
      .map((entry) => serializeSourceAssetEntry(entry, options.state)),
  };
}

/**
 * Record the serialized entry versions as successfully delivered. Callers must
 * invoke this only after the message containing the entries was posted; if
 * posting throws (for example a structured-clone failure on an asset payload),
 * skipping the commit keeps the entries eligible for the next snapshot instead
 * of silently dropping them from the mirror forever.
 */
export function commitSerializedSourceAssets(
  state: SourceAssetSerializationState,
  serialized: SerializedSourceAssetRegistry,
): void {
  for (const entry of serialized.entries) {
    const key = assetHandleKey(deserializeAssetHandle(entry.handle));
    const sentVersion = state.versionsByHandle.get(key);

    if (sentVersion === undefined || entry.version > sentVersion) {
      state.versionsByHandle.set(key, entry.version);
    }

    const meshLayoutKey = readSerializedMeshLayoutKey(entry.asset);

    if (meshLayoutKey === null) {
      state.meshLayoutKeysByHandle.delete(key);
    } else {
      state.meshLayoutKeysByHandle.set(key, meshLayoutKey);
    }
  }
}

export function mirrorSourceAssetRegistryFromMessage(
  registry: AssetRegistry,
  message: unknown,
): SourceAssetMirrorReport {
  const sourceAssets = readSourceAssetRegistry(message);

  if (sourceAssets === null) {
    return { mirrored: 0, skipped: 0 };
  }

  let mirrored = 0;
  let skipped = 0;

  for (const entry of sourceAssets.entries) {
    const handle = deserializeAssetHandle(entry.handle);
    const current = registry.get(handle);

    if (current !== undefined && current.version >= entry.version) {
      skipped += 1;
      continue;
    }

    ensureRegistered(registry, handle, entry);
    if (writeEntryStatus(registry, handle, entry)) {
      mirrored += 1;
    } else {
      skipped += 1;
    }
  }

  return { mirrored, skipped };
}

function serializeSourceAssetEntry(
  entry: AssetRegistryEntry,
  state: SourceAssetSerializationState | undefined,
): SerializedSourceAssetEntry {
  return {
    handle: serializeAssetHandle(entry.handle),
    label: entry.label,
    status: entry.status,
    version: entry.version,
    asset: serializeSourceAssetPayload(entry, state),
    dependencies: entry.dependencies.map(serializeAssetHandle),
    diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

function serializeSourceAssetPayload(
  entry: AssetRegistryEntry,
  state: SourceAssetSerializationState | undefined,
): unknown {
  const asset = entry.asset;

  if (state === undefined || !isMeshAsset(asset) || entry.status !== "ready") {
    return asset;
  }

  const key = assetHandleKey(entry.handle);
  const layoutKey = meshAssetPatchLayoutKey(asset);

  if (state.meshLayoutKeysByHandle.get(key) !== layoutKey) {
    return asset;
  }

  return createSerializedMeshAssetPatch(asset, layoutKey) ?? asset;
}

function shouldSerializeSourceAssetEntry(
  entry: AssetRegistryEntry,
  state: SourceAssetSerializationState | undefined,
): boolean {
  if (state === undefined) {
    return true;
  }

  const sentVersion = state.versionsByHandle.get(assetHandleKey(entry.handle));

  return sentVersion === undefined || entry.version > sentVersion;
}

function readSourceAssetRegistry(
  message: unknown,
): SerializedSourceAssetRegistry | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const value = (message as { readonly sourceAssets?: unknown }).sourceAssets;

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const entries = (value as { readonly entries?: unknown }).entries;

  if (!Array.isArray(entries)) {
    return null;
  }

  return {
    entries: entries.filter(isSerializedSourceAssetEntry),
  };
}

function isSerializedSourceAssetEntry(
  value: unknown,
): value is SerializedSourceAssetEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as SerializedSourceAssetEntry;

  return (
    isSerializedHandle(entry.handle) &&
    typeof entry.label === "string" &&
    isAssetStatus(entry.status) &&
    typeof entry.version === "number" &&
    Array.isArray(entry.dependencies) &&
    entry.dependencies.every(isSerializedHandle) &&
    Array.isArray(entry.diagnostics)
  );
}

function isSerializedHandle(value: unknown): value is SerializedAssetHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly kind?: unknown }).kind === "string" &&
    typeof (value as { readonly id?: unknown }).id === "string"
  );
}

function isAssetStatus(value: unknown): value is AssetStatus {
  return (
    value === "registered" ||
    value === "loading" ||
    value === "ready" ||
    value === "failed"
  );
}

function ensureRegistered(
  registry: AssetRegistry,
  handle: AssetHandle,
  entry: SerializedSourceAssetEntry,
): void {
  if (registry.has(handle)) {
    return;
  }

  registry.register(handle, {
    label: entry.label,
    dependencies: entry.dependencies.map(deserializeAssetHandle),
    diagnostics: entry.diagnostics,
  });
}

function writeEntryStatus(
  registry: AssetRegistry,
  handle: AssetHandle<AssetKind>,
  entry: SerializedSourceAssetEntry,
): boolean {
  if (entry.status === "registered") {
    return true;
  }

  if (entry.status === "loading") {
    registry.markLoading(handle);
    return true;
  }

  if (entry.status === "failed") {
    registry.markFailed(handle, entry.diagnostics);
    return true;
  }

  const asset = materializeReadySourceAsset(registry, handle, entry.asset);

  if (asset === null) {
    return false;
  }

  registry.markReady(handle, asset);
  return true;
}

function materializeReadySourceAsset(
  registry: AssetRegistry,
  handle: AssetHandle<AssetKind>,
  asset: unknown,
): unknown | null {
  const patch = readSerializedMeshAssetPatch(asset);

  if (patch === null) {
    return asset;
  }

  if (handle.kind !== "mesh") {
    return null;
  }

  const current = registry.get<"mesh", MeshAsset>(handle as MeshHandle)?.asset;

  if (current === undefined || current === null) {
    return null;
  }

  return applySerializedMeshAssetPatch(current, patch);
}

function createSerializedMeshAssetPatch(
  asset: MeshAsset,
  meshLayoutKey: string,
): SerializedMeshAssetPatch | null {
  if (
    asset.skinning !== undefined ||
    asset.morphTargets !== undefined ||
    asset.morphTargetData !== undefined
  ) {
    return null;
  }

  return {
    kind: MESH_ASSET_PATCH_KIND,
    meshLayoutKey,
    label: asset.label,
    vertexStreams: asset.vertexStreams.map((stream) => ({
      id: stream.id,
      arrayStride: stream.arrayStride,
      vertexCount: stream.vertexCount,
      attributes: stream.attributes.map((attribute) => ({ ...attribute })),
      updates: serializeMeshBufferRangePatches(
        stream.data,
        stream.updateRanges,
      ),
    })),
    ...(asset.indexBuffer === undefined
      ? {}
      : {
          indexBuffer: {
            format: asset.indexBuffer.format,
            ...(asset.indexBuffer.indexCount === undefined
              ? {}
              : { indexCount: asset.indexBuffer.indexCount }),
            updates: serializeMeshBufferRangePatches(
              asset.indexBuffer.data,
              asset.indexBuffer.updateRanges,
            ),
          },
        }),
    submeshes: asset.submeshes.map((submesh) => ({ ...submesh })),
    materialSlots: asset.materialSlots.map((slot) => ({ ...slot })),
    ...(asset.localAabb === undefined
      ? {}
      : {
          localAabb: {
            min: Array.from(asset.localAabb.min),
            max: Array.from(asset.localAabb.max),
          },
        }),
    ...(asset.localSphere === undefined
      ? {}
      : {
          localSphere: {
            center: Array.from(asset.localSphere.center),
            radius: asset.localSphere.radius,
          },
        }),
  };
}

function applySerializedMeshAssetPatch(
  current: MeshAsset,
  patch: SerializedMeshAssetPatch,
): MeshAsset | null {
  if (meshAssetPatchLayoutKey(current) !== patch.meshLayoutKey) {
    return null;
  }

  const vertexStreams: MeshVertexStreamDescriptor[] = [];

  for (const patchStream of patch.vertexStreams) {
    const currentStream = current.vertexStreams.find(
      (stream) => stream.id === patchStream.id,
    );

    if (currentStream === undefined) {
      return null;
    }

    const data = currentStream.data;

    if (!applyMeshBufferRangePatches(data, patchStream.updates)) {
      return null;
    }

    vertexStreams.push({
      id: patchStream.id,
      arrayStride: patchStream.arrayStride,
      vertexCount: patchStream.vertexCount,
      attributes: patchStream.attributes.map((attribute) => ({ ...attribute })),
      data,
      ...(patchStream.updates.length === 0
        ? {}
        : {
            updateRanges: patchStream.updates.map(
              ({ byteOffset, byteLength }) => ({
                byteOffset,
                byteLength,
              }),
            ),
          }),
    });
  }

  const indexBuffer =
    patch.indexBuffer === undefined
      ? undefined
      : applySerializedMeshIndexBufferPatch(current, patch.indexBuffer);

  if (indexBuffer === null) {
    return null;
  }

  return {
    kind: "mesh",
    label: patch.label,
    vertexStreams,
    ...(indexBuffer === undefined ? {} : { indexBuffer }),
    submeshes: patch.submeshes.map((submesh) => ({ ...submesh })),
    materialSlots: patch.materialSlots.map((slot) => ({ ...slot })),
    ...(patch.localAabb === undefined
      ? {}
      : {
          localAabb: {
            min: Array.from(patch.localAabb.min),
            max: Array.from(patch.localAabb.max),
          },
        }),
    ...(patch.localSphere === undefined
      ? {}
      : {
          localSphere: {
            center: Array.from(patch.localSphere.center),
            radius: patch.localSphere.radius,
          },
        }),
  };
}

function applySerializedMeshIndexBufferPatch(
  current: MeshAsset,
  patch: SerializedMeshIndexBufferPatch,
): MeshIndexBufferDescriptor | null {
  if (current.indexBuffer === undefined) {
    return null;
  }

  const data = current.indexBuffer.data;

  if (!applyMeshBufferRangePatches(data, patch.updates)) {
    return null;
  }

  return {
    format: patch.format,
    data,
    ...(patch.indexCount === undefined ? {} : { indexCount: patch.indexCount }),
    ...(patch.updates.length === 0
      ? {}
      : {
          updateRanges: patch.updates.map(({ byteOffset, byteLength }) => ({
            byteOffset,
            byteLength,
          })),
        }),
  };
}

function serializeMeshBufferRangePatches(
  source: ArrayBufferView,
  ranges: readonly MeshBufferUpdateRange[] | undefined,
): readonly SerializedMeshBufferRangePatch[] {
  if (ranges === undefined || ranges.length === 0) {
    return [];
  }

  return ranges.map((range) => {
    const data = new Uint8Array(
      source.buffer,
      source.byteOffset + range.byteOffset,
      range.byteLength,
    ).slice();

    return {
      byteOffset: range.byteOffset,
      byteLength: range.byteLength,
      data,
    };
  });
}

function applyMeshBufferRangePatches(
  target: ArrayBufferView,
  updates: readonly SerializedMeshBufferRangePatch[],
): boolean {
  const targetBytes = new Uint8Array(
    target.buffer,
    target.byteOffset,
    target.byteLength,
  );

  for (const update of updates) {
    if (
      update.byteOffset < 0 ||
      update.byteLength < 0 ||
      update.byteOffset + update.byteLength > targetBytes.byteLength ||
      update.data.byteLength !== update.byteLength
    ) {
      return false;
    }

    targetBytes.set(update.data, update.byteOffset);
  }

  return true;
}

function readSerializedMeshLayoutKey(asset: unknown): string | null {
  const patch = readSerializedMeshAssetPatch(asset);

  if (patch !== null) {
    return patch.meshLayoutKey;
  }

  return isMeshAsset(asset) ? meshAssetPatchLayoutKey(asset) : null;
}

function readSerializedMeshAssetPatch(
  value: unknown,
): SerializedMeshAssetPatch | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const patch = value as SerializedMeshAssetPatch;

  return patch.kind === MESH_ASSET_PATCH_KIND &&
    typeof patch.meshLayoutKey === "string" &&
    Array.isArray(patch.vertexStreams) &&
    Array.isArray(patch.submeshes) &&
    Array.isArray(patch.materialSlots)
    ? patch
    : null;
}

function isMeshAsset(value: unknown): value is MeshAsset {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const asset = value as MeshAsset;

  return (
    asset.kind === "mesh" &&
    typeof asset.label === "string" &&
    Array.isArray(asset.vertexStreams) &&
    Array.isArray(asset.submeshes) &&
    Array.isArray(asset.materialSlots)
  );
}

function meshAssetPatchLayoutKey(asset: MeshAsset): string {
  const vertexStreams = asset.vertexStreams.map((stream) =>
    [
      stream.id,
      stream.arrayStride,
      stream.vertexCount,
      stream.data.constructor.name,
      stream.data.byteLength,
      stream.attributes
        .map((attribute) =>
          [attribute.semantic, attribute.format, attribute.offset].join(":"),
        )
        .join(","),
    ].join(":"),
  );
  const indexBuffer =
    asset.indexBuffer === undefined
      ? "index:none"
      : [
          "index",
          asset.indexBuffer.format,
          asset.indexBuffer.data.constructor.name,
          asset.indexBuffer.data.byteLength,
        ].join(":");

  return ["mesh", ...vertexStreams, indexBuffer].join("|");
}
