import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderFailureReason,
  type WebGpuShaderDiagnostic,
} from "./shader.js";
import {
  createUnlitPipelineDescriptorPlan,
  resolveUnlitShaderForBatchKey,
  type UnlitPipelineDescriptorDiagnostic,
} from "./unlit-pipeline-descriptor.js";
import {
  createUnlitMeshShaderModuleDescriptor,
  UNLIT_MESH_SHADER,
  type BuiltInShaderSourceModule,
} from "./unlit-shader.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "./material-render-state.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "./pipeline-cache.js";

export const UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 32,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
  ],
} as const;

export type UnlitRenderPipelineDiagnosticCode =
  | "unlitRenderPipeline.shaderDiagnostic"
  | "unlitRenderPipeline.shaderCreationFailed"
  | "unlitRenderPipeline.descriptorPlanFailed"
  | "unlitRenderPipeline.createRenderPipelineUnavailable"
  | "unlitRenderPipeline.pipelineCreationFailed";

export interface UnlitRenderPipelineDiagnostic {
  readonly code: UnlitRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
  readonly field?: string;
}

export interface BrowserUnlitRenderPipelineDescriptorInput {
  readonly shaderModule: unknown;
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly batchKey?: BatchCompatibilityKey;
}

export interface CreateUnlitRenderPipelineResourceOptions {
  readonly device: UnlitRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly batchKey: BatchCompatibilityKey;
  readonly shader?: BuiltInShaderSourceModule;
}

export interface UnlitRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateUnlitRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: UnlitRenderPipelineResource | null;
  readonly diagnostics: readonly UnlitRenderPipelineDiagnostic[];
}

export interface UnlitRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createUnlitRenderPipelineResource(
  options: CreateUnlitRenderPipelineResourceOptions,
): Promise<CreateUnlitRenderPipelineResourceResult> {
  const shader = resolveUnlitShaderForBatchKey(
    options.batchKey,
    options.shader,
  );
  const descriptorPlan = createUnlitPipelineDescriptorPlan({
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
          code: "unlitRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU render pipeline creation failed.",
        },
      ],
    };
  }
}

export function createBrowserUnlitRenderPipelineDescriptor(
  input: BrowserUnlitRenderPipelineDescriptorInput,
): WebGpuRenderPipelineCreateDescriptor {
  const shader = input.shader ?? UNLIT_MESH_SHADER;
  const renderState = resolveWebGpuPipelineRenderState(
    input.batchKey?.pipelineKey,
    input.depthFormat,
  );
  const colorTarget = createWebGpuColorTargetDescriptor(
    input.colorFormat,
    renderState,
  );
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
      targets: [colorTarget],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: "ccw",
      cullMode: renderState.cullMode,
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
): UnlitRenderPipelineDiagnostic {
  return {
    code: "unlitRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}

function mapDescriptorDiagnostic(
  diagnostic: UnlitPipelineDescriptorDiagnostic,
): UnlitRenderPipelineDiagnostic {
  return {
    code: "unlitRenderPipeline.descriptorPlanFailed",
    message: diagnostic.message,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
  };
}
