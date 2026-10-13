import { pushBoneMatrices, pushMorphInstanceDescriptor, pushMorphTargetDeltas, pushMorphTargetWeights, readMorphTargetWeights, readSkinning, } from "./extraction-mesh-deformation.js";
import { pushInstanceAttributePacket, pushInstanceTint, } from "./extraction-mesh-instances.js";
import { pushMatrix } from "./extraction-matrices.js";
export function readMeshDrawExtractionInputs(input) {
    const worldTransformOffset = pushMatrix(input.transforms, input.worldMatrix);
    const instanceTintOffset = pushInstanceTint(input.instanceTints, input.entity);
    const instanceAttributePacketIndex = pushInstanceAttributePacket(input.instanceAttributes, input.instanceAttributePackets, input.diagnostics, input.entity);
    const skinning = readSkinning(input.entity, input.mesh, input.diagnostics);
    if (skinning === null) {
        return null;
    }
    const morphExtraction = readMorphTargetWeights(input.entity, input.mesh, input.diagnostics);
    if (morphExtraction === null) {
        return null;
    }
    const morph = morphExtraction === undefined
        ? undefined
        : packMorph(input, worldTransformOffset, morphExtraction);
    return {
        worldTransformOffset,
        instanceTintOffset,
        instanceAttributePacketIndex,
        skinning,
        morph,
        boneMatrixOffset: skinning === undefined
            ? undefined
            : pushBoneMatrices(input.bones, skinning),
    };
}
function packMorph(input, worldTransformOffset, morph) {
    const weightOffset = pushMorphTargetWeights(input.morphTargetWeights, morph);
    const deltaOffset = pushMorphTargetDeltas(input.morphTargetDeltas, morph);
    pushMorphInstanceDescriptor(input.morphInstanceDescriptors, worldTransformOffset, {
        weightOffset,
        targetCount: morph.targetCount,
        deltaOffset,
        vertexCount: morph.vertexCount,
    });
    return {
        targetCount: morph.targetCount,
        vertexCount: morph.vertexCount,
        weightOffset,
        deltaOffset,
    };
}
//# sourceMappingURL=extraction-mesh-draw-inputs.js.map