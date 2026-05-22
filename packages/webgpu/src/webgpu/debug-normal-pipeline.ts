import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  createDebugNormalPipelineDescriptorPlan,
  type DebugNormalPipelineDescriptorDiagnostic,
} from "./debug-normal-pipeline-descriptor.js";
import {
  createDebugNormalMeshShaderModuleDescriptor,
  DEBUG_NORMAL_MESH_SHADER,
} from "./debug-normal-shader.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "./material-render-state.js";
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
import { resolveUnlitVertexBufferLayouts } from "./unlit-pipeline.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

export type DebugNormalRenderPipelineDiagnosticCode =
  | "debugNormalRenderPipeline.shaderDiagnostic"
  | "debugNormalRenderPipeline.shaderCreationFailed"
  | "debugNormalRenderPipeline.descriptorPlanFailed"
  | "debugNormalRenderPipeline.createRenderPipelineUnavailable"
  | "debugNormalRenderPipeline.pipelineCreationFailed";

export interface DebugNormalRenderPipelineDiagnostic {
  readonly code: DebugNormalRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
  readonly field?: string;
}

export interface BrowserDebugNormalRenderPipelineDescriptorInput {
  readonly shaderModule: unknown;
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly batchKey?: BatchCompatibilityKey;
}

export interface CreateDebugNormalRenderPipelineResourceOptions {
  readonly device: DebugNormalRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly batchKey: BatchCompatibilityKey;
  readonly shader?: BuiltInShaderSourceModule;
}

export interface DebugNormalRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateDebugNormalRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: DebugNormalRenderPipelineResource | null;
  readonly diagnostics: readonly DebugNormalRenderPipelineDiagnostic[];
}

export interface DebugNormalRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createDebugNormalRenderPipelineResource(
  options: CreateDebugNormalRenderPipelineResourceOptions,
): Promise<CreateDebugNormalRenderPipelineResourceResult> {
  const shader = options.shader ?? DEBUG_NORMAL_MESH_SHADER;
  const descriptorPlan = createDebugNormalPipelineDescriptorPlan({
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
    descriptor: createDebugNormalMeshShaderModuleDescriptor(shader),
  });
  const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "debugNormalRenderPipeline.shaderCreationFailed",
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
          code: "debugNormalRenderPipeline.createRenderPipelineUnavailable",
          message:
            "WebGPU device cannot create debug-normal material pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserDebugNormalRenderPipelineDescriptor({
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
          code: "debugNormalRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU debug-normal material render pipeline creation failed.",
        },
      ],
    };
  }
}

export function createBrowserDebugNormalRenderPipelineDescriptor(
  input: BrowserDebugNormalRenderPipelineDescriptorInput,
): WebGpuRenderPipelineCreateDescriptor {
  const shader = input.shader ?? DEBUG_NORMAL_MESH_SHADER;
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
      buffers: resolveUnlitVertexBufferLayouts(input.batchKey),
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
): DebugNormalRenderPipelineDiagnostic {
  return {
    code: "debugNormalRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}

function mapDescriptorDiagnostic(
  diagnostic: DebugNormalPipelineDescriptorDiagnostic,
): DebugNormalRenderPipelineDiagnostic {
  return {
    code: "debugNormalRenderPipeline.descriptorPlanFailed",
    message: diagnostic.message,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
  };
}
