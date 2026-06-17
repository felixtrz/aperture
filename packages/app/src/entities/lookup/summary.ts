import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsGravity,
  PhysicsColliderAxis,
  PhysicsColliderShapeKind,
  PhysicsBodyState,
  PhysicsCharacterController,
  PhysicsCharacterMassMode,
  PhysicsDebug,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsJointMotorMode,
  PhysicsJointMotorModel,
  PhysicsMaterial,
  PhysicsMaterialCombineRule,
  PhysicsVelocity,
  RigidBody,
  PhysicsRigidBodyType,
} from "@aperture-engine/physics";
import {
  Sprite,
  SpriteBillboardMode,
  SpriteBlendMode,
  SpriteCoordinateMode,
  SpriteSizeMode,
} from "@aperture-engine/render";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../../config.js";
import type {
  ApertureEntitySourceSummary,
  ApertureEntitySummary,
  ApertureLocalTransformSummary,
  AperturePhysicsBodyStateSummary,
  AperturePhysicsCharacterControllerSummary,
  AperturePhysicsColliderSummary,
  AperturePhysicsDebugSummary,
  AperturePhysicsExternalForceSummary,
  AperturePhysicsExternalImpulseSummary,
  AperturePhysicsGravitySummary,
  AperturePhysicsJointSummary,
  AperturePhysicsKinematicTargetSummary,
  AperturePhysicsMaterialSummary,
  AperturePhysicsRigidBodySummary,
  AperturePhysicsVelocitySummary,
  ApertureRenderSpriteSummary,
  ApertureWorldTransformSummary,
} from "./types.js";
import {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
} from "../../systems.js";

export { jsonSafeValue } from "../../internal/json-safe.js";

export function entitySummary(entity: Entity): ApertureEntitySummary {
  const key = entity.hasComponent(AppEntityKey)
    ? entity.getValue(AppEntityKey, "value")
    : null;
  const name = entity.hasComponent(Name)
    ? entity.getValue(Name, "value")
    : null;
  const tags = entity.hasComponent(AppEntityTags)
    ? parseTags(entity.getValue(AppEntityTags, "valuesJson"))
    : [];
  const source = entity.hasComponent(AppEntitySource)
    ? sourceSummary(entity)
    : null;
  const parent = entity.hasComponent(Parent)
    ? entityRefFromEntity(entity.getValue(Parent, "entity"))
    : null;
  const localTransform = entity.hasComponent(LocalTransform)
    ? localTransformSummary(entity)
    : null;
  const worldTransform = entity.hasComponent(WorldTransform)
    ? worldTransformSummary(entity)
    : null;
  const renderSprite = entityHasComponentId(entity, Sprite.id)
    ? renderSpriteSummary(entity)
    : null;
  const physicsRigidBody = entityHasComponentId(entity, RigidBody.id)
    ? physicsRigidBodySummary(entity)
    : null;
  const physicsCollider = entityHasComponentId(entity, Collider.id)
    ? physicsColliderSummary(entity)
    : null;
  const physicsVelocity = entityHasComponentId(entity, PhysicsVelocity.id)
    ? physicsVelocitySummary(entity)
    : null;
  const physicsExternalForce = entityHasComponentId(entity, ExternalForce.id)
    ? physicsExternalForceSummary(entity)
    : null;
  const physicsExternalImpulse = entityHasComponentId(
    entity,
    ExternalImpulse.id,
  )
    ? physicsExternalImpulseSummary(entity)
    : null;
  const physicsKinematicTarget = entityHasComponentId(
    entity,
    KinematicTarget.id,
  )
    ? physicsKinematicTargetSummary(entity)
    : null;
  const physicsGravity = entityHasComponentId(entity, PhysicsGravity.id)
    ? physicsGravitySummary(entity)
    : null;
  const physicsCharacterController = entityHasComponentId(
    entity,
    PhysicsCharacterController.id,
  )
    ? physicsCharacterControllerSummary(entity)
    : null;
  const physicsMaterial = entityHasComponentId(entity, PhysicsMaterial.id)
    ? physicsMaterialSummary(entity)
    : null;
  const physicsDebug = entityHasComponentId(entity, PhysicsDebug.id)
    ? physicsDebugSummary(entity)
    : null;
  const physicsJoint = entityHasComponentId(entity, PhysicsJoint.id)
    ? physicsJointSummary(entity)
    : null;
  const physicsBodyState = entityHasComponentId(entity, PhysicsBodyState.id)
    ? physicsBodyStateSummary(entity)
    : null;

  return {
    entity: {
      index: entity.index,
      generation: entity.generation,
    },
    ...(typeof key === "string" && key.length > 0 ? { key } : {}),
    name:
      typeof name === "string" && name.length > 0
        ? name
        : `Entity ${entity.index}`,
    componentIds: entity
      .getComponents()
      .map((component) => component.id)
      .sort((a, b) => a.localeCompare(b)),
    ...(tags.length === 0 ? {} : { tags }),
    ...(source === null ? {} : { source }),
    ...(parent === null ? {} : { parent }),
    ...(localTransform === null ? {} : { localTransform }),
    ...(worldTransform === null ? {} : { worldTransform }),
    ...(renderSprite === null ? {} : { renderSprite }),
    ...(physicsRigidBody === null ? {} : { physicsRigidBody }),
    ...(physicsCollider === null ? {} : { physicsCollider }),
    ...(physicsVelocity === null ? {} : { physicsVelocity }),
    ...(physicsExternalForce === null ? {} : { physicsExternalForce }),
    ...(physicsExternalImpulse === null ? {} : { physicsExternalImpulse }),
    ...(physicsKinematicTarget === null ? {} : { physicsKinematicTarget }),
    ...(physicsGravity === null ? {} : { physicsGravity }),
    ...(physicsCharacterController === null
      ? {}
      : { physicsCharacterController }),
    ...(physicsMaterial === null ? {} : { physicsMaterial }),
    ...(physicsDebug === null ? {} : { physicsDebug }),
    ...(physicsJoint === null ? {} : { physicsJoint }),
    ...(physicsBodyState === null ? {} : { physicsBodyState }),
  };
}

export function collectActiveEntities(world: EcsWorld): Entity[] {
  const entityManager = world.entityManager as unknown as {
    readonly indexLookup?: readonly (Entity | null | undefined)[];
  };

  if (Array.isArray(entityManager.indexLookup)) {
    return entityManager.indexLookup.filter(
      (entity): entity is Entity => entity !== null && entity?.active === true,
    );
  }

  return [
    ...world.queryManager.registerQuery({ required: [] }).entities,
  ].filter((entity) => entity.active);
}

export function compareEntitySummaries(
  a: ApertureEntitySummary,
  b: ApertureEntitySummary,
): number {
  return (
    a.entity.index - b.entity.index || a.entity.generation - b.entity.generation
  );
}

export function entityRefKey(ref: EcsEntityRef): string {
  return `${ref.index}:${ref.generation}`;
}

export function validEntityRef(ref: EcsEntityRef): boolean {
  return (
    Number.isInteger(ref.index) &&
    Number.isInteger(ref.generation) &&
    ref.index >= 0 &&
    ref.generation >= 0
  );
}

function localTransformSummary(entity: Entity): ApertureLocalTransformSummary {
  return {
    translation: tuple3FromView(
      entity.getVectorView(LocalTransform, "translation"),
    ),
    rotation: tuple4FromView(entity.getVectorView(LocalTransform, "rotation")),
    scale: tuple3FromView(entity.getVectorView(LocalTransform, "scale")),
  };
}

function worldTransformSummary(entity: Entity): ApertureWorldTransformSummary {
  return {
    matrix: [
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col0")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col1")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col2")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col3")),
    ],
  };
}

function renderSpriteSummary(entity: Entity): ApertureRenderSpriteSummary {
  const coordinateMode = entity.getValue(Sprite, "coordinateMode");
  const billboardMode = entity.getValue(Sprite, "billboardMode");
  const sizeMode = entity.getValue(Sprite, "sizeMode");
  const blendMode = entity.getValue(Sprite, "blendMode");

  return {
    textureId: entity.getValue(Sprite, "textureId") ?? "",
    samplerId: entity.getValue(Sprite, "samplerId") ?? "",
    color: tuple4FromView(entity.getVectorView(Sprite, "color")),
    width: entity.getValue(Sprite, "width") ?? 1,
    height: entity.getValue(Sprite, "height") ?? 1,
    uvRect: tuple4FromView(entity.getVectorView(Sprite, "uvRect")),
    pivot: tuple2FromView(entity.getVectorView(Sprite, "pivot")),
    rotation: entity.getValue(Sprite, "rotation") ?? 0,
    atlasFrame: entity.getValue(Sprite, "atlasFrame") ?? 0,
    coordinateMode: isSpriteCoordinateMode(coordinateMode)
      ? coordinateMode
      : SpriteCoordinateMode.World,
    billboardMode: isSpriteBillboardMode(billboardMode)
      ? billboardMode
      : SpriteBillboardMode.Spherical,
    sizeMode: isSpriteSizeMode(sizeMode) ? sizeMode : SpriteSizeMode.WorldUnits,
    blendMode: isSpriteBlendMode(blendMode) ? blendMode : SpriteBlendMode.Alpha,
  };
}

function physicsRigidBodySummary(
  entity: Entity,
): AperturePhysicsRigidBodySummary {
  const type = entity.getValue(RigidBody, "type");

  return {
    enabled: entity.getValue(RigidBody, "enabled") === true,
    type: isPhysicsRigidBodyType(type) ? type : PhysicsRigidBodyType.Dynamic,
    gravityScale: entity.getValue(RigidBody, "gravityScale") ?? 1,
    linearDamping: entity.getValue(RigidBody, "linearDamping") ?? 0,
    angularDamping: entity.getValue(RigidBody, "angularDamping") ?? 0,
    canSleep: entity.getValue(RigidBody, "canSleep") !== false,
    ccdEnabled: entity.getValue(RigidBody, "ccdEnabled") === true,
    lockTranslationX: entity.getValue(RigidBody, "lockTranslationX") === true,
    lockTranslationY: entity.getValue(RigidBody, "lockTranslationY") === true,
    lockTranslationZ: entity.getValue(RigidBody, "lockTranslationZ") === true,
    lockRotationX: entity.getValue(RigidBody, "lockRotationX") === true,
    lockRotationY: entity.getValue(RigidBody, "lockRotationY") === true,
    lockRotationZ: entity.getValue(RigidBody, "lockRotationZ") === true,
  };
}

function physicsColliderSummary(
  entity: Entity,
): AperturePhysicsColliderSummary {
  const shapeKind = entity.getValue(Collider, "shapeKind");
  const axis = entity.getValue(Collider, "axis");

  return {
    enabled: entity.getValue(Collider, "enabled") === true,
    shapeKind: isPhysicsColliderShapeKind(shapeKind)
      ? shapeKind
      : PhysicsColliderShapeKind.Box,
    halfExtents: tuple3FromView(entity.getVectorView(Collider, "halfExtents")),
    radius: entity.getValue(Collider, "radius") ?? 0.5,
    halfHeight: entity.getValue(Collider, "halfHeight") ?? 0.5,
    axis: isPhysicsColliderAxis(axis) ? axis : PhysicsColliderAxis.Y,
    meshId: entity.getValue(Collider, "meshId") ?? "",
    heightfieldAssetId: entity.getValue(Collider, "heightfieldAssetId") ?? "",
    offsetTranslation: tuple3FromView(
      entity.getVectorView(Collider, "offsetTranslation"),
    ),
    offsetRotation: tuple4FromView(
      entity.getVectorView(Collider, "offsetRotation"),
    ),
    sensor: entity.getValue(Collider, "sensor") === true,
    density: entity.getValue(Collider, "density") ?? 1,
    friction: entity.getValue(Collider, "friction") ?? 0.5,
    restitution: entity.getValue(Collider, "restitution") ?? 0,
    collisionGroups: entity.getValue(Collider, "collisionGroups") ?? -1,
    solverGroups: entity.getValue(Collider, "solverGroups") ?? -1,
  };
}

function entityHasComponentId(entity: Entity, componentId: string): boolean {
  return entity
    .getComponents()
    .some((component) => component.id === componentId);
}

function physicsVelocitySummary(
  entity: Entity,
): AperturePhysicsVelocitySummary {
  return {
    linear: tuple3FromView(entity.getVectorView(PhysicsVelocity, "linear")),
    angular: tuple3FromView(entity.getVectorView(PhysicsVelocity, "angular")),
  };
}

function physicsExternalForceSummary(
  entity: Entity,
): AperturePhysicsExternalForceSummary {
  return {
    force: tuple3FromView(entity.getVectorView(ExternalForce, "force")),
    torque: tuple3FromView(entity.getVectorView(ExternalForce, "torque")),
  };
}

function physicsExternalImpulseSummary(
  entity: Entity,
): AperturePhysicsExternalImpulseSummary {
  return {
    impulse: tuple3FromView(entity.getVectorView(ExternalImpulse, "impulse")),
    angularImpulse: tuple3FromView(
      entity.getVectorView(ExternalImpulse, "angularImpulse"),
    ),
  };
}

function physicsKinematicTargetSummary(
  entity: Entity,
): AperturePhysicsKinematicTargetSummary {
  return {
    enabled: entity.getValue(KinematicTarget, "enabled") === true,
    translation: tuple3FromView(
      entity.getVectorView(KinematicTarget, "translation"),
    ),
    rotation: tuple4FromView(entity.getVectorView(KinematicTarget, "rotation")),
  };
}

function physicsGravitySummary(entity: Entity): AperturePhysicsGravitySummary {
  return {
    gravity: tuple3FromView(entity.getVectorView(PhysicsGravity, "gravity")),
  };
}

function physicsCharacterControllerSummary(
  entity: Entity,
): AperturePhysicsCharacterControllerSummary {
  const characterMassMode = entity.getValue(
    PhysicsCharacterController,
    "characterMassMode",
  );

  return {
    enabled: entity.getValue(PhysicsCharacterController, "enabled") === true,
    offset: entity.getValue(PhysicsCharacterController, "offset") ?? 0.01,
    up: tuple3FromView(entity.getVectorView(PhysicsCharacterController, "up")),
    slide: entity.getValue(PhysicsCharacterController, "slide") !== false,
    maxSlopeClimbAngleEnabled:
      entity.getValue(
        PhysicsCharacterController,
        "maxSlopeClimbAngleEnabled",
      ) === true,
    maxSlopeClimbAngle:
      entity.getValue(PhysicsCharacterController, "maxSlopeClimbAngle") ??
      Math.PI / 4,
    minSlopeSlideAngleEnabled:
      entity.getValue(
        PhysicsCharacterController,
        "minSlopeSlideAngleEnabled",
      ) === true,
    minSlopeSlideAngle:
      entity.getValue(PhysicsCharacterController, "minSlopeSlideAngle") ??
      Math.PI / 3,
    snapToGroundDistance:
      entity.getValue(PhysicsCharacterController, "snapToGroundDistance") ?? 0,
    autostepEnabled:
      entity.getValue(PhysicsCharacterController, "autostepEnabled") === true,
    autostepMaxHeight:
      entity.getValue(PhysicsCharacterController, "autostepMaxHeight") ?? 0.1,
    autostepMinWidth:
      entity.getValue(PhysicsCharacterController, "autostepMinWidth") ?? 0.1,
    autostepIncludeDynamicBodies:
      entity.getValue(
        PhysicsCharacterController,
        "autostepIncludeDynamicBodies",
      ) === true,
    applyImpulsesToDynamicBodies:
      entity.getValue(
        PhysicsCharacterController,
        "applyImpulsesToDynamicBodies",
      ) === true,
    characterMassMode: isPhysicsCharacterMassMode(characterMassMode)
      ? characterMassMode
      : PhysicsCharacterMassMode.BackendDefault,
    characterMass:
      entity.getValue(PhysicsCharacterController, "characterMass") ?? 0,
  };
}

function physicsMaterialSummary(
  entity: Entity,
): AperturePhysicsMaterialSummary {
  const frictionCombine = entity.getValue(PhysicsMaterial, "frictionCombine");
  const restitutionCombine = entity.getValue(
    PhysicsMaterial,
    "restitutionCombine",
  );

  return {
    friction: entity.getValue(PhysicsMaterial, "friction") ?? 0.5,
    restitution: entity.getValue(PhysicsMaterial, "restitution") ?? 0,
    density: entity.getValue(PhysicsMaterial, "density") ?? 1,
    frictionCombine: isPhysicsMaterialCombineRule(frictionCombine)
      ? frictionCombine
      : PhysicsMaterialCombineRule.Average,
    restitutionCombine: isPhysicsMaterialCombineRule(restitutionCombine)
      ? restitutionCombine
      : PhysicsMaterialCombineRule.Average,
  };
}

function physicsDebugSummary(entity: Entity): AperturePhysicsDebugSummary {
  return {
    colliderWireframes:
      entity.getValue(PhysicsDebug, "colliderWireframes") === true,
    contactNormals: entity.getValue(PhysicsDebug, "contactNormals") === true,
    bodyStateMarkers:
      entity.getValue(PhysicsDebug, "bodyStateMarkers") === true,
    broadphaseAabbs: entity.getValue(PhysicsDebug, "broadphaseAabbs") === true,
    jointFrames: entity.getValue(PhysicsDebug, "jointFrames") === true,
  };
}

function physicsJointSummary(entity: Entity): AperturePhysicsJointSummary {
  const kind = entity.getValue(PhysicsJoint, "kind");
  const motorMode = entity.getValue(PhysicsJoint, "motorMode");
  const motorModel = entity.getValue(PhysicsJoint, "motorModel");

  return {
    enabled: entity.getValue(PhysicsJoint, "enabled") === true,
    kind: isPhysicsJointKind(kind) ? kind : PhysicsJointKind.Fixed,
    bodyARef: entity.getValue(PhysicsJoint, "bodyARef") ?? "",
    bodyBRef: entity.getValue(PhysicsJoint, "bodyBRef") ?? "",
    anchorA: tuple3FromView(entity.getVectorView(PhysicsJoint, "anchorA")),
    anchorB: tuple3FromView(entity.getVectorView(PhysicsJoint, "anchorB")),
    frameA: tuple4FromView(entity.getVectorView(PhysicsJoint, "frameA")),
    frameB: tuple4FromView(entity.getVectorView(PhysicsJoint, "frameB")),
    axis: tuple3FromView(entity.getVectorView(PhysicsJoint, "axis")),
    minLimit: entity.getValue(PhysicsJoint, "minLimit") ?? 0,
    maxLimit: entity.getValue(PhysicsJoint, "maxLimit") ?? 0,
    motorMode: isPhysicsJointMotorMode(motorMode)
      ? motorMode
      : PhysicsJointMotorMode.Position,
    motorModel: isPhysicsJointMotorModel(motorModel)
      ? motorModel
      : PhysicsJointMotorModel.Acceleration,
    motorTarget: entity.getValue(PhysicsJoint, "motorTarget") ?? 0,
    motorVelocity: entity.getValue(PhysicsJoint, "motorVelocity") ?? 0,
    motorStiffness: entity.getValue(PhysicsJoint, "motorStiffness") ?? 0,
    motorDamping: entity.getValue(PhysicsJoint, "motorDamping") ?? 0,
    motorFactor: entity.getValue(PhysicsJoint, "motorFactor") ?? 0,
    motorMaxForce: entity.getValue(PhysicsJoint, "motorMaxForce") ?? 0,
    contactsEnabled: entity.getValue(PhysicsJoint, "contactsEnabled") === true,
    breakForce: entity.getValue(PhysicsJoint, "breakForce") ?? 0,
  };
}

function isPhysicsJointKind(value: unknown): value is PhysicsJointKind {
  return typeof value === "string" && stringValueIn(value, PhysicsJointKind);
}

function isPhysicsCharacterMassMode(
  value: unknown,
): value is PhysicsCharacterMassMode {
  return (
    typeof value === "string" && stringValueIn(value, PhysicsCharacterMassMode)
  );
}

function isPhysicsMaterialCombineRule(
  value: unknown,
): value is PhysicsMaterialCombineRule {
  return (
    typeof value === "string" &&
    stringValueIn(value, PhysicsMaterialCombineRule)
  );
}

function isPhysicsRigidBodyType(value: unknown): value is PhysicsRigidBodyType {
  return (
    typeof value === "string" && stringValueIn(value, PhysicsRigidBodyType)
  );
}

function isPhysicsColliderShapeKind(
  value: unknown,
): value is PhysicsColliderShapeKind {
  return (
    typeof value === "string" && stringValueIn(value, PhysicsColliderShapeKind)
  );
}

function isPhysicsColliderAxis(value: unknown): value is PhysicsColliderAxis {
  return typeof value === "string" && stringValueIn(value, PhysicsColliderAxis);
}

function isPhysicsJointMotorMode(
  value: unknown,
): value is PhysicsJointMotorMode {
  return (
    typeof value === "string" && stringValueIn(value, PhysicsJointMotorMode)
  );
}

function isPhysicsJointMotorModel(
  value: unknown,
): value is PhysicsJointMotorModel {
  return (
    typeof value === "string" && stringValueIn(value, PhysicsJointMotorModel)
  );
}

function isSpriteCoordinateMode(value: unknown): value is SpriteCoordinateMode {
  return typeof value === "string" && stringValueIn(value, SpriteCoordinateMode);
}

function isSpriteBillboardMode(value: unknown): value is SpriteBillboardMode {
  return typeof value === "string" && stringValueIn(value, SpriteBillboardMode);
}

function isSpriteSizeMode(value: unknown): value is SpriteSizeMode {
  return typeof value === "string" && stringValueIn(value, SpriteSizeMode);
}

function isSpriteBlendMode(value: unknown): value is SpriteBlendMode {
  return typeof value === "string" && stringValueIn(value, SpriteBlendMode);
}

function stringValueIn(
  value: string,
  allowed: Readonly<Record<string, string>>,
): boolean {
  return Object.values(allowed).includes(value);
}

function physicsBodyStateSummary(
  entity: Entity,
): AperturePhysicsBodyStateSummary {
  const backendBodyId = entity.getValue(PhysicsBodyState, "backendBodyId");

  return {
    sleeping: entity.getValue(PhysicsBodyState, "sleeping") === true,
    currentTranslation: tuple3FromView(
      entity.getVectorView(PhysicsBodyState, "currentTranslation"),
    ),
    currentRotation: tuple4FromView(
      entity.getVectorView(PhysicsBodyState, "currentRotation"),
    ),
    previousTranslation: tuple3FromView(
      entity.getVectorView(PhysicsBodyState, "previousTranslation"),
    ),
    previousRotation: tuple4FromView(
      entity.getVectorView(PhysicsBodyState, "previousRotation"),
    ),
    ...(typeof backendBodyId === "string" && backendBodyId.length > 0
      ? { backendBodyId }
      : {}),
  };
}

function entityRefFromEntity(entity: Entity | null): EcsEntityRef | null {
  return entity === null
    ? null
    : { index: entity.index, generation: entity.generation };
}

function tuple2FromView(view: ArrayLike<number>): readonly [number, number] {
  return [view[0] ?? 0, view[1] ?? 0];
}

function tuple3FromView(
  view: ArrayLike<number>,
): readonly [number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0];
}

function tuple4FromView(
  view: ArrayLike<number>,
): readonly [number, number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0, view[3] ?? 0];
}

function sourceSummary(entity: Entity): ApertureEntitySourceSummary | null {
  const kind = entity.getValue(AppEntitySource, "kind");
  const assetId = entity.getValue(AppEntitySource, "assetId");
  const gltfNodeIndex = entity.getValue(AppEntitySource, "gltfNodeIndex");
  const gltfNodePath = entity.getValue(AppEntitySource, "gltfNodePath");

  if (kind !== "gltf") {
    return null;
  }

  return {
    ...(typeof assetId === "string" && assetId.length > 0 ? { assetId } : {}),
    ...(typeof gltfNodeIndex === "number" && gltfNodeIndex >= 0
      ? { gltfNodeIndex }
      : {}),
    ...(typeof gltfNodePath === "string" && gltfNodePath.length > 0
      ? { gltfNodePath }
      : {}),
  };
}

function parseTags(value: string | null): readonly string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}
