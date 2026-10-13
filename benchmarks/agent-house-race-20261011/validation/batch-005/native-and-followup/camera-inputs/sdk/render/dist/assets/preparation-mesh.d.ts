import type { AssetRegistry, MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import { PreparedRenderAssetStore } from "./preparation-store.js";
import type { PreparedRenderAssetEntry, PreparedRenderAssetStoreRemoval, RenderAssetAdapter, RenderAssetPreparationReport } from "./preparation-types.js";
export interface PreparedMeshAssetMetadata {
    readonly resourceFamily: "mesh";
    readonly sourceMeshKey: string;
    readonly meshResourceKey: string;
    readonly label: string;
    readonly vertexStreams: number;
    readonly submeshes: number;
    readonly hasIndexBuffer: boolean;
}
export type PreparedMeshAssetStore = PreparedRenderAssetStore<"mesh", PreparedMeshAssetMetadata>;
export declare function createPreparedMeshAssetStore(): PreparedMeshAssetStore;
export interface PreparedMeshStore {
    readonly entries: PreparedMeshAssetStore;
    get(handle: MeshHandle): PreparedRenderAssetEntry<"mesh", PreparedMeshAssetMetadata> | undefined;
    list(): PreparedRenderAssetEntry<"mesh", PreparedMeshAssetMetadata>[];
    prepare(options: PreparedMeshStorePrepareOptions): RenderAssetPreparationReport<"mesh", PreparedMeshAssetMetadata>;
    remove(handle: MeshHandle): PreparedRenderAssetStoreRemoval<"mesh", PreparedMeshAssetMetadata>;
    clear(): void;
}
export interface PreparedMeshStorePrepareOptions {
    readonly registry: AssetRegistry;
    readonly handle: MeshHandle;
}
export interface PreparedMeshStoreEntryJsonValue {
    readonly assetKey: string;
    readonly sourceVersion: number;
    readonly label: string;
    readonly meshResourceKey: string;
    readonly vertexStreams: number;
    readonly submeshes: number;
    readonly hasIndexBuffer: boolean;
    readonly diagnosticCount: number;
}
export interface PreparedMeshStoreJsonValue {
    readonly totalEntries: number;
    readonly entries: readonly PreparedMeshStoreEntryJsonValue[];
}
export declare function createPreparedMeshStore(options?: {
    readonly entries?: PreparedMeshAssetStore;
}): PreparedMeshStore;
export declare function preparedMeshStoreSummaryToJsonValue(store: PreparedMeshStore): PreparedMeshStoreJsonValue;
export declare function createMeshMetadataRenderAssetAdapter(): RenderAssetAdapter<"mesh", MeshAsset, PreparedMeshAssetMetadata>;
//# sourceMappingURL=preparation-mesh.d.ts.map