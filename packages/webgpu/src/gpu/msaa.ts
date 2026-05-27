import type { CurrentTextureLike } from "../app/presentation/current-texture-view.js";
import { WEBGPU_TEXTURE_USAGE_FLAGS } from "../resources/textures/texture-resources.js";

export type WebGpuMsaaSampleCount = 1 | 4;

export interface WebGpuMsaaConfig {
  readonly requestedSampleCount: number;
  readonly sampleCount: WebGpuMsaaSampleCount;
  readonly enabled: boolean;
  readonly clamped: boolean;
  readonly supportedSampleCounts: readonly WebGpuMsaaSampleCount[];
}

export type WebGpuMsaaColorTextureDiagnosticCode =
  | "webGpuMsaaColorTexture.createTextureUnavailable"
  | "webGpuMsaaColorTexture.textureCreationFailed"
  | "webGpuMsaaColorTexture.textureViewCreationFailed";

export interface WebGpuMsaaColorTextureDiagnostic {
  readonly code: WebGpuMsaaColorTextureDiagnosticCode;
  readonly message: string;
}

export interface WebGpuMsaaTextureLike extends CurrentTextureLike {
  destroy?: () => void;
}

export interface WebGpuMsaaTextureDeviceLike {
  createTexture?: (descriptor: unknown) => WebGpuMsaaTextureLike;
}

export interface CachedWebGpuMsaaColorTextureResource {
  readonly texture: WebGpuMsaaTextureLike;
  readonly view: unknown;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly sampleCount: WebGpuMsaaSampleCount;
  readonly label: string;
}

export interface WebGpuMsaaColorTextureCacheSlot {
  current: CachedWebGpuMsaaColorTextureResource | null;
}

export interface CreateOrReuseWebGpuMsaaColorTextureResult {
  readonly valid: boolean;
  readonly status: "created" | "reused" | "disabled" | "failed";
  readonly resource: CachedWebGpuMsaaColorTextureResource | null;
  readonly diagnostics: readonly WebGpuMsaaColorTextureDiagnostic[];
}

const WEBGPU_SUPPORTED_MSAA_SAMPLE_COUNTS = [1, 4] as const;

export function resolveWebGpuMsaaConfig(
  requestedSampleCount: number | undefined,
): WebGpuMsaaConfig {
  const requested = sanitizeRequestedSampleCount(requestedSampleCount);
  const sampleCount: WebGpuMsaaSampleCount = requested > 1 ? 4 : 1;

  return {
    requestedSampleCount: requested,
    sampleCount,
    enabled: sampleCount > 1,
    clamped: requested !== sampleCount,
    supportedSampleCounts: WEBGPU_SUPPORTED_MSAA_SAMPLE_COUNTS,
  };
}

export function createWebGpuMsaaColorTextureCacheSlot(): WebGpuMsaaColorTextureCacheSlot {
  return { current: null };
}

export function createOrReuseWebGpuMsaaColorTexture(options: {
  readonly device: WebGpuMsaaTextureDeviceLike;
  readonly cache: WebGpuMsaaColorTextureCacheSlot;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly sampleCount: WebGpuMsaaSampleCount;
  readonly label: string;
}): CreateOrReuseWebGpuMsaaColorTextureResult {
  if (options.sampleCount <= 1) {
    return {
      valid: true,
      status: "disabled",
      resource: null,
      diagnostics: [],
    };
  }

  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const current = options.cache.current;

  if (
    current !== null &&
    current.width === width &&
    current.height === height &&
    current.format === options.format &&
    current.sampleCount === options.sampleCount
  ) {
    return {
      valid: true,
      status: "reused",
      resource: current,
      diagnostics: [],
    };
  }

  if (options.device.createTexture === undefined) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: "webGpuMsaaColorTexture.createTextureUnavailable",
          message: "WebGPU MSAA color target creation requires createTexture.",
        },
      ],
    };
  }

  current?.texture.destroy?.();

  let texture: WebGpuMsaaTextureLike;

  try {
    texture = options.device.createTexture({
      label: options.label,
      size: { width, height },
      format: options.format,
      sampleCount: options.sampleCount,
      usage: WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT,
    });
  } catch (cause) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: "webGpuMsaaColorTexture.textureCreationFailed",
          message: `WebGPU MSAA color texture creation failed: ${messageFromCause(
            cause,
          )}`,
        },
      ],
    };
  }

  const view = texture.createView?.();

  if (view === undefined) {
    texture.destroy?.();
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: "webGpuMsaaColorTexture.textureViewCreationFailed",
          message: "WebGPU MSAA color texture did not provide a texture view.",
        },
      ],
    };
  }

  const resource: CachedWebGpuMsaaColorTextureResource = {
    texture,
    view,
    width,
    height,
    format: options.format,
    sampleCount: options.sampleCount,
    label: options.label,
  };

  options.cache.current = resource;
  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

function sanitizeRequestedSampleCount(
  requestedSampleCount: number | undefined,
): number {
  if (
    requestedSampleCount === undefined ||
    !Number.isFinite(requestedSampleCount)
  ) {
    return 1;
  }

  return Math.max(1, Math.floor(requestedSampleCount));
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
