const EMPTY_MATERIAL_PIPELINE_RENDER_STATE_TOKENS = {
    alphaMode: null,
    cullMode: null,
    frontFace: null,
    depthCompare: null,
    depthBias: null,
    depthBiasSlopeScale: null,
    blendPreset: null,
};
const MATERIAL_PIPELINE_RENDER_STATE_TOKEN_CACHE_LIMIT = 2048;
const materialPipelineRenderStateTokenCache = new Map();
export function parseMaterialPipelineRenderStateTokens(pipelineKey) {
    if (pipelineKey === undefined || pipelineKey.trim().length === 0) {
        return EMPTY_MATERIAL_PIPELINE_RENDER_STATE_TOKENS;
    }
    const cached = materialPipelineRenderStateTokenCache.get(pipelineKey);
    if (cached !== undefined) {
        return cached;
    }
    const parts = pipelineKey.split("|");
    const renderStateStart = Math.max(1, parts.length - 4);
    const featureTokens = parts.slice(1, renderStateStart);
    const depthBias = parseDepthBiasToken(featureTokens);
    const tokens = {
        alphaMode: parts[renderStateStart] ?? null,
        cullMode: parts[renderStateStart + 1] ?? null,
        frontFace: parseFrontFaceToken(featureTokens),
        depthCompare: parts[renderStateStart + 2] ?? null,
        depthBias: depthBias.depthBias,
        depthBiasSlopeScale: depthBias.depthBiasSlopeScale,
        blendPreset: parts[renderStateStart + 3] ?? null,
    };
    if (materialPipelineRenderStateTokenCache.size >=
        MATERIAL_PIPELINE_RENDER_STATE_TOKEN_CACHE_LIMIT) {
        materialPipelineRenderStateTokenCache.clear();
    }
    materialPipelineRenderStateTokenCache.set(pipelineKey, tokens);
    return tokens;
}
export function resolveWebGpuPipelineRenderState(pipelineKey, depthFormat) {
    const tokens = parseMaterialPipelineRenderStateTokens(pipelineKey);
    const alphaMode = tokens.alphaMode ?? "opaque";
    const depthCompare = tokens.depthCompare ?? "less";
    return {
        alphaMode,
        cullMode: tokens.cullMode ?? "back",
        frontFace: tokens.frontFace === "cw" ? "cw" : "ccw",
        depthCompare,
        depthBias: tokens.depthBias ?? 0,
        depthBiasSlopeScale: tokens.depthBiasSlopeScale ?? 0,
        depthWriteEnabled: depthFormat !== undefined &&
            depthFormat !== null &&
            alphaMode !== "blend",
        blend: createBlendState(tokens.blendPreset ?? "none"),
    };
}
export function createWebGpuDepthStencilStateKey(depthFormat, renderState) {
    if (depthFormat === undefined || depthFormat === null) {
        return {
            format: null,
            depthWriteEnabled: false,
            depthCompare: "always",
        };
    }
    return {
        format: depthFormat,
        depthWriteEnabled: renderState.depthWriteEnabled,
        depthCompare: renderState.depthCompare,
        ...depthBiasFields(renderState),
    };
}
export function createWebGpuDepthStencilDescriptor(depthFormat, renderState) {
    if (depthFormat === undefined || depthFormat === null) {
        return null;
    }
    return {
        format: depthFormat,
        depthWriteEnabled: renderState.depthWriteEnabled,
        depthCompare: renderState.depthCompare,
        ...depthBiasFields(renderState),
    };
}
export function createWebGpuColorTargetStateKey(colorFormat, renderState) {
    return {
        format: colorFormat,
        blend: renderState.blend,
        writeMask: "all",
    };
}
export function createWebGpuColorTargetDescriptor(colorFormat, renderState) {
    if (renderState.blend === null) {
        return { format: colorFormat };
    }
    return {
        format: colorFormat,
        blend: renderState.blend,
    };
}
function createBlendState(preset) {
    switch (preset) {
        case "alpha":
            return {
                color: {
                    srcFactor: "src-alpha",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                },
                alpha: {
                    srcFactor: "one",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                },
            };
        case "premultiplied-alpha":
            return {
                color: {
                    srcFactor: "one",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                },
                alpha: {
                    srcFactor: "one",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                },
            };
        case "additive":
            return {
                color: {
                    srcFactor: "src-alpha",
                    dstFactor: "one",
                    operation: "add",
                },
                alpha: {
                    srcFactor: "one",
                    dstFactor: "one",
                    operation: "add",
                },
            };
        case "none":
        default:
            return null;
    }
}
function parseFrontFaceToken(features) {
    return features.includes("front-face:cw") ? "cw" : null;
}
function parseDepthBiasToken(features) {
    const token = features.find((feature) => feature.startsWith("depth-bias:"));
    if (token === undefined) {
        return { depthBias: null, depthBiasSlopeScale: null };
    }
    const [, depthBiasRaw, depthBiasSlopeScaleRaw] = token.split(":");
    const depthBias = Number(depthBiasRaw);
    const depthBiasSlopeScale = Number(depthBiasSlopeScaleRaw);
    return {
        depthBias: Number.isFinite(depthBias) ? Math.round(depthBias) : 0,
        depthBiasSlopeScale: Number.isFinite(depthBiasSlopeScale)
            ? depthBiasSlopeScale
            : 0,
    };
}
function depthBiasFields(renderState) {
    return {
        ...(renderState.depthBias === 0
            ? {}
            : { depthBias: renderState.depthBias }),
        ...(renderState.depthBiasSlopeScale === 0
            ? {}
            : { depthBiasSlopeScale: renderState.depthBiasSlopeScale }),
    };
}
//# sourceMappingURL=material-render-state.js.map