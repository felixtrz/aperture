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

export const MSDF_TEXT_PIPELINE_KEY = "aperture/msdf-text";

export const MSDF_TEXT_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  viewport: vec4f,
};

struct GlyphData {
  color: vec4f,
  positionSize: vec4f,
  uvRect: vec4f,
  params: vec4f,
  metadata: vec4f,
  clipRect: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) params: vec4f,
  @location(3) clipRect: vec4f,
  @location(4) screen: vec2f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<storage, read> glyphs: array<GlyphData>;
@group(2) @binding(1) var fontAtlasTexture: texture_2d<f32>;
@group(2) @binding(2) var fontAtlasSampler: sampler;

fn quadPosition(vertexIndex: u32) -> vec2f {
  let x = array<f32, 6>(0.0, 1.0, 1.0, 0.0, 1.0, 0.0);
  let y = array<f32, 6>(0.0, 0.0, 1.0, 0.0, 1.0, 1.0);
  return vec2f(x[vertexIndex], y[vertexIndex]);
}

fn median(r: f32, g: f32, b: f32) -> f32 {
  return max(min(r, g), min(max(r, g), b));
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let glyph = glyphs[instanceIndex];
  let transformIndex = u32(glyph.metadata.x);
  let world = worldTransforms[transformIndex];
  let quad = quadPosition(vertexIndex);
  let viewportSize = max(view.viewport.xy, vec2f(1.0, 1.0));
  let origin = world[3].xy;
  let screen = origin + glyph.positionSize.xy + quad * glyph.positionSize.zw;
  let clip = vec2f(
    screen.x / viewportSize.x * 2.0 - 1.0,
    1.0 - screen.y / viewportSize.y * 2.0,
  );
  var output: VertexOutput;

  output.position = vec4f(clip, 0.0, 1.0);
  output.uv = glyph.uvRect.xy + quad * glyph.uvRect.zw;
  output.color = glyph.color;
  output.params = glyph.params;
  output.clipRect = glyph.clipRect;
  output.screen = screen;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  if (input.clipRect.z > 0.0 && input.clipRect.w > 0.0) {
    let pixel = input.screen;

    if (
      pixel.x < input.clipRect.x ||
      pixel.y < input.clipRect.y ||
      pixel.x > input.clipRect.x + input.clipRect.z ||
      pixel.y > input.clipRect.y + input.clipRect.w
    ) {
      discard;
    }
  }

  // MSDF atlas textures are linear data, not sRGB color images. The RGB
  // channels carry signed-distance data and the tint is applied after coverage.
  let msdf = textureSample(fontAtlasTexture, fontAtlasSampler, input.uv).rgb;
  let signedDistance = median(msdf.r, msdf.g, msdf.b) - 0.5;
  let distanceRange = max(input.params.x, 0.0001);
  let atlasSize = max(input.params.yz, vec2f(1.0, 1.0));
  let dpiScale = max(input.params.w, 0.5);
  let unitRange = vec2f(distanceRange) / atlasSize;
  let screenTexSize = vec2f(1.0) / max(fwidth(input.uv), vec2f(0.0001, 0.0001));
  let screenPxRange = max(0.5 * dot(unitRange, screenTexSize) * dpiScale, 1.0);
  let opacity = clamp(signedDistance * screenPxRange + 0.5, 0.0, 1.0);

  return vec4f(input.color.rgb, input.color.a * opacity);
}
`.trim();

export interface CreateMsdfTextRenderPipelineResourceOptions {
  readonly device: MsdfTextRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}

export type MsdfTextRenderPipelineDiagnosticCode =
  | "msdfTextRenderPipeline.shaderDiagnostic"
  | "msdfTextRenderPipeline.shaderCreationFailed"
  | "msdfTextRenderPipeline.createRenderPipelineUnavailable"
  | "msdfTextRenderPipeline.pipelineCreationFailed";

export interface MsdfTextRenderPipelineDiagnostic {
  readonly code: MsdfTextRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface MsdfTextRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateMsdfTextRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: MsdfTextRenderPipelineResource | null;
  readonly diagnostics: readonly MsdfTextRenderPipelineDiagnostic[];
}

export interface MsdfTextRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createMsdfTextRenderPipelineResource(
  options: CreateMsdfTextRenderPipelineResourceOptions,
): Promise<CreateMsdfTextRenderPipelineResourceResult> {
  // AI-17: no-op default (none + linear) → byte-identical unless the output stage
  // is requested.
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: MSDF_TEXT_PIPELINE_KEY,
      code: applyOutputStageToFragmentWgsl(
        MSDF_TEXT_WGSL,
        tonemap,
        outputColorSpace,
        MSDF_TEXT_PIPELINE_KEY,
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
          code: "msdfTextRenderPipeline.shaderCreationFailed",
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
          code: "msdfTextRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create MSDF text render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserMsdfTextRenderPipelineDescriptor({
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
        cacheKey: msdfTextPipelineCacheKey(
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
          code: "msdfTextRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU MSDF text render pipeline creation failed.",
        },
      ],
    };
  }
}

export function msdfTextPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null = null,
  sampleCount = 1,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
): string {
  const outputStage =
    tonemap === "none" && outputColorSpace === "linear"
      ? ""
      : `:${createTonemapPipelineKey(tonemap)}:${createOutputColorSpacePipelineKey(outputColorSpace)}`;
  return `${MSDF_TEXT_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "nodepth"}:${sampleCount}${outputStage}`;
}

export function createBrowserMsdfTextRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${MSDF_TEXT_PIPELINE_KEY}:${input.colorFormat}`,
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
            depthCompare: "less",
          },
        }),
    multisample: {
      count: input.sampleCount ?? 1,
    },
  };
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): MsdfTextRenderPipelineDiagnostic {
  return {
    code: "msdfTextRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
