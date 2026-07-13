import {
  Camera,
  createRenderTargetAsset,
  validateRenderTargetAsset,
  type RenderTargetAsset,
  type RenderTargetAssetDimension,
  type RenderTargetAssetFormat,
  type RenderTargetAssetMsaa,
} from "@aperture-engine/render";
import {
  createRenderTargetHandle,
  createTextureHandle,
  type AssetRegistry,
  type EcsWorld,
  type RenderTargetHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type { ApertureFrameTime } from "./frame-time.js";
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
//
// B2: `dimension: "cube"` targets are capture probes — a camera paired with
// one becomes a cube-capture camera that renders six 90-degree faces per
// scheduled capture (`camera.captureEvery`, default every frame) or on demand
// (`this.renderTargets.capture(id)`). The captured cube feeds IBL through the
// environment-map `renderTargetSource` (renderer tier); plain
// `material.texture` bindings stay 2d-only and diagnose cube targets.

export interface RenderTargetRegisterOptions {
  /** Stable handle id (also the mirror key across the worker boundary). */
  readonly id: string;
  readonly width?: number;
  readonly height?: number;
  /** Square-size convenience (required form for cube targets). */
  readonly size?: number;
  /** Defaults to "2d". "cube" targets must be square (B2). */
  readonly dimension?: RenderTargetAssetDimension;
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
  readonly width?: number;
  readonly height?: number;
  /** Square-size convenience (cube targets resize with a single size). */
  readonly size?: number;
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
   * registration needed. 2d targets only (cube targets are IBL sources).
   */
  colorTexture(handle: RenderTargetHandle | string): TextureHandle;
  /**
   * One-shot cube capture (B2): request every camera paired with this cube
   * target to capture its six faces on the next extracted frame, regardless
   * of the periodic `captureEvery` schedule. Returns the number of capture
   * cameras that were armed.
   */
  capture(handle: RenderTargetHandle | string): number;
}

export function createRenderTargetAccess(
  registry: AssetRegistry,
  options: {
    /** ECS world for the on-demand capture command (B2). */
    readonly world?: EcsWorld;
    /** Sanctioned sim-clock; capture requests are stamped with its frame. */
    readonly time?: ApertureFrameTime;
  } = {},
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
        'Check that width/height are positive integers (cube targets must be square — declare size), format is a supported color format (or "swapchain"), msaa is 1 or 4 (2d targets only), and depth is not disabled.',
      );
    }

    if (!registry.has(handle)) {
      registry.register(handle, { label: asset.label });
    }

    registry.markReady(handle, asset);
    return handle;
  };

  return {
    register(registerOptions) {
      const handle = createRenderTargetHandle(registerOptions.id);
      const asset = createRenderTargetAsset({
        label: registerOptions.label ?? registerOptions.id,
        ...(registerOptions.width === undefined
          ? {}
          : { width: registerOptions.width }),
        ...(registerOptions.height === undefined
          ? {}
          : { height: registerOptions.height }),
        ...(registerOptions.size === undefined
          ? {}
          : { size: registerOptions.size }),
        ...(registerOptions.dimension === undefined
          ? {}
          : { dimension: registerOptions.dimension }),
        ...(registerOptions.format === undefined
          ? {}
          : { format: registerOptions.format }),
        ...(registerOptions.msaa === undefined
          ? {}
          : { msaa: registerOptions.msaa }),
        ...(registerOptions.depth === undefined
          ? {}
          : { depth: registerOptions.depth }),
        ...(registerOptions.sampleable === undefined
          ? {}
          : { sampleable: registerOptions.sampleable }),
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
          width: size.width ?? size.size ?? current.width,
          height: size.height ?? size.size ?? current.height,
          dimension: current.dimension,
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
    capture(handleOrId) {
      const handle = toRenderTargetHandle(handleOrId);
      const world = options.world;

      if (world === undefined) {
        throw new ApertureSystemError(
          "aperture.renderTargets.captureUnavailable",
          `Cannot capture render target '${handle.id}': this renderTargets facade was created without an ECS world.`,
          "Use the app system context (this.renderTargets) — it wires the world in — or pass { world } to createRenderTargetAccess.",
        );
      }

      const asset = this.get(handle);

      if (asset === undefined || asset.dimension !== "cube") {
        throw new ApertureSystemError(
          "aperture.renderTargets.captureNotCube",
          `Cannot capture render target '${handle.id}': ${asset === undefined ? "no ready render-target asset is registered under that handle" : "only cube targets support on-demand capture"}.`,
          'Register the target with this.renderTargets.register({ id, size, dimension: "cube" }) and pair a camera with it before requesting a capture.',
        );
      }

      // Stamp requests with the sim frame: extraction fires each new stamp
      // exactly once (frame >= stamp), so requests in successive frames each
      // capture while same-frame repeats stay idempotent.
      const requestFrame = Math.max(0, (options.time?.frame ?? 1) - 1);
      const renderTargetKey = `render-target:${handle.id}`;
      const query = world.queryManager.registerQuery({ required: [Camera] });
      let armed = 0;

      for (const entity of query.entities) {
        if (entity.getValue(Camera, "renderTargetId") !== renderTargetKey) {
          continue;
        }

        entity.setValue(Camera, "captureRequestFrame", requestFrame);
        armed += 1;
      }

      return armed;
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
