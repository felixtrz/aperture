import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import {
  createOrReuseWebGpuDepthTexture,
  WEBGPU_APP_DEPTH_FORMAT,
  type CachedWebGpuDepthTextureResource,
  type WebGpuDepthTextureCacheSlot,
} from "../resources/textures/depth-texture-resource.js";

/**
 * Single-sample copy of the frame's multisampled scene depth, so the overlay
 * boundary — which composites into the SINGLE-SAMPLE presentation target and
 * therefore cannot bind a multisampled depth attachment — can still depth-test
 * post-tonemap mesh and particle draws against the scene.
 *
 * Without it, every post-tonemap draw in an MSAA app is drawn unconditionally
 * on top of the resolved frame: a translucent board decal paints straight over
 * the character standing on it, and a spark behind a wall shines through it.
 * The same app at `sampleCount: 1` depth-tests those draws correctly, so the
 * behavior used to depend on an unrelated quality setting.
 *
 * The copy takes sample 0 of each pixel. A depth attachment cannot be resolved
 * by the hardware (WebGPU has no depth resolve), and a single depth value per
 * pixel is all a single-sample attachment can hold, so an overlay's occlusion
 * edge is aliased by one pixel where a multisampled scene edge is not. Color
 * is untouched — the occluder's own edge stays fully antialiased.
 */
export interface WebGpuAppOverlayDepthResolvePlan {
  /** Single-sample depth view the overlay boundary binds read-only. */
  readonly view: unknown;
  /** Fullscreen depth copy, encoded as its own boundary before the overlay. */
  readonly commands: readonly RenderPassCommand[];
  readonly diagnostics: readonly WebGpuAppOverlayDepthResolveDiagnostic[];
}

export interface WebGpuAppOverlayDepthResolveDiagnostic {
  readonly code: string;
  readonly severity: "error";
  readonly message: string;
}

export interface WebGpuAppOverlayDepthResolveCache {
  /** Single-sample destination texture, reused across frames. */
  resolved: WebGpuDepthTextureCacheSlot;
  /** Pipeline + bind group, keyed by the inputs that shape them. */
  pipeline: { key: string; pipeline: unknown } | null;
  bindGroup: { key: string; bindGroup: unknown } | null;
}

interface OverlayDepthResolveDeviceLike {
  createShaderModule?: (descriptor: {
    readonly label?: string;
    readonly code: string;
  }) => unknown;
  createRenderPipeline?: (descriptor: Record<string, unknown>) => {
    readonly getBindGroupLayout?: (group: number) => unknown;
  };
  createBindGroup?: (descriptor: Record<string, unknown>) => unknown;
  createTexture: Parameters<
    typeof createOrReuseWebGpuDepthTexture
  >[0]["device"]["createTexture"];
}

export function createWebGpuAppOverlayDepthResolveCache(): WebGpuAppOverlayDepthResolveCache {
  return {
    resolved: { current: null },
    pipeline: null,
    bindGroup: null,
  };
}

/**
 * WGSL for the copy: a fullscreen triangle whose fragment stage writes only
 * `@builtin(frag_depth)`. The color target is bound with `writeMask: 0`, which
 * WebGPU allows a fragment stage to leave unwritten, so the pass touches the
 * already-composited presentation image not at all.
 */
export const WEBGPU_APP_OVERLAY_DEPTH_RESOLVE_WGSL = `
@group(0) @binding(0) var sceneDepth: texture_depth_multisampled_2d;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, 3.0),
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
  );
  return vec4f(positions[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) position: vec4f) -> @builtin(frag_depth) f32 {
  return textureLoad(sceneDepth, vec2i(position.xy), 0);
}
`;

/**
 * Build the frame's overlay depth copy, or return `null` when the overlay can
 * bind the app's depth attachment directly (single-sample apps) — the caller
 * then keeps its existing read-only binding and encodes no extra pass.
 */
export function prepareWebGpuAppOverlayDepthResolve(options: {
  readonly device: unknown;
  readonly cache: WebGpuAppOverlayDepthResolveCache;
  readonly depthAttachment: CachedWebGpuDepthTextureResource;
  readonly colorFormat: string;
  readonly label: string;
}): WebGpuAppOverlayDepthResolvePlan | null {
  if (options.depthAttachment.sampleCount <= 1) {
    return null;
  }

  const device = options.device as OverlayDepthResolveDeviceLike;
  const diagnostics: WebGpuAppOverlayDepthResolveDiagnostic[] = [];

  if (
    device.createShaderModule === undefined ||
    device.createRenderPipeline === undefined ||
    device.createBindGroup === undefined ||
    typeof device.createTexture !== "function"
  ) {
    return unavailable(
      diagnostics,
      "webgpu.overlayDepthResolve.deviceUnavailable",
      `${options.label}: the device cannot build the overlay depth copy, so post-tonemap draws in this MSAA frame are not depth-tested.`,
    );
  }

  const resolved = createOrReuseWebGpuDepthTexture({
    device: device as Parameters<
      typeof createOrReuseWebGpuDepthTexture
    >[0]["device"],
    cache: options.cache.resolved,
    width: options.depthAttachment.width,
    height: options.depthAttachment.height,
    format: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: 1,
    label: "aperture/webgpu-app/depth/overlay-resolved",
  }).resource;

  const pipelineKey = `${options.colorFormat}|${WEBGPU_APP_DEPTH_FORMAT}|${options.depthAttachment.sampleCount}`;
  let cachedPipeline = options.cache.pipeline;

  if (cachedPipeline?.key !== pipelineKey) {
    const module = device.createShaderModule({
      label: `${options.label}:overlay-depth-resolve:shader`,
      code: WEBGPU_APP_OVERLAY_DEPTH_RESOLVE_WGSL,
    });
    cachedPipeline = {
      key: pipelineKey,
      pipeline: device.createRenderPipeline({
        label: `${options.label}:overlay-depth-resolve`,
        layout: "auto",
        vertex: { module, entryPoint: "vs" },
        fragment: {
          module,
          entryPoint: "fs",
          // writeMask 0: the copy owns depth only. The presentation image it
          // loads is stored back byte-identical.
          targets: [{ format: options.colorFormat, writeMask: 0 }],
        },
        primitive: { topology: "triangle-list" },
        depthStencil: {
          format: WEBGPU_APP_DEPTH_FORMAT,
          depthWriteEnabled: true,
          depthCompare: "always",
        },
      }),
    };
    options.cache.pipeline = cachedPipeline;
    options.cache.bindGroup = null;
  }

  const layout = (
    cachedPipeline.pipeline as {
      readonly getBindGroupLayout?: (group: number) => unknown;
    }
  ).getBindGroupLayout?.(0);

  if (layout === undefined) {
    return unavailable(
      diagnostics,
      "webgpu.overlayDepthResolve.pipelineLayoutUnavailable",
      `${options.label}: the overlay depth copy pipeline does not expose its group 0 layout, so post-tonemap draws in this MSAA frame are not depth-tested.`,
    );
  }

  // The scene depth VIEW is recreated whenever the depth texture is (resize,
  // sample-count change), so key the bind group on the view identity rather
  // than on the descriptor that produced it.
  const bindGroupKey = `${pipelineKey}|${String(resolved.width)}x${String(resolved.height)}`;
  let cachedBindGroup = options.cache.bindGroup;

  if (
    cachedBindGroup?.key !== bindGroupKey ||
    options.cache.pipeline !== cachedPipeline
  ) {
    cachedBindGroup = {
      key: bindGroupKey,
      bindGroup: device.createBindGroup({
        label: `${options.label}:overlay-depth-resolve:bind-group`,
        layout,
        entries: [{ binding: 0, resource: options.depthAttachment.view }],
      }),
    };
    options.cache.bindGroup = cachedBindGroup;
  }

  return {
    view: resolved.view,
    commands: [
      {
        kind: "setPipeline",
        renderId: 0,
        pipelineKey: `overlay-depth-resolve|${pipelineKey}`,
        pipeline: cachedPipeline.pipeline,
      },
      {
        kind: "setBindGroup",
        renderId: 0,
        index: 0,
        resourceKey: `overlay-depth-resolve|${bindGroupKey}`,
        bindGroup: cachedBindGroup.bindGroup,
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
  };
}

function unavailable(
  diagnostics: WebGpuAppOverlayDepthResolveDiagnostic[],
  code: string,
  message: string,
): WebGpuAppOverlayDepthResolvePlan {
  diagnostics.push({ code, severity: "error", message });
  return { view: null, commands: [], diagnostics };
}
