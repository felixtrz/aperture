import { type AssetHandle, type AssetKind } from "@aperture-engine/simulation";
import type { PreparedRenderAssetEntry, PreparedRenderAssetStoreRemoval, PreparedRenderAssetStoreUpdate, RenderAssetDependencyState, RenderAssetPreparationDiagnostic } from "./preparation-types.js";
export declare class PreparedRenderAssetStore<TKind extends AssetKind, TPrepared> {
    #private;
    get size(): number;
    has(handle: AssetHandle<TKind>): boolean;
    get(handle: AssetHandle<TKind>): PreparedRenderAssetEntry<TKind, TPrepared> | undefined;
    list(): PreparedRenderAssetEntry<TKind, TPrepared>[];
    upsert(input: {
        readonly handle: AssetHandle<TKind>;
        readonly family: string;
        readonly sourceVersion: number;
        readonly dependencyState: RenderAssetDependencyState;
        readonly prepared: TPrepared;
        readonly diagnostics?: readonly RenderAssetPreparationDiagnostic[];
    }): PreparedRenderAssetStoreUpdate<TKind, TPrepared>;
    remove(handle: AssetHandle<TKind>): PreparedRenderAssetStoreRemoval<TKind, TPrepared>;
    clear(): void;
}
//# sourceMappingURL=preparation-store.d.ts.map