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

export const SPRITE_PIPELINE_KEY = "aperture/sprite-billboard";

export const SPRITE_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  viewport: vec4f,
};

struct SpriteData {
  color: vec4f,
  sizePivot: vec4f,
  uvRect: vec4f,
  mode: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<storage, read> sprites: array<SpriteData>;
@group(2) @binding(1) var spriteTexture: texture_2d<f32>;
@group(2) @binding(2) var spriteSampler: sampler;

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

fn rotate2(value: vec2f, radians: f32) -> vec2f {
  let c = cos(radians);
  let s = sin(radians);
  return vec2f(value.x * c - value.y * s, value.x * s + value.y * c);
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
  let sprite = sprites[instanceIndex];
  let flags = u32(sprite.mode.x);
  let coordinateMode = flags & 3u;
  let billboardMode = (flags >> 2u) & 15u;
  let sizeMode = (flags >> 6u) & 3u;
  let transformIndex = u32(sprite.mode.z);
  let world = worldTransforms[transformIndex];
  let local = rotate2(
    (quadPosition(vertexIndex) - sprite.sizePivot.zw) * sprite.sizePivot.xy,
    sprite.mode.w,
  );
  let center = world[3].xyz;
  let cameraDelta = view.cameraPosition.xyz - center;
  var toCamera = safeNormalize(cameraDelta, vec3f(0.0, 0.0, 1.0));

  if (billboardMode == 2u) {
    toCamera = safeNormalize(vec3f(cameraDelta.x, 0.0, cameraDelta.z), vec3f(0.0, 0.0, 1.0));
  }

  let worldUp = vec3f(0.0, 1.0, 0.0);
  var right = safeNormalize(cross(worldUp, toCamera), vec3f(1.0, 0.0, 0.0));
  var up = safeNormalize(cross(toCamera, right), worldUp);

  if (billboardMode == 0u || billboardMode == 3u) {
    right = safeNormalize(world[0].xyz, vec3f(1.0, 0.0, 0.0));
    up = safeNormalize(world[1].xyz, worldUp);
  }

  var output: VertexOutput;

  if (sizeMode == 2u || coordinateMode == 2u) {
    let viewportSize = max(view.viewport.xy, vec2f(1.0, 1.0));
    let centerClip = view.viewProjection * vec4f(center, 1.0);
    let clipOffset =
      vec2f(local.x * 2.0 / viewportSize.x, local.y * 2.0 / viewportSize.y) *
      centerClip.w;

    output.position = centerClip + vec4f(clipOffset, 0.0, 0.0);
  } else {
    let scale = vec2f(length(world[0].xyz), length(world[1].xyz));
    let billboardOffset =
      right * local.x * scale.x +
      up * local.y * scale.y;
    let worldPosition = center + billboardOffset;

    output.position = view.viewProjection * vec4f(worldPosition, 1.0);
  }

  output.uv = sprite.uvRect.xy + quadUv(vertexIndex) * sprite.uvRect.zw;
  output.color = sprite.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(spriteTexture, spriteSampler, input.uv) * input.color;
}
`.trim();

export interface CreateSpriteRenderPipelineResourceOptions {
  readonly device: SpriteRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly depthMode?: SpritePipelineDepthMode;
  readonly sampleCount?: number;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}

export type SpritePipelineDepthMode = "test" | "disabled";

export type SpriteRenderPipelineDiagnosticCode =
  | "spriteRenderPipeline.shaderDiagnostic"
  | "spriteRenderPipeline.shaderCreationFailed"
  | "spriteRenderPipeline.createRenderPipelineUnavailable"
  | "spriteRenderPipeline.pipelineCreationFailed";

export interface SpriteRenderPipelineDiagnostic {
  readonly code: SpriteRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface SpriteRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateSpriteRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: SpriteRenderPipelineResource | null;
  readonly diagnostics: readonly SpriteRenderPipelineDiagnostic[];
}

export interface SpriteRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createSpriteRenderPipelineResource(
  options: CreateSpriteRenderPipelineResourceOptions,
): Promise<CreateSpriteRenderPipelineResourceResult> {
  // Default to the no-op (none + linear) so a sprite pipeline is byte-identical to
  // before unless the caller opts into the output stage (e.g. app.tonemap on the
  // non-HDR path).
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  const depthMode = options.depthMode ?? "test";
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: "aperture/sprite-billboard",
      // AI-17: apply the shared output color-space + tonemap stage (no-op on the
      // HDR-scene-buffer path, where the post stage encodes instead).
      code: applyOutputStageToFragmentWgsl(
        SPRITE_WGSL,
        tonemap,
        outputColorSpace,
        "aperture/sprite-billboard",
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
          code: "spriteRenderPipeline.shaderCreationFailed",
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
          code: "spriteRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create sprite render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserSpriteRenderPipelineDescriptor({
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
    ...(options.sampleCount === undefined
      ? {}
      : { sampleCount: options.sampleCount }),
    ...(options.depthFormat === undefined
      ? {}
      : { depthFormat: options.depthFormat }),
    depthMode,
  });

  try {
    return {
      valid: true,
      resource: {
        cacheKey: spritePipelineCacheKey(
          options.colorFormat,
          options.depthFormat ?? null,
          options.sampleCount ?? 1,
          tonemap,
          outputColorSpace,
          depthMode,
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
          code: "spriteRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU sprite render pipeline creation failed.",
        },
      ],
    };
  }
}

export function spritePipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null,
  sampleCount = 1,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
  depthMode: SpritePipelineDepthMode = "test",
): string {
  // Only differentiate the key when the output stage is actually applied. none +
  // linear is the no-op (HDR-scene-buffer) path — matching applyOutputStageToFragmentWgsl
  // — so it keeps the same key + shader as before this change.
  const outputStage =
    tonemap === "none" && outputColorSpace === "linear"
      ? ""
      : `:${createTonemapPipelineKey(tonemap)}:${createOutputColorSpacePipelineKey(outputColorSpace)}`;

  const depthModeKey = depthMode === "test" ? "" : `:depth-${depthMode}`;

  return `${SPRITE_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}${outputStage}${depthModeKey}`;
}

function createBrowserSpriteRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly depthMode?: SpritePipelineDepthMode;
  readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${SPRITE_PIPELINE_KEY}:${input.colorFormat}`,
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
            depthCompare: input.depthMode === "disabled" ? "always" : "less",
          },
        }),
  };
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): SpriteRenderPipelineDiagnostic {
  return {
    code: "spriteRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
