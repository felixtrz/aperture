import type { AssetRegistry } from "./registry.js";
import type { AssetDiagnostic, AssetHandle, AssetKind, AssetListFilter, AssetProvenance, AssetRegistryEntry, RegisterAssetOptions } from "./types.js";
export interface TypedAssetCollectionOptions<TKind extends AssetKind, TAsset> {
    readonly registry: AssetRegistry;
    readonly kind: TKind;
    readonly createHandle: (id: string) => AssetHandle<TKind>;
    readonly idPrefix?: string;
    readonly label?: (asset: TAsset) => string | undefined;
    readonly dependencies?: (asset: TAsset) => readonly AssetHandle[];
}
export interface TypedAssetRegisterOptions<TKind extends AssetKind> extends RegisterAssetOptions {
    readonly id?: string;
    readonly handle?: AssetHandle<TKind>;
}
export type TypedAssetAddOptions<TKind extends AssetKind> = TypedAssetRegisterOptions<TKind>;
export declare class TypedAssetCollection<TKind extends AssetKind, TAsset> {
    #private;
    constructor(options: TypedAssetCollectionOptions<TKind, TAsset>);
    get registry(): AssetRegistry;
    get kind(): TKind;
    register(options?: TypedAssetRegisterOptions<TKind>): AssetHandle<TKind>;
    add(asset: TAsset, options?: TypedAssetAddOptions<TKind>): AssetHandle<TKind>;
    has(handle: AssetHandle<TKind>): boolean;
    unregister(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset> | undefined;
    get(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset> | undefined;
    getAsset(handle: AssetHandle<TKind>): TAsset | undefined;
    markLoading(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset>;
    markReady(handle: AssetHandle<TKind>, asset: TAsset, diagnostics?: readonly AssetDiagnostic[], provenance?: AssetProvenance): AssetRegistryEntry<TKind, TAsset>;
    markFailed(handle: AssetHandle<TKind>, diagnostics: readonly AssetDiagnostic[]): AssetRegistryEntry<TKind, TAsset>;
    list(filter?: Omit<AssetListFilter, "kind">): AssetRegistryEntry<TKind, TAsset>[];
    private resolveHandle;
    private createAvailableHandle;
    private assertHandleKind;
    private toRegisterOptions;
}
//# sourceMappingURL=collections.d.ts.map