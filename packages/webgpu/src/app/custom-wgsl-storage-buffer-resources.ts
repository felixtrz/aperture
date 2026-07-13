import {
  assetHandleKey,
  createBufferHandle,
  type AssetRegistry,
  type BufferHandle,
} from "@aperture-engine/simulation";
import {
  bufferAssetByteLength,
  bufferAssetUsageIsWritable,
  bufferElementByteStride,
  bufferElementComponentCount,
  validateBufferAsset,
  type BufferAsset,
  type CustomWgslMaterialAsset,
  type CustomWgslStorageBindingDeclaration,
  type PreparedCustomWgslMaterial,
  type RuntimeBufferPacket,
} from "@aperture-engine/render";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import type { CustomWgslMaterialGpuResource } from "../materials/custom-wgsl/custom-wgsl-material.js";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";
import {
  createBufferBackedInstanceAttributeResource,
  type InstanceAttributeGpuBufferResource,
} from "../resources/attributes/instance-attribute-buffer.js";

// A2 (three.js parity plan): realize renderer-independent `BufferAsset`
// sources as read-only storage-buffer bindings for custom WGSL materials.
// GPU buffers are cached per handle id + source version (mirroring the
// texture/sampler resource caches); keyed `RuntimeBuffer` packets stream
// element updates through `queue.writeBuffer` on the cached buffer with zero
// pipeline rebuilds (DECISIONS.md 0022 — only the binding kind participates
// in the pipeline key).

export interface CustomWgslAppStorageBufferResource {
  readonly cacheKey: string;
  readonly buffer: unknown;
  readonly byteLength: number;
  readonly elementType: BufferAsset["elementType"];
  readonly elementCount: number;
  /** Last-applied runtime packet value key per runtimeBufferKey. */
  readonly appliedRuntimeValueKeys: Map<string, string>;
}

export interface CustomWgslAppStorageBufferReuseCounters {
  storageBufferResourcesCreated: number;
  storageBufferResourcesReused: number;
  dynamicBufferWrites: number;
}

export interface CustomWgslAppStorageBufferBindingDiagnostic {
  readonly code:
    | "customWgslAppFrameResources.storageBufferMissingHandle"
    | "customWgslAppFrameResources.storageBufferSourceNotReady"
    | "customWgslAppFrameResources.storageBufferSizeMismatch"
    | "customWgslAppFrameResources.storageBufferInvalidAsset"
    | "customWgslAppFrameResources.storageBufferCreationFailed"
    | "customWgslAppFrameResources.runtimeBufferInvalidValues"
    | "customWgslAppFrameResources.runtimeBufferOutOfRange"
    | "customWgslAppFrameResources.runtimeBufferWriteFailed"
    | "webGpuApp.customWgslBindingNotPrepared";
  readonly message: string;
  readonly severity: "error";
  readonly binding: number;
  readonly resourceKey?: string;
  readonly bufferKey?: string;
  readonly runtimeBufferKey?: string;
  readonly status?: string;
}

export interface CustomWgslAppStorageBufferBindingResources {
  readonly valid: boolean;
  readonly resources: readonly CustomWgslMaterialGpuResource[];
  readonly bufferKeys: readonly string[];
  readonly diagnostics: readonly CustomWgslAppStorageBufferBindingDiagnostic[];
}

interface StorageBufferWriteQueueLike {
  readonly queue?: {
    writeBuffer?: (
      buffer: unknown,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ) => void;
  };
}

export function prepareCustomWgslAppStorageBufferBindingResources(options: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: Map<string, CustomWgslAppStorageBufferResource>;
  readonly reuse: CustomWgslAppStorageBufferReuseCounters;
  readonly source: CustomWgslMaterialAsset;
  readonly material: PreparedCustomWgslMaterial;
  readonly runtimeBuffers?: readonly RuntimeBufferPacket[];
}): CustomWgslAppStorageBufferBindingResources {
  const diagnostics: CustomWgslAppStorageBufferBindingDiagnostic[] = [];
  const resources: CustomWgslMaterialGpuResource[] = [];
  const bufferKeys: string[] = [];
  const runtimeBuffers = new Map(
    (options.runtimeBuffers ?? []).map((packet) => [packet.key, packet]),
  );
  const storageBindings = options.source.bindings.filter(
    (binding): binding is CustomWgslStorageBindingDeclaration =>
      binding.kind === "storage-buffer",
  );

  for (const binding of storageBindings) {
    const resourceKey = preparedBindingResourceKey(
      options.material,
      binding.binding,
      diagnostics,
    );

    if (resourceKey === null) {
      continue;
    }

    if (binding.buffer === undefined) {
      diagnostics.push({
        code: "customWgslAppFrameResources.storageBufferMissingHandle",
        severity: "error",
        binding: binding.binding,
        resourceKey,
        message: `Custom WGSL storage binding ${String(binding.binding)} ('${binding.name}') does not declare a buffer asset handle. Register a BufferAsset (this.buffers.register(...)) and pass it to material.storage(...).`,
      });
      continue;
    }

    const resource = getOrCreateStorageBufferResource({
      assets: options.assets,
      device: options.device,
      cache: options.cache,
      reuse: options.reuse,
      binding,
      handle: binding.buffer,
      resourceKey,
      diagnostics,
    });

    if (resource === null) {
      continue;
    }

    applyRuntimeBufferPacket({
      device: options.device,
      binding,
      resource,
      resourceKey,
      runtimeBuffers,
      reuse: options.reuse,
      diagnostics,
    });

    resources.push({ resourceKey, resource: { buffer: resource.buffer } });
    bufferKeys.push(resource.cacheKey);
  }

  return {
    valid:
      diagnostics.length === 0 && resources.length === storageBindings.length,
    resources,
    bufferKeys,
    diagnostics,
  };
}

function getOrCreateStorageBufferResource(input: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: Map<string, CustomWgslAppStorageBufferResource>;
  readonly reuse: CustomWgslAppStorageBufferReuseCounters;
  readonly binding: CustomWgslStorageBindingDeclaration;
  readonly handle: BufferHandle;
  readonly resourceKey: string;
  readonly diagnostics: CustomWgslAppStorageBufferBindingDiagnostic[];
}): CustomWgslAppStorageBufferResource | null {
  const bufferKey = assetHandleKey(input.handle);
  const entry = input.assets.get<"buffer", BufferAsset>(input.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    input.diagnostics.push({
      code: "customWgslAppFrameResources.storageBufferSourceNotReady",
      severity: "error",
      binding: input.binding.binding,
      resourceKey: input.resourceKey,
      bufferKey,
      status: entry?.status ?? "missing",
      message: `Buffer source asset '${bufferKey}' is '${entry?.status ?? "missing"}', not ready for custom WGSL storage binding ${String(input.binding.binding)}.`,
    });
    return null;
  }

  const asset = entry.asset;
  const cacheKey = sourceAssetCacheKey(input.handle, entry.version);
  const cached = input.cache.get(cacheKey);

  if (cached !== undefined) {
    input.reuse.storageBufferResourcesReused += 1;
    return cached;
  }

  const validation = validateBufferAsset(asset);

  if (!validation.valid) {
    const sizeMismatch = validation.diagnostics.some(
      (diagnostic) => diagnostic.code === "bufferAsset.dataLengthMismatch",
    );

    input.diagnostics.push({
      code: sizeMismatch
        ? "customWgslAppFrameResources.storageBufferSizeMismatch"
        : "customWgslAppFrameResources.storageBufferInvalidAsset",
      severity: "error",
      binding: input.binding.binding,
      resourceKey: input.resourceKey,
      bufferKey,
      message: `Buffer source asset '${bufferKey}' is invalid for custom WGSL storage binding ${String(input.binding.binding)}: ${validation.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
    });
    return null;
  }

  const byteLength = bufferAssetByteLength(asset);
  const initialData = packStorageBufferInitialData(asset);
  const created = createWebGpuBuffer({
    device: input.device as Parameters<typeof createWebGpuBuffer>[0]["device"],
    descriptor: {
      label: `custom-wgsl-storage:${bufferKey}`,
      size: byteLength,
      usage: appBufferAssetGpuUsage(asset),
      ...(initialData === null ? {} : { initialData }),
    },
  });

  if (!created.ok) {
    input.diagnostics.push({
      code: "customWgslAppFrameResources.storageBufferCreationFailed",
      severity: "error",
      binding: input.binding.binding,
      resourceKey: input.resourceKey,
      bufferKey,
      message: created.message,
    });
    return null;
  }

  const resource: CustomWgslAppStorageBufferResource = {
    cacheKey,
    buffer: created.buffer,
    byteLength,
    elementType: asset.elementType,
    elementCount: asset.elementCount,
    appliedRuntimeValueKeys: new Map(),
  };

  input.cache.set(cacheKey, resource);
  input.reuse.storageBufferResourcesCreated += 1;
  return resource;
}

// C1/C2: GPU usage flags for a realized BufferAsset. A read-only buffer keeps
// its pre-C1 `STORAGE | COPY_DST` flags byte-for-byte. A writable (`usage:
// "storage"`) buffer additionally gains `VERTEX` (buffer-backed instance
// stream), `COPY_SRC` (motion readback / e2e), `INDIRECT` (C2 — the same GPU
// buffer can back an `ctx.drawIndirect(...)` argument region a compute pass
// wrote), and stays `COPY_DST` — one GPU buffer serves the compute writer, the
// read-only storage binding, the instance-attribute vertex stream, and the
// indirect-draw argument source with zero CPU copies. INDIRECT is unconditional
// on writable buffers: it is cheap, and GPU-driven rendering is exactly what
// writable buffers exist for.
function appBufferAssetGpuUsage(asset: Pick<BufferAsset, "usage">): number {
  const flags = (
    globalThis as {
      GPUBufferUsage?: {
        STORAGE: number;
        COPY_DST: number;
        COPY_SRC: number;
        VERTEX: number;
        INDIRECT: number;
      };
    }
  ).GPUBufferUsage ?? {
    STORAGE: 0x80,
    COPY_DST: 0x08,
    COPY_SRC: 0x04,
    VERTEX: 0x20,
    INDIRECT: 0x100,
  };

  if (bufferAssetUsageIsWritable(asset.usage)) {
    return (
      flags.STORAGE |
      flags.VERTEX |
      flags.COPY_DST |
      flags.COPY_SRC |
      flags.INDIRECT
    );
  }

  return flags.STORAGE | flags.COPY_DST;
}

/**
 * C1: resolve (get-or-create) the ONE realized GPU buffer for a BufferAsset
 * handle from the shared `customWgslStorageBuffers` cache. This is the
 * zero-copy sharing point: a `material.storage(...)` binding, a buffer-backed
 * instance stream, and an `app.addComputePass(...)` buffer resolver all call
 * this with the SAME handle@version, so they bind the identical GPUBuffer. The
 * first caller in a frame realizes it (with writable usage flags when the asset
 * opts in); the rest reuse. Returns `null` when the asset is missing/not-ready/
 * invalid — callers surface their own diagnostic.
 */
export function resolveAppBufferAssetResource(input: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: Map<string, CustomWgslAppStorageBufferResource>;
  readonly reuse: CustomWgslAppStorageBufferReuseCounters;
  readonly handle: BufferHandle;
}): CustomWgslAppStorageBufferResource | null {
  const entry = input.assets.get<"buffer", BufferAsset>(input.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    return null;
  }

  const cacheKey = sourceAssetCacheKey(input.handle, entry.version);
  const cached = input.cache.get(cacheKey);

  if (cached !== undefined) {
    input.reuse.storageBufferResourcesReused += 1;
    return cached;
  }

  const asset = entry.asset;

  if (!validateBufferAsset(asset).valid) {
    return null;
  }

  const byteLength = bufferAssetByteLength(asset);
  const initialData = packStorageBufferInitialData(asset);
  const created = createWebGpuBuffer({
    device: input.device as Parameters<typeof createWebGpuBuffer>[0]["device"],
    descriptor: {
      label: `app-buffer-asset:${assetHandleKey(input.handle)}`,
      size: byteLength,
      usage: appBufferAssetGpuUsage(asset),
      ...(initialData === null ? {} : { initialData }),
    },
  });

  if (!created.ok) {
    return null;
  }

  const resource: CustomWgslAppStorageBufferResource = {
    cacheKey,
    buffer: created.buffer,
    byteLength,
    elementType: asset.elementType,
    elementCount: asset.elementCount,
    appliedRuntimeValueKeys: new Map(),
  };

  input.cache.set(cacheKey, resource);
  input.reuse.storageBufferResourcesCreated += 1;
  return resource;
}

/**
 * C1: resolve a realized BufferAsset GPU buffer by its registered string id
 * (the graph-handle convention shared by `app.addComputePass` write handles and
 * the scene node's buffer reads). Used by the compute-pass `ctx.buffer(id)`
 * resolver.
 */
export function resolveAppBufferAssetResourceById(input: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: Map<string, CustomWgslAppStorageBufferResource>;
  readonly reuse: CustomWgslAppStorageBufferReuseCounters;
  readonly bufferId: string;
}): CustomWgslAppStorageBufferResource | null {
  return resolveAppBufferAssetResource({
    assets: input.assets,
    device: input.device,
    cache: input.cache,
    reuse: input.reuse,
    handle: createBufferHandle(input.bufferId),
  });
}

export interface CustomWgslWritableBufferStreamResult {
  /**
   * Registered ids of WRITABLE (`usage: "storage"`) BufferAssets this material
   * consumes — the scene node reads them for compute-before-draw ordering.
   */
  readonly writableBufferIds: readonly string[];
  /**
   * The buffer-backed instance-attribute stream (slot 1) realized zero-copy, or
   * null when the material declared no `instanceBuffer`.
   */
  readonly instanceAttributeResource: InstanceAttributeGpuBufferResource | null;
  readonly diagnostics: readonly unknown[];
}

/**
 * C1 (compute→draw plumbing): collect the WRITABLE (`usage: "storage"`)
 * BufferAsset ids a custom material consumes — from `material.storage(...)`
 * bindings and/or a buffer-backed instance stream — so the scene node can read
 * them (writer-before-reader ordering onto the compute pass that writes them),
 * and realize the buffer-backed instance stream (slot 1) as a ZERO-COPY vertex
 * buffer sharing the exact GPUBuffer the storage cache holds. Read-only buffers
 * (A2 grass) are never listed, so their frames stay byte-identical.
 *
 * Shared by the single-custom and mixed custom/built-in forward routes.
 */
export function prepareCustomWgslWritableBufferStream(options: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: Map<string, CustomWgslAppStorageBufferResource>;
  readonly reuse: CustomWgslAppStorageBufferReuseCounters;
  readonly material: CustomWgslMaterialAsset;
  readonly prepared: PreparedCustomWgslMaterial;
  readonly renderId: number;
}): CustomWgslWritableBufferStreamResult {
  const writableBufferIds: string[] = [];
  const diagnostics: unknown[] = [];

  const addWritable = (handle: BufferHandle | undefined): void => {
    if (handle === undefined) {
      return;
    }
    const entry = options.assets.get<"buffer", BufferAsset>(handle);
    if (
      entry?.status === "ready" &&
      entry.asset !== null &&
      bufferAssetUsageIsWritable(entry.asset.usage) &&
      !writableBufferIds.includes(handle.id)
    ) {
      writableBufferIds.push(handle.id);
    }
  };

  for (const binding of options.material.bindings) {
    if (binding.kind === "storage-buffer") {
      addWritable(binding.buffer);
    }
  }

  const instanceBuffer = options.prepared.pipeline.instanceBuffer;
  const layout = options.prepared.pipeline.instanceAttributes;
  let instanceAttributeResource: InstanceAttributeGpuBufferResource | null =
    null;

  if (instanceBuffer !== undefined && layout !== null) {
    addWritable(instanceBuffer.buffer);
    const entry = options.assets.get<"buffer", BufferAsset>(
      instanceBuffer.buffer,
    );
    const resolved = resolveAppBufferAssetResource({
      assets: options.assets,
      device: options.device,
      cache: options.cache,
      reuse: options.reuse,
      handle: instanceBuffer.buffer,
    });

    if (resolved === null || entry === undefined) {
      diagnostics.push({
        code: "webGpuApp.instanceBufferSourceNotReady",
        message: `Buffer-backed instance stream for custom material '${options.prepared.sourceMaterialKey}' could not resolve its BufferAsset '${instanceBuffer.buffer.id}'.`,
        renderId: options.renderId,
      });
    } else if (resolved.byteLength % layout.stride !== 0) {
      diagnostics.push({
        code: "webGpuApp.instanceBufferLayoutMismatch",
        message: `Buffer-backed instance stream '${instanceBuffer.buffer.id}' byte length ${String(resolved.byteLength)} is not a multiple of the declared instance stride ${String(layout.stride)} (attributes packed stride). Match the buffer element type to the instance attributes.`,
        renderId: options.renderId,
      });
    } else {
      instanceAttributeResource = createBufferBackedInstanceAttributeResource({
        resourceKey: `instance-buffer:${sourceAssetCacheKey(
          instanceBuffer.buffer,
          entry.version,
        )}`,
        buffer: resolved.buffer,
        layout,
        instanceCount: resolved.byteLength / layout.stride,
      });
    }
  }

  return { writableBufferIds, instanceAttributeResource, diagnostics };
}

/**
 * Pack CPU-side element data into the GPU byte layout. For every supported
 * element type (f32/vec2f/vec4f/u32/i32) the std430 array stride equals the
 * tightly-packed CPU stride, so the typed array uploads as-is; vec3f — whose
 * stride would differ — is rejected by validateBufferAsset before this point.
 */
function packStorageBufferInitialData(
  asset: BufferAsset,
): ArrayBufferView | null {
  return asset.data === undefined || asset.data.byteLength === 0
    ? null
    : asset.data;
}

function applyRuntimeBufferPacket(input: {
  readonly device: unknown;
  readonly binding: CustomWgslStorageBindingDeclaration;
  readonly resource: CustomWgslAppStorageBufferResource;
  readonly resourceKey: string;
  readonly runtimeBuffers: ReadonlyMap<string, RuntimeBufferPacket>;
  readonly reuse: CustomWgslAppStorageBufferReuseCounters;
  readonly diagnostics: CustomWgslAppStorageBufferBindingDiagnostic[];
}): void {
  const runtimeBufferKey = input.binding.runtimeBufferKey;

  if (runtimeBufferKey === undefined) {
    return;
  }

  // A missing packet is not an error: the buffer keeps its source-asset
  // contents until a runtime-buffer entity with this key is spawned
  // (spawn.runtimeBuffer). This intentionally differs from runtimeUniformKey,
  // where the binding has no other value source.
  const packet = input.runtimeBuffers.get(runtimeBufferKey);

  if (packet === undefined) {
    return;
  }

  const componentCount = bufferElementComponentCount(
    input.resource.elementType,
  );
  const byteStride = bufferElementByteStride(input.resource.elementType);

  if (
    packet.values.length === 0 ||
    packet.values.length % componentCount !== 0 ||
    packet.values.some(
      (value) => typeof value !== "number" || !Number.isFinite(value),
    )
  ) {
    input.diagnostics.push({
      code: "customWgslAppFrameResources.runtimeBufferInvalidValues",
      severity: "error",
      binding: input.binding.binding,
      resourceKey: input.resourceKey,
      runtimeBufferKey,
      message: `Runtime buffer '${runtimeBufferKey}' values must be a non-empty array of finite numbers with a multiple of ${String(componentCount)} components for elementType '${input.resource.elementType}'.`,
    });
    return;
  }

  const elementCount = packet.values.length / componentCount;

  if (
    !Number.isInteger(packet.elementOffset) ||
    packet.elementOffset < 0 ||
    packet.elementOffset + elementCount > input.resource.elementCount
  ) {
    input.diagnostics.push({
      code: "customWgslAppFrameResources.runtimeBufferOutOfRange",
      severity: "error",
      binding: input.binding.binding,
      resourceKey: input.resourceKey,
      runtimeBufferKey,
      message: `Runtime buffer '${runtimeBufferKey}' writes elements [${String(packet.elementOffset)}, ${String(packet.elementOffset + elementCount)}) outside buffer capacity ${String(input.resource.elementCount)}.`,
    });
    return;
  }

  const valueKey = runtimeBufferValueKey(packet);

  if (
    input.resource.appliedRuntimeValueKeys.get(runtimeBufferKey) === valueKey
  ) {
    return;
  }

  const data = encodeRuntimeBufferValues(
    input.resource.elementType,
    packet.values,
  );
  const queue = (input.device as StorageBufferWriteQueueLike).queue;

  if (queue?.writeBuffer === undefined) {
    input.diagnostics.push({
      code: "customWgslAppFrameResources.runtimeBufferWriteFailed",
      severity: "error",
      binding: input.binding.binding,
      resourceKey: input.resourceKey,
      runtimeBufferKey,
      message: `WebGPU device cannot write runtime buffer '${runtimeBufferKey}' (queue.writeBuffer unavailable).`,
    });
    return;
  }

  queue.writeBuffer(
    input.resource.buffer,
    packet.elementOffset * byteStride,
    data.buffer,
    data.byteOffset,
    data.byteLength,
  );
  input.resource.appliedRuntimeValueKeys.set(runtimeBufferKey, valueKey);
  input.reuse.dynamicBufferWrites += 1;
}

function encodeRuntimeBufferValues(
  elementType: BufferAsset["elementType"],
  values: readonly number[],
): Float32Array | Uint32Array | Int32Array {
  switch (elementType) {
    case "u32":
      return Uint32Array.from(values);
    case "i32":
      return Int32Array.from(values);
    default:
      return Float32Array.from(values);
  }
}

// FNV-1a over the packet payload: cheap change detection so unchanged packets
// skip queue.writeBuffer entirely (mirrors the runtime-uniform valueKey).
function runtimeBufferValueKey(packet: RuntimeBufferPacket): string {
  let hash = 0x811c9dc5;
  const mix = (value: number): void => {
    hash ^= value & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (value >>> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (value >>> 16) & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (value >>> 24) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  };
  const view = new DataView(new ArrayBuffer(8));

  for (const value of packet.values) {
    view.setFloat64(0, value, true);
    mix(view.getUint32(0, true));
    mix(view.getUint32(4, true));
  }

  return `${String(packet.elementOffset)}:${String(packet.values.length)}:${(hash >>> 0).toString(16)}`;
}

function preparedBindingResourceKey(
  material: PreparedCustomWgslMaterial,
  binding: number,
  diagnostics: CustomWgslAppStorageBufferBindingDiagnostic[],
): string | null {
  const entry = material.bindGroup.entries.find(
    (candidate) => candidate.binding === binding,
  );

  if (entry === undefined) {
    diagnostics.push({
      code: "webGpuApp.customWgslBindingNotPrepared",
      severity: "error",
      binding,
      message: `Custom WGSL binding ${String(binding)} was not present in the prepared material bind group.`,
    });
    return null;
  }

  return entry.resourceKey;
}
