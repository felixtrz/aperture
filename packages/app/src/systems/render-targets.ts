import {
  createRenderTargetAsset,
  validateRenderTargetAsset,
  type RenderTargetAsset,
  type RenderTargetAssetFormat,
  type RenderTargetAssetMsaa,
} from "@aperture-engine/render";
import {
  createRenderTargetHandle,
  createTextureHandle,
  type AssetRegistry,
  type RenderTargetHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import { ApertureSystemError } from "./errors.js";

// B1 (three.js parity plan): render-target authoring on the app facade.
// `this.renderTargets.register(...)` mirrors `this.buffers.register`: it
// validates and registers a renderer-independent `RenderTargetAsset` in the
// asset registry, the mirror carries it across the worker boundary, and the
// WebGPU backend realizes (and owns) the actual GPU texture. Cameras pair
// with a target via `spawn.camera({ renderTarget })` (or
// `camera.renderTargetId`); materials sample its color texture through
// `material.texture(..., { texture: this.renderTargets.colorTexture(id) })`.
// `resize` republishes the same handle with new dimensions (version bump →
// the renderer destroys the old texture and creates the new one; every
// reference stays handle-stable).

export interface RenderTargetRegisterOptions {
  /** Stable handle id (also the mirror key across the worker boundary). */
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Defaults to "swapchain" (follows the canvas format renderer-side). */
  readonly format?: RenderTargetAssetFormat;
  /** Defaults to 1. `4` requires the app to be created with `{ msaa: 4 }`. */
  readonly msaa?: RenderTargetAssetMsaa;
  /** Defaults to true (the only supported value today). */
  readonly depth?: boolean;
  /** Defaults to true: color texture gets TEXTURE_BINDING for sampling. */
  readonly sampleable?: boolean;
  readonly label?: string;
}

export interface RenderTargetResizeOptions {
  readonly width: number;
  readonly height: number;
}

export interface RenderTargetAccess {
  /** Validate and register (or republish) a render-target source asset. */
  register(options: RenderTargetRegisterOptions): RenderTargetHandle;
  /** Read the current source asset for a registered render-target handle. */
  get(handle: RenderTargetHandle | string): RenderTargetAsset | undefined;
  /**
   * Republish the target at a new size under the same handle (version bump).
   * The renderer destroys the old GPU texture and creates the new one; camera
   * pairings and texture bindings keep working without re-registration.
   */
  resize(
    handle: RenderTargetHandle | string,
    size: RenderTargetResizeOptions,
  ): RenderTargetHandle;
  /**
   * Texture handle for the target's color texture, usable anywhere a texture
   * handle is accepted (custom-WGSL `material.texture(...)`, sprites). The
   * renderer serves the realized target texture for it — no texture asset
   * registration needed.
   */
  colorTexture(handle: RenderTargetHandle | string): TextureHandle;
}

export function createRenderTargetAccess(
  registry: AssetRegistry,
): RenderTargetAccess {
  const publish = (
    handle: RenderTargetHandle,
    asset: RenderTargetAsset,
  ): RenderTargetHandle => {
    const report = validateRenderTargetAsset(asset);

    if (!report.valid) {
      throw new ApertureSystemError(
        "aperture.renderTargets.invalidAsset",
        `Render target asset '${handle.id}' is invalid: ${report.diagnostics
          .map((diagnostic) => diagnostic.message)
          .join(" ")}`,
        'Check that width/height are positive integers, format is a supported color format (or "swapchain"), msaa is 1 or 4, and depth is not disabled.',
      );
    }

    if (!registry.has(handle)) {
      registry.register(handle, { label: asset.label });
    }

    registry.markReady(handle, asset);
    return handle;
  };

  return {
    register(options) {
      const handle = createRenderTargetHandle(options.id);
      const asset = createRenderTargetAsset({
        label: options.label ?? options.id,
        width: options.width,
        height: options.height,
        ...(options.format === undefined ? {} : { format: options.format }),
        ...(options.msaa === undefined ? {} : { msaa: options.msaa }),
        ...(options.depth === undefined ? {} : { depth: options.depth }),
        ...(options.sampleable === undefined
          ? {}
          : { sampleable: options.sampleable }),
      });

      return publish(handle, asset);
    },
    get(handleOrId) {
      const handle = toRenderTargetHandle(handleOrId);
      const entry = registry.get<"render-target", RenderTargetAsset>(handle);

      return entry?.status === "ready" && entry.asset !== null
        ? entry.asset
        : undefined;
    },
    resize(handleOrId, size) {
      const handle = toRenderTargetHandle(handleOrId);
      const entry = registry.get<"render-target", RenderTargetAsset>(handle);
      const current =
        entry?.status === "ready" && entry.asset !== null ? entry.asset : null;

      if (current === null) {
        throw new ApertureSystemError(
          "aperture.renderTargets.unknownHandle",
          `Cannot resize render target '${handle.id}': no ready render-target asset is registered under that handle.`,
          "Register the target with this.renderTargets.register({ id, width, height, ... }) before resizing it.",
        );
      }

      return publish(
        handle,
        createRenderTargetAsset({
          label: current.label,
          width: size.width,
          height: size.height,
          format: current.format,
          msaa: current.msaa,
          depth: current.depth,
          sampleable: current.sampleable,
        }),
      );
    },
    colorTexture(handleOrId) {
      return createTextureHandle(toRenderTargetHandle(handleOrId).id);
    },
  };
}

function toRenderTargetHandle(
  handleOrId: RenderTargetHandle | string,
): RenderTargetHandle {
  return typeof handleOrId === "string"
    ? createRenderTargetHandle(handleOrId)
    : handleOrId;
}
