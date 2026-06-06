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

export const PARTICLE_COMPUTE_PIPELINE_KEY = "aperture/gpu-particles-compute";
export const PARTICLE_RENDER_PIPELINE_KEY = "aperture/gpu-particles-render";

export const PARTICLE_COMPUTE_WGSL = `
struct ParticleParams {
  frameSeedCapacityFlags: vec4u,
  originRadiusTime: vec4f,
  colorA: vec4f,
  colorB: vec4f,
  sizeSpeedLife: vec4f,
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

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  let capacity = params.frameSeedCapacityFlags.z;

  if (index >= capacity) {
    return;
  }

  if (index == 0u) {
    particles[index].positionSize = vec4f(
      params.originRadiusTime.x,
      params.originRadiusTime.y,
      0.0,
      max(params.sizeSpeedLife.x, params.sizeSpeedLife.y)
    );
    particles[index].color = params.colorA;
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
  let size = mix(params.sizeSpeedLife.x, params.sizeSpeedLife.y, c);
  let color = mix(params.colorA, params.colorB, c);

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
  viewport: vec4f,
};

struct ParticleData {
  positionSize: vec4f,
  color: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> particles: array<ParticleData>;

fn quadPosition(vertexIndex: u32) -> vec2f {
  let x = array<f32, 6>(-0.5, 0.5, 0.5, -0.5, 0.5, -0.5);
  let y = array<f32, 6>(-0.5, -0.5, 0.5, -0.5, 0.5, 0.5);
  return vec2f(x[vertexIndex], y[vertexIndex]);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let particle = particles[instanceIndex];
  let local = quadPosition(vertexIndex) * particle.positionSize.w;
  let world = particle.positionSize.xyz + vec3f(local, 0.0);
  var output: VertexOutput;

  output.position = view.viewProjection * vec4f(world, 1.0);
  output.color = particle.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
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
): string {
  return `${PARTICLE_RENDER_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}`;
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
}): Promise<CreateParticleRenderPipelineResourceResult> {
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: PARTICLE_RENDER_PIPELINE_KEY,
      code: PARTICLE_RENDER_WGSL,
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
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
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
        cacheKey: particleRenderPipelineCacheKey(
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
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${PARTICLE_RENDER_PIPELINE_KEY}:${input.colorFormat}`,
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
              dstFactor: "one",
            },
            alpha: {
              operation: "add",
              srcFactor: "one",
              dstFactor: "one",
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
): ParticlePipelineDiagnostic {
  return {
    code: "particlePipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
