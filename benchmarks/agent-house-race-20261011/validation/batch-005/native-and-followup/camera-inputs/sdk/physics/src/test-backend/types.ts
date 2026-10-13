import type {
  PhysicsExternalForceValue,
  PhysicsExternalImpulseValue,
  PhysicsJointDescriptor,
  PhysicsTransform,
  PhysicsVelocityValue,
} from "../backend.js";
import type { PhysicsRigidBodyType, PhysicsVec3 } from "../components.js";

export interface TestBody {
  readonly entity: string;
  bodyType: PhysicsRigidBodyType;
  transform: PhysicsTransform;
  velocity: PhysicsVelocityValue;
  externalForce: PhysicsExternalForceValue;
  pendingImpulse: PhysicsExternalImpulseValue;
  gravityScale: number;
  linearDamping: number;
  angularDamping: number;
  canSleep: boolean;
  lockTranslations: readonly [boolean, boolean, boolean];
  lockRotations: readonly [boolean, boolean, boolean];
  colliders: readonly TestCollider[];
  sleeping: boolean;
  manualAwake: boolean;
}

export interface TestCollider {
  readonly entity: string;
  radius: number;
  colliderOffsetTranslation: PhysicsVec3;
  sensor: boolean;
  collisionGroups: number;
}

export interface TestJoint {
  readonly entity: string;
  descriptor: PhysicsJointDescriptor;
}
