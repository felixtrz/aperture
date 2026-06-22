import { WEBGPU_TEXTURE_USAGE_FLAGS } from "./texture-resources.js";

export const WEBGPU_APP_DEPTH_FORMAT = "depth24plus";

interface WebGpuDepthTextureLike {
  createView(): unknown;
  destroy?(): void;
}

interface WebGpuDepthTextureDeviceLike {
  createTexture(descriptor: {
    readonly label?: string;
    readonly size: readonly [number, number, number];
    readonly format: string;
    readonly sampleCount?: number;
    readonly usage: number;
  }): WebGpuDepthTextureLike;
}

export interface CachedWebGpuDepthTextureResource {
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly sampleCount: number;
  readonly texture: WebGpuDepthTextureLike;
  readonly view: unknown;
}

export interface WebGpuDepthTextureCacheSlot {
  current: CachedWebGpuDepthTextureResource | null;
}

export interface CreateOrReuseWebGpuDepthTextureOptions {
  readonly device: WebGpuDepthTextureDeviceLike;
  readonly cache: WebGpuDepthTextureCacheSlot;
  readonly width: number;
  readonly height: number;
  readonly format?: string;
  readonly sampleCount?: number;
  readonly label?: string;
}

export interface CreateOrReuseWebGpuDepthTextureResult {
  readonly status: "created" | "reused";
  readonly resource: CachedWebGpuDepthTextureResource;
}

export function createWebGpuDepthTextureCacheSlot(): WebGpuDepthTextureCacheSlot {
  return { current: null };
}

export function createOrReuseWebGpuDepthTexture(
  options: CreateOrReuseWebGpuDepthTextureOptions,
): CreateOrReuseWebGpuDepthTextureResult {
  const format = options.format ?? WEBGPU_APP_DEPTH_FORMAT;
  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const sampleCount = Math.max(1, Math.floor(options.sampleCount ?? 1));
  const current = options.cache.current;

  if (
    current !== null &&
    current.format === format &&
    current.width === width &&
    current.height === height &&
    current.sampleCount === sampleCount
  ) {
    return { status: "reused", resource: current };
  }

  current?.texture.destroy?.();

  const texture = options.device.createTexture({
    label: options.label ?? "aperture/webgpu-app/depth",
    size: [width, height, 1],
    format,
    sampleCount,
    usage: webGpuRenderAttachmentUsage(),
  });
  const resource: CachedWebGpuDepthTextureResource = {
    format,
    width,
    height,
    sampleCount,
    texture,
    view: texture.createView(),
  };

  options.cache.current = resource;
  return { status: "created", resource };
}

function webGpuRenderAttachmentUsage(): number {
  const usage = (
    globalThis as {
      GPUTextureUsage?: { RENDER_ATTACHMENT: number; TEXTURE_BINDING: number };
    }
  ).GPUTextureUsage;

  return (
    (usage?.RENDER_ATTACHMENT ?? WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT) |
    (usage?.TEXTURE_BINDING ?? WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING)
  );
}
