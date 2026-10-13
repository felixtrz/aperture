import { materialPipelineKeyInputToKey, } from "../materials/index.js";
export function createBatchCompatibilityKey(input) {
    return {
        pipelineKey: materialPipelineKeyInputToKey(input.materialPipeline),
        materialKey: input.materialKey,
        meshLayoutKey: input.meshLayoutKey,
        topology: input.topology,
        instanced: input.instanced ?? false,
        skinned: input.skinned ?? false,
        morphed: input.morphed ?? false,
    };
}
//# sourceMappingURL=snapshot-batch-key.js.map