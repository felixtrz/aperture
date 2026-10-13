import { createSamplerAssetFromGltfSampler, } from "./gltf-sampler.js";
import { isNonNegativeInteger, isRecord, toDiagnosticValue, } from "./gltf-texture-utils.js";
export function mapSamplerIndex(input) {
    if (input.texture.sampler === undefined) {
        return undefined;
    }
    if (isNonNegativeInteger(input.texture.sampler) &&
        input.texture.sampler < (input.samplers?.length ?? 0)) {
        return input.texture.sampler;
    }
    input.diagnostics.push({
        code: "gltfTexture.invalidSamplerIndex",
        severity: "error",
        textureIndex: input.textureIndex,
        slot: input.slot,
        field: `textures[${input.textureIndex}].sampler`,
        value: toDiagnosticValue(input.texture.sampler),
        ...(isNonNegativeInteger(input.texture.sampler)
            ? { samplerIndex: input.texture.sampler }
            : {}),
        message: `textures[${input.textureIndex}].sampler must reference an existing sampler.`,
    });
    return undefined;
}
export function createMappedSampler(input) {
    const samplerSource = input.samplerIndex === undefined
        ? undefined
        : input.samplers?.[input.samplerIndex];
    if (samplerSource !== undefined && !isRecord(samplerSource)) {
        input.diagnostics.push({
            code: "gltfTexture.invalidSamplerIndex",
            severity: "error",
            textureIndex: input.textureIndex,
            slot: input.slot,
            ...(input.samplerIndex === undefined
                ? {}
                : { samplerIndex: input.samplerIndex }),
            field: `samplers[${input.samplerIndex}]`,
            value: toDiagnosticValue(samplerSource),
            message: `samplers[${input.samplerIndex}] must be an object.`,
        });
        return null;
    }
    const samplerReport = createSamplerAssetFromGltfSampler(samplerSource);
    for (const diagnostic of samplerReport.diagnostics) {
        input.diagnostics.push(samplerDiagnosticToTextureDiagnostic(input, diagnostic));
    }
    return samplerReport.sampler;
}
function samplerDiagnosticToTextureDiagnostic(input, diagnostic) {
    return {
        code: "gltfTexture.invalidSampler",
        severity: "error",
        textureIndex: input.textureIndex,
        slot: input.slot,
        ...(input.samplerIndex === undefined
            ? {}
            : { samplerIndex: input.samplerIndex }),
        field: `sampler.${diagnostic.field}`,
        value: diagnostic.value,
        message: diagnostic.message,
    };
}
//# sourceMappingURL=gltf-texture-sampler-mapping.js.map