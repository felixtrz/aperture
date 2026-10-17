import type { CurrentTextureLike } from "../presentation/current-texture-view.js";

/** A final, single-sampled output. HDR and MSAA intermediates belong to the renderer. */
export interface WebGpuOutputTarget {
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly colorSpace: "srgb";
  readonly alphaMode: "opaque" | "premultiplied";
  readonly sampleCount: 1;
  acquire(): CurrentTextureLike;
}

/** Hold one acquired image for all passes in a frame, including multiple views. */
export function createWebGpuFrameOutput(target: WebGpuOutputTarget): {
  readonly output: WebGpuOutputTarget;
  release(): void;
} {
  let current: CurrentTextureLike | null = null;
  return {
    output: {
      get width() {
        return target.width;
      },
      get height() {
        return target.height;
      },
      get format() {
        return target.format;
      },
      get colorSpace() {
        return target.colorSpace;
      },
      get alphaMode() {
        return target.alphaMode;
      },
      sampleCount: 1,
      acquire() {
        return (current ??= target.acquire());
      },
    },
    release() {
      current = null;
    },
  };
}
