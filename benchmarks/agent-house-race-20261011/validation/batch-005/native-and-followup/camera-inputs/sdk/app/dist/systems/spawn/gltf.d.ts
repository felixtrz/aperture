import { type GltfEcsCommandReplayReport } from "@aperture-engine/render";
import { type AssetRegistry, type EcsWorld, type Entity } from "@aperture-engine/simulation";
import type { SystemGltfLoadedScene } from "../assets.js";
import type { SystemDiagnostics } from "../diagnostics.js";
import type { SpawnGltfMaterialOverrides } from "./types.js";
export declare function applyGltfSourceMetadata(world: EcsWorld, scene: SystemGltfLoadedScene, replay: GltfEcsCommandReplayReport): void;
export declare function replayGltfLoadedScene(world: EcsWorld, scene: SystemGltfLoadedScene): GltfEcsCommandReplayReport;
export declare function firstReplayRootEntity(scene: SystemGltfLoadedScene, replay: GltfEcsCommandReplayReport): Entity;
export declare function applyGltfMaterialOverrides(input: {
    readonly registry: AssetRegistry;
    readonly diagnostics: SystemDiagnostics;
    readonly scene: SystemGltfLoadedScene;
    readonly replay: GltfEcsCommandReplayReport;
    readonly overrides: SpawnGltfMaterialOverrides | undefined;
}): void;
//# sourceMappingURL=gltf.d.ts.map