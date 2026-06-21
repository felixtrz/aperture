import { DEBUG_NORMAL_MESH_SHADER, DEBUG_NORMAL_SHADER_VARIANT, validateDebugNormalShaderMetadata, } from "./debug-normal-shader.js";
import { createWebGpuRenderPipelineCacheKey, } from "../../gpu/pipeline-cache.js";
import { createWebGpuColorTargetDescriptor, createWebGpuColorTargetStateKey, createWebGpuDepthStencilDescriptor, createWebGpuDepthStencilStateKey, resolveWebGpuPipelineRenderState, } from "../core/material-render-state.js";
export function createDebugNormalPipelineDescriptorPlan(input) {
    const diagnostics = [];
    const batchKey = input.batchKey;
    const shader = input.shader ?? DEBUG_NORMAL_MESH_SHADER;
    const metadata = validateDebugNormalShaderMetadata(shader);
    const topology = input.topology ?? batchKey?.topology;
    const tokens = parsePipelineTokens(batchKey?.pipelineKey);
    for (const diagnostic of metadata.diagnostics) {
        diagnostics.push({
            code: "debugNormalPipeline.missingShaderMetadata",
            message: diagnostic.message,
            ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        });
    }
    if (input.colorFormat.trim().length === 0) {
        diagnostics.push({
            code: "debugNormalPipeline.missingColorFormat",
            field: "colorFormat",
            message: "DebugNormalMaterial pipeline descriptor planning requires a color format.",
        });
    }
    if (topology !== "triangle-list") {
        diagnostics.push({
            code: "debugNormalPipeline.unsupportedTopology",
            field: "topology",
            message: `DebugNormalMaterial pipeline supports triangle-list topology, not '${String(topology)}'.`,
        });
    }
    validateBatchKey(batchKey, diagnostics);
    validateDebugNormalPipelineTokens(tokens, diagnostics);
    validateDebugNormalVertexLayout(batchKey, diagnostics);
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
        shaderFamily: "debug-normal",
        shaderVariantKey: DEBUG_NORMAL_SHADER_VARIANT,
        colorFormats,
        depthFormat: input.depthFormat ?? null,
        stencilFormat: null,
        topology: resolvedTopology,
        vertexLayoutKey: batchKey.meshLayoutKey,
        bindGroupLayoutKeys: debugNormalBindGroupLayoutKeys(),
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
            buffers: ["POSITION", "NORMAL"],
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
function debugNormalBindGroupLayoutKeys() {
    return [
        "debug-normal/group-0:view-uniform@0",
        "debug-normal/group-1:world-transforms@0",
        "debug-normal/group-2:material@0",
    ];
}
function validateDebugNormalPipelineTokens(tokens, diagnostics) {
    if (tokens.family !== null && tokens.family !== "debug-normal") {
        diagnostics.push({
            code: "debugNormalPipeline.unsupportedShaderFamily",
            field: "batchKey.pipelineKey",
            message: `DebugNormalMaterial pipeline descriptor planning requires a 'debug-normal' material pipeline key, not '${tokens.family}'.`,
        });
    }
    for (const feature of tokens.features.filter((feature) => !isRenderStateFeatureToken(feature))) {
        diagnostics.push({
            code: "debugNormalPipeline.unsupportedFeature",
            field: `batchKey.pipelineKey.${feature}`,
            message: `DebugNormalMaterial pipeline does not support feature '${feature}'.`,
        });
    }
}
function isRenderStateFeatureToken(feature) {
    return feature === "front-face:cw" || feature.startsWith("depth-bias:");
}
function validateDebugNormalVertexLayout(batchKey, diagnostics) {
    const layout = batchKey?.meshLayoutKey;
    if (typeof layout !== "string" || layout.trim().length === 0) {
        return;
    }
    const attributes = new Set(layout
        .split(/[|,]/)
        .map(meshLayoutTokenSemantic)
        .filter((part) => part !== ""));
    for (const semantic of ["POSITION", "NORMAL"]) {
        if (!attributes.has(semantic)) {
            diagnostics.push({
                code: "debugNormalPipeline.missingVertexAttribute",
                field: `batchKey.meshLayoutKey.${semantic}`,
                message: `DebugNormalMaterial pipeline requires '${semantic}' vertex attribute data.`,
            });
        }
    }
}
function meshLayoutTokenSemantic(token) {
    if (token.startsWith("stride=")) {
        return "";
    }
    return token.split("@")[0]?.split(":")[0] ?? "";
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
            code: "debugNormalPipeline.missingBatchKeyField",
            field: "batchKey",
            message: "DebugNormalMaterial pipeline descriptor planning requires a batch key.",
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
                code: "debugNormalPipeline.missingBatchKeyField",
                field: `batchKey.${field}`,
                message: `DebugNormalMaterial pipeline descriptor planning requires batchKey.${field}.`,
            });
        }
    }
    if (batchKey.topology === undefined) {
        diagnostics.push({
            code: "debugNormalPipeline.missingBatchKeyField",
            field: "batchKey.topology",
            message: "DebugNormalMaterial pipeline descriptor planning requires batchKey.topology.",
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
//# sourceMappingURL=debug-normal-pipeline-descriptor.js.map