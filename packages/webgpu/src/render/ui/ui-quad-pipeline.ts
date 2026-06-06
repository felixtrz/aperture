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

export const UI_PANEL_PIPELINE_KEY = "aperture/ui-panel";
export const UI_IMAGE_PIPELINE_KEY = "aperture/ui-image";

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
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) clipRect: vec4f,
  @location(3) screen: vec2f,
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
  return output;
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

  return input.color;
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

  return textureSample(uiTexture, uiSampler, input.uv) * input.color;
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
): string {
  return `${UI_PANEL_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}`;
}

export function uiImagePipelineCacheKey(
  colorFormat: string,
  depthFormat: string | null = null,
  sampleCount = 1,
): string {
  return `${UI_IMAGE_PIPELINE_KEY}:${colorFormat}:${depthFormat ?? "no-depth"}:samples-${sampleCount}`;
}

export async function createUiPanelRenderPipelineResource(options: {
  readonly device: UiQuadRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): Promise<CreateUiQuadRenderPipelineResourceResult> {
  return createUiQuadRenderPipelineResource({
    ...options,
    label: UI_PANEL_PIPELINE_KEY,
    code: UI_PANEL_WGSL,
    cacheKey: uiPanelPipelineCacheKey(
      options.colorFormat,
      options.depthFormat ?? null,
      options.sampleCount ?? 1,
    ),
  });
}

export async function createUiImageRenderPipelineResource(options: {
  readonly device: UiQuadRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
}): Promise<CreateUiQuadRenderPipelineResourceResult> {
  return createUiQuadRenderPipelineResource({
    ...options,
    label: UI_IMAGE_PIPELINE_KEY,
    code: UI_IMAGE_WGSL,
    cacheKey: uiImagePipelineCacheKey(
      options.colorFormat,
      options.depthFormat ?? null,
      options.sampleCount ?? 1,
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
}): Promise<CreateUiQuadRenderPipelineResourceResult> {
  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: {
      label: options.label,
      code: options.code,
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
