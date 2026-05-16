import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "./pipeline-cache.js";
import {
  createStandardPipelineDescriptorPlan,
  type StandardPipelineDescriptorDiagnostic,
} from "./standard-pipeline-descriptor.js";
import {
  createStandardMeshShaderModuleDescriptor,
  STANDARD_MESH_SHADER,
} from "./standard-shader.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "./shader.js";
import { UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT } from "./unlit-pipeline.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

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
  readonly depthFormat?: string | null;
}

export interface CreateStandardRenderPipelineResourceOptions {
  readonly device: StandardRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly batchKey: BatchCompatibilityKey;
  readonly shader?: BuiltInShaderSourceModule;
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
  const shader = options.shader ?? STANDARD_MESH_SHADER;
  const descriptorPlan = createStandardPipelineDescriptorPlan({
    shader,
    colorFormat: options.colorFormat,
    batchKey: options.batchKey,
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
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
    label: `${shader.label}:${input.colorFormat}:triangle-list`,
    layout: "auto",
    vertex: {
      module: input.shaderModule,
      entryPoint: shader.entryPoints.vertex,
      buffers: [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
    },
    fragment: {
      module: input.shaderModule,
      entryPoint: shader.entryPoints.fragment,
      targets: [{ format: input.colorFormat }],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: "ccw",
      cullMode: "back",
    },
  };

  if (input.depthFormat === undefined || input.depthFormat === null) {
    return descriptor;
  }

  return {
    ...descriptor,
    depthStencil: {
      format: input.depthFormat,
      depthWriteEnabled: true,
      depthCompare: "less",
    },
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
