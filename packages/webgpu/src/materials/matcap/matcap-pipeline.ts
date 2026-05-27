import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  createMatcapPipelineDescriptorPlan,
  type MatcapPipelineDescriptorDiagnostic,
} from "./matcap-pipeline-descriptor.js";
import {
  createMatcapMeshShaderModuleDescriptor,
  MATCAP_MESH_SHADER,
} from "./matcap-shader.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "../core/material-render-state.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "../../gpu/pipeline-cache.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "../../gpu/shader.js";
import { createMotionVectorBuiltInShaderVariant } from "../../render/motion/motion-vector-shader.js";
import { resolveUnlitVertexBufferLayouts } from "../unlit/unlit-pipeline.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";

export type MatcapRenderPipelineDiagnosticCode =
  | "matcapRenderPipeline.shaderDiagnostic"
  | "matcapRenderPipeline.shaderCreationFailed"
  | "matcapRenderPipeline.descriptorPlanFailed"
  | "matcapRenderPipeline.createRenderPipelineUnavailable"
  | "matcapRenderPipeline.pipelineCreationFailed";

export interface MatcapRenderPipelineDiagnostic {
  readonly code: MatcapRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
  readonly field?: string;
}

export interface BrowserMatcapRenderPipelineDescriptorInput {
  readonly shaderModule: unknown;
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly motionVectorColorFormat?: string | null;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly batchKey?: BatchCompatibilityKey;
}

export interface CreateMatcapRenderPipelineResourceOptions {
  readonly device: MatcapRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly motionVectorColorFormat?: string | null;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly batchKey: BatchCompatibilityKey;
  readonly shader?: BuiltInShaderSourceModule;
}

export interface MatcapRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateMatcapRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: MatcapRenderPipelineResource | null;
  readonly diagnostics: readonly MatcapRenderPipelineDiagnostic[];
}

export interface MatcapRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createMatcapRenderPipelineResource(
  options: CreateMatcapRenderPipelineResourceOptions,
): Promise<CreateMatcapRenderPipelineResourceResult> {
  const baseShader = options.shader ?? MATCAP_MESH_SHADER;
  const shader =
    options.motionVectorColorFormat === undefined ||
    options.motionVectorColorFormat === null
      ? baseShader
      : createMotionVectorBuiltInShaderVariant(baseShader);
  const descriptorPlan = createMatcapPipelineDescriptorPlan({
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
    descriptor: createMatcapMeshShaderModuleDescriptor(shader),
  });
  const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "matcapRenderPipeline.shaderCreationFailed",
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
          code: "matcapRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create matcap material pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserMatcapRenderPipelineDescriptor({
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
          code: "matcapRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU matcap material render pipeline creation failed.",
        },
      ],
    };
  }
}

export function createBrowserMatcapRenderPipelineDescriptor(
  input: BrowserMatcapRenderPipelineDescriptorInput,
): WebGpuRenderPipelineCreateDescriptor {
  const shader = input.shader ?? MATCAP_MESH_SHADER;
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
      buffers: resolveUnlitVertexBufferLayouts(input.batchKey),
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
): MatcapRenderPipelineDiagnostic {
  return {
    code: "matcapRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}

function mapDescriptorDiagnostic(
  diagnostic: MatcapPipelineDescriptorDiagnostic,
): MatcapRenderPipelineDiagnostic {
  return {
    code: "matcapRenderPipeline.descriptorPlanFailed",
    message: diagnostic.message,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
  };
}
