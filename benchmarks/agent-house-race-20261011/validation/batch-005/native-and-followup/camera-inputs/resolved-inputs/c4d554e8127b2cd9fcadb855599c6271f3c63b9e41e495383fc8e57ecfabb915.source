export async function resolveDracoDecoder(input) {
    if (input.provided !== undefined || !gltfUsesDraco(input.root)) {
        return input.provided;
    }
    return input.create?.();
}
export async function resolveMeshoptDecoder(input) {
    if (input.provided !== undefined || !gltfUsesMeshopt(input.root)) {
        return input.provided;
    }
    return input.create?.();
}
function gltfUsesDraco(root) {
    return (root !== null &&
        (stringArray(root.extensionsUsed).includes("KHR_draco_mesh_compression") ||
            stringArray(root.extensionsRequired).includes("KHR_draco_mesh_compression")));
}
function gltfUsesMeshopt(root) {
    if (root === null) {
        return false;
    }
    const used = stringArray(root.extensionsUsed);
    const required = stringArray(root.extensionsRequired);
    return (used.includes("EXT_meshopt_compression") ||
        used.includes("KHR_meshopt_compression") ||
        required.includes("EXT_meshopt_compression") ||
        required.includes("KHR_meshopt_compression"));
}
function stringArray(value) {
    return Array.isArray(value)
        ? value.filter((entry) => typeof entry === "string")
        : [];
}
//# sourceMappingURL=glb-uri-loader-decoders.js.map