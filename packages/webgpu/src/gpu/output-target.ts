import type {
  WebGpuCanvasContextLike,
  WebGpuCanvasLike,
} from "./initialize-webgpu.js";
import type { CurrentTextureLike } from "../app/presentation/current-texture-view.js";
import type { WebGpuOutputTarget } from "@aperture-engine/gpu/internal/gpu/output-target.js";
export {
  createWebGpuFrameOutput,
  type WebGpuOutputTarget,
} from "@aperture-engine/gpu/internal/gpu/output-target.js";

export function createWebGpuCanvasOutput(options: {
  readonly canvas?: WebGpuCanvasLike;
  readonly context: WebGpuCanvasContextLike;
  readonly format: string;
  readonly alphaMode?: "opaque" | "premultiplied";
}): WebGpuOutputTarget {
  const dimensions = options.canvas as
    | { width?: number; height?: number }
    | undefined;
  return {
    get width() {
      return Math.max(1, Math.floor(dimensions?.width ?? 1));
    },
    get height() {
      return Math.max(1, Math.floor(dimensions?.height ?? 1));
    },
    format: options.format,
    colorSpace: "srgb",
    alphaMode: options.alphaMode ?? "opaque",
    sampleCount: 1,
    acquire() {
      const texture = (
        options.context as { getCurrentTexture?: () => CurrentTextureLike }
      ).getCurrentTexture?.();
      if (texture === undefined)
        throw new Error("WebGPU canvas did not provide an output texture.");
      return texture;
    },
  };
}
