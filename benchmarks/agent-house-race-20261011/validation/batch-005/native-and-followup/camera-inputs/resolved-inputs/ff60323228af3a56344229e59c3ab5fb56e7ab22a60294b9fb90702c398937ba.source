import { isCustomWgslMaterialAsset } from "../materials/index.js";
import { diagnostic } from "./extraction-diagnostics.js";
export function validateMaterialTextureDependencies(material, materialHandle, assets, entity, diagnostics) {
    if (isCustomWgslMaterialAsset(material)) {
        return validateCustomMaterialBindingDependencies(material, assets, entity, diagnostics);
    }
    if (material.kind !== "unlit" || material.baseColorTexture === null) {
        return true;
    }
    const binding = material.baseColorTexture;
    let valid = true;
    if (binding.texture === null) {
        diagnostics.push(diagnostic("render.material.missingTextureHandle", entity, materialHandle));
        valid = false;
    }
    else {
        valid =
            validateTextureAssetState(binding.texture, assets, entity, diagnostics) &&
                valid;
    }
    if (binding.sampler === null) {
        diagnostics.push(diagnostic("render.material.missingSamplerHandle", entity, materialHandle));
        valid = false;
    }
    else {
        valid =
            validateSamplerAssetState(binding.sampler, assets, entity, diagnostics) &&
                valid;
    }
    return valid;
}
function validateCustomMaterialBindingDependencies(material, assets, entity, diagnostics) {
    let valid = true;
    for (const binding of material.bindings) {
        if (binding.kind === "texture") {
            valid =
                validateTextureAssetState(binding.texture, assets, entity, diagnostics) && valid;
        }
        if (binding.kind === "sampler") {
            valid =
                validateSamplerAssetState(binding.sampler, assets, entity, diagnostics) && valid;
        }
    }
    return valid;
}
export function validateTextureAssetState(handle, assets, entity, diagnostics) {
    const entry = assets.get(handle);
    if (entry === undefined) {
        diagnostics.push(diagnostic("render.texture.missing", entity, handle));
        return false;
    }
    if (entry.status !== "ready" || entry.asset === null) {
        diagnostics.push(diagnostic(`render.texture.${entry.status}`, entity, handle));
        return false;
    }
    return true;
}
export function validateSkyboxTextureAssetState(handle, assets, entity, diagnostics) {
    const entry = assets.get(handle);
    if (entry === undefined) {
        diagnostics.push(diagnostic("render.texture.missing", entity, handle));
        return null;
    }
    if (entry.status !== "ready" || entry.asset === null) {
        diagnostics.push(diagnostic(`render.texture.${entry.status}`, entity, handle));
        return null;
    }
    if (entry.asset.dimension !== "cube" || entry.asset.depthOrLayers !== 6) {
        diagnostics.push(diagnostic("render.skybox.textureNotCube", entity, handle));
        return null;
    }
    return entry.asset;
}
export function validateSamplerAssetState(handle, assets, entity, diagnostics) {
    const entry = assets.get(handle);
    if (entry === undefined) {
        diagnostics.push(diagnostic("render.sampler.missing", entity, handle));
        return false;
    }
    if (entry.status !== "ready" || entry.asset === null) {
        diagnostics.push(diagnostic(`render.sampler.${entry.status}`, entity, handle));
        return false;
    }
    return true;
}
export function validateEnvironmentMapAssetState(handle, assets, entity, diagnostics) {
    const entry = assets.get(handle);
    if (entry === undefined) {
        diagnostics.push(diagnostic("render.environment.missing", entity, handle));
        return false;
    }
    if (entry.status !== "ready" || entry.asset === null) {
        diagnostics.push(diagnostic(`render.environment.${entry.status}`, entity, handle));
        return false;
    }
    return true;
}
//# sourceMappingURL=extraction-asset-state-validation.js.map