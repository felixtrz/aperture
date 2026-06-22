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

export const PROCEDURAL_SKY_PIPELINE_KEY = "aperture/procedural-sky";

export const PROCEDURAL_SKY_UNIFORM_FLOAT_COUNT = 44;

export const PROCEDURAL_SKY_WGSL = `
struct ProceduralSkyUniform {
  inverseViewProjection: mat4x4f,
  cameraPosition: vec4f,
  topColorIntensity: vec4f,
  horizonColorPosition: vec4f,
  bottomColorSoftness: vec4f,
  sunDirectionRadius: vec4f,
  sunColorGlow: vec4f,
  dither: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) direction: vec3f,
  @location(1) screenUv: vec2f,
};

@group(0) @binding(0) var<uniform> sky: ProceduralSkyUniform;

fn fullscreenPosition(vertexIndex: u32) -> vec2f {
  let x = array<f32, 3>(-1.0, 3.0, -1.0);
  let y = array<f32, 3>(-1.0, -1.0, 3.0);
  return vec2f(x[vertexIndex], y[vertexIndex]);
}

fn lerp3(a: vec3f, b: vec3f, t: f32) -> vec3f {
  return a * (1.0 - t) + b * t;
}

fn hash12(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + vec3f(dot(p3, p3.yzx + vec3f(33.33)));
  return fract((p3.x + p3.y) * p3.z);
}

fn normalizeOrDefault(value: vec3f, fallback: vec3f) -> vec3f {
  let lengthSq = dot(value, value);
  if (lengthSq <= 0.000001) {
    return fallback;
  }
  return value * inverseSqrt(lengthSq);
}

fn gradientColor(direction: vec3f, screenY: f32) -> vec3f {
  let worldY = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
  let y = clamp(worldY * 0.25 + screenY * 0.75, 0.0, 1.0);
  let horizon = clamp(sky.horizonColorPosition.w, 0.0, 1.0);
  let softness = max(sky.bottomColorSoftness.w, 0.0001);
  let topAmount = smoothstep(horizon - softness, horizon + softness, y);
  let bottomAmount = 1.0 - smoothstep(max(horizon - softness * 1.25, 0.0), horizon, y);

  var color = sky.horizonColorPosition.rgb;
  color = lerp3(color, sky.topColorIntensity.rgb, topAmount);
  color = lerp3(color, sky.bottomColorSoftness.rgb, bottomAmount);
  return color;
}

fn sunColor(direction: vec3f) -> vec3f {
  let sunDirection = normalizeOrDefault(sky.sunDirectionRadius.xyz, vec3f(0.0, 1.0, 0.0));
  let radius = max(sky.sunDirectionRadius.w, 0.000001);
  let glowAmount = max(sky.sunColorGlow.w, 0.0);
  let alignment = clamp(dot(direction, sunDirection), -1.0, 1.0);
  let angularDistance = acos(alignment);
  let disk = 1.0 - smoothstep(radius * 0.55, radius, angularDistance);
  let glowPower = max(2.0, 50.0 / (1.0 + glowAmount * 18.0));
  let glow = pow(max(alignment, 0.0), glowPower) * glowAmount;
  return sky.sunColorGlow.rgb * (disk + glow);
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let position = fullscreenPosition(vertexIndex);
  let farWorld = sky.inverseViewProjection * vec4f(position, 1.0, 1.0);
  let world = farWorld.xyz / farWorld.w;
  var output: VertexOutput;
  output.position = vec4f(position, 1.0, 1.0);
  output.direction = normalize(world - sky.cameraPosition.xyz);
  output.screenUv = position * 0.5 + vec2f(0.5);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let direction = normalize(input.direction);
  var color = gradientColor(direction, clamp(input.screenUv.y, 0.0, 1.0)) + sunColor(direction);
  color = color * max(sky.topColorIntensity.w, 0.0);
  let noise = (hash12(input.position.xy) - 0.5) * max(sky.dither.x, 0.0);
  return vec4f(max(color + vec3f(noise), vec3f(0.0)), 1.0);
}
`.trim();

export interface CreateProceduralSkyRenderPipelineResourceOptions {
  readonly device: ProceduralSkyRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}

export type ProceduralSkyRenderPipelineDiagnosticCode =
  | "proceduralSkyRenderPipeline.shaderDiagnostic"
  | "proceduralSkyRenderPipeline.shaderCreationFailed"
  | "proceduralSkyRenderPipeline.createRenderPipelineUnavailable"
  | "proceduralSkyRenderPipeline.pipelineCreationFailed";

export interface ProceduralSkyRenderPipelineDiagnostic {
  readonly code: ProceduralSkyRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface ProceduralSkyRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateProceduralSkyRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: ProceduralSkyRenderPipelineResource | null;
  readonly diagnostics: readonly ProceduralSkyRenderPipelineDiagnostic[];
}

export interface ProceduralSkyRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createProceduralSkyRenderPipelineResource(
  options: CreateProceduralSkyRenderPipelineResourceOptions,
): Promise<CreateProceduralSkyRenderPipelineResourceResult> {
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: PROCEDURAL_SKY_PIPELINE_KEY,
      code: PROCEDURAL_SKY_WGSL,
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
          code: "proceduralSkyRenderPipeline.shaderCreationFailed",
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
          code: "proceduralSkyRenderPipeline.createRenderPipelineUnavailable",
          message:
            "WebGPU device cannot create procedural sky render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserProceduralSkyRenderPipelineDescriptor({
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
        cacheKey: proceduralSkyPipelineCacheKey(
          options.colorFormat,
          options.depthFormat ?? null,
          options.sampleCount ?? 1,
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
          code: "proceduralSkyRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU procedural sky render pipeline creation failed.",
        },
      ],
    };
  }
}

export function proceduralSkyPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null,
  sampleCount = 1,
): string {
  return `${PROCEDURAL_SKY_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}`;
}

function createBrowserProceduralSkyRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${PROCEDURAL_SKY_PIPELINE_KEY}:${input.colorFormat}`,
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
): ProceduralSkyRenderPipelineDiagnostic {
  return {
    code: "proceduralSkyRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
