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
import {
  SpriteBlendMode,
  type SpriteBlendMode as SpriteBlendModeValue,
} from "@aperture-engine/render";

export const PARTICLE_COMPUTE_PIPELINE_KEY = "aperture/gpu-particles-compute";
export const PARTICLE_RENDER_PIPELINE_KEY = "aperture/gpu-particles-render";
export const PARTICLE_BURST_RENDER_PIPELINE_KEY =
  "aperture/gpu-particles-burst-render";

export const PARTICLE_COMPUTE_WGSL = `
const PARTICLE_CURVE_SAMPLE_COUNT: u32 = 16u;

struct ParticleParams {
  frameSeedCapacityFlags: vec4u,
  originRadiusTime: vec4f,
  colorA: vec4f,
  colorB: vec4f,
  sizeSpeedLife: vec4f,
  sizeCurve: array<vec4f, 4>,
  colorCurve: array<vec4f, 16>,
};

struct ParticleData {
  positionSize: vec4f,
  color: vec4f,
};

@group(0) @binding(0) var<uniform> params: ParticleParams;
@group(0) @binding(1) var<storage, read_write> particles: array<ParticleData>;

fn hash(value: u32) -> f32 {
  var x = value;
  x = ((x >> 16u) ^ x) * 0x45d9f3bu;
  x = ((x >> 16u) ^ x) * 0x45d9f3bu;
  x = (x >> 16u) ^ x;
  return f32(x & 0x00ffffffu) / f32(0x01000000u);
}

fn sizeCurveValue(index: u32) -> f32 {
  let packed = params.sizeCurve[index / 4u];
  let component = index % 4u;

  if (component == 0u) {
    return packed.x;
  }
  if (component == 1u) {
    return packed.y;
  }
  if (component == 2u) {
    return packed.z;
  }
  return packed.w;
}

fn sampleSizeCurve(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(sizeCurveValue(lower), sizeCurveValue(upper), fract(scaled));
}

fn sampleColorCurve(life: f32) -> vec4f {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(params.colorCurve[lower], params.colorCurve[upper], fract(scaled));
}

fn particleLife(offset: f32) -> f32 {
  return fract(params.originRadiusTime.z / max(params.sizeSpeedLife.z, 0.001) + offset);
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  let capacity = params.frameSeedCapacityFlags.z;

  if (index >= capacity) {
    return;
  }

  if (index == 0u) {
    let life = particleLife(0.0);
    particles[index].positionSize = vec4f(
      params.originRadiusTime.x,
      params.originRadiusTime.y,
      0.0,
      max(0.001, max(params.sizeSpeedLife.x, params.sizeSpeedLife.y) * sampleSizeCurve(life))
    );
    particles[index].color = sampleColorCurve(life);
    return;
  }

  let frame = params.frameSeedCapacityFlags.x;
  let seed = params.frameSeedCapacityFlags.y;
  let a = hash(seed ^ (index * 747796405u) ^ (frame * 2891336453u));
  let b = hash(seed ^ (index * 277803737u) ^ (frame * 1597334677u));
  let c = hash(seed ^ (index * 1442695041u));
  let angle = a * 6.2831853;
  let radius = sqrt(b) * params.originRadiusTime.w;
  let drift = sin(params.originRadiusTime.z + f32(index) * 0.073) * 0.18;
  let life = particleLife(c);
  let baseSize = mix(params.sizeSpeedLife.x, params.sizeSpeedLife.y, c);
  let size = max(0.001, baseSize * sampleSizeCurve(life));
  let color = sampleColorCurve(life);

  particles[index].positionSize = vec4f(
    params.originRadiusTime.x + cos(angle) * radius,
    params.originRadiusTime.y + sin(angle) * radius + drift,
    0.0,
    size
  );
  particles[index].color = color;
}
`.trim();

export const PARTICLE_RENDER_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  previousViewProjection: mat4x4f,
  fogColor: vec4f,
  fogParams: vec4f,
};

struct ParticleData {
  positionSize: vec4f,
  color: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) uv: vec2f,
  @location(2) distanceToCamera: f32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> particles: array<ParticleData>;
@group(2) @binding(0) var particleTexture: texture_2d<f32>;
@group(2) @binding(1) var particleSampler: sampler;

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

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn applyParticleFog(color: vec3f, distanceToCamera: f32) -> vec3f {
  let mode = u32(round(view.fogParams.x));

  if (view.fogColor.a <= 0.0 || mode == 0u) {
    return color;
  }

  var fogFactor = 0.0;

  if (mode == 1u) {
    fogFactor = 1.0 - saturate((view.fogParams.w - distanceToCamera) / max(view.fogParams.w - view.fogParams.z, 0.0001));
  } else if (mode == 2u) {
    fogFactor = 1.0 - saturate(exp(-distanceToCamera * view.fogParams.y));
  } else {
    fogFactor = 1.0 - saturate(exp(-distanceToCamera * distanceToCamera * view.fogParams.y * view.fogParams.y));
  }

  return mix(color, view.fogColor.rgb, saturate(fogFactor * view.fogColor.a));
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let particle = particles[instanceIndex];
  let local = quadPosition(vertexIndex) * particle.positionSize.w;
  let forwardRaw = view.cameraPosition.xyz - particle.positionSize.xyz;
  let forwardLength = max(length(forwardRaw), 0.0001);
  let forward = forwardRaw / forwardLength;
  let rightRaw = cross(vec3f(0.0, 1.0, 0.0), forward);
  let rightLength = length(rightRaw);
  var right = rightRaw / max(rightLength, 0.0001);

  if (rightLength < 0.0001) {
    right = vec3f(1.0, 0.0, 0.0);
  }

  let up = normalize(cross(forward, right));
  let world = particle.positionSize.xyz + right * local.x + up * local.y;
  var output: VertexOutput;

  output.position = view.viewProjection * vec4f(world, 1.0);
  output.color = particle.color;
  output.uv = quadUv(vertexIndex);
  output.distanceToCamera = length(view.cameraPosition.xyz - world);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texel = textureSample(particleTexture, particleSampler, input.uv);
  let color = input.color * texel;
  return vec4f(applyParticleFog(color.rgb, input.distanceToCamera), color.a);
}
`.trim();

export const PARTICLE_BURST_RENDER_WGSL = `
const PARTICLE_CURVE_SAMPLE_COUNT: u32 = 16u;

struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  previousViewProjection: mat4x4f,
  fogColor: vec4f,
  fogParams: vec4f,
};

struct ParticleBurstData {
  originBirthTime: vec4f,
  velocityLifetime: vec4f,
  baseSizeTimeScale: vec4f,
};

struct ParticleBurstParams {
  timeGravity: vec4f,
  motion: vec4f,
  sizeCurve: array<vec4f, 4>,
  colorCurve: array<vec4f, 16>,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) uv: vec2f,
  @location(2) distanceToCamera: f32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> particles: array<ParticleBurstData>;
@group(2) @binding(0) var particleTexture: texture_2d<f32>;
@group(2) @binding(1) var particleSampler: sampler;
@group(3) @binding(0) var<uniform> params: ParticleBurstParams;

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

fn rotate2(value: vec2f, radians: f32) -> vec2f {
  let c = cos(radians);
  let s = sin(radians);
  return vec2f(value.x * c - value.y * s, value.x * s + value.y * c);
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn applyParticleFog(color: vec3f, distanceToCamera: f32) -> vec3f {
  let mode = u32(round(view.fogParams.x));

  if (view.fogColor.a <= 0.0 || mode == 0u) {
    return color;
  }

  var fogFactor = 0.0;

  if (mode == 1u) {
    fogFactor = 1.0 - saturate((view.fogParams.w - distanceToCamera) / max(view.fogParams.w - view.fogParams.z, 0.0001));
  } else if (mode == 2u) {
    fogFactor = 1.0 - saturate(exp(-distanceToCamera * view.fogParams.y));
  } else {
    fogFactor = 1.0 - saturate(exp(-distanceToCamera * distanceToCamera * view.fogParams.y * view.fogParams.y));
  }

  return mix(color, view.fogColor.rgb, saturate(fogFactor * view.fogColor.a));
}

fn sizeCurveValue(index: u32) -> f32 {
  let packed = params.sizeCurve[index / 4u];
  let component = index % 4u;

  if (component == 0u) {
    return packed.x;
  }
  if (component == 1u) {
    return packed.y;
  }
  if (component == 2u) {
    return packed.z;
  }
  return packed.w;
}

fn sampleSizeCurve(life: f32) -> f32 {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(sizeCurveValue(lower), sizeCurveValue(upper), fract(scaled));
}

fn sampleColorCurve(life: f32) -> vec4f {
  let maxIndex = PARTICLE_CURVE_SAMPLE_COUNT - 1u;
  let scaled = clamp(life, 0.0, 1.0) * f32(maxIndex);
  let lower = u32(floor(scaled));
  let upper = min(lower + 1u, maxIndex);
  return mix(params.colorCurve[lower], params.colorCurve[upper], fract(scaled));
}

fn particleDisplacement(
  velocity: vec3f,
  gravity: vec3f,
  age: f32,
  damping: f32,
) -> vec3f {
  if (damping <= 0.0001) {
    return velocity * age + 0.5 * gravity * age * age;
  }

  let decay = exp(-damping * age);
  let invDamping = 1.0 / damping;
  let velocityTerm = velocity * ((1.0 - decay) * invDamping);
  let gravityTerm = gravity * (age * invDamping - (1.0 - decay) * invDamping * invDamping);
  return velocityTerm + gravityTerm;
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let particle = particles[instanceIndex];
  let lifetime = max(particle.velocityLifetime.w, 0.001);
  let age = max(0.0, params.timeGravity.x - particle.originBirthTime.w) * particle.baseSizeTimeScale.y;
  let lifeT = clamp(age / lifetime, 0.0, 1.0);
  let alive = select(0.0, 1.0, age < lifetime);
  let position = particle.originBirthTime.xyz + particleDisplacement(
    particle.velocityLifetime.xyz,
    params.timeGravity.yzw,
    age,
    params.motion.x
  );
  let size = max(0.0, particle.baseSizeTimeScale.x * sampleSizeCurve(lifeT) * alive);
  let rotation = particle.baseSizeTimeScale.z + age * particle.baseSizeTimeScale.w;
  let local = rotate2(quadPosition(vertexIndex) * size, rotation);
  let forwardRaw = view.cameraPosition.xyz - position;
  let forwardLength = max(length(forwardRaw), 0.0001);
  let forward = forwardRaw / forwardLength;
  let rightRaw = cross(vec3f(0.0, 1.0, 0.0), forward);
  let rightLength = length(rightRaw);
  var right = rightRaw / max(rightLength, 0.0001);

  if (rightLength < 0.0001) {
    right = vec3f(1.0, 0.0, 0.0);
  }

  let up = normalize(cross(forward, right));
  let world = position + right * local.x + up * local.y;
  var output: VertexOutput;

  output.position = view.viewProjection * vec4f(world, 1.0);
  output.color = sampleColorCurve(lifeT) * alive;
  output.uv = quadUv(vertexIndex);
  output.distanceToCamera = length(view.cameraPosition.xyz - world);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texel = textureSample(particleTexture, particleSampler, input.uv);
  let color = input.color * texel;
  return vec4f(applyParticleFog(color.rgb, input.distanceToCamera), color.a);
}
`.trim();

export interface ParticleComputePipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: unknown;
}

export interface ParticleRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateParticleComputePipelineResourceResult {
  readonly valid: boolean;
  readonly resource: ParticleComputePipelineResource | null;
  readonly diagnostics: readonly ParticlePipelineDiagnostic[];
}

export interface CreateParticleRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: ParticleRenderPipelineResource | null;
  readonly diagnostics: readonly ParticlePipelineDiagnostic[];
}

export type ParticlePipelineDiagnosticCode =
  | "particlePipeline.shaderDiagnostic"
  | "particlePipeline.shaderCreationFailed"
  | "particlePipeline.createComputePipelineUnavailable"
  | "particlePipeline.createRenderPipelineUnavailable"
  | "particlePipeline.pipelineCreationFailed";

export interface ParticlePipelineDiagnostic {
  readonly code: ParticlePipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface ParticlePipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {
  createComputePipeline?: (descriptor: unknown) => unknown;
}

export function particleComputePipelineCacheKey(): string {
  return PARTICLE_COMPUTE_PIPELINE_KEY;
}

export function particleRenderPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null = null,
  sampleCount = 1,
  blendMode: SpriteBlendModeValue = SpriteBlendMode.Additive,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
): string {
  const outputStage =
    tonemap === "none" && outputColorSpace === "linear"
      ? ""
      : `:${createTonemapPipelineKey(tonemap)}:${createOutputColorSpacePipelineKey(outputColorSpace)}`;

  return `${PARTICLE_RENDER_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}:blend-${blendMode}${outputStage}`;
}

export function particleBurstRenderPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null = null,
  sampleCount = 1,
  blendMode: SpriteBlendModeValue = SpriteBlendMode.Additive,
  tonemap: TonemapOperator = "none",
  outputColorSpace: OutputColorSpace = "linear",
): string {
  const outputStage =
    tonemap === "none" && outputColorSpace === "linear"
      ? ""
      : `:${createTonemapPipelineKey(tonemap)}:${createOutputColorSpacePipelineKey(outputColorSpace)}`;

  return `${PARTICLE_BURST_RENDER_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}:blend-${blendMode}${outputStage}`;
}

export async function createParticleComputePipelineResource(options: {
  readonly device: ParticlePipelineDeviceLike;
}): Promise<CreateParticleComputePipelineResourceResult> {
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: PARTICLE_COMPUTE_PIPELINE_KEY,
      code: PARTICLE_COMPUTE_WGSL,
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
          code: "particlePipeline.shaderCreationFailed",
          reason: shaderModule.reason,
          message: shaderModule.message,
        },
      ],
    };
  }

  if (options.device.createComputePipeline === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "particlePipeline.createComputePipelineUnavailable",
          message: "WebGPU device cannot create particle compute pipelines.",
        },
      ],
    };
  }

  const descriptor = {
    label: PARTICLE_COMPUTE_PIPELINE_KEY,
    layout: "auto",
    compute: {
      module: shaderModule.module,
      entryPoint: "cs_main",
    },
  };

  try {
    return {
      valid: true,
      resource: {
        cacheKey: particleComputePipelineCacheKey(),
        shaderModule: shaderModule.module,
        pipeline: options.device.createComputePipeline(descriptor),
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
          code: "particlePipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU particle compute pipeline creation failed.",
        },
      ],
    };
  }
}

export async function createParticleRenderPipelineResource(options: {
  readonly device: ParticlePipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly blendMode?: SpriteBlendModeValue;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
  readonly variant?: "computed" | "burst";
}): Promise<CreateParticleRenderPipelineResourceResult> {
  // AI-17: no-op by default (none + linear) so the pipeline is byte-identical
  // unless the caller opts into the output stage.
  const tonemap = options.tonemap ?? "none";
  const outputColorSpace = options.outputColorSpace ?? "linear";
  const blendMode = options.blendMode ?? SpriteBlendMode.Additive;
  const burst = options.variant === "burst";
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: burst
        ? PARTICLE_BURST_RENDER_PIPELINE_KEY
        : PARTICLE_RENDER_PIPELINE_KEY,
      code: applyOutputStageToFragmentWgsl(
        burst ? PARTICLE_BURST_RENDER_WGSL : PARTICLE_RENDER_WGSL,
        tonemap,
        outputColorSpace,
        burst
          ? PARTICLE_BURST_RENDER_PIPELINE_KEY
          : PARTICLE_RENDER_PIPELINE_KEY,
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
          code: "particlePipeline.shaderCreationFailed",
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
          code: "particlePipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create particle render pipelines.",
        },
      ],
    };
  }

  const descriptor = createParticleRenderPipelineDescriptor({
    label: burst
      ? PARTICLE_BURST_RENDER_PIPELINE_KEY
      : PARTICLE_RENDER_PIPELINE_KEY,
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
    ...(options.depthFormat === undefined
      ? {}
      : { depthFormat: options.depthFormat }),
    ...(options.sampleCount === undefined
      ? {}
      : { sampleCount: options.sampleCount }),
    blendMode,
  });

  try {
    return {
      valid: true,
      resource: {
        cacheKey: burst
          ? particleBurstRenderPipelineCacheKey(
              options.colorFormat,
              options.depthFormat ?? null,
              options.sampleCount ?? 1,
              blendMode,
              tonemap,
              outputColorSpace,
            )
          : particleRenderPipelineCacheKey(
              options.colorFormat,
              options.depthFormat ?? null,
              options.sampleCount ?? 1,
              blendMode,
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
          code: "particlePipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU particle render pipeline creation failed.",
        },
      ],
    };
  }
}

function createParticleRenderPipelineDescriptor(input: {
  readonly label: string;
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly blendMode: SpriteBlendModeValue;
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
          blend: particleBlendState(input.blendMode),
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

function particleBlendState(blendMode: SpriteBlendModeValue): unknown {
  switch (blendMode) {
    case SpriteBlendMode.Opaque:
      return null;
    case SpriteBlendMode.Alpha:
      return {
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
      };
    case SpriteBlendMode.Multiply:
      return {
        color: {
          operation: "add",
          srcFactor: "dst",
          dstFactor: "zero",
        },
        alpha: {
          operation: "add",
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
        },
      };
    case SpriteBlendMode.Additive:
    default:
      return {
        color: {
          operation: "add",
          srcFactor: "src-alpha",
          dstFactor: "one",
        },
        alpha: {
          operation: "add",
          srcFactor: "one",
          dstFactor: "one",
        },
      };
  }
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): ParticlePipelineDiagnostic {
  return {
    code: "particlePipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
