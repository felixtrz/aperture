// B1 (three.js parity plan): renderer-independent render-target source asset.
// `RenderTargetAsset` is the data-only description of an offscreen color
// target a camera can render into (`Camera.renderTargetId`) and a material
// can sample (`material.texture(...)` against the same id). It registers in
// the `AssetRegistry` under a `RenderTargetHandle` like any other source
// asset, is structured-clone-safe for the worker asset mirror, and never
// carries live GPU objects; the WebGPU backend realizes (and owns) the
// actual `GPUTexture`, keyed by handle + registry version, so re-publishing
// the same handle (resize) destroys the old texture and creates a new one
// while every reference stays handle-stable.

/**
 * Color format of a render-target source asset. `"swapchain"` (the default)
 * resolves renderer-side to the canvas/swapchain format, which is the only
 * format the app forward pipelines render into today — declaring a concrete
 * format that differs from the canvas format surfaces the existing
 * `webGpuApp.renderTargetFormatMismatch` diagnostic at render time.
 */
export type RenderTargetAssetFormat =
  | "swapchain"
  | "rgba8unorm"
  | "rgba8unorm-srgb"
  | "bgra8unorm"
  | "bgra8unorm-srgb"
  | "rgba16float";

/**
 * MSAA intent for the target. The app renders every target at the app-level
 * MSAA sample count (pipelines are compiled once per app); `msaa: 4` declares
 * that this target expects 4x MSAA-resolved content and produces a structured
 * diagnostic (`webGpuApp.renderTargetMsaaUnavailable`) when the app was not
 * created with `msaa: 4`, instead of silently rendering aliased.
 */
export type RenderTargetAssetMsaa = 1 | 4;

/**
 * Texture shape of the target. `"2d"` (the default) is a single color image a
 * camera renders into. `"cube"` (B2) is a 6-face cube map captured by a
 * cube-capture camera (`Camera.renderTargetId` pointing at a cube target emits
 * six 90-degree face views per scheduled capture); cube targets must be square
 * and are consumable as an IBL environment source
 * (`prepareWebGpuAppEnvironmentAssets` `renderTargetSource`).
 */
export type RenderTargetAssetDimension = "2d" | "cube";

export interface RenderTargetAsset {
  readonly kind: "render-target";
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly dimension: RenderTargetAssetDimension;
  readonly format: RenderTargetAssetFormat;
  readonly msaa: RenderTargetAssetMsaa;
  /**
   * Whether the target renders with a depth buffer. The app frame path
   * always attaches its renderer-owned per-target depth buffer (pipelines
   * share one depth contract), so only `true` is valid today;
   * `depth: false` is rejected with `renderTargetAsset.depthDisabledUnsupported`.
   */
  readonly depth: boolean;
  /**
   * Whether the color texture is created with `TEXTURE_BINDING` so materials
   * (custom WGSL `material.texture(...)`, sprites, HUD quads) can sample it.
   * Defaults to true; sampling a `sampleable: false` target surfaces
   * `webGpuApp.renderTargetNotSampleable` at render time.
   */
  readonly sampleable: boolean;
}

export type RenderTargetAssetDiagnosticCode =
  | "renderTargetAsset.invalidLabel"
  | "renderTargetAsset.invalidSize"
  | "renderTargetAsset.invalidDimension"
  | "renderTargetAsset.cubeSizeNotSquare"
  | "renderTargetAsset.cubeMsaaUnsupported"
  | "renderTargetAsset.invalidFormat"
  | "renderTargetAsset.invalidMsaa"
  | "renderTargetAsset.depthDisabledUnsupported"
  | "renderTargetAsset.liveRendererObject";

export interface RenderTargetAssetValidationDiagnostic {
  readonly code: RenderTargetAssetDiagnosticCode;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly field?: string;
}

export interface RenderTargetAssetValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly RenderTargetAssetValidationDiagnostic[];
}

export interface CreateRenderTargetAssetInput {
  readonly label?: string;
  readonly width?: number;
  readonly height?: number;
  /** Square-size convenience (cube targets): sets width and height at once. */
  readonly size?: number;
  readonly dimension?: RenderTargetAssetDimension;
  readonly format?: RenderTargetAssetFormat;
  readonly msaa?: RenderTargetAssetMsaa;
  readonly depth?: boolean;
  readonly sampleable?: boolean;
}

export function createRenderTargetAsset(
  input: CreateRenderTargetAssetInput,
): RenderTargetAsset {
  return {
    kind: "render-target",
    label: input.label ?? "Render Target",
    width: input.width ?? input.size ?? Number.NaN,
    height: input.height ?? input.size ?? Number.NaN,
    dimension: input.dimension ?? "2d",
    format: input.format ?? "swapchain",
    msaa: input.msaa ?? 1,
    depth: input.depth ?? true,
    sampleable: input.sampleable ?? true,
  };
}

/**
 * Distinguishes the renderer-independent source asset from the low-level
 * `createWebGpuAppRenderTargetAsset` payload (which wraps a live GPUTexture
 * and has no `kind` discriminator). Both register under the same
 * `render-target` handle kind; the WebGPU frame path branches on this guard.
 */
export function isRenderTargetAsset(
  value: unknown,
): value is RenderTargetAsset {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const asset = value as RenderTargetAsset & { readonly texture?: unknown };

  return (
    asset.kind === "render-target" &&
    asset.texture === undefined &&
    typeof asset.label === "string" &&
    typeof asset.width === "number" &&
    typeof asset.height === "number"
  );
}

/** Resolve the declared format against the app's swapchain/canvas format. */
export function resolveRenderTargetAssetFormat(
  asset: Pick<RenderTargetAsset, "format">,
  swapchainFormat: string,
): string {
  return asset.format === "swapchain" ? swapchainFormat : asset.format;
}

const RENDER_TARGET_ASSET_FORMATS: readonly RenderTargetAssetFormat[] = [
  "swapchain",
  "rgba8unorm",
  "rgba8unorm-srgb",
  "bgra8unorm",
  "bgra8unorm-srgb",
  "rgba16float",
];

export function validateRenderTargetAsset(
  asset: RenderTargetAsset,
): RenderTargetAssetValidationReport {
  const diagnostics: RenderTargetAssetValidationDiagnostic[] = [];

  if (typeof asset.label !== "string" || asset.label.trim().length === 0) {
    diagnostics.push({
      code: "renderTargetAsset.invalidLabel",
      severity: "warning",
      field: "label",
      message: "Render target asset should provide a non-empty label.",
    });
  }

  validateRenderTargetAssetDimension(asset.width, "width", diagnostics);
  validateRenderTargetAssetDimension(asset.height, "height", diagnostics);

  if (asset.dimension !== "2d" && asset.dimension !== "cube") {
    diagnostics.push({
      code: "renderTargetAsset.invalidDimension",
      severity: "error",
      field: "dimension",
      message: `Render target asset dimension '${String(asset.dimension)}' must be "2d" or "cube".`,
    });
  }

  if (asset.dimension === "cube" && asset.width !== asset.height) {
    diagnostics.push({
      code: "renderTargetAsset.cubeSizeNotSquare",
      severity: "error",
      field: "size",
      message: `Cube render target assets must be square; received ${String(asset.width)}x${String(asset.height)}. Declare a single size (or equal width/height).`,
    });
  }

  if (asset.dimension === "cube" && asset.msaa !== 1) {
    diagnostics.push({
      code: "renderTargetAsset.cubeMsaaUnsupported",
      severity: "error",
      field: "msaa",
      message:
        "Cube render target assets do not support msaa: 4 yet — capture faces render into single-sample cube layers. Drop the msaa declaration.",
    });
  }

  if (!RENDER_TARGET_ASSET_FORMATS.includes(asset.format)) {
    diagnostics.push({
      code: "renderTargetAsset.invalidFormat",
      severity: "error",
      field: "format",
      message: `Render target asset format '${String(asset.format)}' must be one of ${RENDER_TARGET_ASSET_FORMATS.join(", ")}.`,
    });
  }

  if (asset.msaa !== 1 && asset.msaa !== 4) {
    diagnostics.push({
      code: "renderTargetAsset.invalidMsaa",
      severity: "error",
      field: "msaa",
      message: `Render target asset msaa '${String(asset.msaa)}' must be 1 or 4 (WebGPU guarantees only these color sample counts).`,
    });
  }

  if (asset.depth === false) {
    diagnostics.push({
      code: "renderTargetAsset.depthDisabledUnsupported",
      severity: "error",
      field: "depth",
      message:
        "Render target asset depth: false is not supported yet: the app frame path always renders offscreen views with the renderer-owned per-target depth buffer (pipelines share one depth contract). Omit depth or set it to true.",
    });
  }

  if (looksLikeLiveRendererObject(asset)) {
    diagnostics.push({
      code: "renderTargetAsset.liveRendererObject",
      severity: "error",
      message:
        "Render target asset must stay data-only: it may not carry a live GPU texture or other renderer-owned objects. The WebGPU backend realizes and owns the GPUTexture; use createWebGpuAppRenderTargetAsset only for the low-level route.",
    });
  }

  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics,
  };
}

function validateRenderTargetAssetDimension(
  value: number,
  field: "width" | "height",
  diagnostics: RenderTargetAssetValidationDiagnostic[],
): void {
  if (!Number.isInteger(value) || value <= 0 || !Number.isSafeInteger(value)) {
    diagnostics.push({
      code: "renderTargetAsset.invalidSize",
      severity: "error",
      field,
      message: `Render target asset ${field} must be a positive integer, received ${String(value)}.`,
    });
  }
}

function looksLikeLiveRendererObject(asset: object): boolean {
  const candidate = asset as {
    readonly texture?: unknown;
    readonly destroy?: unknown;
    readonly createView?: unknown;
  };

  return (
    candidate.texture !== undefined ||
    typeof candidate.destroy === "function" ||
    typeof candidate.createView === "function"
  );
}
