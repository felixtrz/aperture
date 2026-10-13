import { AssetRegistry, TypedAssetCollection, type AssetDiagnostic, type AssetHandle, type AssetListFilter, type AssetRegistryEntry, type MaterialHandle, type TypedAssetAddOptions, type TypedAssetRegisterOptions } from "@aperture-engine/simulation";
import type { CustomWgslMaterialAsset, DebugNormalMaterialAsset, MatcapMaterialAsset, SourceMaterialAsset, StandardMaterialAsset, UnlitMaterialAsset, WgslShaderAsset } from "../materials/types.js";
import type { MeshAsset } from "../mesh/types.js";
import { type MsdfFontAtlasAsset } from "../text/index.js";
import { type ParticleEffectAsset } from "./particles.js";
export interface RenderAssetCollectionsOptions {
    readonly registry?: AssetRegistry;
}
export interface RenderAssetCollections {
    readonly registry: AssetRegistry;
    readonly meshes: TypedAssetCollection<"mesh", MeshAsset>;
    readonly materials: MaterialAssetCollections;
    readonly shaders: TypedAssetCollection<"shader", WgslShaderAsset>;
    readonly fontAtlases: TypedAssetCollection<"font-atlas", MsdfFontAtlasAsset>;
    readonly particleEffects: TypedAssetCollection<"particle-effect", ParticleEffectAsset>;
}
export declare class MaterialAssetCollections {
    #private;
    readonly unlit: TypedAssetCollection<"material", UnlitMaterialAsset>;
    readonly matcap: TypedAssetCollection<"material", MatcapMaterialAsset>;
    readonly standard: TypedAssetCollection<"material", StandardMaterialAsset>;
    readonly debugNormal: TypedAssetCollection<"material", DebugNormalMaterialAsset>;
    readonly customWgsl: TypedAssetCollection<"material", CustomWgslMaterialAsset>;
    constructor(registry: AssetRegistry);
    get registry(): AssetRegistry;
    add(asset: SourceMaterialAsset, options?: TypedAssetAddOptions<"material">): MaterialHandle;
    register(options?: TypedAssetRegisterOptions<"material">): MaterialHandle;
    has(handle: MaterialHandle): boolean;
    get(handle: MaterialHandle): AssetRegistryEntry<"material", SourceMaterialAsset> | undefined;
    getAsset(handle: MaterialHandle): SourceMaterialAsset | undefined;
    markLoading(handle: MaterialHandle): AssetRegistryEntry<"material", SourceMaterialAsset>;
    markReady(handle: MaterialHandle, asset: SourceMaterialAsset, diagnostics?: readonly AssetDiagnostic[]): AssetRegistryEntry<"material", SourceMaterialAsset>;
    markFailed(handle: MaterialHandle, diagnostics: readonly AssetDiagnostic[]): AssetRegistryEntry<"material", SourceMaterialAsset>;
    list(filter?: Omit<AssetListFilter, "kind">): AssetRegistryEntry<"material", SourceMaterialAsset>[];
}
export declare function createRenderAssetCollections(options?: RenderAssetCollectionsOptions): RenderAssetCollections;
export declare function materialAssetDependencies(material: SourceMaterialAsset): readonly AssetHandle[];
export type MeshAssetCollection = TypedAssetCollection<"mesh", MeshAsset>;
export type MaterialAssetCollection = TypedAssetCollection<"material", SourceMaterialAsset>;
export type UnlitMaterialAssetCollection = TypedAssetCollection<"material", UnlitMaterialAsset>;
export type MatcapMaterialAssetCollection = TypedAssetCollection<"material", MatcapMaterialAsset>;
export type StandardMaterialAssetCollection = TypedAssetCollection<"material", StandardMaterialAsset>;
export type DebugNormalMaterialAssetCollection = TypedAssetCollection<"material", DebugNormalMaterialAsset>;
export type CustomWgslMaterialAssetCollection = TypedAssetCollection<"material", CustomWgslMaterialAsset>;
export type ShaderAssetCollection = TypedAssetCollection<"shader", WgslShaderAsset>;
//# sourceMappingURL=collections.d.ts.map