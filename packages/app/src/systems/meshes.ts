import type { MeshAsset } from "@aperture-engine/render";
import { primitiveToMeshAsset } from "./spawn/assets.js";
import type { PrimitiveMeshDescriptor } from "./spawn/types.js";
import {
  assetHandleKey,
  createMeshHandle,
  type AssetDiagnostic,
  type AssetRegistry,
  type MeshHandle,
} from "@aperture-engine/simulation";

/**
 * Either a raw mesh asset or any primitive descriptor (`mesh.box(...)`,
 * `mesh.triangleList(...)`, `mesh.merge(...)`), which is built on publish.
 */
export type MeshSource = MeshAsset | PrimitiveMeshDescriptor;

export interface DynamicMeshOptions {
  readonly label?: string;
  readonly initial?: MeshSource;
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

export interface DynamicMesh {
  readonly handle: MeshHandle;
  readonly key: string;
  get(): MeshAsset | undefined;
  /** Replace the geometry (e.g. every frame for a waving flag or water). */
  publish(mesh: MeshSource, options?: MeshPublishOptions): MeshPublishResult;
}

export interface MeshAccess {
  /**
   * Register (or replace) a named, shareable mesh and return its handle —
   * build a geometry once and pass the handle as `spawn.mesh({ mesh })` for
   * every instance, like reusing one three.js BufferGeometry.
   */
  create(id: string | MeshHandle, mesh: MeshSource): MeshHandle;
  dynamic(id: string | MeshHandle, options?: DynamicMeshOptions): DynamicMesh;
  get(handle: MeshHandle): MeshAsset | undefined;
  publish(
    id: string | MeshHandle,
    mesh: MeshSource,
    options?: MeshPublishOptions,
  ): MeshPublishResult;
}

export function createMeshAccess(registry: AssetRegistry): MeshAccess {
  const access: MeshAccess = {
    create(id, mesh) {
      return access.publish(id, mesh).handle;
    },
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
      };
    },
    get(handle) {
      return registry.get<"mesh", MeshAsset>(handle)?.asset ?? undefined;
    },
    publish(id, source, options = {}) {
      const handle = meshHandleFrom(id);
      const mesh = meshAssetFrom(source);
      ensureRegistered(registry, handle, options.label ?? mesh.label);
      return publishMesh(registry, handle, mesh, options);
    },
  };

  return access;
}

function meshAssetFrom(source: MeshSource): MeshAsset {
  return source.kind === "mesh" ? source : primitiveToMeshAsset(source);
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
  source: MeshSource,
  options: MeshPublishOptions,
): MeshPublishResult {
  const mesh = meshAssetFrom(source);
  const entry = registry.markReady(handle, mesh, options.diagnostics ?? []);

  return {
    handle,
    key: assetHandleKey(handle),
    version: entry.version,
  };
}
