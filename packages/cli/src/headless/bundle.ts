import {
  serializeSourceAssetRegistry,
  type SerializedSourceAssetRegistry,
} from "@aperture-engine/app/asset-mirror";
import {
  encodeTypedArrayTree,
  renderSnapshotToJsonValue,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { APERTURE_CLI_VERSION } from "../version.js";

// Derive the registry type from the serializer instead of taking a direct
// dependency on @aperture-engine/simulation.
type SourceAssetRegistry = Parameters<typeof serializeSourceAssetRegistry>[0];

export const APERTURE_RENDER_BUNDLE_FORMAT = "aperture.render-bundle";
export const APERTURE_RENDER_BUNDLE_VERSION = 1;
export const APERTURE_LEGACY_SNAPSHOT_BUNDLE_FORMAT =
  "aperture-render-snapshot";
export const APERTURE_LEGACY_SNAPSHOT_BUNDLE_VERSION = 1;
export const APERTURE_SNAPSHOT_BUNDLE_FORMAT = APERTURE_RENDER_BUNDLE_FORMAT;
export const APERTURE_SNAPSHOT_BUNDLE_VERSION = APERTURE_RENDER_BUNDLE_VERSION;
export const APERTURE_RENDER_SNAPSHOT_SCHEMA = "aperture.render-snapshot.v1";
export const APERTURE_SOURCE_ASSET_SCHEMA = "aperture.source-assets.v1";
export const APERTURE_TYPED_ARRAY_JSON_CODEC = "json-typed-array-v1";

const DEFAULT_RENDER_TARGET: ApertureRenderBundleTarget = {
  width: 960,
  height: 640,
  colorSpace: "srgb",
  sampleCount: 4,
};

// A self-contained, renderable bundle: the extracted RenderSnapshot plus the
// serialized source-asset registry it references. A RenderSnapshot carries only
// `{ kind, id }` asset handles, not bytes, so the render command (Track 2) must
// rehydrate `sourceAssets` before drawing — otherwise every mesh resolves to
// null and the frame is blank.
export interface ApertureAssetProvenance {
  /** Assets fulfilled with real loaded bytes. */
  readonly real: number;
  /** Assets fulfilled with a structural placeholder (stubbed pixels). */
  readonly placeholderCount: number;
  readonly placeholderIds: readonly string[];
}

export interface ApertureSnapshotBundleClosure {
  /** Asset handles directly referenced by the render snapshot. */
  readonly roots: readonly string[];
  /** Direct and transitive source-asset handles needed to render this snapshot. */
  readonly referenced: readonly string[];
  readonly missing: readonly string[];
  readonly unready: readonly string[];
  readonly placeholders: readonly string[];
}

export interface ApertureRenderBundleBloom {
  readonly threshold?: number;
  readonly intensity?: number;
  readonly radius?: number;
  /** Legacy Aperture blur radius fallback; prefer `radius` for new code. */
  readonly radiusPixels?: number;
  readonly levels?: number;
}

export interface ApertureRenderBundleTarget {
  readonly width: number;
  readonly height: number;
  readonly colorSpace: "srgb" | "display-p3";
  readonly sampleCount: number;
  readonly toneMapping?: string;
  readonly exposure?: number;
  /** UnrealBloom-style bloom settings; presence enables the effect (#73). */
  readonly bloom?: ApertureRenderBundleBloom;
}

/**
 * Derive the render/post fields of a bundle target from the app's
 * config.render defaults (#73): tonemap, exposure, bloom, and sampleCount
 * travel with the bundle so `aperture render` and headless frame_capture
 * reproduce the app's final look instead of a geometry+lighting-only preview.
 */
export function renderBundleTargetFromRenderDefaults(
  render:
    | {
        readonly sampleCount?: number;
        readonly tonemap?: string;
        readonly exposure?: number;
        readonly bloom?: boolean | ApertureRenderBundleBloom;
      }
    | undefined,
): Partial<ApertureRenderBundleTarget> {
  if (render === undefined) {
    return {};
  }

  const bloom =
    render.bloom === undefined || render.bloom === false
      ? undefined
      : render.bloom === true
        ? {}
        : {
            ...(render.bloom.threshold === undefined
              ? {}
              : { threshold: render.bloom.threshold }),
            ...(render.bloom.intensity === undefined
              ? {}
              : { intensity: render.bloom.intensity }),
            ...(render.bloom.radius === undefined
              ? {}
              : { radius: render.bloom.radius }),
            ...(render.bloom.radiusPixels === undefined
              ? {}
              : { radiusPixels: render.bloom.radiusPixels }),
            ...(render.bloom.levels === undefined
              ? {}
              : { levels: render.bloom.levels }),
          };
  // Bloom needs the HDR scene-buffer path; opting into bloom implies exposure,
  // matching the browser runtime.
  const exposure = render.exposure ?? (bloom === undefined ? undefined : 1);

  return {
    ...(render.sampleCount === undefined
      ? {}
      : { sampleCount: render.sampleCount }),
    ...(render.tonemap === undefined ? {} : { toneMapping: render.tonemap }),
    ...(exposure === undefined ? {} : { exposure }),
    ...(bloom === undefined ? {} : { bloom }),
  };
}

export interface ApertureRenderBundleRequirements {
  readonly webgpuFeatures: readonly string[];
  readonly textureFormats: readonly string[];
  readonly limits?: Readonly<Record<string, number>>;
}

export interface ApertureRenderBundleDigest {
  readonly algorithm: "fnv1a32-stable-json-v1";
  readonly hash: string;
  readonly byteLength: number;
}

export interface ApertureRenderBundleDiagnostic {
  readonly code: string;
  readonly severity?: "info" | "warning" | "error";
  readonly message?: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly suggestedFix?: string;
}

export interface ApertureSnapshotBundlePreflightResult {
  readonly ok: boolean;
  readonly closure: ApertureSnapshotBundleClosure;
  readonly violations: readonly string[];
}

export interface ApertureSnapshotBundlePreflightOptions {
  readonly allowPlaceholders?: boolean;
}

export interface CreateApertureSnapshotBundleOptions {
  readonly renderTarget?: Partial<ApertureRenderBundleTarget>;
  readonly createdBy?: string;
  readonly allowPlaceholders?: boolean;
}

export interface ApertureRenderBundle {
  readonly format: typeof APERTURE_RENDER_BUNDLE_FORMAT;
  readonly version: typeof APERTURE_RENDER_BUNDLE_VERSION;
  readonly engine: {
    readonly apertureVersion: string;
    readonly snapshotSchema: typeof APERTURE_RENDER_SNAPSHOT_SCHEMA;
    readonly assetSchema: typeof APERTURE_SOURCE_ASSET_SCHEMA;
    readonly createdBy: string;
  };
  readonly frame: number;
  readonly renderTarget: ApertureRenderBundleTarget;
  readonly requirements: ApertureRenderBundleRequirements;
  readonly snapshot: {
    readonly codec: typeof APERTURE_TYPED_ARRAY_JSON_CODEC;
    readonly value: unknown;
  };
  readonly assets: {
    readonly schema: typeof APERTURE_SOURCE_ASSET_SCHEMA;
    readonly completeness: "complete" | "incomplete";
    readonly allowPlaceholders: boolean;
    readonly entries: SerializedSourceAssetRegistry["entries"];
  };
  readonly assetProvenance: ApertureAssetProvenance;
  readonly closure: ApertureSnapshotBundleClosure;
  readonly diagnostics: readonly ApertureRenderBundleDiagnostic[];
  /**
   * Digest of the whole bundle, including provenance such as `engine.createdBy`.
   * Two identical simulations exported by different commands (`headless` vs
   * `serve`) therefore get different `digest` hashes.
   */
  readonly digest: ApertureRenderBundleDigest;
  /**
   * Digest of the deterministic simulation output only (`snapshot.value`), with
   * no provenance/tool metadata folded in. Use this to assert "same simulation
   * across tools" — it is stable regardless of which command produced the
   * bundle (finding F6).
   */
  readonly snapshotDigest: ApertureRenderBundleDigest;
}

export interface ApertureLegacySnapshotBundle {
  readonly format: typeof APERTURE_LEGACY_SNAPSHOT_BUNDLE_FORMAT;
  readonly version: typeof APERTURE_LEGACY_SNAPSHOT_BUNDLE_VERSION;
  readonly frame: number;
  readonly assetProvenance?: ApertureAssetProvenance;
  readonly closure?: ApertureSnapshotBundleClosure;
  readonly snapshot: unknown;
  readonly sourceAssets: unknown;
}

export type ApertureSnapshotBundle =
  | ApertureRenderBundle
  | ApertureLegacySnapshotBundle;

export function createApertureSnapshotBundle(args: {
  readonly snapshot: RenderSnapshot;
  readonly assets: SourceAssetRegistry;
  readonly options?: CreateApertureSnapshotBundleOptions;
}): ApertureRenderBundle {
  const manifest = args.assets.createManifestReport();
  const sourceAssets: SerializedSourceAssetRegistry =
    serializeSourceAssetRegistry(args.assets);
  const snapshotValue = renderSnapshotToJsonValue(args.snapshot);
  const encodedSourceAssets = encodeTypedArrayTree(
    sourceAssets,
  ) as SerializedSourceAssetRegistry;
  const closure = createApertureSnapshotBundleClosure({
    snapshot: snapshotValue,
    sourceAssets: encodedSourceAssets,
  });
  const assetProvenance: ApertureAssetProvenance = {
    real: manifest.total - manifest.placeholders.count,
    placeholderCount: manifest.placeholders.count,
    placeholderIds: manifest.placeholders.ids,
  };
  const bundleWithoutDigest = {
    format: APERTURE_RENDER_BUNDLE_FORMAT,
    version: APERTURE_RENDER_BUNDLE_VERSION,
    engine: {
      apertureVersion: APERTURE_CLI_VERSION,
      snapshotSchema: APERTURE_RENDER_SNAPSHOT_SCHEMA,
      assetSchema: APERTURE_SOURCE_ASSET_SCHEMA,
      createdBy: args.options?.createdBy ?? "aperture headless",
    },
    frame: args.snapshot.frame,
    renderTarget: normalizeRenderTarget(args.options?.renderTarget),
    requirements: {
      webgpuFeatures: [],
      textureFormats: [],
    },
    snapshot: {
      codec: APERTURE_TYPED_ARRAY_JSON_CODEC,
      value: snapshotValue,
    },
    assets: {
      schema: APERTURE_SOURCE_ASSET_SCHEMA,
      completeness:
        closure.missing.length === 0 && closure.unready.length === 0
          ? "complete"
          : "incomplete",
      allowPlaceholders:
        args.options?.allowPlaceholders ?? assetProvenance.placeholderCount > 0,
      entries: encodedSourceAssets.entries,
    },
    assetProvenance,
    closure,
    diagnostics: collectBundleDiagnostics(encodedSourceAssets),
  } satisfies Omit<ApertureRenderBundle, "digest" | "snapshotDigest">;

  return {
    ...bundleWithoutDigest,
    // Pure-simulation digest (snapshot.value only) — stable across the command
    // that produced the bundle. Kept outside the whole-bundle digest so the
    // existing `digest` semantics and hashes are unchanged.
    snapshotDigest: createStableDigest(snapshotValue),
    digest: createStableDigest(bundleWithoutDigest),
  };
}

export function createApertureSnapshotBundleClosure(args: {
  readonly snapshot: unknown;
  readonly sourceAssets: unknown;
}): ApertureSnapshotBundleClosure {
  const roots = collectApertureSnapshotAssetKeys(args.snapshot);
  const sourceAssets = readSerializedSourceAssetMap(args.sourceAssets);

  return expandApertureSnapshotBundleClosure(roots, sourceAssets.entries);
}

export function preflightApertureSnapshotBundle(
  bundle: unknown,
  options: ApertureSnapshotBundlePreflightOptions = {},
): ApertureSnapshotBundlePreflightResult {
  const normalized = normalizeApertureSnapshotBundle(bundle);
  const roots = collectApertureSnapshotAssetKeys(normalized.snapshot);
  const unsupportedSnapshotAssetHandles = collectUnsupportedAssetHandleKeys(
    normalized.snapshot,
  );
  const sourceAssets = readSerializedSourceAssetMap(normalized.sourceAssets);
  const closure = expandApertureSnapshotBundleClosure(
    roots,
    sourceAssets.entries,
  );
  const violations: string[] = [];

  if (!normalized.valid) {
    violations.push(...normalized.violations);
  }

  if (!sourceAssets.valid) {
    violations.push("sourceAssets must contain a valid entries array");
  }

  violations.push(
    ...renderTargetRequirementViolations(normalized.renderTarget),
  );

  if (unsupportedSnapshotAssetHandles.length > 0) {
    violations.push(
      `unsupported asset handles: ${unsupportedSnapshotAssetHandles.join(", ")}`,
    );
  }

  if (normalized.expectedClosure !== null) {
    const stale = compareClosure(closure, normalized.expectedClosure);
    if (stale.length > 0) {
      violations.push(`stale closure metadata: ${stale.join(", ")}`);
    }
  }

  if (closure.missing.length > 0) {
    violations.push(`missing assets: ${closure.missing.join(", ")}`);
  }

  if (closure.unready.length > 0) {
    violations.push(`unready assets: ${closure.unready.join(", ")}`);
  }

  if (options.allowPlaceholders !== true && closure.placeholders.length > 0) {
    violations.push(`placeholder assets: ${closure.placeholders.join(", ")}`);
  }

  const patchOnlyMeshes = collectPatchOnlyMeshAssets(
    closure,
    sourceAssets.entries,
  );
  if (patchOnlyMeshes.length > 0) {
    violations.push(
      `mesh patch assets without base payload: ${patchOnlyMeshes.join(", ")}`,
    );
  }

  const runtimeExternalDependencies = collectRuntimeExternalDependencies(
    closure,
    sourceAssets.entries,
  );
  if (runtimeExternalDependencies.length > 0) {
    violations.push(
      `runtime external asset dependencies: ${runtimeExternalDependencies.join(", ")}`,
    );
  }

  return {
    ok: violations.length === 0,
    closure,
    violations,
  };
}

export function normalizeApertureSnapshotBundle(bundle: unknown): {
  readonly valid: boolean;
  readonly violations: readonly string[];
  readonly format: string | null;
  readonly version: number | null;
  readonly frame: number | null;
  readonly renderTarget: ApertureRenderBundleTarget;
  readonly snapshot: unknown;
  readonly sourceAssets: unknown;
  readonly expectedClosure: ApertureSnapshotBundleClosure | null;
} {
  const violations: string[] = [];

  if (!isRecord(bundle)) {
    return {
      valid: false,
      violations: ["bundle must be an object"],
      format: null,
      version: null,
      frame: null,
      renderTarget: DEFAULT_RENDER_TARGET,
      snapshot: null,
      sourceAssets: null,
      expectedClosure: null,
    };
  }

  const format = typeof bundle["format"] === "string" ? bundle["format"] : null;
  const version =
    typeof bundle["version"] === "number" ? bundle["version"] : null;
  const frame = typeof bundle["frame"] === "number" ? bundle["frame"] : null;

  if (format === APERTURE_RENDER_BUNDLE_FORMAT) {
    const snapshot = readRenderBundleSnapshot(bundle["snapshot"], violations);
    const sourceAssets = readRenderBundleSourceAssets(
      bundle["assets"],
      violations,
    );
    const renderTarget = readRenderTarget(bundle["renderTarget"], violations);
    const expectedClosure = readClosure(bundle["closure"]);

    if (version !== APERTURE_RENDER_BUNDLE_VERSION) {
      violations.push(
        `unsupported render bundle version ${String(
          version,
        )}; expected ${APERTURE_RENDER_BUNDLE_VERSION}`,
      );
    }

    if (!isRecord(bundle["engine"])) {
      violations.push("engine metadata must be an object");
    }

    if (!isRecord(bundle["requirements"])) {
      violations.push("requirements metadata must be an object");
    }

    if (expectedClosure === null) {
      violations.push("closure metadata must be present");
    }

    return {
      valid: violations.length === 0,
      violations,
      format,
      version,
      frame,
      renderTarget,
      snapshot,
      sourceAssets,
      expectedClosure,
    };
  }

  if (format === APERTURE_LEGACY_SNAPSHOT_BUNDLE_FORMAT) {
    if (version !== APERTURE_LEGACY_SNAPSHOT_BUNDLE_VERSION) {
      violations.push(
        `unsupported legacy snapshot bundle version ${String(
          version,
        )}; expected ${APERTURE_LEGACY_SNAPSHOT_BUNDLE_VERSION}`,
      );
    }

    return {
      valid: violations.length === 0,
      violations,
      format,
      version,
      frame,
      renderTarget: DEFAULT_RENDER_TARGET,
      snapshot: bundle["snapshot"],
      sourceAssets: bundle["sourceAssets"],
      expectedClosure: readClosure(bundle["closure"]),
    };
  }

  violations.push(
    `unsupported bundle format '${String(
      format,
    )}'; expected '${APERTURE_RENDER_BUNDLE_FORMAT}'`,
  );

  return {
    valid: false,
    violations,
    format,
    version,
    frame,
    renderTarget: DEFAULT_RENDER_TARGET,
    snapshot: null,
    sourceAssets: null,
    expectedClosure: null,
  };
}

export function getApertureSnapshotBundleRenderTarget(
  bundle: unknown,
): ApertureRenderBundleTarget {
  return normalizeApertureSnapshotBundle(bundle).renderTarget;
}

function normalizeRenderTarget(
  value: Partial<ApertureRenderBundleTarget> | undefined,
): ApertureRenderBundleTarget {
  return {
    width: normalizePositiveInteger(value?.width, DEFAULT_RENDER_TARGET.width),
    height: normalizePositiveInteger(
      value?.height,
      DEFAULT_RENDER_TARGET.height,
    ),
    colorSpace: value?.colorSpace === "display-p3" ? "display-p3" : "srgb",
    sampleCount: normalizePositiveInteger(
      value?.sampleCount,
      DEFAULT_RENDER_TARGET.sampleCount,
    ),
    ...(value?.toneMapping === undefined
      ? {}
      : { toneMapping: value.toneMapping }),
    ...(value?.exposure === undefined ? {} : { exposure: value.exposure }),
    ...(value?.bloom === undefined ? {} : { bloom: value.bloom }),
  };
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function collectBundleDiagnostics(
  sourceAssets: SerializedSourceAssetRegistry,
): readonly ApertureRenderBundleDiagnostic[] {
  const diagnostics: ApertureRenderBundleDiagnostic[] = [];

  for (const entry of sourceAssets.entries) {
    for (const diagnostic of entry.diagnostics) {
      diagnostics.push({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
      });
    }
  }

  return diagnostics;
}

function readRenderBundleSnapshot(
  value: unknown,
  violations: string[],
): unknown {
  if (!isRecord(value)) {
    violations.push("snapshot must be an object with codec and value");
    return null;
  }

  if (value["codec"] !== APERTURE_TYPED_ARRAY_JSON_CODEC) {
    violations.push(
      `snapshot codec must be '${APERTURE_TYPED_ARRAY_JSON_CODEC}'`,
    );
  }

  return value["value"];
}

function readRenderBundleSourceAssets(
  value: unknown,
  violations: string[],
): unknown {
  if (!isRecord(value)) {
    violations.push("assets must be an object");
    return null;
  }

  if (value["schema"] !== APERTURE_SOURCE_ASSET_SCHEMA) {
    violations.push(`assets schema must be '${APERTURE_SOURCE_ASSET_SCHEMA}'`);
  }

  if (
    value["completeness"] !== "complete" &&
    value["completeness"] !== "incomplete"
  ) {
    violations.push("assets completeness must be complete or incomplete");
  }

  if (typeof value["allowPlaceholders"] !== "boolean") {
    violations.push("assets allowPlaceholders must be a boolean");
  }

  return { entries: value["entries"] };
}

function readRenderTarget(
  value: unknown,
  violations: string[],
): ApertureRenderBundleTarget {
  if (!isRecord(value)) {
    violations.push("renderTarget must be an object");
    return DEFAULT_RENDER_TARGET;
  }

  const width = value["width"];
  const height = value["height"];
  const sampleCount = value["sampleCount"];
  const colorSpace = value["colorSpace"];
  const toneMapping = value["toneMapping"];
  const exposure = value["exposure"];
  const bloom = readRenderTargetBloom(value["bloom"], violations);

  if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) {
    violations.push("renderTarget.width must be a positive integer");
  }
  if (typeof height !== "number" || !Number.isInteger(height) || height <= 0) {
    violations.push("renderTarget.height must be a positive integer");
  }
  if (colorSpace !== "srgb" && colorSpace !== "display-p3") {
    violations.push("renderTarget.colorSpace must be srgb or display-p3");
  }
  if (
    typeof sampleCount !== "number" ||
    !Number.isInteger(sampleCount) ||
    sampleCount <= 0
  ) {
    violations.push("renderTarget.sampleCount must be a positive integer");
  }
  if (toneMapping !== undefined && typeof toneMapping !== "string") {
    violations.push("renderTarget.toneMapping must be a string when present");
  }
  if (exposure !== undefined && typeof exposure !== "number") {
    violations.push("renderTarget.exposure must be a number when present");
  }

  return {
    width: normalizePositiveInteger(width, DEFAULT_RENDER_TARGET.width),
    height: normalizePositiveInteger(height, DEFAULT_RENDER_TARGET.height),
    colorSpace: colorSpace === "display-p3" ? "display-p3" : "srgb",
    sampleCount: normalizePositiveInteger(
      sampleCount,
      DEFAULT_RENDER_TARGET.sampleCount,
    ),
    ...(typeof toneMapping === "string" ? { toneMapping } : {}),
    ...(typeof exposure === "number" ? { exposure } : {}),
    ...(bloom === undefined ? {} : { bloom }),
  };
}

function readRenderTargetBloom(
  value: unknown,
  violations: string[],
): ApertureRenderBundleBloom | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    violations.push("renderTarget.bloom must be an object when present");
    return undefined;
  }

  const bloom: Record<string, number> = {};
  for (const field of [
    "threshold",
    "intensity",
    "radius",
    "radiusPixels",
    "levels",
  ] as const) {
    const fieldValue = value[field];
    if (fieldValue === undefined) {
      continue;
    }
    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
      violations.push(
        `renderTarget.bloom.${field} must be a finite number when present`,
      );
      continue;
    }
    bloom[field] = fieldValue;
  }

  return bloom;
}

function readClosure(value: unknown): ApertureSnapshotBundleClosure | null {
  if (!isRecord(value)) {
    return null;
  }

  const roots = value["roots"];
  const referenced = value["referenced"];
  const missing = value["missing"];
  const unready = value["unready"];
  const placeholders = value["placeholders"];

  if (
    !isStringArray(roots) ||
    !isStringArray(referenced) ||
    !isStringArray(missing) ||
    !isStringArray(unready) ||
    !isStringArray(placeholders)
  ) {
    return null;
  }

  return {
    roots,
    referenced,
    missing,
    unready,
    placeholders,
  };
}

function compareClosure(
  actual: ApertureSnapshotBundleClosure,
  expected: ApertureSnapshotBundleClosure,
): readonly string[] {
  const stale: string[] = [];

  for (const key of [
    "roots",
    "referenced",
    "missing",
    "unready",
    "placeholders",
  ] as const) {
    if (!sameStringArray(actual[key], expected[key])) {
      stale.push(key);
    }
  }

  return stale;
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function collectApertureSnapshotAssetKeys(
  snapshot: unknown,
): readonly string[] {
  const keys = new Set<string>();
  collectAssetHandleKeys(snapshot, keys, new Set<object>());
  return sortedKeys(keys);
}

function collectUnsupportedAssetHandleKeys(value: unknown): readonly string[] {
  const keys = new Set<string>();
  collectUnsupportedAssetHandles(value, keys, new Set<object>());
  return sortedKeys(keys);
}

interface SourceAssetEntryForClosure {
  readonly kind: string;
  readonly status: string;
  readonly asset: unknown;
  readonly dependencies: readonly string[];
  readonly provenance?: string;
}

interface SerializedSourceAssetMap {
  readonly entries: ReadonlyMap<string, SourceAssetEntryForClosure>;
  readonly valid: boolean;
}

const ASSET_KINDS = new Set([
  "mesh",
  "material",
  "texture",
  "sampler",
  "render-target",
  "scene",
  "prefab",
  "animation-clip",
  "skin",
  "morph-target-set",
  "environment-map",
  "shader",
  "font-atlas",
  "particle-effect",
  "audio-clip",
]);

const ASSET_READY_STATUS = "ready";
const ASSET_PLACEHOLDER_PROVENANCE = "placeholder";
const SUPPORTED_RENDER_TARGET_COLOR_SPACES = new Set(["srgb"]);
const SUPPORTED_RENDER_TARGET_SAMPLE_COUNTS = new Set([1, 4]);
const SUPPORTED_TONE_MAPPING = new Set([
  "none",
  "linear",
  "reinhard",
  "aces",
  "agx",
  "neutral",
]);

function renderTargetRequirementViolations(
  target: ApertureRenderBundleTarget,
): readonly string[] {
  const violations: string[] = [];

  if (!SUPPORTED_RENDER_TARGET_COLOR_SPACES.has(target.colorSpace)) {
    violations.push(
      `unsupported renderTarget.colorSpace '${target.colorSpace}'`,
    );
  }

  if (!SUPPORTED_RENDER_TARGET_SAMPLE_COUNTS.has(target.sampleCount)) {
    violations.push(
      `unsupported renderTarget.sampleCount ${target.sampleCount}`,
    );
  }

  if (
    target.toneMapping !== undefined &&
    !SUPPORTED_TONE_MAPPING.has(target.toneMapping)
  ) {
    violations.push(
      `unsupported renderTarget.toneMapping '${target.toneMapping}'`,
    );
  }

  if (target.exposure !== undefined && !Number.isFinite(target.exposure)) {
    violations.push("renderTarget.exposure must be finite");
  }

  return violations;
}

function readSerializedSourceAssetMap(
  sourceAssets: unknown,
): SerializedSourceAssetMap {
  if (!isRecord(sourceAssets)) {
    return { entries: new Map(), valid: false };
  }

  const entries = sourceAssets["entries"];

  if (!Array.isArray(entries)) {
    return { entries: new Map(), valid: false };
  }

  let valid = true;
  const result = new Map<string, SourceAssetEntryForClosure>();

  for (const value of entries) {
    const entry = readSerializedSourceAssetEntry(value);

    if (entry === null) {
      valid = false;
      continue;
    }

    result.set(entry.key, {
      kind: entry.kind,
      status: entry.status,
      asset: entry.asset,
      dependencies: entry.dependencies,
      ...(entry.provenance === undefined
        ? {}
        : { provenance: entry.provenance }),
    });
  }

  return { entries: result, valid };
}

function readSerializedSourceAssetEntry(value: unknown): {
  readonly key: string;
  readonly kind: string;
  readonly status: string;
  readonly asset: unknown;
  readonly dependencies: readonly string[];
  readonly provenance?: string;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const handle = knownAssetHandleFromUnknown(value["handle"]);

  if (handle === null) {
    return null;
  }

  const dependencies = value["dependencies"];
  const status = value["status"];

  if (!Array.isArray(dependencies) || typeof status !== "string") {
    return null;
  }

  const dependencyKeys: string[] = [];

  for (const dependency of dependencies) {
    const dependencyKey = assetHandleKeyFromUnknown(dependency);

    if (dependencyKey === null) {
      return null;
    }

    dependencyKeys.push(dependencyKey);
  }

  const provenance = value["provenance"];

  return {
    key: handle.key,
    kind: handle.kind,
    status,
    asset: value["asset"],
    dependencies: uniqueSorted(dependencyKeys),
    ...(typeof provenance === "string" ? { provenance } : {}),
  };
}

function expandApertureSnapshotBundleClosure(
  roots: readonly string[],
  entries: ReadonlyMap<string, SourceAssetEntryForClosure>,
): ApertureSnapshotBundleClosure {
  const referenced = new Set<string>();
  const missing = new Set<string>();
  const unready = new Set<string>();
  const placeholders = new Set<string>();
  const queue = [...roots];

  for (const key of queue) {
    referenced.add(key);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const key = queue[index];

    if (key === undefined) {
      continue;
    }

    const entry = entries.get(key);

    if (entry === undefined) {
      missing.add(key);
      continue;
    }

    if (entry.status !== ASSET_READY_STATUS) {
      unready.add(key);
    }

    if (entry.provenance === ASSET_PLACEHOLDER_PROVENANCE) {
      placeholders.add(key);
    }

    for (const dependency of entry.dependencies) {
      if (!referenced.has(dependency)) {
        referenced.add(dependency);
        queue.push(dependency);
      }
    }
  }

  return {
    roots: uniqueSorted(roots),
    referenced: sortedKeys(referenced),
    missing: sortedKeys(missing),
    unready: sortedKeys(unready),
    placeholders: sortedKeys(placeholders),
  };
}

function collectAssetHandleKeys(
  value: unknown,
  keys: Set<string>,
  seen: Set<object>,
): void {
  const key = assetHandleKeyFromUnknown(value);

  if (key !== null) {
    keys.add(key);
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAssetHandleKeys(item, keys, seen);
    }
    return;
  }

  for (const item of Object.values(value)) {
    collectAssetHandleKeys(item, keys, seen);
  }
}

function assetHandleKeyFromUnknown(value: unknown): string | null {
  return knownAssetHandleFromUnknown(value)?.key ?? null;
}

function knownAssetHandleFromUnknown(value: unknown): {
  readonly key: string;
  readonly kind: string;
  readonly id: string;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = value["kind"];
  const id = value["id"];

  if (
    typeof kind !== "string" ||
    typeof id !== "string" ||
    !ASSET_KINDS.has(kind)
  ) {
    return null;
  }

  return { key: `${kind}:${id}`, kind, id };
}

function collectUnsupportedAssetHandles(
  value: unknown,
  keys: Set<string>,
  seen: Set<object>,
): void {
  if (isRecord(value)) {
    const kind = value["kind"];
    const id = value["id"];

    if (
      typeof kind === "string" &&
      typeof id === "string" &&
      !ASSET_KINDS.has(kind)
    ) {
      keys.add(`${kind}:${id}`);
    }
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUnsupportedAssetHandles(item, keys, seen);
    }
    return;
  }

  for (const item of Object.values(value)) {
    collectUnsupportedAssetHandles(item, keys, seen);
  }
}

function collectPatchOnlyMeshAssets(
  closure: ApertureSnapshotBundleClosure,
  entries: ReadonlyMap<string, SourceAssetEntryForClosure>,
): readonly string[] {
  const patchOnlyMeshes: string[] = [];

  for (const key of closure.referenced) {
    const entry = entries.get(key);

    if (
      entry?.kind === "mesh" &&
      isRecord(entry.asset) &&
      entry.asset["kind"] === "aperture.meshAssetPatch.v1"
    ) {
      patchOnlyMeshes.push(key);
    }
  }

  return patchOnlyMeshes;
}

function collectRuntimeExternalDependencies(
  closure: ApertureSnapshotBundleClosure,
  entries: ReadonlyMap<string, SourceAssetEntryForClosure>,
): readonly string[] {
  const dependencies: string[] = [];

  for (const key of closure.referenced) {
    const entry = entries.get(key);

    if (entry === undefined || entry.status !== ASSET_READY_STATUS) {
      continue;
    }

    const reason = runtimeExternalDependencyReason(entry);

    if (reason !== null) {
      dependencies.push(`${key} (${reason})`);
    }
  }

  return dependencies;
}

function runtimeExternalDependencyReason(
  entry: SourceAssetEntryForClosure,
): string | null {
  if (!isRecord(entry.asset)) {
    return null;
  }

  if (
    entry.kind === "texture" &&
    typeof entry.asset["url"] === "string" &&
    !hasTextureSourceData(entry.asset)
  ) {
    return "texture URL without embedded sourceData";
  }

  if (
    entry.kind === "shader" &&
    typeof entry.asset["url"] === "string" &&
    typeof entry.asset["source"] !== "string"
  ) {
    return "shader URL without embedded source";
  }

  if (
    entry.kind === "audio-clip" &&
    typeof entry.asset["url"] === "string" &&
    entry.asset["bytes"] === undefined
  ) {
    return "audio URL without embedded bytes";
  }

  if (
    entry.kind === "environment-map" &&
    !hasEnvironmentMapPayload(entry.asset)
  ) {
    return typeof entry.asset["url"] === "string"
      ? "environment-map URL without embedded environment payload"
      : "environment-map without embedded environment payload";
  }

  return null;
}

function hasTextureSourceData(asset: Record<string, unknown>): boolean {
  const sourceData = asset["sourceData"];

  return isRecord(sourceData) && sourceData["bytes"] !== undefined;
}

function hasEnvironmentMapPayload(asset: Record<string, unknown>): boolean {
  const equirectSource = asset["equirectSource"];
  if (isRecord(equirectSource) && equirectSource["data"] !== undefined) {
    return true;
  }

  const diffuseSource = asset["diffuseSource"];
  const specularPmremSource = asset["specularPmremSource"];

  return (
    hasCubeSourcePayload(diffuseSource) ||
    hasCubeSourcePayload(specularPmremSource)
  );
}

function hasCubeSourcePayload(source: unknown): boolean {
  if (!isRecord(source)) {
    return false;
  }

  const faces = source["faces"];

  return (
    Array.isArray(faces) &&
    faces.length > 0 &&
    faces.every((face) => face !== undefined)
  );
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return sortedKeys(new Set(values));
}

function sortedKeys(keys: Iterable<string>): readonly string[] {
  return [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function createStableDigest(value: unknown): ApertureRenderBundleDigest {
  const json = stableJsonStringify(value);
  return {
    algorithm: "fnv1a32-stable-json-v1",
    hash: fnv1a32(json),
    byteLength: json.length,
  };
}

function stableJsonStringify(value: unknown): string {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (ArrayBuffer.isView(value)) {
    return stableJsonStringify(
      Array.from(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      ),
    );
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`)
    .join(",")}}`;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
