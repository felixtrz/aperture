import { type AssetRegistry } from "@aperture-engine/simulation";
import type { MaterialAsset, MeshAsset, RenderSnapshot } from "@aperture-engine/render";
export interface QueuedSourceMeshAsset {
    readonly asset: MeshAsset;
    readonly resourceKey: string;
}
export interface QueuedSourceMaterialAsset {
    readonly asset: MaterialAsset;
    readonly kind: string;
    readonly resourceKey: string;
    readonly sourceVersion: number;
}
export declare function indexQueuedSourceAssets(assets: AssetRegistry, snapshot: RenderSnapshot, output: {
    readonly meshAssets: Map<string, QueuedSourceMeshAsset>;
    readonly materialAssets: Map<string, QueuedSourceMaterialAsset>;
}): void;
//# sourceMappingURL=queued-source-assets.d.ts.map