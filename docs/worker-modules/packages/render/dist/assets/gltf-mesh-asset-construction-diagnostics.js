export function createGltfMeshAssetDiagnostic(primitive, code, input) {
    return {
        code,
        severity: "error",
        meshHandleKey: primitive.meshHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
        ...input,
    };
}
export function gltfMeshAssetIdFromRegisteredHandleKey(handleKey) {
    const prefix = "mesh:";
    return handleKey.startsWith(prefix)
        ? handleKey.slice(prefix.length)
        : handleKey;
}
export function gltfMeshPrimitiveRequestKey(meshIndex, primitiveIndex) {
    return `${meshIndex}:${primitiveIndex}`;
}
//# sourceMappingURL=gltf-mesh-asset-construction-diagnostics.js.map