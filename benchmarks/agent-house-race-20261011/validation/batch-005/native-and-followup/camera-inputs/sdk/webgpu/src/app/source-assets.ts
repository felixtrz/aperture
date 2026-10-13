import type { AssetRegistry } from "@aperture-engine/simulation";
import {
  prepareSnapshotMaterials,
  prepareSnapshotMeshes,
  preparedMaterialStoreSummaryToJsonValue,
  preparedMeshStoreSummaryToJsonValue,
  type PreparedMaterialStore,
  type PreparedMeshStore,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { PreparedBuiltInMaterialStore } from "../materials/core/prepared-built-in-material-store.js";
import type { PreparedMeshGpuResourceCache } from "../resources/meshes/prepared-mesh-cache.js";
import type { AppTextureSamplerResourceCache } from "./app-texture-sampler-resources.js";
import {
  writeWebGpuAppPreparedMaterialCacheSummary,
  writeWebGpuAppPreparedMeshCacheSummary,
  writeWebGpuAppTextureSamplerCacheSummary,
} from "./report.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";

export interface WebGpuAppSourceAssetFacadeCache extends AppTextureSamplerResourceCache {
  readonly preparedMeshFacade: PreparedMeshStore;
  readonly preparedMaterialFacade: PreparedMaterialStore;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
}

export function prepareWebGpuAppSourceAssetFacades(options: {
  readonly registry: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly cache: WebGpuAppSourceAssetFacadeCache;
  readonly pruneUnreferenced?: boolean;
  readonly resourceReuse?: WebGpuAppResourceReuseReport;
}): void {
  prepareSnapshotMeshes({
    registry: options.registry,
    snapshot: options.snapshot,
    meshes: options.cache.preparedMeshFacade,
    ...(options.pruneUnreferenced === undefined
      ? {}
      : { pruneUnreferenced: options.pruneUnreferenced }),
  });

  if (options.resourceReuse !== undefined) {
    options.resourceReuse.preparedMeshFacade =
      preparedMeshStoreSummaryToJsonValue(options.cache.preparedMeshFacade);
    writeWebGpuAppPreparedMeshCacheSummary(
      options.resourceReuse.preparedMeshCache,
      options.cache,
    );
  }

  prepareSnapshotMaterials({
    registry: options.registry,
    snapshot: options.snapshot,
    materials: options.cache.preparedMaterialFacade,
    ...(options.pruneUnreferenced === undefined
      ? {}
      : { pruneUnreferenced: options.pruneUnreferenced }),
  });

  if (options.resourceReuse !== undefined) {
    options.resourceReuse.preparedMaterialFacade =
      preparedMaterialStoreSummaryToJsonValue(
        options.cache.preparedMaterialFacade,
      );
    writeWebGpuAppPreparedMaterialCacheSummary(
      options.resourceReuse.preparedMaterialCache,
      options.cache,
    );
    writeWebGpuAppTextureSamplerCacheSummary(
      options.resourceReuse.textureSamplerCache,
      options.cache,
    );
  }
}
