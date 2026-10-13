import { createWebGpuShaderModule, } from "../../gpu/shader.js";
import { createUnlitPipelineDescriptorPlan, hasUnlitVertexColorFeature, isColor0LayoutToken, resolveUnlitShaderForBatchKey, } from "./unlit-pipeline-descriptor.js";
import { createUnlitMeshShaderModuleDescriptor, UNLIT_MESH_SHADER, } from "./unlit-shader.js";
import { createWebGpuColorTargetDescriptor, createWebGpuDepthStencilDescriptor, resolveWebGpuPipelineRenderState, } from "../core/material-render-state.js";
import { createMotionVectorBuiltInShaderVariant } from "../../render/motion/motion-vector-shader.js";
import { applyOutputStageToBuiltInShader, } from "../../output/output-stage-tonemap.js";
export const UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 32,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
    ],
};
export const UNLIT_VERTEX_COLOR_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 48,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 5, offset: 32, format: "float32x4" },
    ],
};
export const UNLIT_VERTEX_COLOR_FLOAT32X3_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 44,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 5, offset: 32, format: "float32x3" },
    ],
};
export const UNLIT_VERTEX_COLOR_UNORM8_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 36,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 5, offset: 32, format: "unorm8x4" },
    ],
};
export const UNLIT_VERTEX_COLOR_UNORM16_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 40,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 5, offset: 32, format: "unorm16x4" },
    ],
};
export async function createUnlitRenderPipelineResource(options) {
    // AI-17: apply the shared output stage to the base color shader BEFORE the
    // motion-vector variant, so the MV path (which renames fs_main -> fs_main_color
    // and adds the motion output) wraps the tonemapped color. No-op on none + linear
    // (HDR-scene-buffer path), so it stays byte-identical there.
    const baseShader = applyOutputStageToBuiltInShader(resolveUnlitShaderForBatchKey(options.batchKey, options.shader), options.tonemap ?? "none", options.outputColorSpace ?? "linear");
    const shader = options.motionVectorColorFormat === undefined ||
        options.motionVectorColorFormat === null
        ? baseShader
        : createMotionVectorBuiltInShaderVariant(baseShader);
    const descriptorPlan = createUnlitPipelineDescriptorPlan({
        shader,
        colorFormat: options.colorFormat,
        batchKey: options.batchKey,
        ...(options.motionVectorColorFormat === undefined
            ? {}
            : { motionVectorColorFormat: options.motionVectorColorFormat }),
        ...(options.sampleCount === undefined
            ? {}
            : { sampleCount: options.sampleCount }),
        ...(options.depthFormat === undefined
            ? {}
            : { depthFormat: options.depthFormat }),
    });
    if (!descriptorPlan.valid || descriptorPlan.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: descriptorPlan.diagnostics.map(mapDescriptorDiagnostic),
        };
    }
    const shaderModule = await createWebGpuShaderModule({
        device: options.device,
        descriptor: createUnlitMeshShaderModuleDescriptor(shader),
    });
    const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);
    if (!shaderModule.ok) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...shaderDiagnostics,
                {
                    code: "unlitRenderPipeline.shaderCreationFailed",
                    reason: shaderModule.reason,
                    message: shaderModule.message,
                },
            ],
        };
    }
    if (options.device.createRenderPipeline === undefined) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...shaderDiagnostics,
                {
                    code: "unlitRenderPipeline.createRenderPipelineUnavailable",
                    message: "WebGPU device cannot create render pipelines.",
                },
            ],
        };
    }
    const descriptor = createBrowserUnlitRenderPipelineDescriptor({
        shader,
        shaderModule: shaderModule.module,
        colorFormat: options.colorFormat,
        batchKey: options.batchKey,
        ...(options.motionVectorColorFormat === undefined
            ? {}
            : { motionVectorColorFormat: options.motionVectorColorFormat }),
        ...(options.sampleCount === undefined
            ? {}
            : { sampleCount: options.sampleCount }),
        ...(options.depthFormat === undefined
            ? {}
            : { depthFormat: options.depthFormat }),
    });
    try {
        return {
            valid: true,
            resource: {
                cacheKey: descriptorPlan.plan.cacheKey,
                shaderModule: shaderModule.module,
                pipeline: options.device.createRenderPipeline(descriptor),
                descriptor,
            },
            diagnostics: shaderDiagnostics,
        };
    }
    catch (error) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...shaderDiagnostics,
                {
                    code: "unlitRenderPipeline.pipelineCreationFailed",
                    message: error instanceof Error
                        ? error.message
                        : "WebGPU render pipeline creation failed.",
                },
            ],
        };
    }
}
export function createBrowserUnlitRenderPipelineDescriptor(input) {
    const shader = input.shader ?? UNLIT_MESH_SHADER;
    const topology = input.batchKey?.topology ?? "triangle-list";
    const renderState = resolveWebGpuPipelineRenderState(input.batchKey?.pipelineKey, input.depthFormat);
    const colorTarget = createWebGpuColorTargetDescriptor(input.colorFormat, renderState);
    const targets = input.motionVectorColorFormat === undefined ||
        input.motionVectorColorFormat === null
        ? [colorTarget]
        : [colorTarget, { format: input.motionVectorColorFormat }];
    const descriptor = {
        label: `${shader.label}:${input.colorFormat}:${topology}`,
        layout: "auto",
        vertex: {
            module: input.shaderModule,
            entryPoint: shader.entryPoints.vertex,
            buffers: resolveUnlitVertexBufferLayouts(input.batchKey),
        },
        fragment: {
            module: input.shaderModule,
            entryPoint: shader.entryPoints.fragment,
            targets,
        },
        primitive: {
            topology,
            frontFace: renderState.frontFace,
            cullMode: renderState.cullMode,
        },
        multisample: {
            count: input.sampleCount ?? 1,
        },
    };
    const depthStencil = createWebGpuDepthStencilDescriptor(input.depthFormat, renderState);
    if (depthStencil === null) {
        return descriptor;
    }
    return {
        ...descriptor,
        depthStencil,
    };
}
export function resolveUnlitVertexBufferLayout(batchKey) {
    return (resolveUnlitVertexBufferLayouts(batchKey)[0] ??
        UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT);
}
export function resolveUnlitVertexBufferLayouts(batchKey) {
    return (createUnlitDynamicVertexBufferLayouts(batchKey) ?? [
        resolveUnlitStaticVertexBufferLayout(batchKey),
    ]);
}
function resolveUnlitStaticVertexBufferLayout(batchKey) {
    if (!hasUnlitVertexColorFeature(batchKey ?? null)) {
        return UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
    }
    switch (vertexColorAttributeFormatFromBatchKey(batchKey)) {
        case "float32x3":
            return UNLIT_VERTEX_COLOR_FLOAT32X3_VERTEX_BUFFER_LAYOUT;
        case "unorm8x4":
            return UNLIT_VERTEX_COLOR_UNORM8_VERTEX_BUFFER_LAYOUT;
        case "unorm16x4":
            return UNLIT_VERTEX_COLOR_UNORM16_VERTEX_BUFFER_LAYOUT;
        case "float32x4":
            return UNLIT_VERTEX_COLOR_VERTEX_BUFFER_LAYOUT;
    }
}
function createUnlitDynamicVertexBufferLayouts(batchKey) {
    const streams = parseUnlitMeshLayoutKey(batchKey?.meshLayoutKey);
    if (streams === null) {
        return null;
    }
    const required = new Set(requiredUnlitVertexSemantics(batchKey));
    const streamAttributes = streams.map((stream) => {
        const attributes = [];
        for (const semantic of required) {
            const attribute = stream.attributes.get(semantic);
            const shaderLocation = unlitVertexShaderLocation(semantic);
            if (attribute !== undefined && shaderLocation !== null) {
                attributes.push({
                    shaderLocation,
                    offset: attribute.offset,
                    format: attribute.format,
                });
            }
        }
        return attributes;
    });
    for (const attributes of streamAttributes) {
        for (const attribute of attributes) {
            for (const semantic of required) {
                if (unlitVertexShaderLocation(semantic) === attribute.shaderLocation) {
                    required.delete(semantic);
                    break;
                }
            }
        }
    }
    if (required.size > 0) {
        return null;
    }
    const lastUsedStreamIndex = findLastUsedStreamIndex(streamAttributes);
    if (lastUsedStreamIndex < 0) {
        return null;
    }
    for (let index = 0; index <= lastUsedStreamIndex; index += 1) {
        if ((streamAttributes[index]?.length ?? 0) === 0) {
            return null;
        }
    }
    return streams.slice(0, lastUsedStreamIndex + 1).map((stream, index) => ({
        arrayStride: stream.arrayStride,
        stepMode: "vertex",
        attributes: streamAttributes[index] ?? [],
    }));
}
function findLastUsedStreamIndex(streamAttributes) {
    for (let index = streamAttributes.length - 1; index >= 0; index -= 1) {
        if ((streamAttributes[index]?.length ?? 0) > 0) {
            return index;
        }
    }
    return -1;
}
function requiredUnlitVertexSemantics(batchKey) {
    const semantics = ["POSITION", "NORMAL", "TEXCOORD_0"];
    if (hasUnlitVertexColorFeature(batchKey ?? null)) {
        semantics.push("COLOR_0");
    }
    return semantics;
}
function parseUnlitMeshLayoutKey(meshLayoutKey) {
    if (meshLayoutKey === undefined || meshLayoutKey.trim().length === 0) {
        return null;
    }
    const streams = [];
    const seen = new Set();
    for (const rawStream of meshLayoutKey.split("|")) {
        const stream = parseUnlitMeshLayoutStream(rawStream, seen);
        if (stream === null) {
            return null;
        }
        streams.push(stream);
    }
    return streams.length > 0 ? streams : null;
}
function parseUnlitMeshLayoutStream(rawStream, seen) {
    const attributes = new Map();
    let explicitStride = null;
    let offset = 0;
    for (const rawToken of rawStream.split(",")) {
        const token = rawToken.trim();
        if (token.length === 0) {
            return null;
        }
        if (token.startsWith("stride=")) {
            const stride = parseExplicitMeshLayoutStride(token);
            if (stride === null || explicitStride !== null) {
                return null;
            }
            explicitStride = stride;
            continue;
        }
        const parsed = parseExplicitMeshLayoutAttributeOffset(token);
        const semantic = meshLayoutTokenSemantic(parsed.token);
        const format = unlitMeshLayoutTokenFormat(parsed.token);
        if (semantic === null ||
            format === null ||
            attributes.has(semantic) ||
            seen.has(semantic)) {
            return null;
        }
        const attributeOffset = parsed.offset ?? offset;
        const attributeEnd = attributeOffset + vertexFormatByteSize(format);
        seen.add(semantic);
        attributes.set(semantic, {
            shaderLocation: unlitVertexShaderLocation(semantic) ?? 0,
            offset: attributeOffset,
            format,
        });
        offset =
            parsed.offset === null ? attributeEnd : Math.max(offset, attributeEnd);
    }
    const arrayStride = explicitStride ?? offset;
    return attributes.size > 0 && arrayStride >= offset
        ? { arrayStride, attributes }
        : null;
}
function meshLayoutTokenSemantic(token) {
    const [semantic] = token.split(":");
    return semantic === undefined || semantic.length === 0 ? null : semantic;
}
function unlitMeshLayoutTokenFormat(token) {
    const [semantic, format] = token.split(":");
    switch (semantic) {
        case "POSITION":
        case "NORMAL":
        case "MORPH_POSITION_0":
        case "MORPH_NORMAL_0":
        case "MORPH_POSITION_1":
        case "MORPH_NORMAL_1":
            return format === undefined ? "float32x3" : null;
        case "TEXCOORD_0":
        case "TEXCOORD_1":
            return format === undefined ? "float32x2" : null;
        case "TANGENT":
            return format === undefined ? "float32x4" : null;
        case "COLOR_0":
            return format === undefined
                ? "float32x4"
                : isUnlitColorFormat(format)
                    ? format
                    : null;
        case "JOINTS_0":
            return format === undefined
                ? "uint16x4"
                : format === "uint8x4" || format === "uint16x4"
                    ? format
                    : null;
        case "WEIGHTS_0":
            return format === undefined
                ? "float32x4"
                : isUnlitWeightFormat(format)
                    ? format
                    : null;
        default:
            return null;
    }
}
function parseExplicitMeshLayoutStride(token) {
    const value = Number.parseInt(token.slice("stride=".length), 10);
    return Number.isInteger(value) &&
        value > 0 &&
        String(value) === token.slice("stride=".length)
        ? value
        : null;
}
function parseExplicitMeshLayoutAttributeOffset(token) {
    const offsetSeparator = token.lastIndexOf("@");
    if (offsetSeparator < 0) {
        return { token, offset: null };
    }
    const baseToken = token.slice(0, offsetSeparator);
    const rawOffset = token.slice(offsetSeparator + 1);
    const offset = Number.parseInt(rawOffset, 10);
    return Number.isInteger(offset) &&
        offset >= 0 &&
        String(offset) === rawOffset &&
        baseToken.length > 0
        ? { token: baseToken, offset }
        : { token: "", offset: null };
}
function isUnlitColorFormat(format) {
    return (format === "float32x3" ||
        format === "float32x4" ||
        format === "unorm8x4" ||
        format === "unorm16x4");
}
function isUnlitWeightFormat(format) {
    return (format === "float32x4" || format === "unorm8x4" || format === "unorm16x4");
}
function unlitVertexShaderLocation(semantic) {
    switch (semantic) {
        case "POSITION":
            return 0;
        case "NORMAL":
            return 1;
        case "TEXCOORD_0":
            return 2;
        case "COLOR_0":
            return 5;
        default:
            return null;
    }
}
function vertexFormatByteSize(format) {
    switch (format) {
        case "uint8x4":
        case "unorm8x4":
            return 4;
        case "uint16x4":
        case "unorm16x4":
            return 8;
        case "float32x2":
            return 8;
        case "float32x3":
            return 12;
        case "float32x4":
            return 16;
        default:
            return 0;
    }
}
export function vertexColorAttributeFormatFromBatchKey(batchKey) {
    const token = typeof batchKey?.meshLayoutKey === "string"
        ? batchKey.meshLayoutKey.split(/[|,]/).find(isColor0LayoutToken)
        : undefined;
    const normalized = stripMeshLayoutOffsetSuffix(token);
    if (normalized === "COLOR_0:unorm8x4") {
        return "unorm8x4";
    }
    if (normalized === "COLOR_0:unorm16x4") {
        return "unorm16x4";
    }
    if (normalized === "COLOR_0:float32x3") {
        return "float32x3";
    }
    return "float32x4";
}
function stripMeshLayoutOffsetSuffix(token) {
    return token?.split("@")[0];
}
function mapShaderDiagnostic(diagnostic) {
    return {
        code: "unlitRenderPipeline.shaderDiagnostic",
        message: diagnostic.message,
        severity: diagnostic.severity,
    };
}
function mapDescriptorDiagnostic(diagnostic) {
    return {
        code: "unlitRenderPipeline.descriptorPlanFailed",
        message: diagnostic.message,
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    };
}
//# sourceMappingURL=unlit-pipeline.js.map