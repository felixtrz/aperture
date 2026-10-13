import { assetHandleKey, } from "@aperture-engine/simulation";
import { prepareSnapshotMeshes, } from "./snapshot-prepared-meshes.js";
export function prepareAndBindSnapshotMeshesToRenderWorld(options) {
    const apply = options.renderWorld.applySnapshot(options.snapshot);
    const preparation = prepareSnapshotMeshes({
        registry: options.registry,
        snapshot: options.snapshot,
        meshes: options.meshes,
    });
    const binding = bindPreparedMeshResourcesToRenderWorld({
        renderWorld: options.renderWorld,
        meshes: options.meshes,
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
export function bindPreparedMeshResourcesToRenderWorld(options) {
    const diagnostics = [];
    let updated = 0;
    let missing = 0;
    for (const object of options.renderWorld.listObjects()) {
        const meshKey = assetHandleKey(object.packet.mesh);
        const prepared = options.meshes.get(object.packet.mesh);
        if (prepared === undefined) {
            missing += 1;
            if (object.gpu.meshResourceKey !== null) {
                const clearResult = options.renderWorld.updateResourceBindings(object.renderId, { meshResourceKey: null });
                if (!clearResult.ok) {
                    diagnostics.push(...clearResult.diagnostics);
                }
            }
            diagnostics.push({
                code: "renderWorld.missingPreparedMeshResource",
                message: `Render object ${object.renderId} has no prepared mesh resource for '${meshKey}'.`,
                severity: "warning",
                entity: object.packet.entity,
                assetKey: meshKey,
            });
            continue;
        }
        const meshResourceKey = prepared.prepared.meshResourceKey;
        if (object.gpu.meshResourceKey === meshResourceKey) {
            continue;
        }
        const updateResult = options.renderWorld.updateResourceBindings(object.renderId, { meshResourceKey });
        if (updateResult.ok) {
            updated += 1;
        }
        else {
            diagnostics.push(...updateResult.diagnostics);
        }
    }
    return { updated, missing, diagnostics };
}
//# sourceMappingURL=render-world-prepared-meshes.js.map