import {
  assetHandleKey,
  createRenderTargetHandle,
  type AssetRegistry,
  type RenderTargetHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import {
  isRenderTargetAsset,
  resolveRenderTargetAssetFormat,
  validateRenderTargetAsset,
  type RenderTargetAsset,
} from "@aperture-engine/render";
import type { CurrentTextureLike } from "./presentation/current-texture-view.js";
import {
  WEBGPU_TEXTURE_USAGE_FLAGS,
  type TextureGpuResource,
} from "../resources/textures/texture-resources.js";

// Same shape as app-texture-sampler-resources' sourceAssetCacheKey; declared
// locally because that module consults this one for render-target fallbacks
// (importing it here would create a module cycle).
function sourceAssetCacheKey(
  handle: Parameters<typeof assetHandleKey>[0],
  version: number,
): string {
  return `${assetHandleKey(handle)}@${version}`;
}

// B1 (three.js parity plan): realize renderer-independent `RenderTargetAsset`
// sources into renderer-owned GPU color textures. One live texture exists per
// handle; the realization is keyed by handle + registry version
// (`sourceAssetCacheKey`), so re-publishing the same handle (facade
// `renderTargets.resize(...)`) destroys the previous texture and creates the
// new one while `Camera.renderTargetId` and `material.texture(...)` references
// stay handle-stable. Depth and MSAA color attachments stay renderer-owned in
// the existing per-target frame-boundary caches (`depthByRenderTarget` /
// `msaaColorByRenderTarget`), mirroring the proven low-level lifecycle.

interface RenderTargetTextureLike extends CurrentTextureLike {
  createView?: (descriptor?: unknown) => unknown;
  destroy?: () => void;
}

interface RenderTargetDeviceLike {
  readonly createTexture?: (descriptor: unknown) => RenderTargetTextureLike;
}

export interface WebGpuAppRealizedRenderTarget {
  /** `render-target:<id>@<version>` — changes on every republish. */
  readonly cacheKey: string;
  /** `render-target:<id>` — stable across republishes. */
  readonly renderTargetKey: string;
  readonly texture: RenderTargetTextureLike;
  /**
   * Reused color view for texture-binding consumers: the default 2d view for
   * 2d targets, a `dimension: "cube"` view for cube targets (B2).
   */
  readonly view: unknown;
  readonly width: number;
  readonly height: number;
  /** Concrete resolved format ("swapchain" already substituted). */
  readonly format: string;
  readonly dimension: RenderTargetAsset["dimension"];
  /**
   * Cube targets only (B2): one reused 2d render-attachment view per cube
   * layer (+X, -X, +Y, -Y, +Z, -Z) the capture face passes render into.
   */
  readonly faceViews: readonly unknown[] | null;
  readonly sampleable: boolean;
  readonly msaa: RenderTargetAsset["msaa"];
}

export interface WebGpuAppRenderTargetResourceCounters {
  renderTargetTexturesCreated: number;
  renderTargetTexturesReused: number;
  renderTargetTexturesDestroyed: number;
}

export interface WebGpuAppRenderTargetResourceState {
  /** Live realizations keyed by stable render-target handle key. */
  readonly targets: Map<string, WebGpuAppRealizedRenderTarget>;
  /**
   * Completed cube captures per stable render-target handle key (B2). Bumped
   * once per frame in which the target's face passes were submitted; IBL
   * consumption (`renderTargetSource`) folds it into the versioned resource
   * keys so the prefilter re-runs after every capture.
   */
  readonly captureGenerations: Map<string, number>;
  readonly counters: WebGpuAppRenderTargetResourceCounters;
  /**
   * Swapchain/canvas format used to resolve `format: "swapchain"`. Written by
   * the app at creation time and refreshed by the frame-target resolution;
   * null only before the app has initialized (direct unit-test setups set it
   * explicitly).
   */
  appFormat: string | null;
  /** App-level MSAA sample count (pipelines are compiled once per app). */
  appSampleCount: number;
}

export function createWebGpuAppRenderTargetResourceState(): WebGpuAppRenderTargetResourceState {
  return {
    targets: new Map(),
    captureGenerations: new Map(),
    counters: {
      renderTargetTexturesCreated: 0,
      renderTargetTexturesReused: 0,
      renderTargetTexturesDestroyed: 0,
    },
    appFormat: null,
    appSampleCount: 1,
  };
}

export type RealizeWebGpuAppRenderTargetResult =
  | { readonly ok: true; readonly realized: WebGpuAppRealizedRenderTarget }
  | {
      readonly ok: false;
      readonly reason: "invalid-asset" | "creation-failed";
      readonly message: string;
    };

/**
 * Create (or reuse) the GPU color texture for a facade render-target source
 * asset. A version bump on the same handle destroys the previous texture and
 * realizes a new one — the low-level resize/reuse semantics, renderer-owned.
 */
export function realizeWebGpuAppRenderTarget(options: {
  readonly device: unknown;
  readonly state: WebGpuAppRenderTargetResourceState;
  readonly handle: RenderTargetHandle;
  readonly asset: RenderTargetAsset;
  readonly version: number;
}): RealizeWebGpuAppRenderTargetResult {
  const renderTargetKey = assetHandleKey(options.handle);
  const cacheKey = sourceAssetCacheKey(options.handle, options.version);
  const cached = options.state.targets.get(renderTargetKey);

  if (cached !== undefined && cached.cacheKey === cacheKey) {
    options.state.counters.renderTargetTexturesReused += 1;
    return { ok: true, realized: cached };
  }

  const validation = validateRenderTargetAsset(options.asset);

  if (!validation.valid) {
    return {
      ok: false,
      reason: "invalid-asset",
      message: validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.message)
        .join(" "),
    };
  }

  const appFormat = options.state.appFormat;

  if (options.asset.format === "swapchain" && appFormat === null) {
    return {
      ok: false,
      reason: "creation-failed",
      message: `Render target '${renderTargetKey}' declares format 'swapchain' but the app swapchain format is not known yet.`,
    };
  }

  const format = resolveRenderTargetAssetFormat(options.asset, appFormat ?? "");
  const usage =
    WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT |
    (options.asset.sampleable ? WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING : 0);
  const device = options.device as RenderTargetDeviceLike;

  if (typeof device.createTexture !== "function") {
    return {
      ok: false,
      reason: "creation-failed",
      message: `WebGPU device cannot create the render target texture for '${renderTargetKey}' (createTexture unavailable).`,
    };
  }

  const isCube = options.asset.dimension === "cube";
  let texture: RenderTargetTextureLike;

  try {
    texture = device.createTexture({
      label: `aperture/webgpu-app/render-target/${options.handle.id}`,
      size: [options.asset.width, options.asset.height, isCube ? 6 : 1],
      format,
      usage,
    });
  } catch (error) {
    return {
      ok: false,
      reason: "creation-failed",
      message: `Render target '${renderTargetKey}' texture creation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Handle-stable reuse: the superseded version's texture is destroyed the
  // moment its replacement exists, so a resize never leaks the old texture.
  if (cached !== undefined) {
    cached.texture.destroy?.();
    options.state.counters.renderTargetTexturesDestroyed += 1;
  }

  const realized: WebGpuAppRealizedRenderTarget = {
    cacheKey,
    renderTargetKey,
    texture,
    // Cube targets bind as a cube view (IBL / cube consumers); 2d targets
    // keep the whole-texture default view.
    view: isCube
      ? (texture.createView?.({
          label: `aperture/webgpu-app/render-target/${options.handle.id}/cube`,
          dimension: "cube",
          baseArrayLayer: 0,
          arrayLayerCount: 6,
        }) ?? null)
      : (texture.createView?.() ?? null),
    width: options.asset.width,
    height: options.asset.height,
    format,
    dimension: options.asset.dimension,
    faceViews: isCube
      ? Array.from(
          { length: 6 },
          (_, face) =>
            texture.createView?.({
              label: `aperture/webgpu-app/render-target/${options.handle.id}/face${face}`,
              dimension: "2d",
              baseArrayLayer: face,
              arrayLayerCount: 1,
            }) ?? null,
        )
      : null,
    sampleable: options.asset.sampleable,
    msaa: options.asset.msaa,
  };

  options.state.targets.set(renderTargetKey, realized);
  options.state.counters.renderTargetTexturesCreated += 1;
  return { ok: true, realized };
}

export type ResolveWebGpuAppRenderTargetColorTextureResult =
  | { readonly status: "no-render-target" }
  | {
      readonly status: "not-ready";
      readonly renderTargetKey: string;
      readonly assetStatus: string;
    }
  | { readonly status: "not-sampleable"; readonly renderTargetKey: string }
  | {
      readonly status: "cube-binding-unsupported";
      readonly renderTargetKey: string;
    }
  | {
      readonly status: "failed";
      readonly renderTargetKey: string;
      readonly message: string;
    }
  | {
      readonly status: "resolved";
      readonly cacheKey: string;
      readonly resource: TextureGpuResource;
    };

/**
 * Serve a texture-handle binding from the facade render target registered
 * under the same id (B1 "material.texture(id) just works"). Only consulted
 * when no texture source asset exists for the handle, so existing texture
 * assets keep precedence.
 */
export function resolveWebGpuAppRenderTargetColorTexture(options: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly state: WebGpuAppRenderTargetResourceState;
  readonly handle: TextureHandle;
}): ResolveWebGpuAppRenderTargetColorTextureResult {
  const renderTargetHandle = createRenderTargetHandle(options.handle.id);
  const entry = options.assets.get<"render-target", unknown>(
    renderTargetHandle,
  );

  if (entry === undefined) {
    return { status: "no-render-target" };
  }

  const renderTargetKey = assetHandleKey(renderTargetHandle);

  if (entry.status !== "ready" || !isRenderTargetAsset(entry.asset)) {
    // Not a facade asset (e.g. the low-level live-texture route) — fall back
    // to the texture-asset diagnostics rather than claiming this handle.
    if (entry.status === "ready") {
      return { status: "no-render-target" };
    }

    return { status: "not-ready", renderTargetKey, assetStatus: entry.status };
  }

  if (!entry.asset.sampleable) {
    return { status: "not-sampleable", renderTargetKey };
  }

  // B2 deviation: user texture bindings are 2d-only (custom-WGSL layouts are
  // hard-coded to viewDimension "2d"), so a cube target cannot serve a plain
  // `material.texture` binding — consume it through the environment-map
  // `renderTargetSource` (IBL) instead.
  if (entry.asset.dimension === "cube") {
    return { status: "cube-binding-unsupported", renderTargetKey };
  }

  const realizeResult = realizeWebGpuAppRenderTarget({
    device: options.device,
    state: options.state,
    handle: renderTargetHandle,
    asset: entry.asset,
    version: entry.version,
  });

  if (!realizeResult.ok) {
    return {
      status: "failed",
      renderTargetKey,
      message: realizeResult.message,
    };
  }

  const realized = realizeResult.realized;

  return {
    status: "resolved",
    cacheKey: realized.cacheKey,
    resource: {
      resourceKey: assetHandleKey(options.handle),
      texture: realized.texture,
      view: realized.view,
      descriptor: {
        size: [realized.width, realized.height, 1],
        format: realized.format,
        usage:
          WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT |
          WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING,
      },
    },
  };
}

/**
 * Completed-capture count for a cube render target (0 before its first
 * capture). Stable handle key input (`render-target:<id>`).
 */
export function webGpuAppRenderTargetCaptureGeneration(
  state: WebGpuAppRenderTargetResourceState,
  renderTargetKey: string,
): number {
  return state.captureGenerations.get(renderTargetKey) ?? 0;
}

/**
 * Record one completed cube capture (all face passes submitted this frame).
 * Called by the frame boundary assembly; returns the new generation.
 */
export function bumpWebGpuAppRenderTargetCaptureGeneration(
  state: WebGpuAppRenderTargetResourceState,
  renderTargetKey: string,
): number {
  const generation = (state.captureGenerations.get(renderTargetKey) ?? 0) + 1;

  state.captureGenerations.set(renderTargetKey, generation);
  return generation;
}

// B2: the app's render-target realization state, reachable from the app
// object (mirrors registerWebGpuAppEnvironmentResourceCache) so the
// environment-asset orchestration can resolve `renderTargetSource` cubes
// without threading the resource cache through every caller.
const APP_RENDER_TARGET_RESOURCE_STATES = new WeakMap<
  object,
  WebGpuAppRenderTargetResourceState
>();

export function registerWebGpuAppRenderTargetResourceState(
  app: object,
  state: WebGpuAppRenderTargetResourceState,
): void {
  APP_RENDER_TARGET_RESOURCE_STATES.set(app, state);
}

export function getWebGpuAppRenderTargetResourceState(
  app: object,
): WebGpuAppRenderTargetResourceState | undefined {
  return APP_RENDER_TARGET_RESOURCE_STATES.get(app);
}
