import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  createMatcapPipelineDescriptorPlan,
  type MatcapPipelineDescriptorDiagnostic,
} from "./matcap-pipeline-descriptor.js";
import {
  createMatcapMeshShaderModuleDescriptor,
  MATCAP_MESH_SHADER,
} from "./matcap-shader.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "./pipeline-cache.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "./shader.js";
import { UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT } from "./unlit-pipeline.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

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
  readonly depthFormat?: string | null;
}

export interface CreateMatcapRenderPipelineResourceOptions {
  readonly device: MatcapRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
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
  const shader = options.shader ?? MATCAP_MESH_SHADER;
  const descriptorPlan = createMatcapPipelineDescriptorPlan({
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
