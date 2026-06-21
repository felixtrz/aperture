import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { prepareSnapshotMaterials, } from "./snapshot-prepared-materials.js";
export function prepareAndBindSnapshotMaterialsToRenderWorld(options) {
    const apply = options.renderWorld.applySnapshot(options.snapshot);
    const preparation = prepareSnapshotMaterials({
        registry: options.registry,
        snapshot: options.snapshot,
        materials: options.materials,
    });
    const binding = bindPreparedMaterialResourcesToRenderWorld({
        renderWorld: options.renderWorld,
        materials: options.materials,
    });
    return {
        apply,
        preparation,
        binding,
        diagnostics: [
            ...apply.diagnostics,
            ...preparation.diagnostics,
            ...binding.diagnostics,
        ],
    };
}
export function bindPreparedMaterialResourcesToRenderWorld(options) {
    const diagnostics = [];
    let updated = 0;
    let missing = 0;
    for (const object of options.renderWorld.listObjects()) {
        const materialKey = assetHandleKey(object.packet.material);
        const prepared = options.materials.get(object.packet.material);
        if (prepared === undefined) {
            missing += 1;
            if (object.gpu.materialResourceKey !== null) {
                const clearResult = options.renderWorld.updateResourceBindings(object.renderId, { materialResourceKey: null });
                if (!clearResult.ok) {
                    diagnostics.push(...clearResult.diagnostics);
                }
            }
            diagnostics.push({
                code: "renderWorld.missingPreparedMaterialResource",
                message: `Render object ${object.renderId} has no prepared material resource for '${materialKey}'.`,
                severity: "warning",
                entity: object.packet.entity,
                assetKey: materialKey,
            });
            continue;
        }
        const materialResourceKey = prepared.prepared.materialResourceKey;
        if (object.gpu.materialResourceKey === materialResourceKey) {
            continue;
        }
        const updateResult = options.renderWorld.updateResourceBindings(object.renderId, { materialResourceKey });
        if (updateResult.ok) {
            updated += 1;
        }
        else {
            diagnostics.push(...updateResult.diagnostics);
        }
    }
    return { updated, missing, diagnostics };
}
//# sourceMappingURL=render-world-prepared-materials.js.map