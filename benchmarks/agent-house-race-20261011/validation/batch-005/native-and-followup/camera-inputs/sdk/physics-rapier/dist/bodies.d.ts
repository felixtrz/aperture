import RAPIER from "@dimforge/rapier3d-compat";
import { type PhysicsBodyResult, type PhysicsCommand, type PhysicsVelocityValue } from "@aperture-engine/physics";
import { type RapierColliderDescOptions } from "./colliders.js";
import type { RapierBodyEntry, RapierJointEntry } from "./types.js";
export declare function upsertBody(world: RAPIER.World, bodies: Map<string, RapierBodyEntry>, joints: Map<string, RapierJointEntry>, command: Extract<PhysicsCommand, {
    readonly kind: "upsertBody";
}>, options?: RapierColliderDescOptions): void;
export declare function destroyBody(world: RAPIER.World, bodies: Map<string, RapierBodyEntry>, joints: Map<string, RapierJointEntry>, entity: string): void;
export declare function setVelocity(entry: RapierBodyEntry | undefined, velocity: PhysicsVelocityValue | undefined): void;
export declare function bodyResult(entry: RapierBodyEntry): PhysicsBodyResult;
//# sourceMappingURL=bodies.d.ts.map