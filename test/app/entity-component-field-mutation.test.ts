import { describe, expect, it } from "vitest";

import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsCharacterController,
  PhysicsDebug,
  PhysicsGravity,
  PhysicsJoint,
  PhysicsMaterial,
  PhysicsVelocity,
  RigidBody,
  createCollider,
  createExternalForce,
  createExternalImpulse,
  createKinematicTarget,
  createPhysicsCharacterController,
  createPhysicsDebug,
  createPhysicsGravity,
  createPhysicsJoint,
  createPhysicsMaterial,
  createPhysicsVelocity,
  createRigidBody,
  registerPhysicsComponents,
} from "@aperture-engine/physics";
import {
  LocalTransform,
  createLocalTransform,
  createWorld,
  type Entity,
} from "@aperture-engine/simulation";
import {
  DebugMetadata,
  registerApertureAppComponents,
} from "@aperture-engine/app/systems";
import type { EcsEntityRef } from "@aperture-engine/app/config";
import { setApertureEntityComponentField } from "../../packages/app/src/entities/lookup/mutation.js";
import type { ApertureEntitySetComponentFieldReport } from "../../packages/app/src/entities/lookup/types.js";

// Coverage-focused exercise of the developer entity mutation whitelist
// (devtools ecs_set_component_field): every whitelisted component field is
// written and read back, and every rejection family returns its structured
// diagnostic without mutating component state.

const world = createWorld({ entityCapacity: 8 });
registerApertureAppComponents(world);
registerPhysicsComponents(world);

const fullEntity = world
  .createEntity()
  .addComponent(DebugMetadata)
  .addComponent(LocalTransform, createLocalTransform())
  .addComponent(RigidBody, createRigidBody())
  .addComponent(Collider, createCollider())
  .addComponent(PhysicsVelocity, createPhysicsVelocity())
  .addComponent(ExternalForce, createExternalForce())
  .addComponent(ExternalImpulse, createExternalImpulse())
  .addComponent(KinematicTarget, createKinematicTarget())
  .addComponent(PhysicsGravity, createPhysicsGravity())
  .addComponent(PhysicsCharacterController, createPhysicsCharacterController())
  .addComponent(PhysicsMaterial, createPhysicsMaterial())
  .addComponent(PhysicsDebug, createPhysicsDebug())
  .addComponent(PhysicsJoint, createPhysicsJoint());

const bareEntity = world.createEntity();

const componentsById: Readonly<Record<string, unknown>> = {
  [DebugMetadata.id]: DebugMetadata,
  [LocalTransform.id]: LocalTransform,
  [RigidBody.id]: RigidBody,
  [Collider.id]: Collider,
  [PhysicsVelocity.id]: PhysicsVelocity,
  [ExternalForce.id]: ExternalForce,
  [ExternalImpulse.id]: ExternalImpulse,
  [KinematicTarget.id]: KinematicTarget,
  [PhysicsGravity.id]: PhysicsGravity,
  [PhysicsCharacterController.id]: PhysicsCharacterController,
  [PhysicsMaterial.id]: PhysicsMaterial,
  [PhysicsDebug.id]: PhysicsDebug,
  [PhysicsJoint.id]: PhysicsJoint,
};

type FieldKind = "value" | "vector";

interface EntityFieldAccess {
  getValue(component: unknown, key: string): unknown;
  getVectorView(component: unknown, key: string): ArrayLike<number>;
}

function refOf(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}

function readField(
  entity: Entity,
  component: string,
  field: string,
  kind: FieldKind,
): unknown {
  const componentDef = componentsById[component];
  const access = entity as unknown as EntityFieldAccess;

  return kind === "vector"
    ? Array.from(access.getVectorView(componentDef, field))
    : access.getValue(componentDef, field);
}

function mutate(
  entity: Entity,
  component: string,
  field: string,
  value: unknown,
): ApertureEntitySetComponentFieldReport {
  return setApertureEntityComponentField(world, {
    entity: refOf(entity),
    component,
    field,
    value,
  });
}

interface SuccessCase {
  readonly component: string;
  readonly field: string;
  readonly value: unknown;
  readonly kind: FieldKind;
}

const successCases: readonly SuccessCase[] = [
  {
    component: DebugMetadata.id,
    field: "tag",
    value: "selected",
    kind: "value",
  },
  {
    component: DebugMetadata.id,
    field: "note",
    value: "from-tooling",
    kind: "value",
  },
  {
    component: LocalTransform.id,
    field: "translation",
    value: [1, 2, 3],
    kind: "vector",
  },
  {
    component: LocalTransform.id,
    field: "rotation",
    value: [0, 1, 0, 0],
    kind: "vector",
  },
  {
    component: LocalTransform.id,
    field: "scale",
    value: [2, 2, 2],
    kind: "vector",
  },
  { component: RigidBody.id, field: "enabled", value: false, kind: "value" },
  { component: RigidBody.id, field: "type", value: "static", kind: "value" },
  { component: RigidBody.id, field: "gravityScale", value: 0.5, kind: "value" },
  {
    component: RigidBody.id,
    field: "linearDamping",
    value: 0.25,
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "angularDamping",
    value: 0.75,
    kind: "value",
  },
  { component: RigidBody.id, field: "canSleep", value: false, kind: "value" },
  { component: RigidBody.id, field: "ccdEnabled", value: true, kind: "value" },
  {
    component: RigidBody.id,
    field: "lockTranslationX",
    value: true,
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "lockTranslationY",
    value: true,
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "lockTranslationZ",
    value: true,
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "lockRotationX",
    value: true,
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "lockRotationY",
    value: true,
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "lockRotationZ",
    value: true,
    kind: "value",
  },
  { component: Collider.id, field: "enabled", value: false, kind: "value" },
  {
    component: Collider.id,
    field: "shapeKind",
    value: "sphere",
    kind: "value",
  },
  {
    component: Collider.id,
    field: "halfExtents",
    value: [0.5, 1, 1.5],
    kind: "vector",
  },
  { component: Collider.id, field: "radius", value: 0.75, kind: "value" },
  { component: Collider.id, field: "halfHeight", value: 1.25, kind: "value" },
  { component: Collider.id, field: "axis", value: "z", kind: "value" },
  {
    component: Collider.id,
    field: "meshId",
    value: "mesh:crate",
    kind: "value",
  },
  {
    component: Collider.id,
    field: "heightfieldAssetId",
    value: "terrain.heightfield",
    kind: "value",
  },
  {
    component: Collider.id,
    field: "offsetTranslation",
    value: [0.5, 0, -0.5],
    kind: "vector",
  },
  {
    component: Collider.id,
    field: "offsetRotation",
    value: [0, 1, 0, 0],
    kind: "vector",
  },
  { component: Collider.id, field: "sensor", value: true, kind: "value" },
  { component: Collider.id, field: "density", value: 2, kind: "value" },
  { component: Collider.id, field: "friction", value: 0.25, kind: "value" },
  { component: Collider.id, field: "restitution", value: 0.5, kind: "value" },
  {
    component: Collider.id,
    field: "collisionGroups",
    value: 65537,
    kind: "value",
  },
  { component: Collider.id, field: "solverGroups", value: 7, kind: "value" },
  {
    component: PhysicsVelocity.id,
    field: "linear",
    value: [1, 2, 3],
    kind: "vector",
  },
  {
    component: PhysicsVelocity.id,
    field: "angular",
    value: [0.5, 0, -0.5],
    kind: "vector",
  },
  {
    component: ExternalForce.id,
    field: "force",
    value: [1, 0, 0],
    kind: "vector",
  },
  {
    component: ExternalForce.id,
    field: "torque",
    value: [0, 1, 0],
    kind: "vector",
  },
  {
    component: ExternalImpulse.id,
    field: "impulse",
    value: [0, 2, 0],
    kind: "vector",
  },
  {
    component: ExternalImpulse.id,
    field: "angularImpulse",
    value: [0, 0, 3],
    kind: "vector",
  },
  {
    component: KinematicTarget.id,
    field: "enabled",
    value: false,
    kind: "value",
  },
  {
    component: KinematicTarget.id,
    field: "translation",
    value: [4, 5, 6],
    kind: "vector",
  },
  {
    component: KinematicTarget.id,
    field: "rotation",
    value: [1, 0, 0, 0],
    kind: "vector",
  },
  {
    component: PhysicsGravity.id,
    field: "gravity",
    value: [0, -3, 0],
    kind: "vector",
  },
  {
    component: PhysicsCharacterController.id,
    field: "enabled",
    value: false,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "offset",
    value: 0.0625,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "up",
    value: [0, 0, 1],
    kind: "vector",
  },
  {
    component: PhysicsCharacterController.id,
    field: "slide",
    value: false,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "maxSlopeClimbAngleEnabled",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "maxSlopeClimbAngle",
    value: 0.5,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "minSlopeSlideAngleEnabled",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "minSlopeSlideAngle",
    value: 0.25,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "snapToGroundDistance",
    value: 0.5,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "autostepEnabled",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "autostepMaxHeight",
    value: 0.25,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "autostepMinWidth",
    value: 0.125,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "autostepIncludeDynamicBodies",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "applyImpulsesToDynamicBodies",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "characterMassMode",
    value: "mass",
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "characterMass",
    value: 70,
    kind: "value",
  },
  {
    component: PhysicsMaterial.id,
    field: "friction",
    value: 0.75,
    kind: "value",
  },
  {
    component: PhysicsMaterial.id,
    field: "restitution",
    value: 0.25,
    kind: "value",
  },
  { component: PhysicsMaterial.id, field: "density", value: 3, kind: "value" },
  {
    component: PhysicsMaterial.id,
    field: "frictionCombine",
    value: "max",
    kind: "value",
  },
  {
    component: PhysicsMaterial.id,
    field: "restitutionCombine",
    value: "multiply",
    kind: "value",
  },
  {
    component: PhysicsDebug.id,
    field: "colliderWireframes",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsDebug.id,
    field: "contactNormals",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsDebug.id,
    field: "bodyStateMarkers",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsDebug.id,
    field: "broadphaseAabbs",
    value: true,
    kind: "value",
  },
  {
    component: PhysicsDebug.id,
    field: "jointFrames",
    value: true,
    kind: "value",
  },
  { component: PhysicsJoint.id, field: "enabled", value: false, kind: "value" },
  {
    component: PhysicsJoint.id,
    field: "kind",
    value: "distance",
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "bodyARef",
    value: "1:0",
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "bodyBRef",
    value: "2:0",
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "anchorA",
    value: [1, 0, 0],
    kind: "vector",
  },
  {
    component: PhysicsJoint.id,
    field: "anchorB",
    value: [0, 1, 0],
    kind: "vector",
  },
  {
    component: PhysicsJoint.id,
    field: "frameA",
    value: [0, 0, 1, 0],
    kind: "vector",
  },
  {
    component: PhysicsJoint.id,
    field: "frameB",
    value: [1, 0, 0, 0],
    kind: "vector",
  },
  {
    component: PhysicsJoint.id,
    field: "axis",
    value: [0, 0, 1],
    kind: "vector",
  },
  { component: PhysicsJoint.id, field: "minLimit", value: -1, kind: "value" },
  { component: PhysicsJoint.id, field: "maxLimit", value: 2, kind: "value" },
  {
    component: PhysicsJoint.id,
    field: "motorMode",
    value: "velocity",
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "motorModel",
    value: "force",
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "motorTarget",
    value: 0.5,
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "motorVelocity",
    value: 1.5,
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "motorStiffness",
    value: 10,
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "motorDamping",
    value: 2,
    kind: "value",
  },
  { component: PhysicsJoint.id, field: "motorFactor", value: 1, kind: "value" },
  {
    component: PhysicsJoint.id,
    field: "motorMaxForce",
    value: 100,
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "contactsEnabled",
    value: false,
    kind: "value",
  },
  { component: PhysicsJoint.id, field: "breakForce", value: 50, kind: "value" },
];

interface RejectionCase {
  readonly component: string;
  readonly field: string;
  readonly value: unknown;
  readonly kind: FieldKind;
}

const rejectionCases: readonly RejectionCase[] = [
  { component: DebugMetadata.id, field: "tag", value: 42, kind: "value" },
  { component: DebugMetadata.id, field: "note", value: false, kind: "value" },
  {
    component: LocalTransform.id,
    field: "translation",
    value: "north",
    kind: "vector",
  },
  {
    component: LocalTransform.id,
    field: "translation",
    value: [1, 2],
    kind: "vector",
  },
  {
    component: LocalTransform.id,
    field: "rotation",
    value: [0, 0, 0, 0],
    kind: "vector",
  },
  {
    component: LocalTransform.id,
    field: "rotation",
    value: [0, 0, 1],
    kind: "vector",
  },
  {
    component: LocalTransform.id,
    field: "scale",
    value: [1, "2", 3],
    kind: "vector",
  },
  { component: RigidBody.id, field: "enabled", value: "yes", kind: "value" },
  { component: RigidBody.id, field: "type", value: "warp", kind: "value" },
  { component: RigidBody.id, field: "type", value: 4, kind: "value" },
  {
    component: RigidBody.id,
    field: "gravityScale",
    value: "fast",
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "gravityScale",
    value: Number.NaN,
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "linearDamping",
    value: -0.25,
    kind: "value",
  },
  {
    component: RigidBody.id,
    field: "angularDamping",
    value: Number.POSITIVE_INFINITY,
    kind: "value",
  },
  { component: Collider.id, field: "enabled", value: 1, kind: "value" },
  { component: Collider.id, field: "shapeKind", value: "blob", kind: "value" },
  {
    component: Collider.id,
    field: "halfExtents",
    value: [0, 1, 1],
    kind: "vector",
  },
  {
    component: Collider.id,
    field: "halfExtents",
    value: "large",
    kind: "vector",
  },
  { component: Collider.id, field: "radius", value: 0, kind: "value" },
  { component: Collider.id, field: "radius", value: -1, kind: "value" },
  { component: Collider.id, field: "halfHeight", value: -0.5, kind: "value" },
  { component: Collider.id, field: "axis", value: "w", kind: "value" },
  { component: Collider.id, field: "meshId", value: 9, kind: "value" },
  {
    component: Collider.id,
    field: "offsetTranslation",
    value: [1, 2, "3"],
    kind: "vector",
  },
  {
    component: Collider.id,
    field: "offsetRotation",
    value: [0, 0, 0, 0],
    kind: "vector",
  },
  { component: Collider.id, field: "sensor", value: "true", kind: "value" },
  { component: Collider.id, field: "density", value: -1, kind: "value" },
  { component: Collider.id, field: "friction", value: -0.5, kind: "value" },
  {
    component: Collider.id,
    field: "restitution",
    value: Number.NaN,
    kind: "value",
  },
  {
    component: Collider.id,
    field: "collisionGroups",
    value: 1.5,
    kind: "value",
  },
  {
    component: Collider.id,
    field: "collisionGroups",
    value: 2147483648,
    kind: "value",
  },
  {
    component: Collider.id,
    field: "solverGroups",
    value: -2147483649,
    kind: "value",
  },
  {
    component: Collider.id,
    field: "solverGroups",
    value: "mask",
    kind: "value",
  },
  {
    component: PhysicsVelocity.id,
    field: "linear",
    value: [1, "2", 3],
    kind: "vector",
  },
  {
    component: PhysicsVelocity.id,
    field: "angular",
    value: 12,
    kind: "vector",
  },
  { component: ExternalForce.id, field: "force", value: null, kind: "vector" },
  {
    component: ExternalForce.id,
    field: "torque",
    value: [Number.POSITIVE_INFINITY, 0, 0],
    kind: "vector",
  },
  {
    component: ExternalImpulse.id,
    field: "impulse",
    value: "kick",
    kind: "vector",
  },
  {
    component: ExternalImpulse.id,
    field: "angularImpulse",
    value: [1, 2, 3, 4],
    kind: "vector",
  },
  { component: KinematicTarget.id, field: "enabled", value: 0, kind: "value" },
  {
    component: KinematicTarget.id,
    field: "translation",
    value: { x: 1 },
    kind: "vector",
  },
  {
    component: KinematicTarget.id,
    field: "rotation",
    value: [0, 0, 0, 0],
    kind: "vector",
  },
  {
    component: PhysicsGravity.id,
    field: "gravity",
    value: true,
    kind: "vector",
  },
  {
    component: PhysicsCharacterController.id,
    field: "enabled",
    value: "on",
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "offset",
    value: 0,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "up",
    value: [0, 0, 0],
    kind: "vector",
  },
  {
    component: PhysicsCharacterController.id,
    field: "up",
    value: [1, 2],
    kind: "vector",
  },
  {
    component: PhysicsCharacterController.id,
    field: "maxSlopeClimbAngle",
    value: "steep",
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "snapToGroundDistance",
    value: -1,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "autostepMaxHeight",
    value: -0.25,
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "characterMassMode",
    value: "heavy",
    kind: "value",
  },
  {
    component: PhysicsCharacterController.id,
    field: "characterMass",
    value: -5,
    kind: "value",
  },
  {
    component: PhysicsMaterial.id,
    field: "friction",
    value: -1,
    kind: "value",
  },
  {
    component: PhysicsMaterial.id,
    field: "density",
    value: "thick",
    kind: "value",
  },
  {
    component: PhysicsMaterial.id,
    field: "frictionCombine",
    value: "sum",
    kind: "value",
  },
  {
    component: PhysicsDebug.id,
    field: "colliderWireframes",
    value: "yes",
    kind: "value",
  },
  { component: PhysicsJoint.id, field: "enabled", value: "no", kind: "value" },
  { component: PhysicsJoint.id, field: "kind", value: "rope", kind: "value" },
  { component: PhysicsJoint.id, field: "bodyARef", value: 12, kind: "value" },
  {
    component: PhysicsJoint.id,
    field: "anchorA",
    value: "origin",
    kind: "vector",
  },
  {
    component: PhysicsJoint.id,
    field: "frameA",
    value: [0, 0, 0, 0],
    kind: "vector",
  },
  {
    component: PhysicsJoint.id,
    field: "frameB",
    value: [1, 2, 3],
    kind: "vector",
  },
  {
    component: PhysicsJoint.id,
    field: "axis",
    value: [1, "y", 0],
    kind: "vector",
  },
  {
    component: PhysicsJoint.id,
    field: "minLimit",
    value: Number.NaN,
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "motorMode",
    value: "torque",
    kind: "value",
  },
  {
    component: PhysicsJoint.id,
    field: "motorStiffness",
    value: -1,
    kind: "value",
  },
];

interface MissingComponentCase {
  readonly component: string;
  readonly field: string;
  readonly value: unknown;
  readonly code?: string;
}

const missingComponentCases: readonly MissingComponentCase[] = [
  { component: DebugMetadata.id, field: "tag", value: "x" },
  { component: LocalTransform.id, field: "translation", value: [0, 0, 0] },
  { component: LocalTransform.id, field: "rotation", value: [0, 0, 0, 1] },
  { component: RigidBody.id, field: "enabled", value: true },
  { component: RigidBody.id, field: "type", value: "dynamic" },
  { component: RigidBody.id, field: "gravityScale", value: 1 },
  { component: Collider.id, field: "enabled", value: true },
  { component: Collider.id, field: "shapeKind", value: "box" },
  { component: Collider.id, field: "axis", value: "y" },
  { component: Collider.id, field: "meshId", value: "mesh:level" },
  { component: Collider.id, field: "halfExtents", value: [1, 1, 1] },
  { component: Collider.id, field: "offsetRotation", value: [0, 0, 0, 1] },
  { component: Collider.id, field: "radius", value: 0.5 },
  { component: Collider.id, field: "collisionGroups", value: -1 },
  { component: PhysicsVelocity.id, field: "linear", value: [0, 0, 0] },
  { component: ExternalForce.id, field: "force", value: [0, 0, 0] },
  { component: ExternalImpulse.id, field: "impulse", value: [0, 0, 0] },
  { component: KinematicTarget.id, field: "enabled", value: true },
  { component: KinematicTarget.id, field: "translation", value: [0, 0, 0] },
  { component: KinematicTarget.id, field: "rotation", value: [0, 0, 0, 1] },
  {
    component: PhysicsGravity.id,
    field: "gravity",
    value: [0, -9.81, 0],
    code: "aperture.entity.componentField.missingComponent",
  },
  { component: PhysicsCharacterController.id, field: "enabled", value: true },
  { component: PhysicsCharacterController.id, field: "offset", value: 0.5 },
  { component: PhysicsCharacterController.id, field: "up", value: [0, 1, 0] },
  {
    component: PhysicsCharacterController.id,
    field: "characterMassMode",
    value: "mass",
  },
  { component: PhysicsMaterial.id, field: "friction", value: 0.5 },
  { component: PhysicsMaterial.id, field: "frictionCombine", value: "max" },
  { component: PhysicsDebug.id, field: "jointFrames", value: true },
  { component: PhysicsJoint.id, field: "enabled", value: true },
  { component: PhysicsJoint.id, field: "bodyARef", value: "1:0" },
  { component: PhysicsJoint.id, field: "kind", value: "fixed" },
  { component: PhysicsJoint.id, field: "anchorA", value: [0, 0, 0] },
  { component: PhysicsJoint.id, field: "frameA", value: [0, 0, 0, 1] },
  { component: PhysicsJoint.id, field: "minLimit", value: 0 },
];

describe("setApertureEntityComponentField", () => {
  describe("request dispatch", () => {
    it("returns the refreshed entity summary alongside the written value", () => {
      const report = mutate(fullEntity, DebugMetadata.id, "note", "inspected");

      if (!report.ok) {
        throw new Error(`expected ok report, got ${report.diagnostic.code}`);
      }

      expect(report.component).toBe(DebugMetadata.id);
      expect(report.field).toBe("note");
      expect(report.value).toBe("inspected");
      expect(report.summary.entity).toEqual(refOf(fullEntity));
      expect(report.summary.componentIds).toContain(DebugMetadata.id);
      expect(fullEntity.getValue(DebugMetadata, "note")).toBe("inspected");
    });

    it("rejects components outside the mutation whitelist", () => {
      const report = mutate(
        fullEntity,
        "aperture.render.mesh",
        "handle",
        "unsafe",
      );

      if (report.ok) {
        throw new Error("expected an unsupported-component rejection");
      }

      expect(report.diagnostic).toMatchObject({
        code: "aperture.entityLookup.componentMutationUnsupported",
        severity: "error",
        data: { component: "aperture.render.mesh" },
      });
      expect(report.diagnostic.suggestedFix).toContain("whitelist");
    });

    it("rejects unknown fields on whitelisted components", () => {
      const report = mutate(fullEntity, RigidBody.id, "mass", 10);

      if (report.ok) {
        throw new Error("expected an unsupported-field rejection");
      }

      expect(report.diagnostic).toMatchObject({
        code: "aperture.entityLookup.componentFieldUnsupported",
        severity: "error",
        data: { component: RigidBody.id, field: "mass" },
      });
    });

    it("rejects malformed entity refs before resolving", () => {
      const report = setApertureEntityComponentField(world, {
        entity: { index: -1, generation: 0 },
        component: DebugMetadata.id,
        field: "note",
        value: "nope",
      });

      if (report.ok) {
        throw new Error("expected an invalid-ref rejection");
      }

      expect(report.diagnostic.code).toBe("aperture.entityLookup.invalidRef");
    });

    it("rejects stale generation refs without mutating", () => {
      const before = fullEntity.getValue(DebugMetadata, "tag");
      const report = setApertureEntityComponentField(world, {
        entity: {
          index: fullEntity.index,
          generation: fullEntity.generation + 1,
        },
        component: DebugMetadata.id,
        field: "tag",
        value: "stale",
      });

      if (report.ok) {
        throw new Error("expected a generation-mismatch rejection");
      }

      expect(report.diagnostic.code).toBe(
        "aperture.entityLookup.generationMismatch",
      );
      expect(fullEntity.getValue(DebugMetadata, "tag")).toBe(before);
    });

    it("rejects refs to destroyed entities", () => {
      const doomed = world.createEntity();
      const ref = refOf(doomed);
      doomed.destroy();

      const report = setApertureEntityComponentField(world, {
        entity: ref,
        component: DebugMetadata.id,
        field: "note",
        value: "gone",
      });

      if (report.ok) {
        throw new Error("expected a not-found rejection");
      }

      expect(report.diagnostic.code).toBe("aperture.entityLookup.notFound");
    });
  });

  describe("field writes", () => {
    it.each(successCases)(
      "writes $component.$field and reads the value back",
      ({ component, field, value, kind }) => {
        const report = mutate(fullEntity, component, field, value);

        if (!report.ok) {
          throw new Error(`expected ok report, got ${report.diagnostic.code}`);
        }

        expect(report.component).toBe(component);
        expect(report.field).toBe(field);
        expect(report.value).toEqual(value);
        expect(readField(fullEntity, component, field, kind)).toEqual(value);
      },
    );
  });

  describe("invalid value rejections", () => {
    it.each(rejectionCases)(
      "rejects $component.$field value $value without mutating",
      ({ component, field, value, kind }) => {
        const before = readField(fullEntity, component, field, kind);
        const report = mutate(fullEntity, component, field, value);

        if (report.ok) {
          throw new Error(
            `expected invalid-value rejection for ${component}.${field}`,
          );
        }

        expect(report.diagnostic).toMatchObject({
          code: "aperture.entityLookup.invalidComponentFieldValue",
          severity: "error",
          data: { component, field },
        });
        expect(report.diagnostic.message).toContain(`'${field}'`);
        expect(readField(fullEntity, component, field, kind)).toEqual(before);
      },
    );
  });

  describe("missing component rejections", () => {
    it.each(missingComponentCases)(
      "rejects $component.$field when the entity lacks the component",
      ({ component, field, value, code }) => {
        const report = mutate(bareEntity, component, field, value);

        if (report.ok) {
          throw new Error(
            `expected missing-component rejection for ${component}.${field}`,
          );
        }

        expect(report.diagnostic).toMatchObject({
          code: code ?? "aperture.entityLookup.componentMissing",
          severity: "error",
          data: { component, field },
        });
        expect(report.diagnostic.message).toContain(
          `does not have component '${component}'`,
        );
      },
    );
  });
});
