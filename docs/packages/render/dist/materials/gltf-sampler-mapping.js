import { createSamplerAsset } from "./factories.js";
import { GLTF_MAG_FILTER_VALUES, GLTF_MIN_FILTER_VALUES, GLTF_SAMPLER_FILTER, GLTF_SAMPLER_WRAP, GLTF_WRAP_VALUES, } from "./gltf-sampler-constants.js";
export function createSamplerAssetFromGltfSampler(source, options = {}) {
    const diagnostics = [];
    const samplerSource = source ?? {};
    const label = options.label ??
        (typeof samplerSource.name === "string" && samplerSource.name.length > 0
            ? samplerSource.name
            : "glTF Sampler");
    const addressModeU = mapWrapMode({
        field: "wrapS",
        value: samplerSource.wrapS,
        diagnostics,
    });
    const addressModeV = mapWrapMode({
        field: "wrapT",
        value: samplerSource.wrapT,
        diagnostics,
    });
    const magFilter = mapMagFilter(samplerSource.magFilter, diagnostics);
    const minFilter = mapMinFilter(samplerSource.minFilter, diagnostics);
    const samplerInput = {
        label,
        ...(addressModeU === undefined ? {} : { addressModeU }),
        ...(addressModeV === undefined ? {} : { addressModeV }),
        ...(magFilter === undefined ? {} : { magFilter }),
        ...minFilter,
    };
    return {
        valid: diagnostics.length === 0,
        sampler: createSamplerAsset(samplerInput),
        diagnostics,
    };
}
function mapWrapMode(input) {
    if (input.value === undefined) {
        return undefined;
    }
    switch (input.value) {
        case GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE:
            return "clamp-to-edge";
        case GLTF_SAMPLER_WRAP.MIRRORED_REPEAT:
            return "mirror-repeat";
        case GLTF_SAMPLER_WRAP.REPEAT:
            return "repeat";
        default:
            input.diagnostics.push({
                code: "gltfSampler.invalidWrapMode",
                field: input.field,
                value: toDiagnosticValue(input.value),
                expected: GLTF_WRAP_VALUES,
                message: `${input.field} must be a glTF sampler wrap enum value.`,
            });
            return undefined;
    }
}
function mapMagFilter(value, diagnostics) {
    if (value === undefined) {
        return undefined;
    }
    switch (value) {
        case GLTF_SAMPLER_FILTER.NEAREST:
            return "nearest";
        case GLTF_SAMPLER_FILTER.LINEAR:
            return "linear";
        default:
            diagnostics.push({
                code: "gltfSampler.invalidMagFilter",
                field: "magFilter",
                value: toDiagnosticValue(value),
                expected: GLTF_MAG_FILTER_VALUES,
                message: "magFilter must be NEAREST or LINEAR.",
            });
            return undefined;
    }
}
function mapMinFilter(value, diagnostics) {
    if (value === undefined) {
        return {};
    }
    switch (value) {
        case GLTF_SAMPLER_FILTER.NEAREST:
        case GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_NEAREST:
            return { minFilter: "nearest", mipmapFilter: "nearest" };
        case GLTF_SAMPLER_FILTER.LINEAR:
        case GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_NEAREST:
            return { minFilter: "linear", mipmapFilter: "nearest" };
        case GLTF_SAMPLER_FILTER.NEAREST_MIPMAP_LINEAR:
            return { minFilter: "nearest", mipmapFilter: "linear" };
        case GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR:
            return { minFilter: "linear", mipmapFilter: "linear" };
        default:
            diagnostics.push({
                code: "gltfSampler.invalidMinFilter",
                field: "minFilter",
                value: toDiagnosticValue(value),
                expected: GLTF_MIN_FILTER_VALUES,
                message: "minFilter must be a glTF sampler filter enum value.",
            });
            return {};
    }
}
function toDiagnosticValue(value) {
    if (value === null) {
        return null;
    }
    switch (typeof value) {
        case "string":
        case "boolean":
            return value;
        case "number":
            return Number.isFinite(value) ? value : String(value);
        case "undefined":
            return "undefined";
        case "bigint":
        case "symbol":
        case "function":
        case "object":
            return Object.prototype.toString.call(value);
    }
    return String(value);
}
//# sourceMappingURL=gltf-sampler-mapping.js.map