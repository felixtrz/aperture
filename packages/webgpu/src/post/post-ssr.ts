import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import {
  postDepthLoadFunctionWgsl,
  postDepthPipelineKeyToken,
  postDepthTextureBindingWgsl,
  resolvePostDepthSampleCount,
} from "./post-depth-sampling.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";

export interface CreateWebGpuSsrPostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly opacity?: number;
  readonly maxSteps?: number;
  readonly stridePixels?: number;
  readonly thickness?: number;
  readonly near?: number;
  readonly far?: number;
  readonly fovYRadians?: number;
  readonly maxDistance?: number;
  readonly fresnel?: boolean;
  readonly distanceAttenuation?: boolean;
  readonly reflectionBlurPixels?: number;
  readonly fallbackOpacity?: number;
}

interface CachedSsrPostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuSsrPostEffect(
  options: CreateWebGpuSsrPostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "ssr";
  const label = options.label ?? "SSR Post Effect";
  const enabled = options.enabled;
  const opacity = clampFinite(options.opacity ?? 0.42, 0, 1);
  const maxSteps = clampInteger(options.maxSteps ?? 28, 4, 96);
  const stridePixels = clampFinite(options.stridePixels ?? 3.5, 1, 24);
  const thickness = clampFinite(options.thickness ?? 0.045, 0.001, 0.35);
  const near = clampFinite(options.near ?? 0.1, 0.0001, 100000);
  const far = clampFinite(
    options.far ?? 1000,
    Math.max(near + 0.0001, 0.0002),
    1000000,
  );
  const fovYRadians = clampFinite(
    options.fovYRadians ?? Math.PI / 3,
    0.001,
    Math.PI - 0.001,
  );
  const maxDistance = clampFinite(options.maxDistance ?? 12, 0.01, far - near);
  const fresnel = options.fresnel ?? true;
  const distanceAttenuation = options.distanceAttenuation ?? true;
  const reflectionBlurPixels = clampFinite(
    options.reflectionBlurPixels ?? 1.25,
    0,
    8,
  );
  const fallbackOpacity = clampFinite(options.fallbackOpacity ?? 0.16, 0, 1);
  let cachedPipeline: CachedSsrPostPipeline | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    requiresDepthTexture: true,
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];

      if (prepareOptions.depth === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.depthTextureUnavailable",
          effectId: id,
          message: `SSR post effect '${id}' requires the renderer-owned scene depth texture.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
      }

      const depthSampleCount = resolvePostDepthSampleCount(
        prepareOptions.depth.sampleCount,
      );
      const pipelineKey = ssrPipelineKey({
        outputFormat: prepareOptions.outputFormat,
        depthSampleCount,
        opacity,
        maxSteps,
        stridePixels,
        thickness,
        near,
        far,
        fovYRadians,
        maxDistance,
        fresnel,
        distanceAttenuation,
        reflectionBlurPixels,
        fallbackOpacity,
      });
      const pipelineResult =
        cachedPipeline?.key === pipelineKey
          ? cachedPipeline
          : createSsrPostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              depthSampleCount,
              opacity,
              maxSteps,
              stridePixels,
              thickness,
              near,
              far,
              fovYRadians,
              maxDistance,
              fresnel,
              distanceAttenuation,
              reflectionBlurPixels,
              fallbackOpacity,
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedSsrPass(id, label, [], diagnostics);
      }

      cachedPipeline = pipelineResult;

      if (sampler === null) {
        sampler = createSsrPostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedSsrPass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `SSR post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
      }

      const depthView = prepareOptions.depth.texture.createView?.();

      if (depthView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `SSR post effect '${id}' cannot sample depth texture '${prepareOptions.depth.label}'.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
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
          message: `SSR post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `SSR post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedSsrPass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
          { binding: 2, resource: depthView },
        ],
      });

      return preparedSsrPass(
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
            resourceKey: `${id}:input:${prepareOptions.input.label}:depth:${prepareOptions.depth.label}:depthSamples:${depthSampleCount}:opacity:${opacity.toFixed(2)}:distance:${maxDistance.toFixed(2)}:fresnel:${String(fresnel)}`,
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

function ssrPipelineKey(options: {
  readonly outputFormat: string;
  readonly depthSampleCount: number;
  readonly opacity: number;
  readonly maxSteps: number;
  readonly stridePixels: number;
  readonly thickness: number;
  readonly near: number;
  readonly far: number;
  readonly fovYRadians: number;
  readonly maxDistance: number;
  readonly fresnel: boolean;
  readonly distanceAttenuation: boolean;
  readonly reflectionBlurPixels: number;
  readonly fallbackOpacity: number;
}): string {
  return [
    "webgpu-post-ssr",
    options.outputFormat,
    postDepthPipelineKeyToken(options.depthSampleCount),
    `opacity:${options.opacity.toFixed(3)}`,
    `steps:${options.maxSteps}`,
    `stride:${options.stridePixels.toFixed(3)}`,
    `thickness:${options.thickness.toFixed(4)}`,
    `near:${options.near.toFixed(4)}`,
    `far:${options.far.toFixed(3)}`,
    `fovY:${options.fovYRadians.toFixed(4)}`,
    `maxDistance:${options.maxDistance.toFixed(3)}`,
    `fresnel:${String(options.fresnel)}`,
    `attenuate:${String(options.distanceAttenuation)}`,
    `blur:${options.reflectionBlurPixels.toFixed(3)}`,
    `fallback:${options.fallbackOpacity.toFixed(3)}`,
  ].join("|");
}

function createSsrPostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly depthSampleCount: number;
  readonly opacity: number;
  readonly maxSteps: number;
  readonly stridePixels: number;
  readonly thickness: number;
  readonly near: number;
  readonly far: number;
  readonly fovYRadians: number;
  readonly maxDistance: number;
  readonly fresnel: boolean;
  readonly distanceAttenuation: boolean;
  readonly reflectionBlurPixels: number;
  readonly fallbackOpacity: number;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedSsrPostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `SSR post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `SSR post effect '${options.effectId}' cannot create a render pipeline.`,
    });
    return null;
  }

  const module = options.device.createShaderModule({
    label: `${options.label}:shader`,
    code: ssrPostEffectWgsl(options),
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

  return {
    key: ssrPipelineKey(options),
    pipeline,
  };
}

function createSsrPostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `SSR post effect '${options.effectId}' cannot create an input sampler.`,
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

function preparedSsrPass(
  effectId: string,
  label: string,
  commands: readonly RenderPassCommand[],
  diagnostics: readonly WebGpuPostPassDiagnostic[],
): WebGpuPreparedPostEffectPass {
  return {
    effectId,
    label,
    commands,
    diagnostics,
  };
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

function ssrPostEffectWgsl(options: {
  readonly depthSampleCount: number;
  readonly opacity: number;
  readonly maxSteps: number;
  readonly stridePixels: number;
  readonly thickness: number;
  readonly near: number;
  readonly far: number;
  readonly fovYRadians: number;
  readonly maxDistance: number;
  readonly fresnel: boolean;
  readonly distanceAttenuation: boolean;
  readonly reflectionBlurPixels: number;
  readonly fallbackOpacity: number;
}): string {
  return `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
${postDepthTextureBindingWgsl(options.depthSampleCount)}

const OPACITY: f32 = ${wgslFloat(options.opacity)};
const MAX_STEPS: u32 = ${options.maxSteps}u;
const STRIDE_PIXELS: f32 = ${wgslFloat(options.stridePixels)};
const THICKNESS: f32 = ${wgslFloat(options.thickness)};
const NEAR_PLANE: f32 = ${wgslFloat(options.near)};
const FAR_PLANE: f32 = ${wgslFloat(options.far)};
const TAN_HALF_FOV_Y: f32 = ${wgslFloat(Math.tan(options.fovYRadians * 0.5))};
const MAX_DISTANCE: f32 = ${wgslFloat(options.maxDistance)};
const USE_FRESNEL: bool = ${options.fresnel ? "true" : "false"};
const USE_DISTANCE_ATTENUATION: bool = ${options.distanceAttenuation ? "true" : "false"};
const REFLECTION_BLUR_PIXELS: f32 = ${wgslFloat(options.reflectionBlurPixels)};
const FALLBACK_OPACITY: f32 = ${wgslFloat(options.fallbackOpacity)};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, 3.0),
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 2.0),
    vec2f(0.0, 0.0),
    vec2f(2.0, 0.0),
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

fn clampCoord(coord: vec2i, dims: vec2u) -> vec2i {
  let maxCoord = vec2i(i32(dims.x) - 1, i32(dims.y) - 1);
  return clamp(coord, vec2i(0, 0), maxCoord);
}

fn coordFromUv(uv: vec2f, dims: vec2u) -> vec2i {
  let clampedUv = clamp(uv, vec2f(0.0), vec2f(0.999999));
  let pixel = clampedUv * vec2f(f32(dims.x), f32(dims.y));
  return clampCoord(vec2i(i32(pixel.x), i32(pixel.y)), dims);
}

${postDepthLoadFunctionWgsl(options.depthSampleCount)}

fn loadDepthUv(uv: vec2f, dims: vec2u) -> f32 {
  return loadDepth(coordFromUv(uv, dims), dims);
}

fn viewDepth(rawDepth: f32) -> f32 {
  let denominator = max(FAR_PLANE - rawDepth * (FAR_PLANE - NEAR_PLANE), 0.000001);
  return (NEAR_PLANE * FAR_PLANE) / denominator;
}

fn viewPosition(uv: vec2f, dims: vec2u) -> vec3f {
  let clampedUv = clamp(uv, vec2f(0.0), vec2f(1.0));
  let rawDepth = loadDepthUv(clampedUv, dims);
  let depth = viewDepth(rawDepth);
  let aspect = f32(dims.x) / max(f32(dims.y), 1.0);
  let ndc = vec2f(clampedUv.x * 2.0 - 1.0, (1.0 - clampedUv.y) * 2.0 - 1.0);
  return vec3f(ndc.x * depth * TAN_HALF_FOV_Y * aspect, ndc.y * depth * TAN_HALF_FOV_Y, -depth);
}

fn projectViewPosition(position: vec3f, dims: vec2u) -> vec2f {
  let depth = max(-position.z, NEAR_PLANE);
  let aspect = f32(dims.x) / max(f32(dims.y), 1.0);
  let ndc = vec2f(
    position.x / max(depth * TAN_HALF_FOV_Y * aspect, 0.000001),
    position.y / max(depth * TAN_HALF_FOV_Y, 0.000001),
  );
  return vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
}

fn viewNormal(origin: vec3f, uv: vec2f, dims: vec2u, texel: vec2f) -> vec3f {
  let px = viewPosition(uv + vec2f(texel.x, 0.0), dims);
  let py = viewPosition(uv - vec2f(0.0, texel.y), dims);
  let faceNormal = cross(px - origin, py - origin);
  let normalLength = length(faceNormal);
  if (normalLength <= 0.000001) {
    return vec3f(0.0, 0.0, 1.0);
  }
  return faceNormal / normalLength;
}

fn sampleColor(uv: vec2f) -> vec4f {
  return textureSampleLevel(inputTexture, inputSampler, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0);
}

fn sampleReflectionColor(uv: vec2f, texel: vec2f) -> vec3f {
  if (REFLECTION_BLUR_PIXELS <= 0.0) {
    return sampleColor(uv).rgb;
  }

  let offset = texel * REFLECTION_BLUR_PIXELS;
  let center = sampleColor(uv).rgb * 0.4;
  let horizontal = sampleColor(uv + vec2f(offset.x, 0.0)).rgb + sampleColor(uv - vec2f(offset.x, 0.0)).rgb;
  let vertical = sampleColor(uv + vec2f(0.0, offset.y)).rgb + sampleColor(uv - vec2f(0.0, offset.y)).rgb;
  return center + (horizontal + vertical) * 0.15;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let textureUv = vec2f(input.uv.x, 1.0 - input.uv.y);
  let source = sampleColor(textureUv);
  let dims = textureDimensions(depthTexture);
  let centerRawDepth = loadDepthUv(textureUv, dims);

  if (centerRawDepth >= 0.9999 || OPACITY <= 0.0) {
    return source;
  }

  let receiverMask = smoothstep(0.48, 0.78, textureUv.y);
  if (receiverMask <= 0.001) {
    return source;
  }

  let texel = vec2f(1.0 / f32(dims.x), 1.0 / f32(dims.y));
  let origin = viewPosition(textureUv, dims);
  let normal = viewNormal(origin, textureUv, dims, texel);
  let incident = normalize(origin);
  let reflectionDirection = normalize(reflect(incident, normal));
  let viewDirection = normalize(-origin);
  let fresnelSchlick = pow(clamp(1.0 - abs(dot(viewDirection, normal)), 0.0, 1.0), 5.0);
  let fresnel = select(1.0, 0.35 + 0.65 * fresnelSchlick, USE_FRESNEL);
  let centerDepth = -origin.z;
  let pixelWorldStride = max(centerDepth * STRIDE_PIXELS * texel.y * 2.0 * TAN_HALF_FOV_Y, 0.001);
  let stepDistance = max(pixelWorldStride, MAX_DISTANCE / f32(MAX_STEPS));
  var hitColor = vec3f(0.0);
  var hitWeight = 0.0;

  for (var step = 1u; step <= MAX_STEPS; step = step + 1u) {
    let distance = min(MAX_DISTANCE, f32(step) * stepDistance);
    let rayPosition = origin + reflectionDirection * distance;

    if (rayPosition.z >= -NEAR_PLANE) {
      break;
    }

    let marchUv = projectViewPosition(rayPosition, dims);

    if (marchUv.y <= 0.0 || marchUv.x <= 0.0 || marchUv.x >= 1.0) {
      break;
    }

    let sampleDepth = viewDepth(loadDepthUv(marchUv, dims));
    let rayDepth = -rayPosition.z;
    let depthDelta = rayDepth - sampleDepth;
    let hit = 1.0 - smoothstep(THICKNESS * 0.25, THICKNESS, abs(depthDelta));

    if (hit > 0.0) {
      let edgeFade = smoothstep(0.02, 0.16, min(min(marchUv.x, 1.0 - marchUv.x), marchUv.y));
      let distanceFade = select(1.0, 1.0 - clamp(distance / MAX_DISTANCE, 0.0, 1.0), USE_DISTANCE_ATTENUATION);
      hitColor = sampleReflectionColor(marchUv, texel);
      hitWeight = hit * edgeFade * distanceFade * fresnel;
      break;
    }
  }

  if (hitWeight <= 0.0) {
    let mirrorUv = vec2f(textureUv.x, clamp(1.0 - textureUv.y, 0.0, 1.0));
    hitColor = sampleReflectionColor(mirrorUv, texel);
    hitWeight = FALLBACK_OPACITY * fresnel * (1.0 - smoothstep(FAR_PLANE * 0.98, FAR_PLANE, centerDepth));
  }

  let reflectionMask = receiverMask * hitWeight * OPACITY;
  let reflected = mix(source.rgb, hitColor, clamp(reflectionMask, 0.0, 1.0));
  return vec4f(reflected, source.a);
}
`;
}
