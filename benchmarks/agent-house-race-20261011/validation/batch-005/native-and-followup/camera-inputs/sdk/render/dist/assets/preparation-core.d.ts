import { type AssetHandle, type AssetKind, type AssetRegistry, type AssetRegistryEntry } from "@aperture-engine/simulation";
import type { PreparedRenderAssetStore } from "./preparation-store.js";
import type { PreparedRenderAssetEntry, RenderAssetAdapter, RenderAssetDependencyState, RenderAssetPreparationDiagnostic, RenderAssetPreparationReport } from "./preparation-types.js";
export interface PrepareRenderAssetOptions<TKind extends AssetKind, TSource, TPrepared> {
    readonly registry: AssetRegistry;
    readonly adapter: RenderAssetAdapter<TKind, TSource, TPrepared>;
    readonly store: PreparedRenderAssetStore<TKind, TPrepared>;
    readonly handle: AssetHandle<TKind>;
}
export declare function prepareRenderAsset<TKind extends AssetKind, TSource, TPrepared>(options: PrepareRenderAssetOptions<TKind, TSource, TPrepared>): RenderAssetPreparationReport<TKind, TPrepared>;
export interface UnloadPreparedRenderAssetOptions<TKind extends AssetKind, TPrepared> {
    readonly adapter: Pick<RenderAssetAdapter<TKind, unknown, TPrepared>, "unload">;
    readonly store: PreparedRenderAssetStore<TKind, TPrepared>;
    readonly handle: AssetHandle<TKind>;
}
export interface UnloadPreparedRenderAssetReport<TKind extends AssetKind, TPrepared> {
    readonly removed: boolean;
    readonly assetKey: string;
    readonly entry?: PreparedRenderAssetEntry<TKind, TPrepared>;
    readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}
export declare function unloadPreparedRenderAsset<TKind extends AssetKind, TPrepared>(options: UnloadPreparedRenderAssetOptions<TKind, TPrepared>): UnloadPreparedRenderAssetReport<TKind, TPrepared>;
export declare function createRenderAssetDependencyState<TKind extends AssetKind, TAsset>(registry: AssetRegistry, entry: AssetRegistryEntry<TKind, TAsset>): RenderAssetDependencyState;
//# sourceMappingURL=preparation-core.d.ts.map