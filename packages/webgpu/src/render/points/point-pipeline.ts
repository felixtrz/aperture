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

export const POINT_PIPELINE_KEY = "aperture/point-cloud";

// Point-cloud (PointsMaterial-style) camera-facing quad (E1). Each instance is
// one point. The vertex shader expands a screen-space quad around the projected
// point: the size is pixels directly, or (with attenuation) world units scaled
// by `0.5 * viewportHeight / clipW` so points shrink with perspective depth.
// The fragment shader discards outside the unit disc for round points.
export const POINT_WGSL = `
struct ViewUniform {
  viewProjection: mat4x4f,
  viewport: vec4f,
};

struct PointInstance {
  positionSize: vec4f,
  color: vec4f,
  params: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) @interpolate(flat) round: f32,
};

@group(0) @binding(0) var<uniform> view: ViewUniform;
@group(1) @binding(0) var<storage, read> points: array<PointInstance>;

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let point = points[instanceIndex];
  let quadX = array<f32, 6>(-1.0, 1.0, 1.0, -1.0, 1.0, -1.0);
  let quadY = array<f32, 6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
  let corner = vec2f(quadX[vertexIndex], quadY[vertexIndex]);
  let clip = view.viewProjection * vec4f(point.positionSize.xyz, 1.0);
  let w = max(clip.w, 1e-6);
  var sizePx = point.positionSize.w;

  if (point.params.x > 0.5) {
    sizePx = point.positionSize.w * 0.5 * view.viewport.w / w;
  }

  let clipOffset =
    vec2f(corner.x * sizePx / view.viewport.z, corner.y * sizePx / view.viewport.w) *
    clip.w;

  var output: VertexOutput;
  output.position = clip + vec4f(clipOffset, 0.0, 0.0);
  output.uv = corner;
  output.color = point.color;
  output.round = point.params.y;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  if (input.round > 0.5 && dot(input.uv, input.uv) > 1.0) {
    discard;
  }

  return input.color;
}
`.trim();

export interface CreatePointRenderPipelineResourceOptions {
  readonly device: PointRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}

export type PointRenderPipelineDiagnosticCode =
  | "pointRenderPipeline.shaderDiagnostic"
  | "pointRenderPipeline.shaderCreationFailed"
  | "pointRenderPipeline.createRenderPipelineUnavailable"
  | "pointRenderPipeline.pipelineCreationFailed";

export interface PointRenderPipelineDiagnostic {
  readonly code: PointRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface PointRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreatePointRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: PointRenderPipelineResource | null;
  readonly diagnostics: readonly PointRenderPipelineDiagnostic[];
}

export interface PointRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createPointRenderPipelineResource(
  options: CreatePointRenderPipelineResourceOptions,
): Promise<CreatePointRenderPipelineResourceResult> {
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: POINT_PIPELINE_KEY,
      code: applyOutputStageToFragmentWgsl(
        POINT_WGSL,
        tonemap,
        outputColorSpace,
        POINT_PIPELINE_KEY,
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
          code: "pointRenderPipeline.shaderCreationFailed",
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
          code: "pointRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create point-cloud render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserPointRenderPipelineDescriptor({
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
        cacheKey: pointPipelineCacheKey(
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
          code: "pointRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU point-cloud render pipeline creation failed.",
        },
      ],
    };
  }
}

export function pointPipelineCacheKey(
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

  return `${POINT_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}${outputStage}`;
}

function createBrowserPointRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${POINT_PIPELINE_KEY}:${input.colorFormat}`,
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
): PointRenderPipelineDiagnostic {
  return {
    code: "pointRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
