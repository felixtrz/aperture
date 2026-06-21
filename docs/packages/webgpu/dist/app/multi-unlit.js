import { assetHandleKey, } from "@aperture-engine/simulation";
import { createMultiMaterialUnlitFrameGpuResources, } from "../materials/unlit/unlit-frame-resources.js";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";
export function createMultiUnlitAppFrameResources(options) {
    const result = createMultiMaterialUnlitFrameGpuResources({
        device: options.app.initialization.device,
        mesh: options.mesh,
        materials: options.materials,
        viewUniforms: options.viewUniforms,
        worldTransforms: options.worldTransforms,
        layouts: options.layouts.sharedLayouts,
    });
    if (result.valid && result.resources !== null) {
        options.reuse.meshBuffersCreated += 1;
        options.reuse.materialBuffersCreated += result.resources.materials.length;
        options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    }
    return result;
}
export function collectMultiUnlitAppResourceSet(options) {
    if (options.plan.sets.length <= 1) {
        return null;
    }
    const meshKey = options.plan.sets[0]?.meshKey;
    const pipelineKey = options.firstDraw.batchKey.pipelineKey;
    const materials = [];
    const materialKeys = [];
    if (meshKey === undefined) {
        return null;
    }
    for (const set of options.plan.sets) {
        if (set.meshKey !== meshKey) {
            return null;
        }
        const firstDrawIndex = set.drawIndices[0];
        const draw = firstDrawIndex === undefined
            ? undefined
            : options.snapshot.meshDraws[firstDrawIndex];
        if (draw === undefined || draw.batchKey.pipelineKey !== pipelineKey) {
            return null;
        }
        const entry = options.assets.get(draw.material);
        if (entry === undefined ||
            entry.status !== "ready" ||
            entry.asset === null ||
            entry.asset.kind !== "unlit" ||
            entry.asset.baseColorTexture !== null) {
            return null;
        }
        materials.push(entry.asset);
        materialKeys.push(assetHandleKey(draw.material));
    }
    const meshEntry = options.assets.get(options.firstDraw.mesh);
    if (meshEntry === undefined ||
        meshEntry.status !== "ready" ||
        meshEntry.asset === null) {
        return null;
    }
    return {
        mesh: meshEntry.asset,
        meshKey: sourceAssetCacheKey(options.firstDraw.mesh, meshEntry.version),
        materials,
        materialKeys,
    };
}
//# sourceMappingURL=multi-unlit.js.map