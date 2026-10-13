import type { AssetDependencyReport, AssetDiagnostic, AssetHandle, AssetKind, AssetListFilter, AssetManifestReport, AssetProvenance, AssetRegistryEntry, AssetStatus, RegisterAssetOptions } from "./types.js";
export declare class AssetRegistry {
    #private;
    register<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>, options?: RegisterAssetOptions): AssetRegistryEntry<TKind, TAsset>;
    unregister<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset> | undefined;
    has(handle: AssetHandle): boolean;
    get<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset> | undefined;
    getStatus(handle: AssetHandle): AssetStatus | undefined;
    markLoading<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset>;
    markReady<TKind extends AssetKind, TAsset>(handle: AssetHandle<TKind>, asset: TAsset, diagnostics?: readonly AssetDiagnostic[], provenance?: AssetProvenance): AssetRegistryEntry<TKind, TAsset>;
    markFailed<TKind extends AssetKind, TAsset = unknown>(handle: AssetHandle<TKind>, diagnostics: readonly AssetDiagnostic[]): AssetRegistryEntry<TKind, TAsset>;
    list(filter?: AssetListFilter): AssetRegistryEntry[];
    collectDiagnostics(handle?: AssetHandle): AssetDiagnostic[];
    inspectDependencies(handle: AssetHandle): AssetDependencyReport;
    createManifestReport(): AssetManifestReport;
    private update;
    private collectDependencyDiagnostics;
}
//# sourceMappingURL=registry.d.ts.map