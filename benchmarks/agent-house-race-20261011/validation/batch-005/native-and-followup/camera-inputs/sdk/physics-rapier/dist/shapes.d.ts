import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsColliderDescriptor, PhysicsQuat, PhysicsShape } from "@aperture-engine/physics";
export declare function queryShape(shape: PhysicsShape): RAPIER.Shape;
export declare function colliderShapeRotation(collider: PhysicsColliderDescriptor): PhysicsQuat | null;
export declare function queryShapeRotation(rotation: PhysicsQuat, shape: PhysicsShape): PhysicsQuat;
//# sourceMappingURL=shapes.d.ts.map