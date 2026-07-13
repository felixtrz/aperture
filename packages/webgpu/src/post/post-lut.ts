// LUT color-grading post stage (E4 shipped a 2D-strip "3D-texture-lite" LUT;
// E5 migrates it to a real `texture_3d<f32>`). Remaps scene color through a 3D
// color lookup table now uploaded as a genuine N x N x N volume texture and
// sampled with hardware trilinear filtering (`textureSampleLevel` + a linear
// sampler), with the standard half-texel scale/bias so the LUT endpoints land on
// texel centers.
//
// The public `data` contract is unchanged — callers still pass the N-slice strip
// (N slices of an N x N red/green tile indexed by blue), so existing LUT authors
// (`createIdentityLutStripData`, example grades) need no change. The strip bytes
// are reshaped into the volume layout at upload time. `intensity` blends the
// graded result against the original color, so intensity 0 is a pass-through and
// a missing/blank LUT degrades to identity.

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
        cachedLut = createLut3dTexture({
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

function createLut3dTexture(options: {
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
      message: `LUT post effect '${options.effectId}' cannot create the LUT volume texture.`,
    });
    return null;
  }

  const n = options.size;
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
      message: `LUT post effect '${options.effectId}' cannot upload the LUT volume (queue.writeTexture unavailable).`,
    });
    return null;
  }

  try {
    const texture = options.device.createTexture({
      label: `aperture/post/${options.effectId}/lut`,
      size: { width: n, height: n, depthOrArrayLayers: n },
      dimension: "3d",
      format: "rgba8unorm",
      usage:
        WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
        WEBGPU_TEXTURE_USAGE_FLAGS.COPY_DST,
    }) as { readonly createView?: () => unknown };

    // Reshape the N-slice strip (blue-indexed tiles of an N x N red/green plane)
    // into the volume layout WebGPU expects: red fastest (width), then green
    // (height/row), then blue (depth/slice).
    queue.writeTexture(
      { texture },
      reshapeLutStripToVolume(options.data, n),
      { bytesPerRow: n * 4, rowsPerImage: n },
      { width: n, height: n, depthOrArrayLayers: n },
    );

    return { size: options.size, texture };
  } catch (cause) {
    options.diagnostics.push({
      code: "webGpuPostPass.textureCreationFailed",
      effectId: options.effectId,
      message: `LUT post effect '${options.effectId}' LUT volume creation failed: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    });
    return null;
  }
}

/**
 * Reshape an N-slice LUT strip (`x = b*N + r`, `y = g`, row-major RGBA) into a
 * dense N x N x N volume (`r` fastest, then `g`, then `b`) suitable for a single
 * `queue.writeTexture` into a `dimension: "3d"` texture. Pure + covered by a unit
 * test so the LUT-to-3D migration is verifiable without a GPU.
 */
export function reshapeLutStripToVolume(
  strip: Uint8Array,
  size: number,
): Uint8Array {
  const n = clampInteger(size, 2, 64);
  const volume = new Uint8Array(n * n * n * 4);

  for (let b = 0; b < n; b += 1) {
    for (let g = 0; g < n; g += 1) {
      for (let r = 0; r < n; r += 1) {
        const stripOffset = (g * (n * n) + (b * n + r)) * 4;
        const volumeOffset = (b * n * n + g * n + r) * 4;
        volume[volumeOffset] = strip[stripOffset] ?? 0;
        volume[volumeOffset + 1] = strip[stripOffset + 1] ?? 0;
        volume[volumeOffset + 2] = strip[stripOffset + 2] ?? 0;
        volume[volumeOffset + 3] = strip[stripOffset + 3] ?? 255;
      }
    }
  }

  return volume;
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
    // The same sampler filters the 3D LUT volume; clamp the depth (blue) axis so
    // the LUT endpoints do not wrap.
    addressModeW: "clamp-to-edge",
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
@group(0) @binding(2) var lutTexture: texture_3d<f32>;

const LUT_SIZE: f32 = ${wgslFloat(options.size)};
// Half-texel scale/bias so color 0 maps to the first texel center and color 1
// to the last, matching the standard 3D-LUT sampling convention.
const LUT_SCALE: f32 = (LUT_SIZE - 1.0) / LUT_SIZE;
const LUT_BIAS: f32 = 0.5 / LUT_SIZE;
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

// Hardware trilinear fetch of the N x N x N LUT volume (r=u, g=v, b=w).
fn sampleLut(color: vec3f) -> vec3f {
  let c = clamp(color, vec3f(0.0), vec3f(1.0));
  let uvw = c * LUT_SCALE + vec3f(LUT_BIAS);
  return textureSampleLevel(lutTexture, inputSampler, uvw, 0.0).rgb;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let source = textureSample(inputTexture, inputSampler, clamp(input.uv, vec2f(0.0), vec2f(1.0)));
  let graded = sampleLut(source.rgb);
  return vec4f(mix(source.rgb, graded, INTENSITY), source.a);
}
`;
}
