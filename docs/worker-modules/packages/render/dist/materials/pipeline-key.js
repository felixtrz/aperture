import { materialTextureBindings } from "./bindings.js";
import { isCustomWgslMaterialAsset } from "./family-key.js";
export function createMaterialPipelineKeyInput(material) {
    if (isCustomWgslMaterialAsset(material)) {
        return {
            shaderFamily: material.familyKey,
            features: [
                ...material.pipelineKey.features,
                `specialization:${stableStringHash(JSON.stringify(material.pipelineKey.specialization))}`,
                `bindings:${material.bindings
                    .map((binding) => `${binding.binding}:${binding.kind}`)
                    .sort()
                    .join(",")}`,
            ].sort(),
            alphaMode: material.renderState.alphaMode,
            cullMode: material.renderState.cullMode,
            frontFace: material.renderState.frontFace,
            depth: material.renderState.depth,
            blend: material.renderState.blend,
            colorWriteMask: material.renderState.colorWriteMask,
        };
    }
    const features = materialTextureBindings(material)
        .filter(([, binding]) => binding.texture !== null)
        .map(([field]) => field);
    if (usesStandardTexCoord1(material)) {
        features.push("uv1");
    }
    if (usesStandardClearcoat(material)) {
        features.push("clearcoat");
    }
    if (usesStandardTransmission(material)) {
        features.push("transmission");
    }
    if (usesStandardSheen(material)) {
        features.push("sheen");
    }
    if (usesStandardIridescence(material)) {
        features.push("iridescence");
    }
    return {
        shaderFamily: material.kind,
        features: features.sort(),
        alphaMode: material.renderState.alphaMode,
        cullMode: material.renderState.cullMode,
        frontFace: material.renderState.frontFace,
        depth: material.renderState.depth,
        blend: material.renderState.blend,
        colorWriteMask: material.renderState.colorWriteMask,
    };
}
function usesStandardTexCoord1(material) {
    return (material.kind === "standard" &&
        materialTextureBindings(material).some(([, binding]) => binding.texture !== null && binding.texCoord === 1));
}
function usesStandardClearcoat(material) {
    return material.kind === "standard" && material.clearcoatFactor > 0;
}
function usesStandardTransmission(material) {
    return material.kind === "standard" && material.transmissionFactor > 0;
}
function usesStandardSheen(material) {
    return (material.kind === "standard" &&
        (material.sheenColorFactor[0] > 0 ||
            material.sheenColorFactor[1] > 0 ||
            material.sheenColorFactor[2] > 0));
}
function usesStandardIridescence(material) {
    return material.kind === "standard" && material.iridescenceFactor > 0;
}
export function materialPipelineKeyInputToKey(input) {
    const features = [
        ...input.features,
        ...materialFrontFacePipelineFeatures(input.frontFace),
        ...materialDepthBiasPipelineFeatures(input.depth),
    ].sort();
    return [
        input.shaderFamily,
        ...features,
        input.alphaMode,
        input.cullMode,
        input.depth.compare,
        input.blend.preset,
    ].join("|");
}
function materialFrontFacePipelineFeatures(frontFace) {
    return frontFace === "cw" ? ["front-face:cw"] : [];
}
function materialDepthBiasPipelineFeatures(depth) {
    const depthBias = normalizeDepthBias(depth.bias);
    const depthBiasSlopeScale = normalizeDepthBiasSlopeScale(depth.biasSlopeScale);
    return depthBias === 0 && depthBiasSlopeScale === 0
        ? []
        : [`depth-bias:${depthBias}:${depthBiasSlopeScale}`];
}
function normalizeDepthBias(value) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.round(value)
        : 0;
}
function normalizeDepthBiasSlopeScale(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
export function samplerPipelineKey(sampler) {
    return [
        sampler.addressModeU,
        sampler.addressModeV,
        sampler.addressModeW,
        sampler.magFilter,
        sampler.minFilter,
        sampler.mipmapFilter,
        sampler.lodMinClamp,
        sampler.lodMaxClamp,
        sampler.maxAnisotropy,
    ].join("|");
}
function stableStringHash(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
//# sourceMappingURL=pipeline-key.js.map