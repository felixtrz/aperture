import { type AssetRegistry, type MaterialHandle, type MeshHandle } from "@aperture-engine/simulation";
import type { SpawnMeshOptions } from "./types.js";
interface PreparedSpawnMeshAssets {
    readonly meshHandle: MeshHandle;
    readonly materialHandle: MaterialHandle;
    publish(registry: AssetRegistry): void;
}
/** Convert and validate both descriptors without changing the registry. */
export declare function prepareSpawnMeshAssets(input: SpawnMeshOptions, fallbackAssetId: string): PreparedSpawnMeshAssets;
export {};
//# sourceMappingURL=assets.d.ts.map