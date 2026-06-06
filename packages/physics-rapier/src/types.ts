import type RAPIER from "@dimforge/rapier3d-compat";
import type {
  PhysicsColliderDescriptor,
  PhysicsJointDescriptor,
  PhysicsRigidBodyType,
  PhysicsVec3,
} from "@aperture-engine/physics";

export interface RapierBodyEntry {
  readonly entity: string;
  body: RAPIER.RigidBody;
  colliders: readonly RapierColliderEntry[];
  bodyType: PhysicsRigidBodyType;
  colliderKey: string;
  canSleep: boolean;
  lockTranslations: readonly [boolean, boolean, boolean];
  lockRotations: readonly [boolean, boolean, boolean];
}

export interface RapierColliderEntry {
  readonly entity: string;
  readonly collider: RAPIER.Collider;
  readonly descriptor: PhysicsColliderDescriptor;
}

export interface RapierColliderMatch {
  readonly body: RapierBodyEntry;
  readonly collider: RapierColliderEntry;
}

export interface RapierJointEntry {
  readonly entity: string;
  readonly bodyARef: string;
  readonly bodyBRef: string;
  readonly descriptor: PhysicsJointDescriptor;
  joint: RAPIER.ImpulseJoint;
  descriptorKey: string;
}

export interface RapierEventPair {
  readonly key: string;
  readonly entityA: string;
  readonly entityB: string;
  readonly colliderA: string;
  readonly colliderB: string;
  readonly colliderAHandle: number;
  readonly colliderBHandle: number;
  readonly trigger: boolean;
}

export interface RapierContactManifold {
  normal(): { readonly x: number; readonly y: number; readonly z: number };
  numSolverContacts(): number;
  solverContactPoint(index: number): {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

export interface RapierContactEventData {
  readonly point: PhysicsVec3;
  readonly normal: PhysicsVec3;
}
