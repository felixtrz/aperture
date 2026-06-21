import { prepareSnapshotMaterials, prepareSnapshotMeshes, preparedMaterialStoreSummaryToJsonValue, preparedMeshStoreSummaryToJsonValue, } from "@aperture-engine/render";
import { writeWebGpuAppPreparedMaterialCacheSummary, writeWebGpuAppPreparedMeshCacheSummary, writeWebGpuAppTextureSamplerCacheSummary, } from "./report.js";
export function prepareWebGpuAppSourceAssetFacades(options) {
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
        writeWebGpuAppPreparedMeshCacheSummary(options.resourceReuse.preparedMeshCache, options.cache);
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
            preparedMaterialStoreSummaryToJsonValue(options.cache.preparedMaterialFacade);
        writeWebGpuAppPreparedMaterialCacheSummary(options.resourceReuse.preparedMaterialCache, options.cache);
        writeWebGpuAppTextureSamplerCacheSummary(options.resourceReuse.textureSamplerCache, options.cache);
    }
}
//# sourceMappingURL=source-assets.js.map