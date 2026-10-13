import { UNLIT_MESH_SHADER, UNLIT_TEXTURED_MESH_SHADER, UNLIT_TEXTURED_VERTEX_COLOR_MESH_SHADER, UNLIT_VERTEX_COLOR_MESH_SHADER, validateBuiltInShaderMetadata, } from "./unlit-shader.js";
import { createWebGpuRenderPipelineCacheKey, } from "../../gpu/pipeline-cache.js";
import { createWebGpuColorTargetDescriptor, createWebGpuColorTargetStateKey, createWebGpuDepthStencilDescriptor, createWebGpuDepthStencilStateKey, resolveWebGpuPipelineRenderState, } from "../core/material-render-state.js";
export const UNLIT_BASE_COLOR_TEXTURE_FEATURE = "baseColorTexture";
export const UNLIT_VERTEX_COLOR_FEATURE = "vertexColor";
export const UNLIT_TEXTURED_VERTEX_COLOR_FEATURE = `${UNLIT_BASE_COLOR_TEXTURE_FEATURE}+${UNLIT_VERTEX_COLOR_FEATURE}`;
export function createUnlitPipelineDescriptorPlan(input) {
    const diagnostics = [];
    const batchKey = input.batchKey;
    const shader = resolveUnlitShaderForBatchKey(batchKey, input.shader);
    const metadata = validateBuiltInShaderMetadata(shader);
    const topology = input.topology ?? batchKey?.topology;
    for (const diagnostic of metadata.diagnostics) {
        diagnostics.push({
            code: "unlitPipeline.missingShaderMetadata",
            message: diagnostic.message,
            ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        });
    }
    if (input.colorFormat.trim().length === 0) {
        diagnostics.push({
            code: "unlitPipeline.missingColorFormat",
            field: "colorFormat",
            message: "Unlit pipeline descriptor planning requires a color format.",
        });
    }
    if (!isSupportedUnlitTopology(topology)) {
        diagnostics.push({
            code: "unlitPipeline.unsupportedTopology",
            field: "topology",
            message: `Unlit pipeline supports triangle-list and line-list topology, not '${String(topology)}'.`,
        });
    }
    validateBatchKey(batchKey, diagnostics);
    if (diagnostics.length > 0 || !isCompleteBatchKey(batchKey)) {
        return { valid: false, plan: null, diagnostics };
    }
    const resolvedTopology = topology ?? batchKey.topology;
    const sampleCount = input.sampleCount ?? 1;
    const renderState = resolveWebGpuPipelineRenderState(batchKey.pipelineKey, input.depthFormat);
    const depthStencil = createWebGpuDepthStencilStateKey(input.depthFormat, renderState);
    const colorTarget = createWebGpuColorTargetDescriptor(input.colorFormat, renderState);
    const colorFormats = input.motionVectorColorFormat === undefined ||
        input.motionVectorColorFormat === null
        ? [input.colorFormat]
        : [input.colorFormat, input.motionVectorColorFormat];
    const colorTargets = input.motionVectorColorFormat === undefined ||
        input.motionVectorColorFormat === null
        ? [colorTarget]
        : [colorTarget, { format: input.motionVectorColorFormat }];
    const keyInput = {
        shaderLabel: shader.label,
        shaderFamily: "unlit",
        shaderVariantKey: unlitShaderVariantKey(batchKey),
        colorFormats,
        depthFormat: input.depthFormat ?? null,
        stencilFormat: null,
        topology: resolvedTopology,
        vertexLayoutKey: batchKey.meshLayoutKey,
        bindGroupLayoutKeys: unlitBindGroupLayoutKeys(batchKey),
        primitive: {
            topology: resolvedTopology,
            cullMode: renderState.cullMode,
            frontFace: renderState.frontFace,
            stripIndexFormat: null,
        },
        depthStencil,
        blend: {
            alphaToCoverageEnabled: false,
            colorTargets: [
                createWebGpuColorTargetStateKey(input.colorFormat, renderState),
                ...(input.motionVectorColorFormat === undefined ||
                    input.motionVectorColorFormat === null
                    ? []
                    : [
                        {
                            format: input.motionVectorColorFormat,
                            blend: null,
                            writeMask: "all",
                        },
                    ]),
            ],
        },
        sampleCount,
        materialPipelineKey: batchKey.pipelineKey,
        materialVariantKey: batchKey.materialKey,
        batchKey,
    };
    const cacheKey = createWebGpuRenderPipelineCacheKey(keyInput);
    const descriptor = {
        label: `${shader.label}:${input.colorFormat}:${resolvedTopology}`,
        layout: "auto",
        vertex: {
            moduleLabel: shader.label,
            entryPoint: shader.entryPoints.vertex,
            buffers: unlitVertexBufferSemantics(batchKey),
        },
        fragment: {
            moduleLabel: shader.label,
            entryPoint: shader.entryPoints.fragment,
            targets: colorTargets,
        },
        primitive: {
            topology: resolvedTopology,
            cullMode: renderState.cullMode,
            frontFace: renderState.frontFace,
        },
        multisample: {
            count: sampleCount,
        },
    };
    const depthStencilDescriptor = createWebGpuDepthStencilDescriptor(input.depthFormat, renderState);
    if (depthStencilDescriptor !== null) {
        return {
            valid: true,
            plan: {
                cacheKey,
                keyInput,
                descriptor: {
                    ...descriptor,
                    depthStencil: depthStencilDescriptor,
                },
            },
            diagnostics,
        };
    }
    return { valid: true, plan: { descriptor, keyInput, cacheKey }, diagnostics };
}
function isSupportedUnlitTopology(topology) {
    return topology === "triangle-list" || topology === "line-list";
}
function unlitBindGroupLayoutKeys(batchKey) {
    return [
        "unlit/group-0:view-uniform@0",
        "unlit/group-1:world-transforms@0",
        hasBaseColorTextureFeature(batchKey)
            ? "unlit/group-2:material-textured@0,1,2"
            : "unlit/group-2:material@0",
    ];
}
export function resolveUnlitShaderForBatchKey(batchKey, shader) {
    if (shader !== undefined) {
        return shader;
    }
    if (hasBaseColorTextureFeature(batchKey) &&
        hasUnlitVertexColorFeature(batchKey)) {
        return UNLIT_TEXTURED_VERTEX_COLOR_MESH_SHADER;
    }
    if (hasBaseColorTextureFeature(batchKey)) {
        return UNLIT_TEXTURED_MESH_SHADER;
    }
    if (hasUnlitVertexColorFeature(batchKey)) {
        return UNLIT_VERTEX_COLOR_MESH_SHADER;
    }
    return UNLIT_MESH_SHADER;
}
export function hasUnlitVertexColorFeature(batchKey) {
    return (typeof batchKey?.meshLayoutKey === "string" &&
        batchKey.meshLayoutKey.split(/[|,]/).some(isColor0LayoutToken));
}
export function isColor0LayoutToken(token) {
    const normalized = token.split("@")[0] ?? "";
    return normalized === "COLOR_0" || normalized.startsWith("COLOR_0:");
}
function unlitShaderVariantKey(batchKey) {
    if (hasBaseColorTextureFeature(batchKey)) {
        return hasUnlitVertexColorFeature(batchKey)
            ? UNLIT_TEXTURED_VERTEX_COLOR_FEATURE
            : UNLIT_BASE_COLOR_TEXTURE_FEATURE;
    }
    return hasUnlitVertexColorFeature(batchKey)
        ? UNLIT_VERTEX_COLOR_FEATURE
        : "baseColorFactor";
}
function unlitVertexBufferSemantics(batchKey) {
    return hasUnlitVertexColorFeature(batchKey)
        ? ["POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0"]
        : ["POSITION", "NORMAL", "TEXCOORD_0"];
}
function hasBaseColorTextureFeature(batchKey) {
    return (typeof batchKey?.pipelineKey === "string" &&
        batchKey.pipelineKey.split("|").includes(UNLIT_BASE_COLOR_TEXTURE_FEATURE));
}
function validateBatchKey(batchKey, diagnostics) {
    if (batchKey === null) {
        diagnostics.push({
            code: "unlitPipeline.missingBatchKeyField",
            field: "batchKey",
            message: "Unlit pipeline descriptor planning requires a batch key.",
        });
        return;
    }
    for (const field of [
        "pipelineKey",
        "materialKey",
        "meshLayoutKey",
    ]) {
        const value = batchKey[field];
        if (typeof value !== "string" || value.trim().length === 0) {
            diagnostics.push({
                code: "unlitPipeline.missingBatchKeyField",
                field: `batchKey.${field}`,
                message: `Unlit pipeline descriptor planning requires batchKey.${field}.`,
            });
        }
    }
    if (batchKey.topology === undefined) {
        diagnostics.push({
            code: "unlitPipeline.missingBatchKeyField",
            field: "batchKey.topology",
            message: "Unlit pipeline descriptor planning requires batchKey.topology.",
        });
    }
}
function isCompleteBatchKey(batchKey) {
    return (batchKey !== null &&
        typeof batchKey.pipelineKey === "string" &&
        batchKey.pipelineKey.trim().length > 0 &&
        typeof batchKey.materialKey === "string" &&
        batchKey.materialKey.trim().length > 0 &&
        typeof batchKey.meshLayoutKey === "string" &&
        batchKey.meshLayoutKey.trim().length > 0 &&
        batchKey.topology !== undefined &&
        typeof batchKey.instanced === "boolean" &&
        typeof batchKey.skinned === "boolean" &&
        typeof batchKey.morphed === "boolean");
}
//# sourceMappingURL=unlit-pipeline-descriptor.js.map