import { type EcsWorld, type Entity } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import type { RayInput } from "../spatial/index.js";
export interface CameraHandle {
    readonly entity: Entity;
    readonly ref: EcsEntityRef;
    rayFromPointer(position: readonly [number, number]): RayInput;
}
export interface CameraAccess {
    readonly main: CameraHandle;
    readonly active: readonly CameraHandle[];
    byKey(key: string): CameraHandle | null;
}
export declare function createCameraAccess(world: EcsWorld, options?: {
    readonly contextKey?: string;
}): CameraAccess;
//# sourceMappingURL=cameras.d.ts.map