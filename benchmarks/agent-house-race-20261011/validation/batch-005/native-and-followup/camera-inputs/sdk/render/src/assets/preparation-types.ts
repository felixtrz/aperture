import type {
  AssetDependencyDiagnostic,
  AssetHandle,
  AssetKind,
  AssetRegistry,
} from "@aperture-engine/simulation";

export type RenderAssetPreparationSeverity = "info" | "warning" | "error";

export interface RenderAssetPreparationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: RenderAssetPreparationSeverity;
  readonly assetKey?: string;
  readonly dependencyKey?: string;
}

export interface RenderAssetDependencyState {
  readonly key: string;
  readonly ready: boolean;
  readonly dependencies: readonly AssetHandle[];
  readonly diagnostics: readonly AssetDependencyDiagnostic[];
}

export interface RenderAssetPrepareInput<
  TKind extends AssetKind,
  TSource,
  TPrepared,
> {
  readonly registry: AssetRegistry;
  readonly handle: AssetHandle<TKind>;
  readonly assetKey: string;
  readonly source: TSource;
  readonly sourceVersion: number;
  readonly dependencyState: RenderAssetDependencyState;
  readonly previous: PreparedRenderAssetEntry<TKind, TPrepared> | undefined;
}

export interface RenderAssetPrepareSuccess<TPrepared> {
  readonly status: "prepared";
  readonly prepared: TPrepared;
  readonly diagnostics?: readonly RenderAssetPreparationDiagnostic[];
}

export interface RenderAssetPrepareRetry {
  readonly status: "retry";
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}

export interface RenderAssetPrepareFailure {
  readonly status: "failed";
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}

export type RenderAssetPrepareResult<TPrepared> =
  | RenderAssetPrepareSuccess<TPrepared>
  | RenderAssetPrepareRetry
  | RenderAssetPrepareFailure;

export interface RenderAssetUnloadInput<TKind extends AssetKind, TPrepared> {
  readonly handle: AssetHandle<TKind>;
  readonly assetKey: string;
  readonly prepared: PreparedRenderAssetEntry<TKind, TPrepared>;
}

export interface RenderAssetUnloadResult {
  readonly diagnostics?: readonly RenderAssetPreparationDiagnostic[];
}

export interface RenderAssetAdapter<
  TKind extends AssetKind,
  TSource,
  TPrepared,
> {
  readonly kind: TKind;
  readonly family: string;
  prepare(
    input: RenderAssetPrepareInput<TKind, TSource, TPrepared>,
  ): RenderAssetPrepareResult<TPrepared>;
  unload?(
    input: RenderAssetUnloadInput<TKind, TPrepared>,
  ): RenderAssetUnloadResult | void;
}

export interface PreparedRenderAssetEntry<TKind extends AssetKind, TPrepared> {
  readonly handle: AssetHandle<TKind>;
  readonly assetKey: string;
  readonly family: string;
  readonly sourceVersion: number;
  readonly dependencyState: RenderAssetDependencyState;
  readonly prepared: TPrepared;
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}

export type PreparedRenderAssetStoreAction = "created" | "updated";

export interface PreparedRenderAssetStoreUpdate<
  TKind extends AssetKind,
  TPrepared,
> {
  readonly action: PreparedRenderAssetStoreAction;
  readonly entry: PreparedRenderAssetEntry<TKind, TPrepared>;
}

export interface PreparedRenderAssetStoreRemoval<
  TKind extends AssetKind,
  TPrepared,
> {
  readonly removed: boolean;
  readonly entry?: PreparedRenderAssetEntry<TKind, TPrepared>;
}

export type RenderAssetPreparationOutcome =
  | "prepared"
  | "unchanged"
  | "retry"
  | "failed"
  | "skipped";

export interface RenderAssetPreparationReport<
  TKind extends AssetKind,
  TPrepared,
> {
  readonly outcome: RenderAssetPreparationOutcome;
  readonly assetKey: string;
  readonly action?: PreparedRenderAssetStoreAction;
  readonly entry?: PreparedRenderAssetEntry<TKind, TPrepared>;
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}
