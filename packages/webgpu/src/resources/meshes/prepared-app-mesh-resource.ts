import { assetHandleKey, type MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset } from "@aperture-engine/render";
import {
  prepareMeshGpuResource,
  type PreparedMeshGpuResource,
  type PreparedMeshGpuResourceCache,
  type PreparedMeshGpuResourceCacheStatus,
} from "./prepared-mesh-cache.js";

export type { PreparedMeshGpuResourceCache } from "./prepared-mesh-cache.js";

export interface PreparedAppMeshResourceUse {
  readonly status: Extract<
    PreparedMeshGpuResourceCacheStatus,
    "created" | "reused"
  >;
  readonly resource: PreparedMeshGpuResource;
}

export interface PrepareAppMeshResourceOptions {
  readonly device: unknown;
  readonly mesh: MeshAsset | null;
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly frame?: number | undefined;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
}

export function prepareAppMeshResource(
  options: PrepareAppMeshResourceOptions,
): PreparedAppMeshResourceUse | null {
  if (options.mesh === null) {
    return null;
  }

  const sourceVersion = sourceVersionFromAssetKey(
    options.meshKey,
    assetHandleKey(options.meshHandle),
  );

  if (sourceVersion === null) {
    return null;
  }

  const result = prepareMeshGpuResource({
    device: options.device as Parameters<
      typeof prepareMeshGpuResource
    >[0]["device"],
    cache: options.preparedMeshes,
    handle: options.meshHandle,
    mesh: options.mesh,
    sourceVersion,
    frame: options.frame,
  });

  return result.valid &&
    result.resource !== null &&
    (result.status === "created" || result.status === "reused")
    ? { status: result.status, resource: result.resource }
    : null;
}

function sourceVersionFromAssetKey(
  assetKey: string,
  sourceAssetKey: string,
): number | null {
  const prefix = `${sourceAssetKey}@`;

  if (!assetKey.startsWith(prefix)) {
    return null;
  }

  const version = Number.parseInt(assetKey.slice(prefix.length), 10);

  return Number.isFinite(version) ? version : null;
}
