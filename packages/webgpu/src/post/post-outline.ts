// Outline post stage (E4, AC2). Draws a colored silhouette ring around the
// entities the app has SELECTED, using a per-frame selection mask the renderer
// produces by reusing the ID-buffer picking pipeline (the picking ID buffer the
// engine already ships): the mask texture stores WEBGPU_OUTLINE_MASK_SELECTED_ID
// for a visible fragment of a selected entity and 0 everywhere else (occlusion
// handled by the mask pass's own depth test). This effect edge-detects that mask
// — a pixel is on the outline when it is NOT selected but a neighbor within
// `thickness` pixels IS — and composites the outline color over the input.
//
// When no selection mask is supplied (no selection, or a route that does not
// produce the mask) the effect degrades to an exact identity copy of the input,
// so an outline-configured frame with nothing selected is a pass-through.

import type {
  WebGpuPostEffect,
  WebGpuPostPassDiagnostic,
  WebGpuPostPassDeviceLike,
  WebGpuPreparedPostEffectPass,
} from "./post-pass.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";

/** Mask value a selected, visible fragment writes; 0 is background/unselected. */
export const WEBGPU_OUTLINE_MASK_SELECTED_ID = 1;

export interface CreateWebGpuOutlinePostEffectOptions {
  readonly id?: string;
  readonly label?: string;
  readonly enabled?: boolean;
  /** Outline color as linear RGB in [0, 1]. Defaults to orange. */
  readonly color?: readonly [number, number, number];
  /** Outline half-width in pixels. Clamped to [1, 8]. Defaults to 2. */
  readonly thickness?: number;
  /** Outline opacity over the scene, in [0, 1]. Defaults to 1. */
  readonly opacity?: number;
  /**
   * Tint applied over the interior (visible surface) of a selected entity, in
   * [0, 1]. 0 leaves the fill untouched (outline only). Defaults to 0.
   */
  readonly fillOpacity?: number;
}

interface CachedOutlinePostPipeline {
  readonly key: string;
  readonly pipeline: unknown;
}

export function createWebGpuOutlinePostEffect(
  options: CreateWebGpuOutlinePostEffectOptions = {},
): WebGpuPostEffect {
  const id = options.id ?? "outline";
  const label = options.label ?? "Outline Post Effect";
  const enabled = options.enabled;
  const color = normalizeColor(options.color);
  const thickness = clampInteger(options.thickness ?? 2, 1, 8);
  const opacity = clampFinite(options.opacity ?? 1, 0, 1);
  const fillOpacity = clampFinite(options.fillOpacity ?? 0, 0, 1);
  let cachedOutline: CachedOutlinePostPipeline | null = null;
  let cachedIdentity: CachedOutlinePostPipeline | null = null;
  let sampler: unknown | null = null;

  return {
    id,
    label,
    ...(enabled === undefined ? {} : { enabled }),
    requiresSelectionMask: true,
    prepare(prepareOptions) {
      const diagnostics: WebGpuPostPassDiagnostic[] = [];
      const maskView =
        prepareOptions.selectionMask?.texture.createView?.() ?? undefined;
      const useOutline =
        prepareOptions.selectionMask !== undefined && maskView !== undefined;

      if (sampler === null) {
        sampler = createOutlinePostSampler({
          device: prepareOptions.device,
          effectId: id,
          diagnostics,
        });
      }

      if (sampler === null) {
        return preparedOutlinePass(id, label, [], diagnostics);
      }

      const inputView = prepareOptions.input.texture.createView?.();

      if (inputView === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.inputTextureViewUnavailable",
          effectId: id,
          message: `Outline post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
        });
        return preparedOutlinePass(id, label, [], diagnostics);
      }

      const pipelineKey = useOutline
        ? outlinePipelineKey({
            outputFormat: prepareOptions.outputFormat,
            color,
            thickness,
            opacity,
            fillOpacity,
          })
        : `webgpu-post-outline-identity|${prepareOptions.outputFormat}`;
      const cached = useOutline ? cachedOutline : cachedIdentity;
      const pipelineResult =
        cached?.key === pipelineKey
          ? cached
          : createOutlinePostPipeline({
              device: prepareOptions.device,
              outputFormat: prepareOptions.outputFormat,
              key: pipelineKey,
              code: useOutline
                ? outlinePostEffectWgsl({
                    color,
                    thickness,
                    opacity,
                    fillOpacity,
                  })
                : outlineIdentityWgsl(),
              label: `${prepareOptions.label}:${id}:pipeline`,
              effectId: id,
              diagnostics,
            });

      if (pipelineResult === null) {
        return preparedOutlinePass(id, label, [], diagnostics);
      }

      if (useOutline) {
        cachedOutline = pipelineResult;
      } else {
        cachedIdentity = pipelineResult;
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
          message: `Outline post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
        });
        return preparedOutlinePass(id, label, [], diagnostics);
      }

      if (prepareOptions.device.createBindGroup === undefined) {
        diagnostics.push({
          code: "webGpuPostPass.createBindGroupUnavailable",
          effectId: id,
          message: `Outline post effect '${id}' cannot create a texture sampling bind group.`,
        });
        return preparedOutlinePass(id, label, [], diagnostics);
      }

      const bindGroup = prepareOptions.device.createBindGroup({
        label: `${prepareOptions.label}:${id}:bind-group`,
        layout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: inputView },
          ...(useOutline && maskView !== undefined
            ? [{ binding: 2, resource: maskView }]
            : []),
        ],
      });

      return preparedOutlinePass(
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
            resourceKey: `${id}:input:${prepareOptions.input.label}:mask:${useOutline ? (prepareOptions.selectionMask?.label ?? "yes") : "none"}:thickness:${thickness}`,
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

function outlinePipelineKey(options: {
  readonly outputFormat: string;
  readonly color: readonly [number, number, number];
  readonly thickness: number;
  readonly opacity: number;
  readonly fillOpacity: number;
}): string {
  return [
    "webgpu-post-outline",
    options.outputFormat,
    `color:${options.color.map((c) => c.toFixed(3)).join(",")}`,
    `thickness:${options.thickness}`,
    `opacity:${options.opacity.toFixed(3)}`,
    `fill:${options.fillOpacity.toFixed(3)}`,
  ].join("|");
}

function createOutlinePostPipeline(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly outputFormat: string;
  readonly key: string;
  readonly code: string;
  readonly label: string;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): CachedOutlinePostPipeline | null {
  if (options.device.createShaderModule === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createShaderModuleUnavailable",
      effectId: options.effectId,
      message: `Outline post effect '${options.effectId}' cannot create a shader module.`,
    });
    return null;
  }

  if (options.device.createRenderPipeline === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createRenderPipelineUnavailable",
      effectId: options.effectId,
      message: `Outline post effect '${options.effectId}' cannot create a render pipeline.`,
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

function createOutlinePostSampler(options: {
  readonly device: WebGpuPostPassDeviceLike;
  readonly effectId: string;
  readonly diagnostics: WebGpuPostPassDiagnostic[];
}): unknown | null {
  if (options.device.createSampler === undefined) {
    options.diagnostics.push({
      code: "webGpuPostPass.createSamplerUnavailable",
      effectId: options.effectId,
      message: `Outline post effect '${options.effectId}' cannot create an input sampler.`,
    });
    return null;
  }

  return options.device.createSampler({
    label: `aperture/post/${options.effectId}/sampler`,
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });
}

function preparedOutlinePass(
  effectId: string,
  label: string,
  commands: readonly RenderPassCommand[],
  diagnostics: readonly WebGpuPostPassDiagnostic[],
): WebGpuPreparedPostEffectPass {
  return { effectId, label, commands, diagnostics };
}

function normalizeColor(
  color: readonly [number, number, number] | undefined,
): [number, number, number] {
  if (color === undefined) {
    return [1, 0.55, 0.1];
  }

  return [
    clampFinite(color[0], 0, 1),
    clampFinite(color[1], 0, 1),
    clampFinite(color[2], 0, 1),
  ];
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

const OUTLINE_VERTEX_WGSL = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

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
`;

export function outlineIdentityWgsl(): string {
  return `
${OUTLINE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(inputTexture, inputSampler, clamp(input.uv, vec2f(0.0), vec2f(1.0)));
}
`;
}

export function outlinePostEffectWgsl(options: {
  readonly color: readonly [number, number, number];
  readonly thickness: number;
  readonly opacity: number;
  readonly fillOpacity: number;
}): string {
  return `
${OUTLINE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var selectionMask: texture_2d<u32>;

const OUTLINE_COLOR: vec3f = vec3f(${wgslFloat(options.color[0])}, ${wgslFloat(options.color[1])}, ${wgslFloat(options.color[2])});
const THICKNESS: i32 = ${options.thickness};
const THICKNESS_SQUARED: f32 = ${wgslFloat(options.thickness * options.thickness)};
const OPACITY: f32 = ${wgslFloat(options.opacity)};
const FILL_OPACITY: f32 = ${wgslFloat(options.fillOpacity)};
const SELECTED_ID: u32 = ${WEBGPU_OUTLINE_MASK_SELECTED_ID}u;

fn loadMask(coord: vec2i, dims: vec2u) -> u32 {
  let maxCoord = vec2i(i32(dims.x) - 1, i32(dims.y) - 1);
  let clamped = clamp(coord, vec2i(0, 0), maxCoord);
  return textureLoad(selectionMask, clamped, 0).r;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let uv = clamp(input.uv, vec2f(0.0), vec2f(1.0));
  let source = textureSample(inputTexture, inputSampler, uv);
  let dims = textureDimensions(selectionMask);
  let center = vec2i(vec2f(uv.x * f32(dims.x), uv.y * f32(dims.y)));
  let selfSelected = loadMask(center, dims) == SELECTED_ID;

  // A pixel is on the outline when it is NOT selected but a nearby pixel IS.
  var neighborSelected = false;
  for (var dy = -THICKNESS; dy <= THICKNESS; dy = dy + 1) {
    for (var dx = -THICKNESS; dx <= THICKNESS; dx = dx + 1) {
      if (f32(dx * dx + dy * dy) > THICKNESS_SQUARED) {
        continue;
      }
      if (loadMask(center + vec2i(dx, dy), dims) == SELECTED_ID) {
        neighborSelected = true;
      }
    }
  }

  var color = source.rgb;
  if (selfSelected) {
    color = mix(color, OUTLINE_COLOR, FILL_OPACITY);
  } else if (neighborSelected) {
    color = mix(color, OUTLINE_COLOR, OPACITY);
  }

  return vec4f(color, source.a);
}
`;
}
