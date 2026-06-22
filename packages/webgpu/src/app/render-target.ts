import {
  assetHandleKey,
  type RenderTargetHandle,
} from "@aperture-engine/simulation";
import type { CurrentTextureLike } from "./presentation/current-texture-view.js";

export interface WebGpuAppRenderTargetAssetInput {
  readonly texture: CurrentTextureLike;
  readonly width: number;
  readonly height: number;
  readonly format?: string;
  readonly label?: string;
}

export interface WebGpuAppRenderTargetAsset {
  readonly texture: CurrentTextureLike;
  readonly width: number;
  readonly height: number;
  readonly format?: string;
  readonly label?: string;
}

export function createWebGpuAppRenderTargetAsset(
  input: WebGpuAppRenderTargetAssetInput,
): WebGpuAppRenderTargetAsset {
  if (!Number.isInteger(input.width) || input.width <= 0) {
    throw new RangeError("WebGPU app render target width must be positive.");
  }

  if (!Number.isInteger(input.height) || input.height <= 0) {
    throw new RangeError("WebGPU app render target height must be positive.");
  }

  return Object.freeze({
    texture: input.texture,
    width: input.width,
    height: input.height,
    ...(input.format === undefined ? {} : { format: input.format }),
    ...(input.label === undefined ? {} : { label: input.label }),
  });
}

export function createWebGpuAppRenderTargetDiagnostic(input: {
  readonly code:
    | "webGpuApp.renderTargetMissing"
    | "webGpuApp.renderTargetNotReady"
    | "webGpuApp.renderTargetInvalid"
    | "webGpuApp.renderTargetFormatMismatch";
  readonly viewId: number;
  readonly renderTarget: RenderTargetHandle;
  readonly message: string;
  readonly status?: string;
}): {
  readonly code: typeof input.code;
  readonly message: string;
  readonly viewId: number;
  readonly renderTargetKey: string;
  readonly status?: string;
} {
  return {
    code: input.code,
    message: input.message,
    viewId: input.viewId,
    renderTargetKey: assetHandleKey(input.renderTarget),
    ...(input.status === undefined ? {} : { status: input.status }),
  };
}

export function isWebGpuAppRenderTargetAsset(
  value: unknown,
): value is WebGpuAppRenderTargetAsset {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const asset = value as Partial<WebGpuAppRenderTargetAsset>;
  const width = asset.width;
  const height = asset.height;

  return (
    typeof asset.texture === "object" &&
    asset.texture !== null &&
    typeof asset.texture.createView === "function" &&
    width !== undefined &&
    Number.isInteger(width) &&
    width > 0 &&
    height !== undefined &&
    Number.isInteger(height) &&
    height > 0 &&
    (asset.format === undefined || typeof asset.format === "string")
  );
}
