import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "../../gpu/shader.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "../../gpu/pipeline-cache.js";
import {
  applyOutputStageToFragmentWgsl,
  createTonemapPipelineKey,
  type TonemapOperator,
} from "../../output/output-stage-tonemap.js";
import {
  createOutputColorSpacePipelineKey,
  type OutputColorSpace,
} from "../../output/output-stage-color-space.js";

export const DECAL_PIPELINE_KEY = "aperture/decal-projected";

// Projected-decal quad (D4). Each instance carries a baked world matrix (the
// decal projector), a tint (fade folded into alpha), a size, and a UV rect. The
// quad lies in the projector's local XY plane and is nudged toward the camera
// by `params.z` (the depth bias) so it wins the depth test against the coplanar
// surface without z-fighting. The pipeline depth-tests (less-equal) against the
// scene depth the opaque pass wrote and never writes depth, so nearer geometry
// still occludes the decal.
export const DECAL_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct DecalInstance {
  world: mat4x4f,
  color: vec4f,
  params: vec4f,
  uvRect: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> decals: array<DecalInstance>;
@group(1) @binding(1) var decalTexture: texture_2d<f32>;
@group(1) @binding(2) var decalSampler: sampler;

fn quadPosition(vertexIndex: u32) -> vec2f {
  let x = array<f32, 6>(0.0, 1.0, 1.0, 0.0, 1.0, 0.0);
  let y = array<f32, 6>(0.0, 0.0, 1.0, 0.0, 1.0, 1.0);
  return vec2f(x[vertexIndex], y[vertexIndex]);
}

fn quadUv(vertexIndex: u32) -> vec2f {
  let u = array<f32, 6>(0.0, 1.0, 1.0, 0.0, 1.0, 0.0);
  let v = array<f32, 6>(1.0, 1.0, 0.0, 1.0, 0.0, 0.0);
  return vec2f(u[vertexIndex], v[vertexIndex]);
}

fn safeNormalize(value: vec3f, fallback: vec3f) -> vec3f {
  let lengthValue = length(value);

  if (lengthValue > 0.0001) {
    return value / lengthValue;
  }

  return fallback;
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let decal = decals[instanceIndex];
  let world = decal.world;
  let right = safeNormalize(world[0].xyz, vec3f(1.0, 0.0, 0.0));
  let up = safeNormalize(world[1].xyz, vec3f(0.0, 1.0, 0.0));
  let center = world[3].xyz;
  let local = (quadPosition(vertexIndex) - vec2f(0.5, 0.5)) * decal.params.xy;
  var worldPosition = center + right * local.x + up * local.y;
  let toCamera = safeNormalize(
    view.cameraPosition.xyz - center,
    vec3f(0.0, 0.0, 1.0),
  );
  worldPosition += toCamera * decal.params.z;

  var output: VertexOutput;
  output.position = view.viewProjection * vec4f(worldPosition, 1.0);
  output.uv = decal.uvRect.xy + quadUv(vertexIndex) * decal.uvRect.zw;
  output.color = decal.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(decalTexture, decalSampler, input.uv) * input.color;
}
`.trim();

export interface CreateDecalRenderPipelineResourceOptions {
  readonly device: DecalRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}

export type DecalRenderPipelineDiagnosticCode =
  | "decalRenderPipeline.shaderDiagnostic"
  | "decalRenderPipeline.shaderCreationFailed"
  | "decalRenderPipeline.createRenderPipelineUnavailable"
  | "decalRenderPipeline.pipelineCreationFailed";

export interface DecalRenderPipelineDiagnostic {
  readonly code: DecalRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface DecalRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateDecalRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: DecalRenderPipelineResource | null;
  readonly diagnostics: readonly DecalRenderPipelineDiagnostic[];
}

export interface DecalRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createDecalRenderPipelineResource(
  options: CreateDecalRenderPipelineResourceOptions,
): Promise<CreateDecalRenderPipelineResourceResult> {
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: DECAL_PIPELINE_KEY,
      code: applyOutputStageToFragmentWgsl(
        DECAL_WGSL,
        tonemap,
        outputColorSpace,
        DECAL_PIPELINE_KEY,
      ),
    },
  });
  const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "decalRenderPipeline.shaderCreationFailed",
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
          code: "decalRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create decal render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserDecalRenderPipelineDescriptor({
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
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
        cacheKey: decalPipelineCacheKey(
          options.colorFormat,
          options.depthFormat ?? null,
          options.sampleCount ?? 1,
          tonemap,
          outputColorSpace,
        ),
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
          code: "decalRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU decal render pipeline creation failed.",
        },
      ],
    };
  }
}

export function decalPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null,
  sampleCount = 1,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
): string {
  const outputStage =
    tonemap === "none" && outputColorSpace === "linear"
      ? ""
      : `:${createTonemapPipelineKey(tonemap)}:${createOutputColorSpacePipelineKey(outputColorSpace)}`;

  return `${DECAL_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}${outputStage}`;
}

function createBrowserDecalRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${DECAL_PIPELINE_KEY}:${input.colorFormat}`,
    layout: "auto",
    vertex: {
      module: input.shaderModule,
      entryPoint: "vs_main",
      buffers: [],
    },
    fragment: {
      module: input.shaderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format: input.colorFormat,
          blend: {
            color: {
              operation: "add",
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
            },
            alpha: {
              operation: "add",
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
            },
          },
          writeMask: 0xf,
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: "ccw",
      cullMode: "none",
    },
    multisample: {
      count: input.sampleCount ?? 1,
    },
    ...(input.depthFormat === undefined || input.depthFormat === null
      ? {}
      : {
          depthStencil: {
            format: input.depthFormat,
            depthWriteEnabled: false,
            depthCompare: "less-equal",
          },
        }),
  };
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): DecalRenderPipelineDiagnostic {
  return {
    code: "decalRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
