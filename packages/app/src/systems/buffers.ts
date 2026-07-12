import {
  createBufferAsset,
  validateBufferAsset,
  type BufferAsset,
  type BufferAssetData,
  type BufferElementType,
} from "@aperture-engine/render";
import {
  createBufferHandle,
  type AssetRegistry,
  type BufferHandle,
} from "@aperture-engine/simulation";
import { ApertureSystemError } from "./errors.js";

// A2 (three.js parity plan): procedural buffer source assets authored by
// worker systems. `this.buffers.register(...)` mirrors `this.prefabs.register`
// and `this.meshes.publish`: it validates and registers a renderer-independent
// `BufferAsset` in the asset registry so `material.storage(...)` bindings can
// reference the handle. Re-registering the same id publishes a new version
// (full re-upload); per-frame dynamic ranges go through
// `this.spawn.runtimeBuffer(...)` instead.

export interface BufferRegisterOptions {
  /** Stable handle id (also the mirror key across the worker boundary). */
  readonly id: string;
  readonly elementType: BufferElementType;
  readonly elementCount: number;
  /** Optional initial contents; absent data zero-initializes the GPU buffer. */
  readonly data?: BufferAssetData;
  readonly label?: string;
}

export interface BufferAccess {
  /** Validate and register (or republish) a procedural buffer source asset. */
  register(options: BufferRegisterOptions): BufferHandle;
  /** Read the current source asset for a registered buffer handle. */
  get(handle: BufferHandle | string): BufferAsset | undefined;
}

export function createBufferAccess(registry: AssetRegistry): BufferAccess {
  return {
    register(options) {
      const handle = createBufferHandle(options.id);
      const asset = createBufferAsset({
        label: options.label ?? options.id,
        elementType: options.elementType,
        elementCount: options.elementCount,
        ...(options.data === undefined ? {} : { data: options.data }),
      });
      const report = validateBufferAsset(asset);

      if (!report.valid) {
        throw new ApertureSystemError(
          "aperture.buffers.invalidAsset",
          `Buffer asset '${options.id}' is invalid: ${report.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join(" ")}`,
          "Check the elementType (vec3f is rejected; use vec4f), the positive elementCount, and that data length matches elementCount x components.",
        );
      }

      if (!registry.has(handle)) {
        registry.register(handle, { label: asset.label });
      }

      registry.markReady(handle, asset);
      return handle;
    },
    get(handleOrId) {
      const handle =
        typeof handleOrId === "string"
          ? createBufferHandle(handleOrId)
          : handleOrId;
      const entry = registry.get<"buffer", BufferAsset>(handle);

      return entry?.status === "ready" && entry.asset !== null
        ? entry.asset
        : undefined;
    },
  };
}
