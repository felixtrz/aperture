import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsCommand, PhysicsJointDescriptor, PhysicsVec3 } from "@aperture-engine/physics";
import type { RapierBodyEntry, RapierJointEntry } from "./types.js";
export declare function upsertJoint(world: RAPIER.World, bodies: ReadonlyMap<string, RapierBodyEntry>, joints: Map<string, RapierJointEntry>, command: Extract<PhysicsCommand, {
    readonly kind: "upsertJoint";
}>): void;
export declare function destroyJoint(world: RAPIER.World, joints: Map<string, RapierJointEntry>, entity: string): void;
export declare function destroyJointsForBody(world: RAPIER.World, joints: Map<string, RapierJointEntry>, bodyRef: string): void;
export declare function jointAxis(descriptor: PhysicsJointDescriptor): PhysicsVec3;
//# sourceMappingURL=joints.d.ts.map