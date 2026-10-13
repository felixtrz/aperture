import type { AssetRegistry, MaterialHandle } from "@aperture-engine/simulation";
import { type MaterialAsset, type MaterialKind, type PreparedMaterialResourceDescriptor } from "../materials/index.js";
import { type PreparedCustomWgslMaterial } from "./custom-wgsl-material-preparation.js";
import { PreparedRenderAssetStore } from "./preparation-store.js";
import type { PreparedRenderAssetEntry, PreparedRenderAssetStoreRemoval, RenderAssetAdapter, RenderAssetPreparationReport } from "./preparation-types.js";
export interface PreparedMaterialAssetMetadata {
    readonly resourceFamily: PreparedMaterialResourceDescriptor["resourceFamily"];
    readonly sourceMaterialKey: PreparedMaterialResourceDescriptor["sourceMaterialKey"];
    readonly materialKey: PreparedMaterialResourceDescriptor["materialKey"];
    readonly label: PreparedMaterialResourceDescriptor["label"];
    readonly materialFamily: PreparedMaterialResourceDescriptor["materialFamily"];
    readonly materialKind: PreparedMaterialResourceDescriptor["materialKind"];
    readonly pipelineKey: PreparedMaterialResourceDescriptor["pipelineKey"];
    readonly pipelineKeyInput: PreparedMaterialResourceDescriptor["pipelineKeyInput"];
    readonly materialResourceKey: PreparedMaterialResourceDescriptor["materialResourceKey"];
    readonly bindGroupResourceKey: PreparedMaterialResourceDescriptor["bindGroupResourceKey"];
    readonly dependencies: PreparedMaterialResourceDescriptor["dependencies"];
    readonly textureBindings: PreparedMaterialResourceDescriptor["textureBindings"];
    readonly dependencyReadiness: PreparedMaterialResourceDescriptor["dependencyReadiness"];
}
export type PreparedSourceMaterialMetadata = PreparedMaterialAssetMetadata | PreparedCustomWgslMaterial;
export type PreparedMaterialAssetStore = PreparedRenderAssetStore<"material", PreparedSourceMaterialMetadata>;
export declare function createPreparedMaterialAssetStore(): PreparedMaterialAssetStore;
export interface PreparedMaterialStore {
    readonly entries: PreparedMaterialAssetStore;
    get(handle: MaterialHandle): PreparedRenderAssetEntry<"material", PreparedSourceMaterialMetadata> | undefined;
    list(): PreparedRenderAssetEntry<"material", PreparedSourceMaterialMetadata>[];
    prepare(options: PreparedMaterialStorePrepareOptions): RenderAssetPreparationReport<"material", PreparedSourceMaterialMetadata>;
    remove(handle: MaterialHandle): PreparedRenderAssetStoreRemoval<"material", PreparedSourceMaterialMetadata>;
    clear(): void;
}
export interface PreparedMaterialStorePrepareOptions {
    readonly registry: AssetRegistry;
    readonly handle: MaterialHandle;
}
export interface PreparedMaterialStoreFamilyJsonSummary {
    readonly entries: number;
}
export interface PreparedMaterialStoreEntryJsonValue {
    readonly assetKey: string;
    readonly sourceVersion: number;
    readonly label: string;
    readonly materialFamily: string;
    readonly materialKind?: MaterialKind;
    readonly pipelineKey: string;
    readonly materialResourceKey: string;
    readonly bindGroupResourceKey: string;
    readonly dependencyCount: number;
    readonly textureBindingCount: number;
    readonly diagnosticCount: number;
}
export interface PreparedMaterialStoreJsonValue {
    readonly totalEntries: number;
    readonly families: Record<string, PreparedMaterialStoreFamilyJsonSummary>;
    readonly entries: readonly PreparedMaterialStoreEntryJsonValue[];
}
export declare function createPreparedMaterialStore(options?: {
    readonly entries?: PreparedMaterialAssetStore;
}): PreparedMaterialStore;
export declare function preparedMaterialStoreSummaryToJsonValue(store: PreparedMaterialStore): PreparedMaterialStoreJsonValue;
export declare function createMaterialMetadataRenderAssetAdapter(): RenderAssetAdapter<"material", MaterialAsset, PreparedMaterialAssetMetadata>;
//# sourceMappingURL=preparation-material.d.ts.map