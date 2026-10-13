import type RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsCharacterCollision, PhysicsCharacterControllerSettings, PhysicsQueryOptions } from "@aperture-engine/physics";
import type { RapierBodyEntry } from "./types.js";
export declare function configureCharacterController(controller: RAPIER.KinematicCharacterController, settings: PhysicsCharacterControllerSettings | undefined): void;
export declare function characterCollisions(controller: RAPIER.KinematicCharacterController, bodies: ReadonlyMap<string, RapierBodyEntry>): readonly PhysicsCharacterCollision[];
export declare function characterFilterAllowsCollider(bodies: ReadonlyMap<string, RapierBodyEntry>, collider: RAPIER.Collider, options: PhysicsQueryOptions): boolean;
//# sourceMappingURL=character.d.ts.map