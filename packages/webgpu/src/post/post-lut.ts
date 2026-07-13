// LUT color-grading post stage (E4). Remaps scene color through a 3D color
// lookup table stored as a 2D horizontal strip (the "3D-texture-lite" layout:
// N slices of an N x N red/green tile laid side by side, indexed by blue). This
// avoids depending on 3D textures (E5) while giving a full trilinear 3D LUT.
//
// The strip is uploaded once (cached) from CPU RGBA bytes via queue.writeTexture
// and sampled with textureLoad + manual trilinear interpolation so tile seams do
// not bleed. `intensity` blends the graded result against the original color, so
// intensity 0 is a pass-through and a missing/blank LUT degrades to identity.

import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import { WEBGPU_TEXTURE_USAGE_FLAGS } from "../resources/textures/texture-resources.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";

export interface CreateWebGpuLutColorGradePostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  /**
   * LUT edge size N (the cube is N x N x N). The strip texture is (N*N) wide by
   * N tall. Clamped to [2, 64]. Defaults to 16.
   */
  readonly size?: number;
  /**
   * RGBA bytes for the N-slice strip (length must be N*N*N*4). When omitted an
   * identity LUT is generated so the effect is a pass-through until graded.
   */
  readonly data?: Uint8Array | readonly number[];
  /** Blend of the graded color over the original, in [0, 1]. Defaults to 1. */
  readonly intensity?: number;
}

interface CachedLutPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

interface CachedLutTexture {
  readonly size: number;
  readonly texture: { readonly createView?: () => unknown };
}

/**
 * Build an identity LUT strip: output color == input color. Exported so
 * examples/tests can start from identity and apply a grade.
 */
export function createIdentityLutStripData(size: number): Uint8Array {
  const n = clampInteger(size, 2, 64);
  const data = new Uint8Array(n * n * n * 4);
  const maxIndex = n - 1;

  for (let b = 0; b < n; b += 1) {
    for (let g = 0; g < n; g += 1) {
      for (let r = 0; r < n; r += 1) {
        const x = b * n + r;
        const y = g;
        const offset = (y * (n * n) + x) * 4;
        data[offset] = Math.round((r / maxIndex) * 255);
        data[offset + 1] = Math.round((g / maxIndex) * 255);
        data[offset + 2] = Math.round((b / maxIndex) * 255);
        data[offset + 3] = 255;
      }
    }
  }

  return data;
}

export function createWebGpuLutColorGradePostEffect(
  options: CreateWebGpuLutColorGradePostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "lut";
  const label = options.label ?? "LUT Color Grade Post Effect";
  const enabled = options.enabled;
  const size = clampInteger(options.size ?? 16, 2, 64);
  const intensity = clampFinite(options.intensity ?? 1, 0, 1);
  const expectedLength = size * size * size * 4;
  const lutData =
    options.data === undefined
      ? createIdentityLutStripData(size)
      : normalizeLutData(options.data);
  const lutDataValid = lutData !== null && lutData.length === expectedLength;
  let cachedPipeline: CachedLutPostPipeline | null = null;
  let cachedLut: CachedLutTexture | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];

      if (!lutDataValid) {
        diagnostics.push({
          code: "webGpuPostPass.lutDataInvalid",
          effectId: id,
          message: `LUT post effect '${id}' expects ${expectedLength} bytes for a ${size}^3 strip but received ${lutData?.length ?? 0}.`,
        });
        return preparedLutPass(id, label, [], diagnostics);
      }

      const pipelineKey = lutPipelineKey({
        outputFormat: prepareOptions.outputFormat,
        size,
        intensity,
      });
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createLutPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              key: pipelineKey,
              code: lutPostEffectWgsl({ size, intensity }),
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedLutPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (cachedLut === null || cachedLut.size !== size) {
        cachedLut = createLutStripTexture({
          device: prepareOptions.device,
          size,
          data: lutData as Uint8Array,
          effectId: id,
          diagnostics,
        });
      }

      if (cachedLut === null) {
        return preparedLutPass(id, label, [], diagnostics);
      }

      if (sampler === null) {
        sampler = createLutPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedLutPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `LUT post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedLutPass(id, label, [], diagnostics);
      }

      const lutView = cachedLut.texture.createView?.();

      if (lutView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `LUT post effect '${id}' cannot bind the LUT strip texture.`,
        });
        return preparedLutPass(id, label, [], diagnostics);
      }

      const layout = (
        pipelineResult.pipeline as {
          readonly getBindGroupLayout?: (group: number) => unknown;
        }
      ).getBindGroupLayout?.(0);

      if (layout === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.pipelineLayoutUnavailable",
          effectId: id,
          message: `LUT post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedLutPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `LUT post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedLutPass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
          { binding: 2, resource: lutView },
        ],
      });

      return preparedLutPass(
        id,
        label,
        [
          {
            kind: "setPipeline",
            renderId: 0,
            pipelineKey,
            pipeline: pipelineResult.pipeline,
          },
          {
            kind: "setBindGroup",
            renderId: 0,
            index: 0,
            resourceKey: `${id}:input:${prepareOptions.input.label}:lut:${size}:intensity:${intensity.toFixed(2)}`,
            bindGroup,
          },
          {
            kind: "draw",
            renderId: 0,
            vertexCount: 3,
            instanceCount: 1,
            firstVertex: 0,
            firstInstance: 0,
          },
        ],
        diagnostics,
      );
    },
  };
}

function lutPipelineKey(options: {
  readonly outputFormat: string;
  readonly size: number;
  readonly intensity: number;
}): string {
  return [
    "webgpu-post-lut",
    options.outputFormat,
    `size:${options.size}`,
    `intensity:${options.intensity.toFixed(3)}`,
  ].join("|");
}

function createLutPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly key: string;
  readonly code: string;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedLutPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `LUT post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `LUT post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: options.code,
  });
  const pipeline = options.device.createRenderPipeline({
    label: options.label,
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: options.outputFormat }],
    },
    primitive: { topology: "triangle-list" },
  });

  return { key: options.key, pipeline };
}

function createLutStripTexture(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly size: number;
  readonly data: Uint8Array;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedLutTexture | null {
  if (options.device.createTexture === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createTextureUnavailable",
      effectId: options.effectId,
      message: `LUT post effect '${options.effectId}' cannot create the LUT strip texture.`,
    });
    return null;
  }

  const width = options.size * options.size;
  const height = options.size;
  const queue = (
    options.device as {
      readonly queue?: {
        readonly writeTexture?: (
          destination: unknown,
          data: unknown,
          dataLayout: unknown,
          size: unknown,
        ) => void;
      };
    }
  ).queue;

  if (queue?.writeTexture === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.writeBufferUnavailable",
      effectId: options.effectId,
      message: `LUT post effect '${options.effectId}' cannot upload the LUT strip (queue.writeTexture unavailable).`,
    });
    return null;
  }

  try {
    const texture = options.device.createTexture({
      label: `aperture/post/${options.effectId}/lut`,
      size: { width, height },
      format: "rgba8unorm",
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
    }) as { readonly createView?: () => unknown };

    queue.writeTexture(
      { texture },
      options.data,
      { bytesPerRow: width * 4, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 },
    );

    return { size: options.size, texture };
  } catch (cause) {
    options.diagnostics.push({
      code: "webGpuPostPass.textureCreationFailed",
      effectId: options.effectId,
      message: `LUT post effect '${options.effectId}' LUT strip creation failed: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    });
    return null;
  }
}

function createLutPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `LUT post effect '${options.effectId}' cannot create an input sampler.`,
    });
    return null;
  }

  return options.device.createSampler({
    label: `aperture/post/${options.effectId}/sampler`,
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "nearest",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });
}

function preparedLutPass(
  effectId: string,
  label: string,
  commands: readonly RenderPassCommand[],
  diagnostics: readonly WebGpuPostPassDiagnostic[],
): WebGpuPreparedPostEffectPass {
  return { effectId, label, commands, diagnostics };
}

function normalizeLutData(
  data: Uint8Array | readonly number[],
): Uint8Array | null {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (Array.isArray(data)) {
    return Uint8Array.from(data);
  }

  return null;
}

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function wgslFloat(value: number): string {
  return value.toFixed(6);
}

export function lutPostEffectWgsl(options: {
  readonly size: number;
  readonly intensity: number;
}): string {
  return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var lutTexture: texture_2d<f32>;

const LUT_SIZE: f32 = ${wgslFloat(options.size)};
const LUT_MAX: f32 = ${wgslFloat(options.size - 1)};
const INTENSITY: f32 = ${wgslFloat(options.intensity)};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, 3.0),
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, -1.0),
    vec2f(0.0, 1.0),
    vec2f(2.0, 1.0),
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

// Bilinear fetch of a single blue slice's red/green plane.
fn sampleLutSlice(rg: vec2f, sliceIndex: i32) -> vec3f {
  let coord = clamp(rg, vec2f(0.0), vec2f(1.0)) * LUT_MAX;
  let base = vec2f(floor(coord.x), floor(coord.y));
  let frac = coord - base;
  let x0 = i32(base.x);
  let y0 = i32(base.y);
  let x1 = min(x0 + 1, i32(LUT_MAX));
  let y1 = min(y0 + 1, i32(LUT_MAX));
  let tileX = sliceIndex * i32(LUT_SIZE);
  let c00 = textureLoad(lutTexture, vec2i(tileX + x0, y0), 0).rgb;
  let c10 = textureLoad(lutTexture, vec2i(tileX + x1, y0), 0).rgb;
  let c01 = textureLoad(lutTexture, vec2i(tileX + x0, y1), 0).rgb;
  let c11 = textureLoad(lutTexture, vec2i(tileX + x1, y1), 0).rgb;
  let top = mix(c00, c10, frac.x);
  let bottom = mix(c01, c11, frac.x);
  return mix(top, bottom, frac.y);
}

fn sampleLut(color: vec3f) -> vec3f {
  let c = clamp(color, vec3f(0.0), vec3f(1.0));
  let blue = c.b * LUT_MAX;
  let b0 = i32(floor(blue));
  let b1 = min(b0 + 1, i32(LUT_MAX));
  let fb = blue - floor(blue);
  let slice0 = sampleLutSlice(c.rg, b0);
  let slice1 = sampleLutSlice(c.rg, b1);
  return mix(slice0, slice1, fb);
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let source = textureSample(inputTexture, inputSampler, clamp(input.uv, vec2f(0.0), vec2f(1.0)));
  let graded = sampleLut(source.rgb);
  return vec4f(mix(source.rgb, graded, INTENSITY), source.a);
}
`;
}
