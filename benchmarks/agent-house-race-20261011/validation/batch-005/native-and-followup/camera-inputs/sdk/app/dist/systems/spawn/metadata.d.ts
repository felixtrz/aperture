import { type EcsWorld, type Entity } from "@aperture-engine/simulation";
import type { SpawnMetadata } from "./types.js";
export declare function createEntityWithMetadata(world: EcsWorld, metadata: SpawnMetadata, fallbackName: string, initialize?: (entity: Entity) => void): Entity;
export declare function applySpawnMetadata(world: EcsWorld, entity: Entity, metadata: SpawnMetadata, fallbackName: string): void;
export declare function upsertDebugMetadata(entity: Entity, value: {
    readonly tag: string;
    readonly note: string;
}): void;
//# sourceMappingURL=metadata.d.ts.map