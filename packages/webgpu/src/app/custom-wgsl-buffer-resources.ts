import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  CustomWgslMaterialAsset,
  PreparedCustomWgslMaterial,
  SourceBufferAsset,
} from "@aperture-engine/render";
import type { CustomWgslMaterialGpuResource } from "../materials/custom-wgsl/custom-wgsl-material.js";

// The app cache owns these allocations through its scoped device. Source
// versions update data without reusing buffers from another app/device.
const caches = new WeakMap<
  object,
  Map<string, { version: number; buffer: GPUBuffer }>
>();
export function prepareCustomWgslBufferResources(options: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly cache: object;
  readonly source: CustomWgslMaterialAsset;
  readonly material: PreparedCustomWgslMaterial;
}): {
  readonly resources: readonly CustomWgslMaterialGpuResource[];
  readonly diagnostics: readonly unknown[];
} {
  let cache = caches.get(options.cache);
  if (cache === undefined) {
    cache = new Map();
    caches.set(options.cache, cache);
  }
  const device = options.device as GPUDevice;
  const resources: CustomWgslMaterialGpuResource[] = [],
    diagnostics: unknown[] = [];
  for (const binding of options.source.bindings) {
    if (binding.kind !== "storage-buffer" || binding.buffer === undefined)
      continue;
    try {
      const entry = options.assets.get<"buffer", SourceBufferAsset>(
        binding.buffer,
      );
      if (
        entry?.status !== "ready" ||
        entry.asset?.kind !== "buffer" ||
        !(entry.asset.data instanceof Uint8Array)
      )
        throw new Error("Expected ready source-buffer bytes.");
      const data = entry.asset.data,
        offset = binding.offset ?? 0,
        size = binding.size ?? data.byteLength - offset;
      if (
        !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(size) ||
        offset < 0 ||
        size <= 0 ||
        offset + size > data.byteLength ||
        offset % device.limits.minStorageBufferOffsetAlignment ||
        size % 4 ||
        size > device.limits.maxStorageBufferBindingSize ||
        data.byteLength > device.limits.maxBufferSize ||
        data.byteLength % 4
      )
        throw new Error(
          "Storage binding has invalid size, offset, or alignment for this device.",
        );
      const key = assetHandleKey(binding.buffer);
      let prepared = cache.get(key);
      if (prepared?.version !== entry.version) {
        const buffer = device.createBuffer({
          label: key,
          size: data.byteLength,
          usage: 0x80,
          mappedAtCreation: true,
        });
        new Uint8Array(buffer.getMappedRange()).set(data);
        buffer.unmap();
        prepared?.buffer.destroy();
        prepared = { version: entry.version, buffer };
        cache.set(key, prepared);
      }
      const resourceKey = options.material.bindGroup.entries.find(
        (entry) => entry.binding === binding.binding,
      )?.resourceKey;
      if (resourceKey === undefined)
        throw new Error(
          "Storage binding is missing from the prepared material.",
        );
      resources.push({
        resourceKey,
        resource: { buffer: prepared.buffer, offset, size },
      });
    } catch (error) {
      diagnostics.push({
        code: "webGpuApp.customWgslBufferInvalid",
        severity: "error",
        binding: binding.binding,
        message: `${binding.name}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  return { resources, diagnostics };
}
