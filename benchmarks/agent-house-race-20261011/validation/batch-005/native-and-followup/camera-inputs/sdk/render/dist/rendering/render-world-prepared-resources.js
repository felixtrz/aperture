import { bindPreparedMaterialResourcesToRenderWorld, } from "./render-world-prepared-materials.js";
import { bindPreparedMeshResourcesToRenderWorld, } from "./render-world-prepared-meshes.js";
import { prepareSnapshotMaterials, } from "./snapshot-prepared-materials.js";
import { prepareSnapshotMeshes, } from "./snapshot-prepared-meshes.js";
export function prepareAndBindSnapshotPreparedResourcesToRenderWorld(options) {
    const apply = options.renderWorld.applySnapshot(options.snapshot);
    const meshPreparation = prepareSnapshotMeshes({
        registry: options.registry,
        snapshot: options.snapshot,
        meshes: options.meshes,
    });
    const materialPreparation = prepareSnapshotMaterials({
        registry: options.registry,
        snapshot: options.snapshot,
        materials: options.materials,
    });
    const meshBinding = bindPreparedMeshResourcesToRenderWorld({
        renderWorld: options.renderWorld,
        meshes: options.meshes,
    });
    const materialBinding = bindPreparedMaterialResourcesToRenderWorld({
        renderWorld: options.renderWorld,
        materials: options.materials,
    });
    return {
        apply,
        meshes: {
            preparation: meshPreparation,
            binding: meshBinding,
        },
        materials: {
            preparation: materialPreparation,
            binding: materialBinding,
        },
        diagnostics: [
            ...apply.diagnostics,
            ...meshPreparation.diagnostics,
            ...materialPreparation.diagnostics,
            ...meshBinding.diagnostics,
            ...materialBinding.diagnostics,
        ],
    };
}
//# sourceMappingURL=render-world-prepared-resources.js.map