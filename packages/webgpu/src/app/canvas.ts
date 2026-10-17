import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import type { WebGpuOutputTarget } from "../gpu/output-target.js";

export function webGpuAppOutputDimensions(app: {
  readonly canvas?: WebGpuCanvasLike;
  readonly output?: WebGpuOutputTarget;
}): { readonly width: number; readonly height: number } {
  return app.output === undefined
    ? webGpuAppCanvasDimensions(app.canvas)
    : { width: app.output.width, height: app.output.height };
}

export function webGpuAppCanvasDimensions(canvas?: WebGpuCanvasLike): {
  readonly width: number;
  readonly height: number;
} {
  const dimensions = (canvas ?? {}) as {
    readonly width?: unknown;
    readonly height?: unknown;
  };
  const width = typeof dimensions.width === "number" ? dimensions.width : 1;
  const height = typeof dimensions.height === "number" ? dimensions.height : 1;

  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  };
}
