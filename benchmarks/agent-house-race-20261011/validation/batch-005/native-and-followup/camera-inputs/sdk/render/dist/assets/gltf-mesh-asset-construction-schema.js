export function createGltfMeshSkinningSchema(descriptors) {
    const hasJoints0 = descriptors.some((descriptor) => descriptor.semantic === "JOINTS_0");
    const hasWeights0 = descriptors.some((descriptor) => descriptor.semantic === "WEIGHTS_0");
    return hasJoints0 && hasWeights0
        ? { joints0: "JOINTS_0", weights0: "WEIGHTS_0" }
        : null;
}
export function createGltfMeshMorphTargetDescriptors(descriptors) {
    const semantics = new Set(descriptors.map((descriptor) => descriptor.semantic));
    const targets = [];
    if (semantics.has("MORPH_POSITION_0")) {
        targets.push({
            label: "target0",
            positionSemantic: "MORPH_POSITION_0",
            ...(semantics.has("MORPH_NORMAL_0")
                ? { normalSemantic: "MORPH_NORMAL_0" }
                : {}),
        });
    }
    if (semantics.has("MORPH_POSITION_1")) {
        targets.push({
            label: "target1",
            positionSemantic: "MORPH_POSITION_1",
            ...(semantics.has("MORPH_NORMAL_1")
                ? { normalSemantic: "MORPH_NORMAL_1" }
                : {}),
        });
    }
    return targets;
}
//# sourceMappingURL=gltf-mesh-asset-construction-schema.js.map