import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "../../gpu/pipeline-cache.js";
import {
  createStandardPipelineDescriptorPlan,
  resolveStandardShaderForBatchKey,
  type StandardPipelineDescriptorDiagnostic,
} from "./standard-pipeline-descriptor.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "../core/material-render-state.js";
import {
  createStandardMeshShaderModuleDescriptor,
  STANDARD_MESH_SHADER,
} from "./standard-shader.js";
import { standardVertexBufferLayouts } from "./standard-vertex-layout.js";
import {
  applyOutputTonemapToStandardShader,
  DEFAULT_TONEMAP_OPERATOR,
  type TonemapOperator,
} from "../../output/output-stage-tonemap.js";
import {
  DEFAULT_OUTPUT_COLOR_SPACE,
  type OutputColorSpace,
} from "../../output/output-stage-color-space.js";
import { createMotionVectorBuiltInShaderVariant } from "../../render/motion/motion-vector-shader.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "../../gpu/shader.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";

export {
  STANDARD_MORPHED_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_SKINNED_MORPHED_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  vertexSkinningAttributeFormatsFromBatchKey,
  type StandardPrimitiveVertexBufferLayout,
  type WebGpuSkinningAttributeFormats,
  type WebGpuSkinningJointAttributeFormat,
  type WebGpuSkinningWeightAttributeFormat,
} from "./standard-vertex-layout.js";

export type StandardRenderPipelineDiagnosticCode =
  | "standardRenderPipeline.shaderDiagnostic"
  | "standardRenderPipeline.shaderCreationFailed"
  | "standardRenderPipeline.descriptorPlanFailed"
  | "standardRenderPipeline.createRenderPipelineUnavailable"
  | "standardRenderPipeline.pipelineCreationFailed";

export interface StandardRenderPipelineDiagnostic {
  readonly code: StandardRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
  readonly field?: string;
}

export interface BrowserStandardRenderPipelineDescriptorInput {
  readonly shaderModule: unknown;
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly motionVectorColorFormat?: string | null;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly batchKey?: BatchCompatibilityKey;
}

export interface CreateStandardRenderPipelineResourceOptions {
  readonly device: StandardRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly motionVectorColorFormat?: string | null;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly batchKey: BatchCompatibilityKey;
  readonly shader?: BuiltInShaderSourceModule;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}

export interface StandardRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateStandardRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: StandardRenderPipelineResource | null;
  readonly diagnostics: readonly StandardRenderPipelineDiagnostic[];
}

export interface StandardRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createStandardRenderPipelineResource(
  options: CreateStandardRenderPipelineResourceOptions,
): Promise<CreateStandardRenderPipelineResourceResult> {
  const baseShader = applyOutputTonemapToStandardShader(
    resolveStandardShaderForBatchKey(options.batchKey, options.shader),
    options.tonemap ?? DEFAULT_TONEMAP_OPERATOR,
    options.outputColorSpace ?? DEFAULT_OUTPUT_COLOR_SPACE,
  );
  const shader =
    options.motionVectorColorFormat === undefined ||
    options.motionVectorColorFormat === null
      ? baseShader
      : createMotionVectorBuiltInShaderVariant(baseShader);
  const descriptorPlan = createStandardPipelineDescriptorPlan({
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
  } catch (error) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "standardRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU standard material render pipeline creation failed.",
        },
      ],
    };
  }
}

export function createBrowserStandardRenderPipelineDescriptor(
  input: BrowserStandardRenderPipelineDescriptorInput,
): WebGpuRenderPipelineCreateDescriptor {
  const shader = input.shader ?? STANDARD_MESH_SHADER;
  const renderState = resolveWebGpuPipelineRenderState(
    input.batchKey?.pipelineKey,
    input.depthFormat,
  );
  const colorTarget = createWebGpuColorTargetDescriptor(
    input.colorFormat,
    renderState,
  );
  const targets =
    input.motionVectorColorFormat === undefined ||
    input.motionVectorColorFormat === null
      ? [colorTarget]
      : [colorTarget, { format: input.motionVectorColorFormat }];
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
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
      frontFace: "ccw",
      cullMode: renderState.cullMode,
    },
    multisample: {
      count: input.sampleCount ?? 1,
    },
  };
  const depthStencil = createWebGpuDepthStencilDescriptor(
    input.depthFormat,
    renderState,
  );

  if (depthStencil === null) {
    return descriptor;
  }

  return {
    ...descriptor,
    depthStencil,
  };
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): StandardRenderPipelineDiagnostic {
  return {
    code: "standardRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}

function mapDescriptorDiagnostic(
  diagnostic: StandardPipelineDescriptorDiagnostic,
): StandardRenderPipelineDiagnostic {
  return {
    code: "standardRenderPipeline.descriptorPlanFailed",
    message: diagnostic.message,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
  };
}
