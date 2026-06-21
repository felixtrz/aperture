import { assetHandleKey, } from "@aperture-engine/simulation";
const STANDARD_SAMPLER_TEXTURE_FIELDS = [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "clearcoatTexture",
    "clearcoatRoughnessTexture",
    "transmissionTexture",
    "sheenColorTexture",
    "sheenRoughnessTexture",
    "iridescenceTexture",
    "iridescenceThicknessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
];
export function inspectStandardMaterialSamplers(registry, materialKey, material) {
    const slots = [];
    const diagnostics = [];
    for (const field of STANDARD_SAMPLER_TEXTURE_FIELDS) {
        inspectSamplerBinding({
            registry,
            materialKey,
            field,
            binding: material[field],
            slots,
            diagnostics,
        });
    }
    return {
        ready: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        materialKey,
        materialStatus: "ready",
        materialKind: material.kind,
        slots,
        diagnostics,
    };
}
function inspectSamplerBinding(input) {
    if (input.binding === null) {
        return;
    }
    const textureKey = input.binding.texture === null
        ? undefined
        : assetHandleKey(input.binding.texture);
    const samplerKey = input.binding.sampler === null
        ? undefined
        : assetHandleKey(input.binding.sampler);
    if (input.binding.texture === null || input.binding.sampler === null) {
        return;
    }
    const readyTextureKey = assetHandleKey(input.binding.texture);
    const readySamplerKey = assetHandleKey(input.binding.sampler);
    const textureEntry = input.registry.get(input.binding.texture);
    const samplerEntry = input.registry.get(input.binding.sampler);
    if (textureEntry === undefined || textureEntry.asset === null) {
        const status = textureEntry?.status ?? "missing";
        input.diagnostics.push({
            code: "standardMaterialSampler.textureNotReady",
            severity: status === "failed" ? "error" : "warning",
            materialKey: input.materialKey,
            ...(textureKey === undefined ? {} : { textureKey }),
            ...(samplerKey === undefined ? {} : { samplerKey }),
            field: input.field,
            status,
            message: `StandardMaterial ${input.field} sampler fidelity requires texture '${textureKey}' to be ready, not '${status}'.`,
        });
        return;
    }
    if (samplerEntry === undefined || samplerEntry.asset === null) {
        const status = samplerEntry?.status ?? "missing";
        input.diagnostics.push({
            code: "standardMaterialSampler.samplerNotReady",
            severity: status === "failed" ? "error" : "warning",
            materialKey: input.materialKey,
            textureKey: readyTextureKey,
            samplerKey: readySamplerKey,
            field: input.field,
            status,
            message: `StandardMaterial ${input.field} sampler fidelity requires sampler '${readySamplerKey}' to be ready, not '${status}'.`,
        });
        return;
    }
    inspectReadySamplerPair({
        materialKey: input.materialKey,
        field: input.field,
        textureKey: readyTextureKey,
        samplerKey: readySamplerKey,
        texture: textureEntry.asset,
        sampler: samplerEntry.asset,
        slots: input.slots,
        diagnostics: input.diagnostics,
    });
}
function inspectReadySamplerPair(input) {
    const diagnosticStart = input.diagnostics.length;
    const maxSupportedLod = Math.max(0, input.texture.mipLevelCount - 1);
    if (input.texture.mipLevelCount <= 1 &&
        input.sampler.mipmapFilter !== "nearest") {
        input.diagnostics.push({
            code: "standardMaterialSampler.mipmapFilterWithoutMips",
            severity: "warning",
            materialKey: input.materialKey,
            textureKey: input.textureKey,
            samplerKey: input.samplerKey,
            field: input.field,
            mipLevelCount: input.texture.mipLevelCount,
            mipmapFilter: input.sampler.mipmapFilter,
            message: `StandardMaterial ${input.field} sampler '${input.samplerKey}' requests '${input.sampler.mipmapFilter}' mip filtering, but texture '${input.textureKey}' has only ${input.texture.mipLevelCount} mip level.`,
        });
    }
    if (input.sampler.lodMaxClamp > maxSupportedLod) {
        input.diagnostics.push({
            code: "standardMaterialSampler.lodMaxExceedsMipRange",
            severity: "warning",
            materialKey: input.materialKey,
            textureKey: input.textureKey,
            samplerKey: input.samplerKey,
            field: input.field,
            mipLevelCount: input.texture.mipLevelCount,
            lodMaxClamp: input.sampler.lodMaxClamp,
            maxSupportedLod,
            message: `StandardMaterial ${input.field} sampler '${input.samplerKey}' uses lodMaxClamp ${input.sampler.lodMaxClamp}, but texture '${input.textureKey}' supports LOD 0 through ${maxSupportedLod}.`,
        });
    }
    if (input.sampler.maxAnisotropy > 1) {
        input.diagnostics.push({
            code: "standardMaterialSampler.anisotropyNotReported",
            severity: "warning",
            materialKey: input.materialKey,
            textureKey: input.textureKey,
            samplerKey: input.samplerKey,
            field: input.field,
            maxAnisotropy: input.sampler.maxAnisotropy,
            message: `StandardMaterial ${input.field} sampler '${input.samplerKey}' authors maxAnisotropy ${input.sampler.maxAnisotropy}, but current StandardMaterial diagnostics do not report anisotropic sampling readiness.`,
        });
    }
    input.slots.push({
        field: input.field,
        textureKey: input.textureKey,
        samplerKey: input.samplerKey,
        mipLevelCount: input.texture.mipLevelCount,
        magFilter: input.sampler.magFilter,
        minFilter: input.sampler.minFilter,
        mipmapFilter: input.sampler.mipmapFilter,
        lodMinClamp: input.sampler.lodMinClamp,
        lodMaxClamp: input.sampler.lodMaxClamp,
        maxAnisotropy: input.sampler.maxAnisotropy,
        warningCount: input.diagnostics.length - diagnosticStart,
    });
}
//# sourceMappingURL=standard-sampler-fidelity-inspection.js.map