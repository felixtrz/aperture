export const ASSET_KINDS = [
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
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];
export type AssetStatus = "registered" | "loading" | "ready" | "failed";
export type AssetDiagnosticSeverity = "info" | "warning" | "error";

declare const ASSET_HANDLE_BRAND: unique symbol;

export interface AssetHandle<TKind extends AssetKind = AssetKind> {
  readonly kind: TKind;
  readonly id: string;
  readonly [ASSET_HANDLE_BRAND]: TKind;
}

export type MeshHandle = AssetHandle<"mesh">;
export type MaterialHandle = AssetHandle<"material">;
export type TextureHandle = AssetHandle<"texture">;
export type SamplerHandle = AssetHandle<"sampler">;
export type RenderTargetHandle = AssetHandle<"render-target">;
/**
 * Handle for a scene asset. Its registry payload (the `TAsset` of
 * {@link AssetRegistryEntry}) is an `ApertureSceneDocument`
 * (serialization/scene-document.ts) — a versioned, JSON-safe snapshot of an ECS
 * world produced by `saveScene` and instantiated by `loadScene` (M7-T4).
 */
export type SceneHandle = AssetHandle<"scene">;
export type PrefabHandle = AssetHandle<"prefab">;
export type AnimationClipHandle = AssetHandle<"animation-clip">;
export type SkinHandle = AssetHandle<"skin">;
export type MorphTargetSetHandle = AssetHandle<"morph-target-set">;
export type EnvironmentMapHandle = AssetHandle<"environment-map">;
export type ShaderHandle = AssetHandle<"shader">;
export type FontAtlasHandle = AssetHandle<"font-atlas">;
export type ParticleEffectHandle = AssetHandle<"particle-effect">;
export type AudioClipHandle = AssetHandle<"audio-clip">;

export interface SerializedAssetHandle<TKind extends AssetKind = AssetKind> {
  readonly kind: TKind;
  readonly id: string;
}

export interface AssetDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: AssetDiagnosticSeverity;
}

export interface AssetRegistryEntry<
  TKind extends AssetKind = AssetKind,
  TAsset = unknown,
> {
  readonly handle: AssetHandle<TKind>;
  readonly kind: TKind;
  readonly label: string;
  readonly status: AssetStatus;
  readonly version: number;
  readonly asset: TAsset | null;
  readonly dependencies: readonly AssetHandle[];
  readonly diagnostics: readonly AssetDiagnostic[];
  /**
   * Whether the ready asset is the real loaded payload or a structural
   * placeholder (e.g. a Node headless run with no image decoder). Absent is
   * treated as "loaded".
   */
  readonly provenance?: AssetProvenance;
}

export type AssetProvenance = "loaded" | "placeholder";

export interface RegisterAssetOptions {
  readonly label?: string;
  readonly dependencies?: readonly AssetHandle[];
  readonly diagnostics?: readonly AssetDiagnostic[];
  readonly provenance?: AssetProvenance;
}

export interface AssetListFilter {
  readonly kind?: AssetKind;
  readonly status?: AssetStatus;
}

export type AssetDependencyDiagnosticCode =
  | "asset.dependencyMissing"
  | "asset.dependencyLoading"
  | "asset.dependencyFailed"
  | "asset.dependencyCycle";

export interface AssetDependencyDiagnostic {
  readonly code: AssetDependencyDiagnosticCode;
  readonly handleKey: string;
  readonly dependencyKey: string;
  readonly path: readonly string[];
  readonly message: string;
}

export interface AssetDependencyReport {
  readonly handleKey: string;
  readonly diagnostics: readonly AssetDependencyDiagnostic[];
}

export interface AssetManifestDependencyEdge {
  readonly from: string;
  readonly to: string;
}

export interface AssetManifestPlaceholders {
  readonly count: number;
  readonly ids: readonly string[];
}

export interface AssetManifestReport {
  readonly total: number;
  readonly byKind: Readonly<Record<AssetKind, number>>;
  readonly byStatus: Readonly<Record<AssetStatus, number>>;
  readonly dependencies: readonly AssetManifestDependencyEdge[];
  readonly diagnostics: readonly AssetDependencyDiagnostic[];
  readonly placeholders: AssetManifestPlaceholders;
}
