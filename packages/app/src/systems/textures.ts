import {
  createTextureAsset,
  validateTextureAsset,
  type TextureAsset,
  type TextureColorSpace,
  type TextureFormat,
  type TextureSemantic,
  type TextureUsage,
} from "@aperture-engine/render";
import {
  createTextureHandle,
  type AssetRegistry,
  type TextureHandle,
} from "@aperture-engine/simulation";
import { ApertureSystemError } from "./errors.js";

// D3 (three.js parity plan): dynamic / procedural texture source assets authored
// by worker systems. `this.textures.register(...)` mirrors `this.buffers.register`
// and `this.renderTargets.register`: it validates and registers a
// renderer-independent `TextureAsset` (with `copy-dst` usage so its pixels can be
// updated at runtime, plus `render-attachment` for the video/canvas import path)
// so a material can sample it by `createTextureHandle(id)`. Registering here is
// DOM-FREE metadata — the actual pixel uploads happen renderer-side on the main
// thread via `app.updateDynamicTexture(...)` /
// `app.updateDynamicTextureFromExternalImage(...)`, keeping the DOM (video, canvas)
// off the worker. Re-registering the same id republishes a new version.

const DYNAMIC_TEXTURE_TEXEL_BYTES: Readonly<Record<string, number>> = {
  r8unorm: 1,
  rg8unorm: 2,
  rgba8unorm: 4,
  "rgba8unorm-srgb": 4,
  bgra8unorm: 4,
  "bgra8unorm-srgb": 4,
  rgba16float: 8,
};

export interface TextureRegisterOptions {
  /** Stable handle id (also the mirror key across the worker boundary). */
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Uncompressed color format (default `rgba8unorm`). */
  readonly format?: TextureFormat;
  readonly label?: string;
  readonly colorSpace?: TextureColorSpace;
  readonly semantic?: TextureSemantic;
  /**
   * Add `render-attachment` usage so the texture may receive
   * `copyExternalImageToTexture` (HTMLVideoElement / VideoFrame / canvas /
   * ImageBitmap) uploads on the main thread. WebGPU requires it for that path.
   */
  readonly externalImage?: boolean;
  /** Optional extra usage flags (merged with the always-present sampled/copy-dst). */
  readonly usage?: readonly TextureUsage[];
  /** Optional initial full-image contents (DOM-free bytes). */
  readonly data?: Uint8Array;
  /** Bytes per row of `data`; defaults to `width * texelBytes`. */
  readonly bytesPerRow?: number;
}

export interface TextureAccess {
  /** Validate and register (or republish) a dynamic texture source asset. */
  register(options: TextureRegisterOptions): TextureHandle;
  /** Read the current source asset for a registered texture handle. */
  get(handle: TextureHandle | string): TextureAsset | undefined;
}

export function createTextureAccess(registry: AssetRegistry): TextureAccess {
  return {
    register(options) {
      const handle = createTextureHandle(options.id);
      const format = options.format ?? "rgba8unorm";
      const texelBytes = DYNAMIC_TEXTURE_TEXEL_BYTES[format];

      if (texelBytes === undefined) {
        throw new ApertureSystemError(
          "aperture.textures.unsupportedFormat",
          `Dynamic texture '${options.id}' declares unsupported format '${format}'.`,
          `Use one of: ${Object.keys(DYNAMIC_TEXTURE_TEXEL_BYTES).join(", ")}.`,
        );
      }

      const usage = new Set<TextureUsage>(["sampled", "copy-dst"]);

      if (options.externalImage === true) {
        usage.add("render-attachment");
      }
      for (const extra of options.usage ?? []) {
        usage.add(extra);
      }

      const asset = createTextureAsset({
        label: options.label ?? options.id,
        dimension: "2d",
        width: options.width,
        height: options.height,
        format,
        colorSpace: options.colorSpace ?? "linear",
        semantic: options.semantic ?? "data",
        usage: [...usage],
        ...(options.data === undefined
          ? {}
          : {
              sourceData: {
                bytes: options.data,
                bytesPerRow: options.bytesPerRow ?? options.width * texelBytes,
              },
            }),
      });
      const report = validateTextureAsset(asset);

      if (!report.valid) {
        throw new ApertureSystemError(
          "aperture.textures.invalidAsset",
          `Texture asset '${options.id}' is invalid: ${report.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join(" ")}`,
          "Check the format vs. colorSpace (rgba8unorm is linear/data, not srgb) and the positive width/height.",
        );
      }

      if (
        !Number.isInteger(options.width) ||
        !Number.isInteger(options.height) ||
        options.width <= 0 ||
        options.height <= 0
      ) {
        throw new ApertureSystemError(
          "aperture.textures.invalidDimensions",
          `Texture asset '${options.id}' requires positive integer width/height (received ${String(
            options.width,
          )}x${String(options.height)}).`,
          "Pass positive integer width and height.",
        );
      }

      if (!registry.has(handle)) {
        registry.register(handle, { label: asset.label });
      }

      registry.markReady(handle, asset);
      return handle;
    },
    get(handleOrId) {
      const handle =
        typeof handleOrId === "string"
          ? createTextureHandle(handleOrId)
          : handleOrId;
      const entry = registry.get<"texture", TextureAsset>(handle);

      return entry?.status === "ready" && entry.asset !== null
        ? entry.asset
        : undefined;
    },
  };
}
