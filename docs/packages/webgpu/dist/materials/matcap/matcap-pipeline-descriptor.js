import { MATCAP_MATERIAL_SHADER_VARIANT, MATCAP_MESH_SHADER, validateMatcapShaderMetadata, } from "./matcap-shader.js";
import { createWebGpuRenderPipelineCacheKey, } from "../../gpu/pipeline-cache.js";
import { createWebGpuColorTargetDescriptor, createWebGpuColorTargetStateKey, createWebGpuDepthStencilDescriptor, createWebGpuDepthStencilStateKey, resolveWebGpuPipelineRenderState, } from "../core/material-render-state.js";
export function createMatcapPipelineDescriptorPlan(input) {
    const diagnostics = [];
    const batchKey = input.batchKey;
    const shader = input.shader ?? MATCAP_MESH_SHADER;
    const metadata = validateMatcapShaderMetadata(shader);
    const topology = input.topology ?? batchKey?.topology;
    const tokens = parsePipelineTokens(batchKey?.pipelineKey);
    for (const diagnostic of metadata.diagnostics) {
        diagnostics.push({
            code: "matcapPipeline.missingShaderMetadata",
            message: diagnostic.message,
            ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        });
    }
    if (input.colorFormat.trim().length === 0) {
        diagnostics.push({
            code: "matcapPipeline.missingColorFormat",
            field: "colorFormat",
            message: "Matcap pipeline descriptor planning requires a color format.",
        });
    }
    if (topology !== "triangle-list") {
        diagnostics.push({
            code: "matcapPipeline.unsupportedTopology",
            field: "topology",
            message: `MatcapMaterial pipeline supports triangle-list topology, not '${String(topology)}'.`,
        });
    }
    validateBatchKey(batchKey, diagnostics);
    validateMatcapPipelineTokens(tokens, diagnostics);
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
        shaderFamily: "matcap",
        shaderVariantKey: MATCAP_MATERIAL_SHADER_VARIANT,
        colorFormats,
        depthFormat: input.depthFormat ?? null,
        stencilFormat: null,
        topology: resolvedTopology,
        vertexLayoutKey: batchKey.meshLayoutKey,
        bindGroupLayoutKeys: matcapBindGroupLayoutKeys(),
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
            buffers: ["POSITION", "NORMAL", "TEXCOORD_0"],
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
function matcapBindGroupLayoutKeys() {
    return [
        "matcap/group-0:view-uniform@0",
        "matcap/group-1:world-transforms@0",
        "matcap/group-2:material-texture-sampler@0,1,2",
    ];
}
function validateMatcapPipelineTokens(tokens, diagnostics) {
    if (tokens.family !== null && tokens.family !== "matcap") {
        diagnostics.push({
            code: "matcapPipeline.unsupportedShaderFamily",
            field: "batchKey.pipelineKey",
            message: `Matcap pipeline descriptor planning requires a 'matcap' material pipeline key, not '${tokens.family}'.`,
        });
    }
}
function parsePipelineTokens(pipelineKey) {
    if (pipelineKey === undefined || pipelineKey.trim().length === 0) {
        return {
            family: null,
            features: [],
            alphaMode: null,
            cullMode: null,
            depthCompare: null,
            blendPreset: null,
        };
    }
    const parts = pipelineKey.split("|");
    const renderStateStart = Math.max(1, parts.length - 4);
    return {
        family: parts[0] ?? null,
        features: parts.slice(1, renderStateStart),
        alphaMode: parts[renderStateStart] ?? null,
        cullMode: parts[renderStateStart + 1] ?? null,
        depthCompare: parts[renderStateStart + 2] ?? null,
        blendPreset: parts[renderStateStart + 3] ?? null,
    };
}
function validateBatchKey(batchKey, diagnostics) {
    if (batchKey === null) {
        diagnostics.push({
            code: "matcapPipeline.missingBatchKeyField",
            field: "batchKey",
            message: "Matcap pipeline descriptor planning requires a batch key.",
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
                code: "matcapPipeline.missingBatchKeyField",
                field: `batchKey.${field}`,
                message: `Matcap pipeline descriptor planning requires batchKey.${field}.`,
            });
        }
    }
    if (batchKey.topology === undefined) {
        diagnostics.push({
            code: "matcapPipeline.missingBatchKeyField",
            field: "batchKey.topology",
            message: "Matcap pipeline descriptor planning requires batchKey.topology.",
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
//# sourceMappingURL=matcap-pipeline-descriptor.js.map