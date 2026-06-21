import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { sourceAssetCacheKey } from "../../app/app-texture-sampler-resources.js";
export function indexQueuedSourceAssets(assets, snapshot, output) {
    output.meshAssets.clear();
    output.materialAssets.clear();
    for (const draw of snapshot.meshDraws) {
        const meshKey = assetHandleKey(draw.mesh);
        if (!output.meshAssets.has(meshKey)) {
            const meshEntry = assets.get(draw.mesh);
            if (meshEntry !== undefined &&
                meshEntry.status === "ready" &&
                meshEntry.asset !== null) {
                output.meshAssets.set(meshKey, {
                    asset: meshEntry.asset,
                    resourceKey: sourceAssetCacheKey(draw.mesh, meshEntry.version),
                });
            }
        }
        const materialKey = assetHandleKey(draw.material);
        if (output.materialAssets.has(materialKey)) {
            continue;
        }
        const materialEntry = assets.get(draw.material);
        const material = materialEntry?.asset ?? null;
        if (materialEntry === undefined ||
            materialEntry.status !== "ready" ||
            material === null) {
            continue;
        }
        output.materialAssets.set(materialKey, {
            asset: material,
            kind: material.kind,
            resourceKey: sourceAssetCacheKey(draw.material, materialEntry.version),
            sourceVersion: materialEntry.version,
        });
    }
}
//# sourceMappingURL=queued-source-assets.js.map