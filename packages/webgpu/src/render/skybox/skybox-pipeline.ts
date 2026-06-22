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

export const SKYBOX_PIPELINE_KEY = "aperture/skybox";

export const SKYBOX_WGSL = `
struct SkyboxViewUniform {
  inverseViewProjection: mat4x4f,
  cameraPosition: vec4f,
  intensity: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) direction: vec3f,
};

@group(0) @binding(0) var<uniform> view: SkyboxViewUniform;
@group(1) @binding(0) var skyboxTexture: texture_cube<f32>;
@group(1) @binding(1) var skyboxSampler: sampler;

fn fullscreenPosition(vertexIndex: u32) -> vec2f {
  let x = array<f32, 3>(-1.0, 3.0, -1.0);
  let y = array<f32, 3>(-1.0, -1.0, 3.0);
  return vec2f(x[vertexIndex], y[vertexIndex]);
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let position = fullscreenPosition(vertexIndex);
  let farWorld = view.inverseViewProjection * vec4f(position, 1.0, 1.0);
  let world = farWorld.xyz / farWorld.w;
  var output: VertexOutput;
  output.position = vec4f(position, 1.0, 1.0);
  output.direction = normalize(world - view.cameraPosition.xyz);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(
    skyboxTexture,
    skyboxSampler,
    input.direction * vec3f(1.0, 1.0, -1.0),
  );
  return vec4f(color.rgb * view.intensity.x, 1.0);
}
`.trim();

export interface CreateSkyboxRenderPipelineResourceOptions {
  readonly device: SkyboxRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}

export type SkyboxRenderPipelineDiagnosticCode =
  | "skyboxRenderPipeline.shaderDiagnostic"
  | "skyboxRenderPipeline.shaderCreationFailed"
  | "skyboxRenderPipeline.createRenderPipelineUnavailable"
  | "skyboxRenderPipeline.pipelineCreationFailed";

export interface SkyboxRenderPipelineDiagnostic {
  readonly code: SkyboxRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface SkyboxRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateSkyboxRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: SkyboxRenderPipelineResource | null;
  readonly diagnostics: readonly SkyboxRenderPipelineDiagnostic[];
}

export interface SkyboxRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createSkyboxRenderPipelineResource(
  options: CreateSkyboxRenderPipelineResourceOptions,
): Promise<CreateSkyboxRenderPipelineResourceResult> {
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: "aperture/skybox",
      code: SKYBOX_WGSL,
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
          code: "skyboxRenderPipeline.shaderCreationFailed",
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
          code: "skyboxRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create skybox render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserSkyboxRenderPipelineDescriptor({
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
        cacheKey: skyboxPipelineCacheKey(
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
          code: "skyboxRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU skybox render pipeline creation failed.",
        },
      ],
    };
  }
}

export function skyboxPipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null,
  sampleCount = 1,
): string {
  return `${SKYBOX_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}`;
}

function createBrowserSkyboxRenderPipelineDescriptor(input: {
  readonly shaderModule: unknown;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): WebGpuRenderPipelineCreateDescriptor {
  return {
    label: `${SKYBOX_PIPELINE_KEY}:${input.colorFormat}`,
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
): SkyboxRenderPipelineDiagnostic {
  return {
    code: "skyboxRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
