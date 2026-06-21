export function createGltfSceneImportContractSummary(input) {
    const primitiveShapes = [
        ...new Set(input.primitiveShapes.map((entry) => entry.shape)),
    ].sort();
    const materialFamilies = materialFamilyCounts({
        assetMapping: input.assetMapping,
        primitiveMaterialResolution: input.primitiveMaterialResolution,
    });
    return {
        sceneIndex: input.sceneTraversal.sceneIndex,
        sceneEntityKey: input.sceneTraversal.sceneEntityKey,
        nodeCount: input.sceneTraversal.nodes.length,
        rootNodeCount: input.sceneTraversal.rootNodeKeys.length,
        meshPrimitiveCount: input.meshPrimitive.meshes.length,
        renderablePrimitiveCount: input.ecsCommandPlan?.commands.filter((command) => command.type === "addComponent" && command.component === "Mesh").length ?? 0,
        primitiveShapeCount: primitiveShapes.length,
        primitiveShapes,
        materialFamilyCount: materialFamilies.length,
        materialFamilies,
        cameraCount: input.cameras.length,
        directLightCount: input.directLights.length,
        hasEnvironmentIntent: input.environment !== null,
        shadowIntentCount: input.shadows.length,
    };
}
function materialFamilyCounts(input) {
    const familyByHandle = new Map();
    for (const material of input.assetMapping.materials) {
        if (material.material !== null) {
            familyByHandle.set(material.handleKey, material.material.kind);
        }
    }
    const counts = new Map();
    for (const primitive of input.primitiveMaterialResolution?.resolved ?? []) {
        const family = familyByHandle.get(primitive.materialHandleKey);
        if (family === undefined) {
            continue;
        }
        counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([family, count]) => ({ family, count }));
}
//# sourceMappingURL=gltf-scene-import-contract-summary.js.map