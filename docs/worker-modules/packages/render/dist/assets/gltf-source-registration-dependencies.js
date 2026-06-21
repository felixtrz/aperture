import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { materialTextureBindings } from "../materials/bindings.js";
export function gltfMaterialDependencyHandles(material) {
    const dependencies = [];
    const seen = new Set();
    for (const [, binding] of materialTextureBindings(material)) {
        appendDependency(dependencies, seen, binding.texture);
        appendDependency(dependencies, seen, binding.sampler);
    }
    return dependencies;
}
export function findGltfPlannedTextureForSampler(report, sampler) {
    return report.textures.find((texture) => texture.textureIndex === sampler.textureIndex &&
        texture.slot === sampler.slot);
}
export function assetDiagnosticsFromGltfMappingDiagnostics(diagnostics) {
    return diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: diagnostic.severity,
    }));
}
export function materialIdFromGltfPlannedHandleKey(handleKey) {
    const prefix = "material:";
    return handleKey.startsWith(prefix)
        ? handleKey.slice(prefix.length)
        : handleKey;
}
function appendDependency(dependencies, seen, handle) {
    if (handle === null) {
        return;
    }
    const key = assetHandleKey(handle);
    if (!seen.has(key)) {
        seen.add(key);
        dependencies.push(handle);
    }
}
//# sourceMappingURL=gltf-source-registration-dependencies.js.map