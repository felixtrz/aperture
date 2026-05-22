import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "./shader.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "./pipeline-cache.js";

export const SPRITE_PIPELINE_KEY = "aperture/sprite-billboard";

export const SPRITE_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct SpriteData {
  color: vec4f,
  size: vec4f,
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
  let x = array<f32, 6>(-0.5, 0.5, 0.5, -0.5, 0.5, -0.5);
  let y = array<f32, 6>(-0.5, -0.5, 0.5, -0.5, 0.5, 0.5);
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
  let world = worldTransforms[instanceIndex];
  let sprite = sprites[instanceIndex];
  let local = quadPosition(vertexIndex);
  let center = world[3].xyz;
  let toCamera = safeNormalize(view.cameraPosition.xyz - center, vec3f(0.0, 0.0, 1.0));
  let worldUp = vec3f(0.0, 1.0, 0.0);
  let right = safeNormalize(cross(worldUp, toCamera), vec3f(1.0, 0.0, 0.0));
  let up = safeNormalize(cross(toCamera, right), worldUp);
  let scale = vec2f(length(world[0].xyz), length(world[1].xyz));
  let billboardOffset =
    right * local.x * sprite.size.x * scale.x +
    up * local.y * sprite.size.y * scale.y;
  let worldPosition = center + billboardOffset;
  var output: VertexOutput;
  output.position = view.viewProjection * vec4f(worldPosition, 1.0);
  output.uv = quadUv(vertexIndex);
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
}

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
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: "aperture/sprite-billboard",
      code: SPRITE_WGSL,
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
    ...(options.depthFormat === undefined
      ? {}
      : { depthFormat: options.depthFormat }),
  });

  try {
    return {
      valid: true,
      resource: {
        cacheKey: spritePipelineCacheKey(
          options.colorFormat,
          options.depthFormat ?? null,
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
): string {
  return `${SPRITE_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}`;
}

function createBrowserSpriteRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
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
    ...(input.depthFormat === undefined || input.depthFormat === null
      ? {}
      : {
          depthStencil: {
            format: input.depthFormat,
            depthWriteEnabled: false,
            depthCompare: "less",
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
