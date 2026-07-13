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

export const LINE_PIPELINE_KEY = "aperture/fat-line";

// Fat-line (Line2-style) segment quad (E1). Each instance is one polyline
// segment. The vertex shader projects both endpoints to pixel space, expands a
// capsule bounding box (half the screen-space width in pixels perpendicular,
// plus half-width caps beyond each endpoint), and converts the corners back to
// clip space preserving each endpoint's depth. The fragment shader is a capsule
// SDF: it discards fragments beyond half-width from the segment core (round
// caps + round joins for free) and, when dashed, discards gap fragments using
// the world-continuous arc length.
export const LINE_WGSL = `
struct ViewUniform {
  viewProjection: mat4x4f,
  viewport: vec4f,
};

struct LineSegment {
  p0: vec4f,
  p1: vec4f,
  color0: vec4f,
  color1: vec4f,
  params: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) p0Pixel: vec2f,
  @location(1) @interpolate(flat) p1Pixel: vec2f,
  @location(2) @interpolate(flat) halfWidthPx: f32,
  @location(3) @interpolate(flat) u0: f32,
  @location(4) @interpolate(flat) u1: f32,
  @location(5) @interpolate(flat) dash: vec3f,
  @location(6) color0: vec4f,
  @location(7) color1: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewUniform;
@group(1) @binding(0) var<storage, read> segments: array<LineSegment>;

fn clipToPixel(clip: vec4f) -> vec2f {
  let w = max(clip.w, 1e-6);
  let ndc = clip.xy / w;
  return vec2f(
    (ndc.x * 0.5 + 0.5) * view.viewport.z + view.viewport.x,
    (0.5 - ndc.y * 0.5) * view.viewport.w + view.viewport.y,
  );
}

fn pixelToClip(pixel: vec2f, clip: vec4f) -> vec4f {
  let w = max(clip.w, 1e-6);
  let ndcX = (pixel.x - view.viewport.x) / view.viewport.z * 2.0 - 1.0;
  let ndcY = 1.0 - (pixel.y - view.viewport.y) / view.viewport.w * 2.0;
  return vec4f(ndcX * w, ndcY * w, clip.z, w);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let segment = segments[instanceIndex];
  let endpointIndex = array<u32, 6>(0u, 0u, 1u, 0u, 1u, 1u);
  let perpSign = array<f32, 6>(-1.0, 1.0, 1.0, -1.0, 1.0, -1.0);
  let alongSign = array<f32, 6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);

  let c0 = view.viewProjection * vec4f(segment.p0.xyz, 1.0);
  let c1 = view.viewProjection * vec4f(segment.p1.xyz, 1.0);
  let s0 = clipToPixel(c0);
  let s1 = clipToPixel(c1);
  let delta = s1 - s0;
  let length2 = length(delta);
  var dir = vec2f(1.0, 0.0);

  if (length2 > 1e-6) {
    dir = delta / length2;
  }

  let normal = vec2f(-dir.y, dir.x);
  let halfWidth = max(segment.params.x, 0.0) * 0.5;
  let endpoint = endpointIndex[vertexIndex];
  let basePixel = select(s0, s1, endpoint == 1u);
  let baseClip = select(c0, c1, endpoint == 1u);
  let cornerPixel =
    basePixel +
    normal * perpSign[vertexIndex] * halfWidth +
    dir * alongSign[vertexIndex] * halfWidth;

  var output: VertexOutput;
  output.position = pixelToClip(cornerPixel, baseClip);
  output.p0Pixel = s0;
  output.p1Pixel = s1;
  output.halfWidthPx = halfWidth;
  output.u0 = segment.p0.w;
  output.u1 = segment.p1.w;
  output.dash = segment.params.yzw;
  output.color0 = segment.color0;
  output.color1 = segment.color1;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let frag = input.position.xy;
  let seg = input.p1Pixel - input.p0Pixel;
  let lengthSquared = max(dot(seg, seg), 1e-6);
  let t = clamp(dot(frag - input.p0Pixel, seg) / lengthSquared, 0.0, 1.0);
  let closest = input.p0Pixel + seg * t;
  let dist = length(frag - closest);

  if (dist > input.halfWidthPx) {
    discard;
  }

  let dashSize = input.dash.x;

  if (dashSize > 0.0) {
    let period = dashSize + input.dash.y;
    let u = mix(input.u0, input.u1, t) + input.dash.z;
    let phase = u - floor(u / period) * period;

    if (phase > dashSize) {
      discard;
    }
  }

  return mix(input.color0, input.color1, t);
}
`.trim();

export interface CreateLineRenderPipelineResourceOptions {
  readonly device: LineRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}

export type LineRenderPipelineDiagnosticCode =
  | "lineRenderPipeline.shaderDiagnostic"
  | "lineRenderPipeline.shaderCreationFailed"
  | "lineRenderPipeline.createRenderPipelineUnavailable"
  | "lineRenderPipeline.pipelineCreationFailed";

export interface LineRenderPipelineDiagnostic {
  readonly code: LineRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface LineRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateLineRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: LineRenderPipelineResource | null;
  readonly diagnostics: readonly LineRenderPipelineDiagnostic[];
}

export interface LineRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createLineRenderPipelineResource(
  options: CreateLineRenderPipelineResourceOptions,
): Promise<CreateLineRenderPipelineResourceResult> {
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: LINE_PIPELINE_KEY,
      code: applyOutputStageToFragmentWgsl(
        LINE_WGSL,
        tonemap,
        outputColorSpace,
        LINE_PIPELINE_KEY,
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
          code: "lineRenderPipeline.shaderCreationFailed",
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
          code: "lineRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create fat-line render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserLineRenderPipelineDescriptor({
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
        cacheKey: linePipelineCacheKey(
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
          code: "lineRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU fat-line render pipeline creation failed.",
        },
      ],
    };
  }
}

export function linePipelineCacheKey(
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

  return `${LINE_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}${outputStage}`;
}

function createBrowserLineRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${LINE_PIPELINE_KEY}:${input.colorFormat}`,
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
): LineRenderPipelineDiagnostic {
  return {
    code: "lineRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
