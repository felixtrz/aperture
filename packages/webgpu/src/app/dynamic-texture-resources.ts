import {
  createTextureHandle,
  type AssetRegistry,
  type TextureHandle,
} from "@aperture-engine/simulation";
import {
  createTextureAsset,
  validateTextureAsset,
  type TextureAsset,
  type TextureColorSpace,
  type TextureFormat,
  type TextureSemantic,
  type TextureUsage,
} from "@aperture-engine/render";
import type { TextureGpuResource } from "../resources/textures/texture-resources.js";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";

// D3 (three.js parity plan): runtime texture updates (dynamic + video).
//
// ARCHITECTURE: this is a MAIN-THREAD app-facade feature, mirroring B1's
// render-target facade and C3's compute-kernel facade. The ECS simulation runs
// in a worker and MUST NEVER touch the DOM (video / canvas / ImageBitmap), so
// both the CPU-bytes update path (AC1, `queue.writeTexture`) and the external
// image import path (AC2, `queue.copyExternalImageToTexture`) live on the main
// thread. A dynamic texture is an ordinary `TextureAsset` registered on the
// renderer's source-asset registry with `usage` including `"copy-dst"` (and
// `"render-attachment"` when it will receive external images), so it realizes
// byte-identically to any texture with those usages and a worker-authored
// material samples it by handle id WITHOUT the worker ever handling texture
// bytes. No worker→renderer snapshot packet is added, so the packed SAB
// encoding, the determinism fixtures, and every other texture stay untouched.

/**
 * The uncompressed color formats a dynamic texture may declare: every one is
 * both `copyExternalImageToTexture`-renderable and has a fixed texel byte size
 * for `writeTexture` sub-rect validation. Compressed / depth formats are
 * rejected at registration with a structured diagnostic.
 */
export const DYNAMIC_TEXTURE_TEXEL_BYTES: Readonly<Record<string, number>> = {
  r8unorm: 1,
  rg8unorm: 2,
  rgba8unorm: 4,
  "rgba8unorm-srgb": 4,
  bgra8unorm: 4,
  "bgra8unorm-srgb": 4,
  rgba16float: 8,
};

/**
 * Every structured diagnostic this facade can emit, as literal records so the
 * diagnostics catalog generator lists each code for lookup. This array is the
 * single source of truth — {@link WebGpuAppDynamicTextureDiagnosticCode} is
 * derived from it, and the runtime emitters reference these codes.
 */
export const WEBGPU_APP_DYNAMIC_TEXTURE_DIAGNOSTICS = [
  {
    code: "dynamicTexture.invalidDescriptor",
    message:
      "A dynamic texture descriptor was invalid: empty id, unsupported format, or non-positive dimensions.",
  },
  {
    code: "dynamicTexture.notRegistered",
    message:
      "No dynamic texture is registered under the given id — call app.registerDynamicTexture(...) first.",
  },
  {
    code: "dynamicTexture.notRealized",
    message:
      "A dynamic texture has not been realized on the GPU yet (no material has sampled it this session).",
  },
  {
    code: "dynamicTexture.invalidRegion",
    message:
      "A dynamic texture update sub-rect is out of bounds, non-integer, or non-positive.",
  },
  {
    code: "dynamicTexture.invalidBytesPerRow",
    message:
      "A dynamic texture update bytesPerRow is not an integer at least the row minimum for the region.",
  },
  {
    code: "dynamicTexture.uploadDataTooSmall",
    message:
      "A dynamic texture update's data (from its offset) is shorter than the region requires.",
  },
  {
    code: "dynamicTexture.missingSource",
    message:
      "A dynamic texture external-image update was given no source (HTMLVideoElement / VideoFrame / canvas / ImageBitmap).",
  },
  {
    code: "dynamicTexture.uploadUnavailable",
    message:
      "The WebGPU queue does not expose the required upload method (writeTexture / copyExternalImageToTexture).",
  },
  {
    code: "dynamicTexture.uploadFailed",
    message:
      "A dynamic texture upload (writeTexture / copyExternalImageToTexture) threw a device error.",
  },
] as const;

export type WebGpuAppDynamicTextureDiagnosticCode =
  (typeof WEBGPU_APP_DYNAMIC_TEXTURE_DIAGNOSTICS)[number]["code"];

export interface WebGpuAppDynamicTextureDiagnostic {
  readonly code: WebGpuAppDynamicTextureDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly id: string;
}

/**
 * The authoring surface for `app.registerDynamicTexture(...)`. `format` defaults
 * to `rgba8unorm`; `externalImage: true` adds `render-attachment` usage so the
 * texture may receive `copyExternalImageToTexture` uploads (WebGPU requires it).
 * `initialData` seeds the first realized contents (main-thread bytes — no worker
 * boundary crossing).
 */
export interface WebGpuAppDynamicTextureDescriptor {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly format?: TextureFormat;
  readonly label?: string;
  readonly colorSpace?: TextureColorSpace;
  readonly semantic?: TextureSemantic;
  /** Add `render-attachment` usage for the external-image (video/canvas) path. */
  readonly externalImage?: boolean;
  /** Optional initial CPU contents (full-image). */
  readonly initialData?: Uint8Array;
  /** Rows-per-image / bytes-per-row for `initialData` (defaults tight-packed). */
  readonly initialBytesPerRow?: number;
}

/**
 * A sub-rect for a partial update. Any omitted field defaults to the full
 * texture extent (`{ x: 0, y: 0, width, height }`) — a full-image update.
 */
export interface WebGpuAppDynamicTextureRegion {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface WebGpuAppDynamicTextureUpdate {
  readonly data: Uint8Array;
  /** Bytes per row of `data`; defaults to `region.width * texelBytes`. */
  readonly bytesPerRow?: number;
  /** Rows per image of `data`; defaults to `region.height`. */
  readonly rowsPerImage?: number;
  /** Byte offset into `data` where the first row begins (default 0). */
  readonly dataOffset?: number;
  /** Sub-rect to write; defaults to the full texture (full-image update). */
  readonly region?: WebGpuAppDynamicTextureRegion;
}

/**
 * A `GPUCopyExternalImageSource` — an `HTMLVideoElement`, `VideoFrame`,
 * `HTMLCanvasElement`, `OffscreenCanvas`, `ImageBitmap`, or `HTMLImageElement`.
 * Typed loosely here so the headless renderer core never depends on DOM lib
 * types; the app facade narrows it.
 */
export type WebGpuAppDynamicTextureExternalSource = object;

export interface WebGpuAppDynamicTextureExternalImageUpdate {
  readonly source: WebGpuAppDynamicTextureExternalSource;
  readonly flipY?: boolean;
  /** Origin within the SOURCE image to copy from (default `{ x: 0, y: 0 }`). */
  readonly sourceOrigin?: { readonly x?: number; readonly y?: number };
  /** Sub-rect of the DESTINATION texture; defaults to the full texture. */
  readonly region?: WebGpuAppDynamicTextureRegion;
}

interface WebGpuAppDynamicTextureEntry {
  readonly id: string;
  readonly handle: TextureHandle;
  width: number;
  height: number;
  format: TextureFormat;
  texelBytes: number;
  usage: readonly TextureUsage[];
  updates: number;
  bytesUploaded: number;
  externalImageUpdates: number;
  failedUpdates: number;
  frameUpdates: number;
  frameBytesUploaded: number;
  frameExternalImageUpdates: number;
}

export interface WebGpuAppDynamicTextureState {
  readonly entries: Map<string, WebGpuAppDynamicTextureEntry>;
}

export function createWebGpuAppDynamicTextureState(): WebGpuAppDynamicTextureState {
  return { entries: new Map() };
}

export interface WebGpuAppDynamicTextureRegistration {
  readonly ok: boolean;
  readonly id: string;
  readonly handle: TextureHandle | null;
  readonly diagnostics: readonly WebGpuAppDynamicTextureDiagnostic[];
}

export interface WebGpuAppDynamicTextureUpdateResult {
  readonly ok: boolean;
  readonly id: string;
  readonly bytesUploaded: number;
  readonly region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null;
  readonly diagnostics: readonly WebGpuAppDynamicTextureDiagnostic[];
}

export interface WebGpuAppDynamicTextureEntryReport {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly updates: number;
  readonly bytesUploaded: number;
  readonly externalImageUpdates: number;
  readonly failedUpdates: number;
  readonly frameUpdates: number;
  readonly frameBytesUploaded: number;
}

export interface WebGpuAppDynamicTextureReport {
  readonly textureCount: number;
  /** Updates applied since the previous frame report (the per-frame rate). */
  readonly frameUpdates: number;
  readonly frameBytesUploaded: number;
  readonly totalUpdates: number;
  readonly totalBytesUploaded: number;
  readonly totalExternalImageUpdates: number;
  readonly totalFailedUpdates: number;
  readonly textures: readonly WebGpuAppDynamicTextureEntryReport[];
}

interface DynamicTextureQueueLike {
  readonly writeTexture?: (
    destination: unknown,
    data: Uint8Array,
    dataLayout: unknown,
    size: unknown,
  ) => void;
  readonly copyExternalImageToTexture?: (
    source: unknown,
    destination: unknown,
    copySize: unknown,
  ) => void;
}

interface DynamicTextureDeviceLike {
  readonly queue?: DynamicTextureQueueLike;
}

function diagnostic(
  code: WebGpuAppDynamicTextureDiagnosticCode,
  id: string,
  message: string,
): WebGpuAppDynamicTextureDiagnostic {
  return { code, severity: "error", message, id };
}

/**
 * Register (or re-register) a dynamic texture as a real `TextureAsset` on the
 * renderer's source-asset registry with `copy-dst` (and, for the external-image
 * path, `render-attachment`) usage. The renderer realizes it exactly like any
 * texture with those usages; a material samples it by `createTextureHandle(id)`.
 */
export function registerWebGpuAppDynamicTexture(input: {
  readonly state: WebGpuAppDynamicTextureState;
  readonly registry: AssetRegistry;
  readonly descriptor: WebGpuAppDynamicTextureDescriptor;
}): WebGpuAppDynamicTextureRegistration {
  const { descriptor } = input;
  const id = descriptor.id;
  const diagnostics: WebGpuAppDynamicTextureDiagnostic[] = [];

  if (typeof id !== "string" || id.length === 0) {
    diagnostics.push(
      diagnostic(
        "dynamicTexture.invalidDescriptor",
        String(id),
        "A dynamic texture requires a non-empty string id.",
      ),
    );
    return { ok: false, id: String(id), handle: null, diagnostics };
  }

  const format = descriptor.format ?? "rgba8unorm";
  const texelBytes = DYNAMIC_TEXTURE_TEXEL_BYTES[format];

  if (texelBytes === undefined) {
    diagnostics.push(
      diagnostic(
        "dynamicTexture.invalidDescriptor",
        id,
        `Dynamic texture '${id}' declares unsupported format '${format}'. Supported: ${Object.keys(
          DYNAMIC_TEXTURE_TEXEL_BYTES,
        ).join(", ")}.`,
      ),
    );
    return { ok: false, id, handle: null, diagnostics };
  }

  if (
    !Number.isInteger(descriptor.width) ||
    !Number.isInteger(descriptor.height) ||
    descriptor.width <= 0 ||
    descriptor.height <= 0
  ) {
    diagnostics.push(
      diagnostic(
        "dynamicTexture.invalidDescriptor",
        id,
        `Dynamic texture '${id}' requires positive integer width/height (received ${String(
          descriptor.width,
        )}x${String(descriptor.height)}).`,
      ),
    );
    return { ok: false, id, handle: null, diagnostics };
  }

  const usage: TextureUsage[] = ["sampled", "copy-dst"];

  if (descriptor.externalImage === true) {
    usage.push("render-attachment");
  }

  const asset = createTextureAsset({
    label: descriptor.label ?? `Dynamic Texture ${id}`,
    dimension: "2d",
    width: descriptor.width,
    height: descriptor.height,
    format,
    colorSpace: descriptor.colorSpace ?? "linear",
    semantic: descriptor.semantic ?? "data",
    usage,
    ...(descriptor.initialData === undefined
      ? {}
      : {
          sourceData: {
            bytes: descriptor.initialData,
            bytesPerRow:
              descriptor.initialBytesPerRow ?? descriptor.width * texelBytes,
          },
        }),
  });

  const validation = validateTextureAsset(asset);

  if (!validation.valid) {
    diagnostics.push(
      diagnostic(
        "dynamicTexture.invalidDescriptor",
        id,
        `Dynamic texture '${id}' is invalid: ${validation.diagnostics
          .map((entry) => entry.message)
          .join(" ")}`,
      ),
    );
    return { ok: false, id, handle: null, diagnostics };
  }

  const handle = createTextureHandle(id);

  if (!input.registry.has(handle)) {
    input.registry.register(handle, { label: asset.label });
  }
  input.registry.markReady(handle, asset);

  const existing = input.state.entries.get(id);

  if (existing === undefined) {
    input.state.entries.set(id, {
      id,
      handle,
      width: descriptor.width,
      height: descriptor.height,
      format,
      texelBytes,
      usage,
      updates: 0,
      bytesUploaded: 0,
      externalImageUpdates: 0,
      failedUpdates: 0,
      frameUpdates: 0,
      frameBytesUploaded: 0,
      frameExternalImageUpdates: 0,
    });
  } else {
    existing.width = descriptor.width;
    existing.height = descriptor.height;
    existing.format = format;
    existing.texelBytes = texelBytes;
    existing.usage = usage;
  }

  return { ok: true, id, handle, diagnostics };
}

/**
 * Get the tracking entry for a dynamic texture, creating it lazily from the
 * texture asset in the source-asset registry when it has not been seen before.
 * This is what lets a texture registered on the WORKER (via
 * `this.textures.register(...)`, which extraction validates and mirrors to the
 * renderer) be updated from the main thread without a separate main-thread
 * registration — the first update discovers the asset's size + format here.
 */
function resolveDynamicTextureEntry(
  state: WebGpuAppDynamicTextureState,
  registry: AssetRegistry,
  id: string,
):
  | { readonly ok: true; readonly entry: WebGpuAppDynamicTextureEntry }
  | {
      readonly ok: false;
      readonly diagnostic: WebGpuAppDynamicTextureDiagnostic;
    } {
  const existing = state.entries.get(id);

  if (existing !== undefined) {
    return { ok: true, entry: existing };
  }

  const handle = createTextureHandle(id);
  const entry = registry.get<"texture", TextureAsset>(handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "dynamicTexture.notRegistered",
        id,
        `No dynamic texture is registered under id '${id}'. Register it (this.textures.register(...) in a worker system, or app.registerDynamicTexture(...) on the main thread) first.`,
      ),
    };
  }

  const asset = entry.asset;
  const texelBytes = DYNAMIC_TEXTURE_TEXEL_BYTES[asset.format];

  if (texelBytes === undefined) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "dynamicTexture.invalidDescriptor",
        id,
        `Dynamic texture '${id}' uses unsupported format '${asset.format}' for runtime updates.`,
      ),
    };
  }

  const created: WebGpuAppDynamicTextureEntry = {
    id,
    handle,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    texelBytes,
    usage: asset.usage,
    updates: 0,
    bytesUploaded: 0,
    externalImageUpdates: 0,
    failedUpdates: 0,
    frameUpdates: 0,
    frameBytesUploaded: 0,
    frameExternalImageUpdates: 0,
  };
  state.entries.set(id, created);
  return { ok: true, entry: created };
}

type ResolvedRealizedDynamicTexture =
  | { readonly status: "not-registered" }
  | { readonly status: "not-realized" }
  | { readonly status: "resolved"; readonly texture: unknown };

function resolveRealizedDynamicTexture(input: {
  readonly registry: AssetRegistry;
  readonly textures: ReadonlyMap<string, TextureGpuResource>;
  readonly handle: TextureHandle;
}): ResolvedRealizedDynamicTexture {
  const entry = input.registry.get<"texture", TextureAsset>(input.handle);

  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    return { status: "not-registered" };
  }

  const cacheKey = sourceAssetCacheKey(input.handle, entry.version);
  const resource = input.textures.get(cacheKey);

  if (resource === undefined) {
    return { status: "not-realized" };
  }

  return { status: "resolved", texture: resource.texture };
}

interface NormalizedRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function normalizeRegion(
  entry: WebGpuAppDynamicTextureEntry,
  region: WebGpuAppDynamicTextureRegion | undefined,
): NormalizedRegion | null {
  const x = region?.x ?? 0;
  const y = region?.y ?? 0;
  const width = region?.width ?? entry.width;
  const height = region?.height ?? entry.height;

  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > entry.width ||
    y + height > entry.height
  ) {
    return null;
  }

  return { x, y, width, height };
}

/**
 * AC1: apply a CPU-side update (full-image OR sub-rect) to a dynamic texture via
 * `queue.writeTexture`. The sub-rect origin/extent, `bytesPerRow`, and byte
 * length are validated up front so a bad region emits a structured diagnostic
 * instead of a raw WebGPU validation error.
 */
export function updateWebGpuAppDynamicTexture(input: {
  readonly state: WebGpuAppDynamicTextureState;
  readonly registry: AssetRegistry;
  readonly textures: ReadonlyMap<string, TextureGpuResource>;
  readonly device: unknown;
  readonly id: string;
  readonly update: WebGpuAppDynamicTextureUpdate;
}): WebGpuAppDynamicTextureUpdateResult {
  const { id, update } = input;
  const resolvedEntry = resolveDynamicTextureEntry(
    input.state,
    input.registry,
    id,
  );

  if (!resolvedEntry.ok) {
    return failUpdate(id, resolvedEntry.diagnostic);
  }

  const entry = resolvedEntry.entry;
  const region = normalizeRegion(entry, update.region);

  if (region === null) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.invalidRegion",
        id,
        `Dynamic texture '${id}' update region is out of bounds for a ${entry.width}x${entry.height} texture.`,
      ),
    );
  }

  const bytesPerRow = update.bytesPerRow ?? region.width * entry.texelBytes;
  const minBytesPerRow = region.width * entry.texelBytes;

  if (!Number.isInteger(bytesPerRow) || bytesPerRow < minBytesPerRow) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.invalidBytesPerRow",
        id,
        `Dynamic texture '${id}' bytesPerRow must be an integer >= ${minBytesPerRow} for ${region.width} texel(s) of '${entry.format}'; received ${String(
          bytesPerRow,
        )}.`,
      ),
    );
  }

  const rowsPerImage = update.rowsPerImage ?? region.height;
  const dataOffset = update.dataOffset ?? 0;
  const requiredBytes =
    dataOffset + (region.height - 1) * bytesPerRow + minBytesPerRow;

  if (
    !Number.isInteger(dataOffset) ||
    dataOffset < 0 ||
    update.data.byteLength < requiredBytes
  ) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.uploadDataTooSmall",
        id,
        `Dynamic texture '${id}' update needs at least ${requiredBytes} byte(s) from offset ${dataOffset}; received ${update.data.byteLength}.`,
      ),
    );
  }

  const resolved = resolveRealizedDynamicTexture({
    registry: input.registry,
    textures: input.textures,
    handle: entry.handle,
  });

  if (resolved.status !== "resolved") {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      resolved.status === "not-registered"
        ? diagnostic(
            "dynamicTexture.notRegistered",
            id,
            `Dynamic texture '${id}' has no ready texture asset in the source registry.`,
          )
        : diagnostic(
            "dynamicTexture.notRealized",
            id,
            `Dynamic texture '${id}' has not been realized on the GPU yet (no material has sampled it this session).`,
          ),
    );
  }

  const queue = (input.device as DynamicTextureDeviceLike | null | undefined)
    ?.queue;

  if (queue?.writeTexture === undefined) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.uploadUnavailable",
        id,
        `Dynamic texture '${id}' cannot upload: the WebGPU queue does not expose writeTexture.`,
      ),
    );
  }

  try {
    queue.writeTexture(
      {
        texture: resolved.texture,
        mipLevel: 0,
        origin: { x: region.x, y: region.y, z: 0 },
      },
      update.data,
      { offset: dataOffset, bytesPerRow, rowsPerImage },
      { width: region.width, height: region.height, depthOrArrayLayers: 1 },
    );
  } catch (error) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.uploadFailed",
        id,
        `Dynamic texture '${id}' writeTexture failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
      region,
    );
  }

  const bytesUploaded = region.width * region.height * entry.texelBytes;
  entry.updates += 1;
  entry.bytesUploaded += bytesUploaded;
  entry.frameUpdates += 1;
  entry.frameBytesUploaded += bytesUploaded;

  return { ok: true, id, bytesUploaded, region, diagnostics: [] };
}

/**
 * AC2: import a DOM image source (`HTMLVideoElement` / `VideoFrame` / canvas /
 * `ImageBitmap`) into a dynamic texture via `queue.copyExternalImageToTexture`.
 * Renderer-side only — the ECS worker never touches the DOM.
 */
export function updateWebGpuAppDynamicTextureFromExternalImage(input: {
  readonly state: WebGpuAppDynamicTextureState;
  readonly registry: AssetRegistry;
  readonly textures: ReadonlyMap<string, TextureGpuResource>;
  readonly device: unknown;
  readonly id: string;
  readonly update: WebGpuAppDynamicTextureExternalImageUpdate;
}): WebGpuAppDynamicTextureUpdateResult {
  const { id, update } = input;
  const resolvedEntry = resolveDynamicTextureEntry(
    input.state,
    input.registry,
    id,
  );

  if (!resolvedEntry.ok) {
    return failUpdate(id, resolvedEntry.diagnostic);
  }

  const entry = resolvedEntry.entry;

  if (update.source === null || update.source === undefined) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.missingSource",
        id,
        `Dynamic texture '${id}' external-image update requires a source (HTMLVideoElement / VideoFrame / canvas / ImageBitmap).`,
      ),
    );
  }

  const region = normalizeRegion(entry, update.region);

  if (region === null) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.invalidRegion",
        id,
        `Dynamic texture '${id}' external-image region is out of bounds for a ${entry.width}x${entry.height} texture.`,
      ),
    );
  }

  const resolved = resolveRealizedDynamicTexture({
    registry: input.registry,
    textures: input.textures,
    handle: entry.handle,
  });

  if (resolved.status !== "resolved") {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      resolved.status === "not-registered"
        ? diagnostic(
            "dynamicTexture.notRegistered",
            id,
            `Dynamic texture '${id}' has no ready texture asset in the source registry.`,
          )
        : diagnostic(
            "dynamicTexture.notRealized",
            id,
            `Dynamic texture '${id}' has not been realized on the GPU yet (no material has sampled it this session).`,
          ),
    );
  }

  const queue = (input.device as DynamicTextureDeviceLike | null | undefined)
    ?.queue;

  if (queue?.copyExternalImageToTexture === undefined) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.uploadUnavailable",
        id,
        `Dynamic texture '${id}' cannot import an external image: the WebGPU queue does not expose copyExternalImageToTexture.`,
      ),
    );
  }

  try {
    queue.copyExternalImageToTexture(
      {
        source: update.source,
        flipY: update.flipY ?? false,
        origin: {
          x: update.sourceOrigin?.x ?? 0,
          y: update.sourceOrigin?.y ?? 0,
        },
      },
      {
        texture: resolved.texture,
        mipLevel: 0,
        origin: { x: region.x, y: region.y, z: 0 },
      },
      { width: region.width, height: region.height, depthOrArrayLayers: 1 },
    );
  } catch (error) {
    entry.failedUpdates += 1;
    return failUpdate(
      id,
      diagnostic(
        "dynamicTexture.uploadFailed",
        id,
        `Dynamic texture '${id}' copyExternalImageToTexture failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
      region,
    );
  }

  const bytesUploaded = region.width * region.height * entry.texelBytes;
  entry.updates += 1;
  entry.externalImageUpdates += 1;
  entry.bytesUploaded += bytesUploaded;
  entry.frameUpdates += 1;
  entry.frameExternalImageUpdates += 1;
  entry.frameBytesUploaded += bytesUploaded;

  return { ok: true, id, bytesUploaded, region, diagnostics: [] };
}

function failUpdate(
  id: string,
  diag: WebGpuAppDynamicTextureDiagnostic,
  region?: NormalizedRegion,
): WebGpuAppDynamicTextureUpdateResult {
  return {
    ok: false,
    id,
    bytesUploaded: 0,
    region: region ?? null,
    diagnostics: [diag],
  };
}

/**
 * Build the frame-report section for dynamic textures. `reset: true` clears the
 * per-frame accumulators AFTER reading them, so the reported `frameUpdates` /
 * `frameBytesUploaded` are the update rate SINCE the previous frame report.
 * Returns `undefined` when no dynamic texture has ever been registered, so an
 * app that does not use the feature keeps a byte-identical frame report.
 */
export function webGpuAppDynamicTextureReport(
  state: WebGpuAppDynamicTextureState,
  options: { readonly reset?: boolean } = {},
): WebGpuAppDynamicTextureReport | undefined {
  if (state.entries.size === 0) {
    return undefined;
  }

  let frameUpdates = 0;
  let frameBytesUploaded = 0;
  let totalUpdates = 0;
  let totalBytesUploaded = 0;
  let totalExternalImageUpdates = 0;
  let totalFailedUpdates = 0;
  const textures: WebGpuAppDynamicTextureEntryReport[] = [];

  for (const entry of state.entries.values()) {
    frameUpdates += entry.frameUpdates;
    frameBytesUploaded += entry.frameBytesUploaded;
    totalUpdates += entry.updates;
    totalBytesUploaded += entry.bytesUploaded;
    totalExternalImageUpdates += entry.externalImageUpdates;
    totalFailedUpdates += entry.failedUpdates;
    textures.push({
      id: entry.id,
      width: entry.width,
      height: entry.height,
      format: entry.format,
      updates: entry.updates,
      bytesUploaded: entry.bytesUploaded,
      externalImageUpdates: entry.externalImageUpdates,
      failedUpdates: entry.failedUpdates,
      frameUpdates: entry.frameUpdates,
      frameBytesUploaded: entry.frameBytesUploaded,
    });

    if (options.reset === true) {
      entry.frameUpdates = 0;
      entry.frameBytesUploaded = 0;
      entry.frameExternalImageUpdates = 0;
    }
  }

  return {
    textureCount: state.entries.size,
    frameUpdates,
    frameBytesUploaded,
    totalUpdates,
    totalBytesUploaded,
    totalExternalImageUpdates,
    totalFailedUpdates,
    textures,
  };
}

// Reachable-from-the-app registration, mirroring the render-target facade's
// WeakMap so tooling can find an app's dynamic-texture state without threading
// it through every call site.
const APP_DYNAMIC_TEXTURE_STATES = new WeakMap<
  object,
  WebGpuAppDynamicTextureState
>();

export function registerWebGpuAppDynamicTextureState(
  app: object,
  state: WebGpuAppDynamicTextureState,
): void {
  APP_DYNAMIC_TEXTURE_STATES.set(app, state);
}

export function getWebGpuAppDynamicTextureState(
  app: object,
): WebGpuAppDynamicTextureState | undefined {
  return APP_DYNAMIC_TEXTURE_STATES.get(app);
}

// Handle key helper for tests that assert cache-key resolution.
export function dynamicTextureCacheKey(id: string, version: number): string {
  return sourceAssetCacheKey(createTextureHandle(id), version);
}
