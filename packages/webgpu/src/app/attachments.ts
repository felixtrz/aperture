import {
  createOrReuseWebGpuMsaaColorTexture,
  createWebGpuMsaaColorTextureCacheSlot,
  type CachedWebGpuMsaaColorTextureResource,
  type WebGpuMsaaColorTextureCacheSlot,
  type WebGpuMsaaConfig,
} from "../gpu/msaa.js";
import {
  createOrReuseWebGpuDepthTexture,
  createWebGpuDepthTextureCacheSlot,
  WEBGPU_APP_DEPTH_FORMAT,
  type CachedWebGpuDepthTextureResource,
  type WebGpuDepthTextureCacheSlot,
} from "../resources/textures/depth-texture-resource.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

interface WebGpuAppAttachmentContext {
  readonly initialization: {
    readonly device: unknown;
  };
  readonly msaa: Pick<WebGpuMsaaConfig, "sampleCount">;
  // The format the lit scene renders into. Equals the swapchain format by
  // default; rgba16float when the HDR scene buffer is active (M5-T4). The MSAA
  // color attachment for a swapchain target must match the scene-render format
  // so it can resolve into the (possibly HDR) offscreen scene texture.
  readonly sceneRenderFormat: string;
}

export interface WebGpuAppMsaaReport {
  readonly requestedSampleCount: number;
  readonly sampleCount: number;
  readonly enabled: boolean;
  readonly clamped: boolean;
  readonly supportedSampleCounts: readonly number[];
  readonly colorTargets: number;
  readonly colorTexturesCreated: number;
  readonly colorTexturesReused: number;
}

export interface WebGpuAppMsaaColorTargetResult {
  readonly valid: boolean;
  readonly status: "created" | "reused" | "disabled" | "failed";
  readonly resource: CachedWebGpuMsaaColorTextureResource | null;
  readonly diagnostics: readonly unknown[];
}

export function createWebGpuAppDepthAttachmentForTarget(
  app: WebGpuAppAttachmentContext,
  resourceCache: WebGpuAppResourceCache,
  target: WebGpuAppFrameBoundaryTarget,
): CachedWebGpuDepthTextureResource {
  return createOrReuseWebGpuDepthTexture({
    device: app.initialization.device as Parameters<
      typeof createOrReuseWebGpuDepthTexture
    >[0]["device"],
    cache: depthCacheSlotForTarget(resourceCache, target),
    width: target.width,
    height: target.height,
    format: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: app.msaa.sampleCount,
  }).resource;
}

export function createWebGpuAppMsaaColorTargetForTarget(
  app: WebGpuAppAttachmentContext,
  resourceCache: WebGpuAppResourceCache,
  target: WebGpuAppFrameBoundaryTarget,
): WebGpuAppMsaaColorTargetResult {
  const result = createOrReuseWebGpuMsaaColorTexture({
    device: app.initialization.device as Parameters<
      typeof createOrReuseWebGpuMsaaColorTexture
    >[0]["device"],
    cache: msaaColorCacheSlotForTarget(resourceCache, target),
    width: target.width,
    height: target.height,
    format:
      target.source === "swapchain" ? app.sceneRenderFormat : target.format,
    sampleCount: app.msaa.sampleCount,
    label:
      target.source === "swapchain"
        ? "aperture/webgpu-app/msaa/swapchain"
        : `aperture/webgpu-app/msaa/${target.renderTargetKey}`,
  });

  return {
    valid: result.valid,
    status: result.status,
    resource: result.resource,
    diagnostics: result.diagnostics,
  };
}

export function createWebGpuAppMsaaReport(input: {
  readonly config: WebGpuMsaaConfig;
  readonly colorTargets: number;
  readonly colorTexturesCreated: number;
  readonly colorTexturesReused: number;
}): WebGpuAppMsaaReport {
  return {
    requestedSampleCount: input.config.requestedSampleCount,
    sampleCount: input.config.sampleCount,
    enabled: input.config.enabled,
    clamped: input.config.clamped,
    supportedSampleCounts: input.config.supportedSampleCounts,
    colorTargets: input.colorTargets,
    colorTexturesCreated: input.colorTexturesCreated,
    colorTexturesReused: input.colorTexturesReused,
  };
}

function depthCacheSlotForTarget(
  resourceCache: WebGpuAppResourceCache,
  target: WebGpuAppFrameBoundaryTarget,
): WebGpuDepthTextureCacheSlot {
  if (target.source === "swapchain") {
    return resourceCache.depth;
  }

  let slot = resourceCache.depthByRenderTarget.get(target.renderTargetKey);

  if (slot === undefined) {
    slot = createWebGpuDepthTextureCacheSlot();
    resourceCache.depthByRenderTarget.set(target.renderTargetKey, slot);
  }

  return slot;
}

function msaaColorCacheSlotForTarget(
  resourceCache: WebGpuAppResourceCache,
  target: WebGpuAppFrameBoundaryTarget,
): WebGpuMsaaColorTextureCacheSlot {
  if (target.source === "swapchain") {
    return resourceCache.msaaColor;
  }

  let slot = resourceCache.msaaColorByRenderTarget.get(target.renderTargetKey);

  if (slot === undefined) {
    slot = createWebGpuMsaaColorTextureCacheSlot();
    resourceCache.msaaColorByRenderTarget.set(target.renderTargetKey, slot);
  }

  return slot;
}
