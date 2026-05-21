import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "./pipeline-cache.js";
import {
  createStandardPipelineDescriptorPlan,
  resolveStandardShaderForBatchKey,
  type StandardPipelineDescriptorDiagnostic,
} from "./standard-pipeline-descriptor.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "./material-render-state.js";
import {
  createStandardMeshShaderModuleDescriptor,
  STANDARD_MESH_SHADER,
} from "./standard-shader.js";
import {
  applyOutputTonemapToStandardShader,
  DEFAULT_TONEMAP_OPERATOR,
  type TonemapOperator,
} from "./output-stage-tonemap.js";
import { INSTANCE_TINT_VERTEX_BUFFER_LAYOUT } from "./instance-tint-buffer.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "./shader.js";
import { UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT } from "./unlit-pipeline.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

export const STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 48,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 3, offset: 32, format: "float32x4" },
  ],
} as const;

export const STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 40,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 4, offset: 32, format: "float32x2" },
  ],
} as const;

export const STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 48,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "float32x4" },
  ],
} as const;

export const STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 56,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 3, offset: 32, format: "float32x4" },
    { shaderLocation: 4, offset: 48, format: "float32x2" },
  ],
} as const;

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
  readonly batchKey?: BatchCompatibilityKey;
}

export interface CreateStandardRenderPipelineResourceOptions {
  readonly device: StandardRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly batchKey: BatchCompatibilityKey;
  readonly shader?: BuiltInShaderSourceModule;
  readonly tonemap?: TonemapOperator;
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
  const shader = applyOutputTonemapToStandardShader(
    resolveStandardShaderForBatchKey(options.batchKey, options.shader),
    options.tonemap ?? DEFAULT_TONEMAP_OPERATOR,
  );
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
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
    label: `${shader.label}:${input.colorFormat}:triangle-list`,
    layout: "auto",
    vertex: {
      module: input.shaderModule,
      entryPoint: shader.entryPoints.vertex,
      buffers: standardVertexBufferLayouts(shader),
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

function standardPrimitiveVertexBufferLayout(
  shader: BuiltInShaderSourceModule,
):
  | typeof UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT
  | typeof STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT
  | typeof STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT
  | typeof STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT
  | typeof STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT {
  const needsTangents = shader.bindings.some(
    (binding) => binding.id === "normalTexture",
  );
  const needsTexCoord1 = shader.code.includes("@location(4) uv1: vec2f");
  const needsVertexColor = shader.code.includes("@location(5) color: vec4f");

  if (needsTangents && needsTexCoord1) {
    return STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  if (needsTangents) {
    return STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  if (needsTexCoord1) {
    return STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  if (needsVertexColor) {
    return STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  return UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
}

function standardVertexBufferLayouts(
  shader: BuiltInShaderSourceModule,
):
  | readonly [ReturnType<typeof standardPrimitiveVertexBufferLayout>]
  | readonly [
      ReturnType<typeof standardPrimitiveVertexBufferLayout>,
      typeof INSTANCE_TINT_VERTEX_BUFFER_LAYOUT,
    ] {
  const primitive = standardPrimitiveVertexBufferLayout(shader);

  if (!shader.code.includes("@location(6) instanceTint: vec4f")) {
    return [primitive];
  }

  return [primitive, INSTANCE_TINT_VERTEX_BUFFER_LAYOUT];
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
