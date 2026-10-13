import type { MeshAsset } from "@aperture-engine/render";
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

export interface DynamicMesh {
  readonly handle: MeshHandle;
  readonly key: string;
  get(): MeshAsset | undefined;
  publish(mesh: MeshAsset, options?: MeshPublishOptions): MeshPublishResult;
}

export interface MeshAccess {
  dynamic(id: string | MeshHandle, options?: DynamicMeshOptions): DynamicMesh;
  get(handle: MeshHandle): MeshAsset | undefined;
  publish(
    id: string | MeshHandle,
    mesh: MeshAsset,
    options?: MeshPublishOptions,
  ): MeshPublishResult;
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
