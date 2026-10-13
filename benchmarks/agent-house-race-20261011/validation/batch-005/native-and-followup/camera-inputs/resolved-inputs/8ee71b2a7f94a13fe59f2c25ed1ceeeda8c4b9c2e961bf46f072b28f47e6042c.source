import { createStandardPipelineDescriptorPlan, resolveStandardShaderForBatchKey, } from "./standard-pipeline-descriptor.js";
import { createWebGpuColorTargetDescriptor, createWebGpuDepthStencilDescriptor, resolveWebGpuPipelineRenderState, } from "../core/material-render-state.js";
import { createStandardMeshShaderModuleDescriptor, STANDARD_MESH_SHADER, } from "./standard-shader.js";
import { standardVertexBufferLayouts } from "./standard-vertex-layout.js";
import { applyOutputTonemapToStandardShader, DEFAULT_TONEMAP_OPERATOR, } from "../../output/output-stage-tonemap.js";
import { DEFAULT_OUTPUT_COLOR_SPACE, } from "../../output/output-stage-color-space.js";
import { createMotionVectorBuiltInShaderVariant } from "../../render/motion/motion-vector-shader.js";
import { createIndirectColorChannelShaderVariant } from "./standard-indirect-channel-shader.js";
import { createWebGpuShaderModule, } from "../../gpu/shader.js";
export { STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT, STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT, vertexSkinningAttributeFormatsFromBatchKey, } from "./standard-vertex-layout.js";
export async function createStandardRenderPipelineResource(options) {
    const baseShader = applyOutputTonemapToStandardShader(resolveStandardShaderForBatchKey(options.batchKey, options.shader), options.tonemap ?? DEFAULT_TONEMAP_OPERATOR, options.outputColorSpace ?? DEFAULT_OUTPUT_COLOR_SPACE);
    const indirectColorFormat = options.motionVectorColorFormat === undefined ||
        options.motionVectorColorFormat === null
        ? options.indirectColorFormat
        : null;
    const shader = options.motionVectorColorFormat !== undefined &&
        options.motionVectorColorFormat !== null
        ? createMotionVectorBuiltInShaderVariant(baseShader)
        : indirectColorFormat !== undefined && indirectColorFormat !== null
            ? createIndirectColorChannelShaderVariant(baseShader)
            : baseShader;
    const descriptorPlan = createStandardPipelineDescriptorPlan({
        shader,
        colorFormat: options.colorFormat,
        batchKey: options.batchKey,
        ...(options.motionVectorColorFormat === undefined
            ? {}
            : { motionVectorColorFormat: options.motionVectorColorFormat }),
        ...(indirectColorFormat === undefined || indirectColorFormat === null
            ? {}
            : { indirectColorFormat }),
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
        descriptor: createStandardMeshShaderModuleDescriptor(shader),
    });
    const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);
    if (!shaderModule.ok) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                ...shaderDiagnostics,
                {
                    code: "standardRenderPipeline.shaderCreationFailed",
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
                    code: "standardRenderPipeline.createRenderPipelineUnavailable",
                    message: "WebGPU device cannot create standard material pipelines.",
                },
            ],
        };
    }
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
        shader,
        shaderModule: shaderModule.module,
        colorFormat: options.colorFormat,
        batchKey: options.batchKey,
        ...(options.motionVectorColorFormat === undefined
            ? {}
            : { motionVectorColorFormat: options.motionVectorColorFormat }),
        ...(indirectColorFormat === undefined || indirectColorFormat === null
            ? {}
            : { indirectColorFormat }),
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
                    code: "standardRenderPipeline.pipelineCreationFailed",
                    message: error instanceof Error
                        ? error.message
                        : "WebGPU standard material render pipeline creation failed.",
                },
            ],
        };
    }
}
export function createBrowserStandardRenderPipelineDescriptor(input) {
    const shader = input.shader ?? STANDARD_MESH_SHADER;
    const renderState = resolveWebGpuPipelineRenderState(input.batchKey?.pipelineKey, input.depthFormat);
    const colorTarget = createWebGpuColorTargetDescriptor(input.colorFormat, renderState);
    const secondColorFormat = input.motionVectorColorFormat ?? input.indirectColorFormat ?? null;
    const targets = secondColorFormat === null
        ? [colorTarget]
        : [colorTarget, { format: secondColorFormat }];
    const descriptor = {
        label: `${shader.label}:${input.colorFormat}:triangle-list`,
        layout: "auto",
        vertex: {
            module: input.shaderModule,
            entryPoint: shader.entryPoints.vertex,
            buffers: standardVertexBufferLayouts(shader, input.batchKey),
        },
        fragment: {
            module: input.shaderModule,
            entryPoint: shader.entryPoints.fragment,
            targets,
        },
        primitive: {
            topology: "triangle-list",
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
function mapShaderDiagnostic(diagnostic) {
    return {
        code: "standardRenderPipeline.shaderDiagnostic",
        message: diagnostic.message,
        severity: diagnostic.severity,
    };
}
function mapDescriptorDiagnostic(diagnostic) {
    return {
        code: "standardRenderPipeline.descriptorPlanFailed",
        message: diagnostic.message,
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    };
}
//# sourceMappingURL=standard-pipeline.js.map