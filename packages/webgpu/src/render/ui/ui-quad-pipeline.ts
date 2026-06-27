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

export const UI_PANEL_PIPELINE_KEY = "aperture/ui-panel";
export const UI_IMAGE_PIPELINE_KEY = "aperture/ui-image";

// AI-17: a non-default-only output-stage cache-key suffix shared by the ui quad
// pipeline variants, so none + linear keeps the pre-existing key + shader.
function uiOutputStageKeySuffix(
  tonemap: TonemapOperator,
  outputColorSpace: OutputColorSpace,
): string {
  return tonemap === "none" && outputColorSpace === "linear"
    ? ""
    : `:${createTonemapPipelineKey(tonemap)}:${createOutputColorSpacePipelineKey(outputColorSpace)}`;
}

const UI_QUAD_COMMON_WGSL = `
struct UiViewUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  viewport: vec4f,
};

struct UiQuadData {
  color: vec4f,
  rect: vec4f,
  uvRect: vec4f,
  clipRect: vec4f,
  cornerRadii: vec4f,
  borderWidths: vec4f,
  borderColor: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) clipRect: vec4f,
  @location(3) screen: vec2f,
  @location(4) local: vec2f,
  @location(5) size: vec2f,
  @location(6) cornerRadii: vec4f,
  @location(7) borderWidths: vec4f,
  @location(8) borderColor: vec4f,
};

@group(0) @binding(0) var<uniform> view: UiViewUniform;
@group(1) @binding(0) var<storage, read> quads: array<UiQuadData>;

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

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let quad = quads[instanceIndex];
  let unit = quadPosition(vertexIndex);
  let viewportSize = max(view.viewport.xy, vec2f(1.0, 1.0));
  let screen = quad.rect.xy + unit * quad.rect.zw;
  let clip = vec2f(
    screen.x / viewportSize.x * 2.0 - 1.0,
    1.0 - screen.y / viewportSize.y * 2.0,
  );
  var output: VertexOutput;

  output.position = vec4f(clip, 0.0, 1.0);
  output.uv = quad.uvRect.xy + quadUv(vertexIndex) * quad.uvRect.zw;
  output.color = quad.color;
  output.clipRect = quad.clipRect;
  output.screen = screen;
  output.local = unit;
  output.size = quad.rect.zw;
  output.cornerRadii = quad.cornerRadii;
  output.borderWidths = quad.borderWidths;
  output.borderColor = quad.borderColor;
  return output;
}

// Signed distance to a rounded box centered at the origin, with the given
// half-extents and corner radius (negative inside).
fn uiRoundBox(point: vec2f, half: vec2f, radius: f32) -> f32 {
  let q = abs(point) - half + vec2f(radius);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - radius;
}

// Pick the corner radius for the quadrant a point falls in. Corner order is
// [topLeft, topRight, bottomRight, bottomLeft]; +x right, +y down.
fn uiCornerRadius(radii: vec4f, point: vec2f) -> f32 {
  let left = point.x < 0.0;
  let top = point.y < 0.0;
  if (left && top) { return radii.x; }
  if (!left && top) { return radii.y; }
  if (!left && !top) { return radii.z; }
  return radii.w;
}

fn uiMax4(value: vec4f) -> f32 {
  return max(max(value.x, value.y), max(value.z, value.w));
}

// Apply rounded-corner + per-side border shading over a fill color. Computed
// unconditionally (so derivatives stay in uniform control flow) and selected
// away for plain quads, which therefore render byte-identically.
fn uiShade(input: VertexOutput, fill: vec4f) -> vec4f {
  let size = max(input.size, vec2f(1.0));
  let half = size * 0.5;
  let point = input.local * size - half;
  let maxRadius = min(half.x, half.y);
  let radius = min(uiCornerRadius(input.cornerRadii, point), maxRadius);

  let outerDist = uiRoundBox(point, half, radius);
  let outerAa = max(fwidth(outerDist), 1e-4);
  let coverage = 1.0 - smoothstep(-outerAa, outerAa, outerDist);

  let bt = input.borderWidths.x;
  let br = input.borderWidths.y;
  let bb = input.borderWidths.z;
  let bl = input.borderWidths.w;
  let maxBorder = uiMax4(input.borderWidths);
  let innerHalf = vec2f(
    max(half.x - (bl + br) * 0.5, 0.0),
    max(half.y - (bt + bb) * 0.5, 0.0),
  );
  let innerCenter = vec2f((bl - br) * 0.5, (bt - bb) * 0.5);
  let innerRadius = max(radius - maxBorder, 0.0);
  let innerDist = uiRoundBox(point - innerCenter, innerHalf, innerRadius);
  let innerAa = max(fwidth(innerDist), 1e-4);
  let borderMix = 1.0 - smoothstep(-innerAa, innerAa, innerDist);

  let bodyColor = select(fill, mix(input.borderColor, fill, borderMix), maxBorder > 0.0);
  let shaped = vec4f(bodyColor.rgb, bodyColor.a * coverage);

  let hasShape = (uiMax4(input.cornerRadii) > 0.0) || (maxBorder > 0.0);
  return select(fill, shaped, hasShape);
}

fn clipped(input: VertexOutput) -> bool {
  if (input.clipRect.z <= 0.0 || input.clipRect.w <= 0.0) {
    return false;
  }

  let pixel = input.screen;
  return (
    pixel.x < input.clipRect.x ||
    pixel.y < input.clipRect.y ||
    pixel.x > input.clipRect.x + input.clipRect.z ||
    pixel.y > input.clipRect.y + input.clipRect.w
  );
}
`.trim();

export const UI_PANEL_WGSL = `
${UI_QUAD_COMMON_WGSL}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  if (clipped(input)) {
    discard;
  }

  return uiShade(input, input.color);
}
`.trim();

export const UI_IMAGE_WGSL = `
${UI_QUAD_COMMON_WGSL}

@group(1) @binding(1) var uiTexture: texture_2d<f32>;
@group(1) @binding(2) var uiSampler: sampler;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  if (clipped(input)) {
    discard;
  }

  let sampled = textureSample(uiTexture, uiSampler, input.uv) * input.color;
  return uiShade(input, sampled);
}
`.trim();

export interface UiQuadRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateUiQuadRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: UiQuadRenderPipelineResource | null;
  readonly diagnostics: readonly UiQuadRenderPipelineDiagnostic[];
}

export type UiQuadRenderPipelineDiagnosticCode =
  | "uiQuadRenderPipeline.shaderDiagnostic"
  | "uiQuadRenderPipeline.shaderCreationFailed"
  | "uiQuadRenderPipeline.createRenderPipelineUnavailable"
  | "uiQuadRenderPipeline.pipelineCreationFailed";

export interface UiQuadRenderPipelineDiagnostic {
  readonly code: UiQuadRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface UiQuadRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export function uiPanelPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null = null,
  sampleCount = 1,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
): string {
  return `${UI_PANEL_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}${uiOutputStageKeySuffix(tonemap, outputColorSpace)}`;
}

export function uiImagePipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null = null,
  sampleCount = 1,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
): string {
  return `${UI_IMAGE_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}${uiOutputStageKeySuffix(tonemap, outputColorSpace)}`;
}

export async function createUiPanelRenderPipelineResource(options: {
  readonly device: UiQuadRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}): Promise<CreateUiQuadRenderPipelineResourceResult> {
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  return createUiQuadRenderPipelineResource({
    ...options,
    label: UI_PANEL_PIPELINE_KEY,
    code: UI_PANEL_WGSL,
    tonemap,
    outputColorSpace,
    cacheKey: uiPanelPipelineCacheKey(
      options.colorFormat,
      options.depthFormat ?? null,
      options.sampleCount ?? 1,
      tonemap,
      outputColorSpace,
    ),
  });
}

export async function createUiImageRenderPipelineResource(options: {
  readonly device: UiQuadRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}): Promise<CreateUiQuadRenderPipelineResourceResult> {
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  return createUiQuadRenderPipelineResource({
    ...options,
    label: UI_IMAGE_PIPELINE_KEY,
    code: UI_IMAGE_WGSL,
    tonemap,
    outputColorSpace,
    cacheKey: uiImagePipelineCacheKey(
      options.colorFormat,
      options.depthFormat ?? null,
      options.sampleCount ?? 1,
      tonemap,
      outputColorSpace,
    ),
  });
}

async function createUiQuadRenderPipelineResource(options: {
  readonly device: UiQuadRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly label: string;
  readonly code: string;
  readonly cacheKey: string;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}): Promise<CreateUiQuadRenderPipelineResourceResult> {
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: options.label,
      code: applyOutputStageToFragmentWgsl(
        options.code,
        options.tonemap ?? "none",
        options.outputColorSpace ?? "linear",
        options.label,
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
          code: "uiQuadRenderPipeline.shaderCreationFailed",
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
          code: "uiQuadRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create UI quad render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserUiQuadRenderPipelineDescriptor({
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
    label: options.label,
    ...(options.depthFormat === undefined
      ? {}
      : { depthFormat: options.depthFormat }),
    ...(options.sampleCount === undefined
      ? {}
      : { sampleCount: options.sampleCount }),
  });

  try {
    return {
      valid: true,
      resource: {
        cacheKey: options.cacheKey,
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
          code: "uiQuadRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU UI quad render pipeline creation failed.",
        },
      ],
    };
  }
}

function createBrowserUiQuadRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly label: string;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${input.label}:${input.colorFormat}`,
    layout: "auto",
    vertex: {
      module: input.shaderModule,
      entryPoint: "vs_main",
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
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
      frontFace: "ccw",
    },
    ...(input.depthFormat === null || input.depthFormat === undefined
      ? {}
      : {
          depthStencil: {
            format: input.depthFormat,
            depthWriteEnabled: false,
            depthCompare: "always",
          },
        }),
    multisample: {
      count: input.sampleCount ?? 1,
    },
  };
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): UiQuadRenderPipelineDiagnostic {
  return {
    code: "uiQuadRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
