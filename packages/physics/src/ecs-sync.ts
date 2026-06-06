import {
  LocalTransform,
  Parent,
  WorldTransform,
  composeTrsMatrix,
  decomposeTrsMatrix,
  invertMat4,
  mat4,
  multiplyMat4,
  resolveWorldTransforms,
  serializeEntityRef,
  type AnyEcsComponent,
  type EcsWorld,
  type Entity,
  type Mat4,
} from "@aperture-engine/simulation";
import {
  type PhysicsBackend,
  type PhysicsBodyResult,
  type PhysicsColliderDescriptor,
  type PhysicsCommand,
  type PhysicsCommandBuffer,
  type PhysicsEvent,
  type PhysicsJointDescriptor,
  type PhysicsReadbackReport,
  type PhysicsResultBuffer,
  type PhysicsStepReport,
  type PhysicsSyncReport,
  type PhysicsTransform,
  createPhysicsResultBuffer,
} from "./backend.js";
import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsGravity,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsJointMotorMode,
  PhysicsJointMotorModel,
  PhysicsMaterial,
  PhysicsBodyState,
  PhysicsColliderShapeKind,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
  createPhysicsBodyState,
  type PhysicsColliderAxis,
  type PhysicsQuat,
  type PhysicsShape,
  type PhysicsVec3,
} from "./components.js";

export interface PhysicsWorldSyncState {
  readonly knownEntities: Set<string>;
  readonly knownJoints: Set<string>;
  readonly sleepingStates: Map<string, boolean>;
  readonly resultBuffer: PhysicsResultBuffer;
}

export interface PhysicsWorldWritebackReport {
  readonly bodyCount: number;
  readonly transformWrites: number;
  readonly velocityWrites: number;
  readonly bodyStateWrites: number;
  readonly missingEntities: number;
}

export interface PhysicsWorldStepOptions {
  readonly world: EcsWorld;
  readonly backend: PhysicsBackend;
  readonly fixedDelta: number;
  readonly fixedStep: number;
  readonly state?: PhysicsWorldSyncState;
}

export interface PhysicsWorldStepReport {
  readonly sync: PhysicsSyncReport;
  readonly step: PhysicsStepReport;
  readonly readback: PhysicsReadbackReport;
  readonly writeback: PhysicsWorldWritebackReport;
  readonly events: readonly PhysicsResultBuffer["events"][number][];
}

interface PhysicsColliderSource {
  readonly entity: Entity;
  readonly bodyLocalOffset: boolean;
}

interface PhysicsTransformWithSource extends PhysicsTransform {
  readonly source: "local" | "world";
}

export function createPhysicsWorldSyncState(): PhysicsWorldSyncState {
  return {
    knownEntities: new Set<string>(),
    knownJoints: new Set<string>(),
    sleepingStates: new Map<string, boolean>(),
    resultBuffer: createPhysicsResultBuffer(),
  };
}

export function collectPhysicsCommands(
  world: EcsWorld,
  state?: PhysicsWorldSyncState,
): PhysicsCommandBuffer {
  const commands: PhysicsCommand[] = [];
  const seen = new Set<string>();
  const seenJoints = new Set<string>();
  const query = world.queryManager.registerQuery({
    required: [RigidBody, LocalTransform],
  });
  const childColliders = childColliderSourcesByBody(world);
  const gravityQuery = world.queryManager.registerQuery({
    required: [PhysicsGravity],
  });
  const jointQuery = world.queryManager.registerQuery({
    required: [PhysicsJoint],
  });
  const gravity = firstAuthoredGravity(gravityQuery.entities);

  if (gravity !== undefined) {
    commands.push({ kind: "setGravity", gravity });
  }

  for (const entity of query.entities) {
    if (!entity.active) {
      continue;
    }

    if (!readBoolean(entity, RigidBody, "enabled")) {
      clearPhysicsBodyState(entity);
      continue;
    }

    const ref = serializeEntityRef(entity);
    const colliders = colliderSourcesForBody(entity, childColliders.get(ref));

    if (colliders.length === 0) {
      clearPhysicsBodyState(entity);
      continue;
    }

    const command = createUpsertBodyCommand(world, entity, ref, colliders);

    seen.add(ref);
    commands.push(command);
  }

  for (const entity of jointQuery.entities) {
    if (!entity.active) {
      continue;
    }

    if (!readBoolean(entity, PhysicsJoint, "enabled")) {
      continue;
    }

    const ref = serializeEntityRef(entity);
    seenJoints.add(ref);
    commands.push({
      kind: "upsertJoint",
      entity: ref,
      joint: createJointDescriptor(entity),
    });
  }

  if (state !== undefined) {
    for (const ref of state.knownEntities) {
      if (!seen.has(ref)) {
        commands.push({ kind: "destroyBody", entity: ref });
      }
    }
    state.knownEntities.clear();
    for (const ref of seen) {
      state.knownEntities.add(ref);
    }

    for (const ref of state.knownJoints) {
      if (!seenJoints.has(ref)) {
        commands.push({ kind: "destroyJoint", entity: ref });
      }
    }
    state.knownJoints.clear();
    for (const ref of seenJoints) {
      state.knownJoints.add(ref);
    }
  }

  return { commands };
}

function firstAuthoredGravity(
  entities: Iterable<Entity>,
): PhysicsVec3 | undefined {
  const active = Array.from(entities)
    .filter((entity) => entity.active)
    .sort((a, b) => a.index - b.index || a.generation - b.generation)[0];

  return active === undefined
    ? undefined
    : readVec3(active, PhysicsGravity, "gravity");
}

export function stepPhysicsWorld(
  options: PhysicsWorldStepOptions,
): PhysicsWorldStepReport {
  const state = options.state ?? createPhysicsWorldSyncState();
  resolveWorldTransforms(options.world);
  const sync = options.backend.sync(
    collectPhysicsCommands(options.world, state),
  );
  const step = options.backend.step(options.fixedDelta, options.fixedStep);
  const readback = options.backend.readResults(state.resultBuffer);
  appendSleepWakeEvents(state, state.resultBuffer, options.fixedStep);
  const writeback = applyPhysicsResultsToWorld(
    options.world,
    state.resultBuffer,
  );
  const events = [...state.resultBuffer.events];

  return { sync, step, readback, writeback, events };
}

function appendSleepWakeEvents(
  state: PhysicsWorldSyncState,
  results: PhysicsResultBuffer,
  fixedStep: number,
): void {
  const seen = new Set<string>();
  const transitionEvents: PhysicsEvent[] = [];

  for (const body of [...results.bodies].sort(compareBodyResults)) {
    seen.add(body.entity);
    const previousSleeping = state.sleepingStates.get(body.entity);

    if (previousSleeping !== undefined && previousSleeping !== body.sleeping) {
      transitionEvents.push({
        kind: body.sleeping ? "sleep" : "wake",
        frame: 0,
        fixedStep,
        substep: 0,
        entityA: body.entity,
        entityB: body.entity,
        colliderA: body.entity,
        colliderB: body.entity,
      });
    }

    state.sleepingStates.set(body.entity, body.sleeping);
  }

  for (const entity of [...state.sleepingStates.keys()]) {
    if (!seen.has(entity)) {
      state.sleepingStates.delete(entity);
    }
  }

  if (transitionEvents.length === 0) {
    return;
  }

  results.events.push(...transitionEvents);
  results.events.sort(comparePhysicsEvents);
}

function compareBodyResults(
  left: PhysicsBodyResult,
  right: PhysicsBodyResult,
): number {
  return left.entity.localeCompare(right.entity);
}

function comparePhysicsEvents(left: PhysicsEvent, right: PhysicsEvent): number {
  return (
    left.fixedStep - right.fixedStep ||
    left.substep - right.substep ||
    left.kind.localeCompare(right.kind) ||
    left.entityA.localeCompare(right.entityA) ||
    left.entityB.localeCompare(right.entityB) ||
    left.colliderA.localeCompare(right.colliderA) ||
    left.colliderB.localeCompare(right.colliderB)
  );
}

export function applyPhysicsResultsToWorld(
  world: EcsWorld,
  results: PhysicsResultBuffer,
): PhysicsWorldWritebackReport {
  const entities = activeEntitiesByRef(world);
  let transformWrites = 0;
  let velocityWrites = 0;
  let bodyStateWrites = 0;
  let missingEntities = 0;
  const seenBodies = new Set<string>();

  for (const body of results.bodies) {
    seenBodies.add(body.entity);
    const entity =
      entities.get(body.entity) ?? resolveEntityRef(world, body.entity);

    if (entity === undefined) {
      missingEntities += 1;
      continue;
    }

    if (entity.hasComponent(LocalTransform)) {
      const localTransform = localTransformFromPhysicsResult(
        world,
        entity,
        body,
      );

      entity
        .getVectorView(LocalTransform, "translation")
        .set(localTransform.translation);
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(localTransform.rotation);
      transformWrites += 1;
    }

    if (entity.hasComponent(PhysicsVelocity)) {
      entity.getVectorView(PhysicsVelocity, "linear").set(body.velocity.linear);
      entity
        .getVectorView(PhysicsVelocity, "angular")
        .set(body.velocity.angular);
      velocityWrites += 1;
    }

    writePhysicsBodyState(entity, body);
    bodyStateWrites += 1;
  }
  clearMissingPhysicsBodyStates(world, seenBodies);

  return {
    bodyCount: results.bodies.length,
    transformWrites,
    velocityWrites,
    bodyStateWrites,
    missingEntities,
  };
}

function clearMissingPhysicsBodyStates(
  world: EcsWorld,
  seenBodies: ReadonlySet<string>,
): void {
  if (!world.hasComponent(PhysicsBodyState)) {
    return;
  }

  const query = world.queryManager.registerQuery({
    required: [RigidBody, PhysicsBodyState],
  });

  for (const entity of query.entities) {
    if (!entity.active || seenBodies.has(serializeEntityRef(entity))) {
      continue;
    }

    clearPhysicsBodyState(entity);
  }
}

function localTransformFromPhysicsResult(
  world: EcsWorld,
  entity: Entity,
  body: PhysicsBodyResult,
): {
  readonly translation: PhysicsVec3;
  readonly rotation: PhysicsQuat;
} {
  const parent = activeParentForEntity(entity);

  if (parent === null || !hasWorldTransform(world, parent)) {
    return body.transform;
  }

  const parentInverse = invertMat4(readWorldMatrix(parent));

  if (parentInverse === null) {
    return {
      translation: readVec3(entity, LocalTransform, "translation"),
      rotation: readQuat(entity, LocalTransform, "rotation"),
    };
  }

  const localMatrix = multiplyMat4(
    parentInverse,
    composeTrsMatrix(
      body.transform.translation,
      body.transform.rotation,
      readVec3(entity, LocalTransform, "scale"),
    ),
  );
  const local = decomposeTrsMatrix(localMatrix);

  if (local === null) {
    return {
      translation: readVec3(entity, LocalTransform, "translation"),
      rotation: readQuat(entity, LocalTransform, "rotation"),
    };
  }

  return {
    translation: [
      local.translation[0],
      local.translation[1],
      local.translation[2],
    ],
    rotation: [
      local.rotation[0],
      local.rotation[1],
      local.rotation[2],
      local.rotation[3],
    ],
  };
}

function createUpsertBodyCommand(
  world: EcsWorld,
  entity: Entity,
  ref: string,
  colliderSources: readonly PhysicsColliderSource[],
): Extract<PhysicsCommand, { readonly kind: "upsertBody" }> {
  const bodyType = readRigidBodyType(entity);
  const kinematicTarget = kinematicTargetForEntity(entity, bodyType);
  const colliders = colliderSources.map((source) =>
    createColliderDescriptor(entity, source),
  );
  const primaryCollider = colliders[0];
  const transform = physicsTransformForEntity(entity, world);

  if (primaryCollider === undefined) {
    throw new Error(
      `Physics body '${ref}' cannot be synced without at least one collider.`,
    );
  }

  return {
    kind: "upsertBody",
    entity: ref,
    transform,
    ...(kinematicTarget === undefined ? {} : { kinematicTarget }),
    bodyType,
    gravityScale: readNumber(entity, RigidBody, "gravityScale"),
    linearDamping: readNumber(entity, RigidBody, "linearDamping"),
    angularDamping: readNumber(entity, RigidBody, "angularDamping"),
    canSleep: readBoolean(entity, RigidBody, "canSleep"),
    ccdEnabled: readBoolean(entity, RigidBody, "ccdEnabled"),
    lockTranslations: [
      readBoolean(entity, RigidBody, "lockTranslationX"),
      readBoolean(entity, RigidBody, "lockTranslationY"),
      readBoolean(entity, RigidBody, "lockTranslationZ"),
    ],
    lockRotations: [
      readBoolean(entity, RigidBody, "lockRotationX"),
      readBoolean(entity, RigidBody, "lockRotationY"),
      readBoolean(entity, RigidBody, "lockRotationZ"),
    ],
    ...(hasActiveParent(entity) && transform.source !== "world"
      ? { parented: true }
      : {}),
    ...(entity.hasComponent(PhysicsVelocity)
      ? {
          velocity: {
            linear: readVec3(entity, PhysicsVelocity, "linear"),
            angular: readVec3(entity, PhysicsVelocity, "angular"),
          },
        }
      : {}),
    ...(entity.hasComponent(ExternalForce)
      ? {
          externalForce: {
            force: readVec3(entity, ExternalForce, "force"),
            torque: readVec3(entity, ExternalForce, "torque"),
          },
        }
      : {}),
    ...(entity.hasComponent(ExternalImpulse)
      ? {
          externalImpulse: consumeExternalImpulse(entity),
        }
      : {}),
    collider: primaryCollider,
    ...(colliders.length > 1 ? { colliders } : {}),
  };
}

function hasActiveParent(entity: Entity): boolean {
  return activeParentForEntity(entity) !== null;
}

function activeParentForEntity(entity: Entity): Entity | null {
  if (!entity.hasComponent(Parent)) {
    return null;
  }

  const parent = entity.getValue(Parent, "entity");

  return parent !== null && parent !== undefined && parent.active
    ? parent
    : null;
}

function physicsTransformForEntity(
  entity: Entity,
  world: EcsWorld,
): PhysicsTransformWithSource {
  if (hasActiveParent(entity) && hasWorldTransform(world, entity)) {
    const worldTransform = decomposeTrsMatrix(readWorldMatrix(entity));

    if (worldTransform !== null) {
      return {
        source: "world",
        translation: [
          worldTransform.translation[0],
          worldTransform.translation[1],
          worldTransform.translation[2],
        ],
        rotation: [
          worldTransform.rotation[0],
          worldTransform.rotation[1],
          worldTransform.rotation[2],
          worldTransform.rotation[3],
        ],
      };
    }
  }

  return {
    source: "local",
    translation: readVec3(entity, LocalTransform, "translation"),
    rotation: readQuat(entity, LocalTransform, "rotation"),
  };
}

function readWorldMatrix(entity: Entity): Mat4 {
  const matrix = mat4();

  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);

  return matrix;
}

function hasWorldTransform(world: EcsWorld, entity: Entity): boolean {
  return (
    world.hasComponent(WorldTransform) && entity.hasComponent(WorldTransform)
  );
}

function colliderSourcesForBody(
  body: Entity,
  childColliders: readonly PhysicsColliderSource[] | undefined,
): readonly PhysicsColliderSource[] {
  const sources: PhysicsColliderSource[] = [];

  if (body.hasComponent(Collider) && readBoolean(body, Collider, "enabled")) {
    sources.push({ entity: body, bodyLocalOffset: false });
  }

  if (childColliders !== undefined) {
    sources.push(...childColliders);
  }

  return sources;
}

function childColliderSourcesByBody(
  world: EcsWorld,
): Map<string, readonly PhysicsColliderSource[]> {
  const sources = new Map<string, PhysicsColliderSource[]>();
  const query = world.queryManager.registerQuery({
    required: [Collider, LocalTransform, Parent],
  });

  for (const entity of [...query.entities].sort(compareEntities)) {
    if (!entity.active || !readBoolean(entity, Collider, "enabled")) {
      continue;
    }

    const parent = entity.getValue(Parent, "entity");

    if (parent === null || parent === undefined || !parent.active) {
      continue;
    }

    const parentRef = serializeEntityRef(parent);

    const bodySources = sources.get(parentRef) ?? [];

    bodySources.push({ entity, bodyLocalOffset: true });

    if (!sources.has(parentRef)) {
      sources.set(parentRef, bodySources);
    }
  }

  return sources;
}

function compareEntities(left: Entity, right: Entity): number {
  return left.index - right.index || left.generation - right.generation;
}

function createColliderDescriptor(
  body: Entity,
  source: PhysicsColliderSource,
): PhysicsColliderDescriptor {
  const collider = source.entity;
  const frictionCombine = readMaterialCombineRule(
    body,
    collider,
    "frictionCombine",
  );
  const restitutionCombine = readMaterialCombineRule(
    body,
    collider,
    "restitutionCombine",
  );
  const shape = readColliderShape(collider);

  return {
    entity: serializeEntityRef(collider),
    shape,
    ...(isAssetBackedColliderShape(shape)
      ? { scale: readVec3(collider, LocalTransform, "scale") }
      : {}),
    offsetTranslation: colliderOffsetTranslation(source),
    offsetRotation: colliderOffsetRotation(source),
    sensor: readBoolean(collider, Collider, "sensor"),
    density: readMaterialNumber(body, collider, "density"),
    friction: readMaterialNumber(body, collider, "friction"),
    restitution: readMaterialNumber(body, collider, "restitution"),
    ...(frictionCombine === undefined ? {} : { frictionCombine }),
    ...(restitutionCombine === undefined ? {} : { restitutionCombine }),
    collisionGroups: readNumber(collider, Collider, "collisionGroups"),
    solverGroups: readNumber(collider, Collider, "solverGroups"),
  };
}

function isAssetBackedColliderShape(shape: PhysicsShape): boolean {
  switch (shape.kind) {
    case "convexHull":
    case "trimesh":
    case "heightfield":
      return true;
    case "box":
    case "sphere":
    case "capsule":
    case "cylinder":
    case "cone":
      return false;
  }
}

function colliderOffsetTranslation(source: PhysicsColliderSource): PhysicsVec3 {
  const colliderOffset = readVec3(source.entity, Collider, "offsetTranslation");

  if (!source.bodyLocalOffset) {
    return colliderOffset;
  }

  const childTranslation = readVec3(
    source.entity,
    LocalTransform,
    "translation",
  );
  const childRotation = readQuat(source.entity, LocalTransform, "rotation");

  return addVec3(childTranslation, rotateVec3(childRotation, colliderOffset));
}

function colliderOffsetRotation(source: PhysicsColliderSource): PhysicsQuat {
  const colliderOffset = readQuat(source.entity, Collider, "offsetRotation");

  if (!source.bodyLocalOffset) {
    return colliderOffset;
  }

  return normalizeQuat(
    multiplyQuat(
      readQuat(source.entity, LocalTransform, "rotation"),
      colliderOffset,
    ),
  );
}

function readMaterialNumber(
  body: Entity,
  collider: Entity,
  field: "density" | "friction" | "restitution",
): number {
  if (collider.hasComponent(PhysicsMaterial)) {
    return readNumber(collider, PhysicsMaterial, field);
  }

  return body.hasComponent(PhysicsMaterial)
    ? readNumber(body, PhysicsMaterial, field)
    : readNumber(collider, Collider, field);
}

function readMaterialCombineRule(
  body: Entity,
  collider: Entity,
  field: "frictionCombine" | "restitutionCombine",
): PhysicsMaterialCombineRule | undefined {
  const materialEntity = collider.hasComponent(PhysicsMaterial)
    ? collider
    : body.hasComponent(PhysicsMaterial)
      ? body
      : undefined;

  if (materialEntity === undefined) {
    return undefined;
  }

  const value = materialEntity.getValue(PhysicsMaterial, field);

  switch (value) {
    case PhysicsMaterialCombineRule.Average:
    case PhysicsMaterialCombineRule.Min:
    case PhysicsMaterialCombineRule.Max:
    case PhysicsMaterialCombineRule.Multiply:
      return value;
    default:
      throw new Error(
        `Unsupported physics material combine rule '${String(value)}'.`,
      );
  }
}

function kinematicTargetForEntity(
  entity: Entity,
  bodyType: PhysicsRigidBodyType,
):
  | { readonly translation: PhysicsVec3; readonly rotation: PhysicsQuat }
  | undefined {
  if (bodyType !== PhysicsRigidBodyType.KinematicPosition) {
    return undefined;
  }
  if (
    !entity.hasComponent(KinematicTarget) ||
    !readBoolean(entity, KinematicTarget, "enabled")
  ) {
    return undefined;
  }

  return {
    translation: readVec3(entity, KinematicTarget, "translation"),
    rotation: readQuat(entity, KinematicTarget, "rotation"),
  };
}

function consumeExternalImpulse(entity: Entity): {
  readonly impulse: PhysicsVec3;
  readonly angularImpulse: PhysicsVec3;
} {
  const impulse = readVec3(entity, ExternalImpulse, "impulse");
  const angularImpulse = readVec3(entity, ExternalImpulse, "angularImpulse");

  entity.getVectorView(ExternalImpulse, "impulse").set([0, 0, 0]);
  entity.getVectorView(ExternalImpulse, "angularImpulse").set([0, 0, 0]);

  return { impulse, angularImpulse };
}

function createJointDescriptor(entity: Entity): PhysicsJointDescriptor {
  return {
    kind: readJointKind(entity),
    bodyARef: readString(entity, PhysicsJoint, "bodyARef"),
    bodyBRef: readString(entity, PhysicsJoint, "bodyBRef"),
    anchorA: readVec3(entity, PhysicsJoint, "anchorA"),
    anchorB: readVec3(entity, PhysicsJoint, "anchorB"),
    frameA: readQuat(entity, PhysicsJoint, "frameA"),
    frameB: readQuat(entity, PhysicsJoint, "frameB"),
    axis: readVec3(entity, PhysicsJoint, "axis"),
    minLimit: readNumber(entity, PhysicsJoint, "minLimit"),
    maxLimit: readNumber(entity, PhysicsJoint, "maxLimit"),
    motorMode: readJointMotorMode(entity),
    motorModel: readJointMotorModel(entity),
    motorTarget: readNumber(entity, PhysicsJoint, "motorTarget"),
    motorVelocity: readNumber(entity, PhysicsJoint, "motorVelocity"),
    motorStiffness: readNumber(entity, PhysicsJoint, "motorStiffness"),
    motorDamping: readNumber(entity, PhysicsJoint, "motorDamping"),
    motorFactor: readNumber(entity, PhysicsJoint, "motorFactor"),
    motorMaxForce: readNumber(entity, PhysicsJoint, "motorMaxForce"),
    contactsEnabled: readBoolean(entity, PhysicsJoint, "contactsEnabled"),
    breakForce: readNumber(entity, PhysicsJoint, "breakForce"),
  };
}

function readColliderShape(entity: Entity): PhysicsShape {
  const kind = entity.getValue(Collider, "shapeKind");

  switch (kind) {
    case PhysicsColliderShapeKind.Box:
      return {
        kind: "box",
        halfExtents: readVec3(entity, Collider, "halfExtents"),
      };
    case PhysicsColliderShapeKind.Sphere:
      return {
        kind: "sphere",
        radius: readNumber(entity, Collider, "radius"),
      };
    case PhysicsColliderShapeKind.Capsule:
      return {
        kind: "capsule",
        radius: readNumber(entity, Collider, "radius"),
        halfHeight: readNumber(entity, Collider, "halfHeight"),
        axis: readColliderAxis(entity),
      };
    case PhysicsColliderShapeKind.Cylinder:
      return {
        kind: "cylinder",
        radius: readNumber(entity, Collider, "radius"),
        halfHeight: readNumber(entity, Collider, "halfHeight"),
        axis: readColliderAxis(entity),
      };
    case PhysicsColliderShapeKind.Cone:
      return {
        kind: "cone",
        radius: readNumber(entity, Collider, "radius"),
        halfHeight: readNumber(entity, Collider, "halfHeight"),
        axis: readColliderAxis(entity),
      };
    case PhysicsColliderShapeKind.ConvexHull:
      return {
        kind: "convexHull",
        meshId: readString(entity, Collider, "meshId"),
      };
    case PhysicsColliderShapeKind.Trimesh:
      return {
        kind: "trimesh",
        meshId: readString(entity, Collider, "meshId"),
      };
    case PhysicsColliderShapeKind.Heightfield:
      return {
        kind: "heightfield",
        assetId: readString(entity, Collider, "heightfieldAssetId"),
      };
  }

  throw new Error(`Unsupported physics collider shape kind '${String(kind)}'.`);
}

function writePhysicsBodyState(
  entity: Entity,
  body: PhysicsResultBuffer["bodies"][number],
): void {
  const previousTranslation = entity.hasComponent(PhysicsBodyState)
    ? readVec3(entity, PhysicsBodyState, "currentTranslation")
    : body.transform.translation;
  const previousRotation = entity.hasComponent(PhysicsBodyState)
    ? readQuat(entity, PhysicsBodyState, "currentRotation")
    : body.transform.rotation;

  if (!entity.hasComponent(PhysicsBodyState)) {
    entity.addComponent(
      PhysicsBodyState,
      createPhysicsBodyState({
        sleeping: body.sleeping,
        currentTranslation: body.transform.translation,
        currentRotation: body.transform.rotation,
        previousTranslation,
        previousRotation,
        backendBodyId: body.entity,
      }),
    );
    return;
  }

  entity.setValue(PhysicsBodyState, "sleeping", body.sleeping);
  entity.setValue(PhysicsBodyState, "backendBodyId", body.entity);
  entity
    .getVectorView(PhysicsBodyState, "previousTranslation")
    .set(previousTranslation);
  entity
    .getVectorView(PhysicsBodyState, "previousRotation")
    .set(previousRotation);
  entity
    .getVectorView(PhysicsBodyState, "currentTranslation")
    .set(body.transform.translation);
  entity
    .getVectorView(PhysicsBodyState, "currentRotation")
    .set(body.transform.rotation);
}

function clearPhysicsBodyState(entity: Entity): void {
  if (entity.hasComponent(PhysicsBodyState)) {
    entity.removeComponent(PhysicsBodyState);
  }
}

function activeEntitiesByRef(world: EcsWorld): Map<string, Entity> {
  const entities = new Map<string, Entity>();
  const query = world.queryManager.registerQuery({ required: [] });

  for (const entity of query.entities) {
    if (entity.active) {
      entities.set(serializeEntityRef(entity), entity);
    }
  }

  return entities;
}

function resolveEntityRef(world: EcsWorld, ref: string): Entity | undefined {
  const separator = ref.indexOf(":");

  if (separator < 0) {
    return undefined;
  }

  const index = Number.parseInt(ref.slice(0, separator), 10);
  const generation = Number.parseInt(ref.slice(separator + 1), 10);

  if (!Number.isInteger(index) || !Number.isInteger(generation)) {
    return undefined;
  }

  const entity = world.entityManager.getEntityByIndex(index);

  return entity !== null && entity.active && entity.generation === generation
    ? entity
    : undefined;
}

function readVec3(
  entity: Entity,
  component: AnyEcsComponent,
  field: string,
): PhysicsVec3 {
  const value = entity.getVectorView(
    component as never,
    field as never,
  ) as ArrayLike<number>;

  return [read(value, 0), read(value, 1), read(value, 2)];
}

function readQuat(
  entity: Entity,
  component: AnyEcsComponent,
  field: string,
): PhysicsQuat {
  const value = entity.getVectorView(
    component as never,
    field as never,
  ) as ArrayLike<number>;

  return [read(value, 0), read(value, 1), read(value, 2), read(value, 3)];
}

function readNumber(
  entity: Entity,
  component: AnyEcsComponent,
  field: string,
): number {
  const value = entity.getValue(component as never, field as never);

  if (typeof value !== "number") {
    throw new TypeError(`Expected numeric physics field ${field}.`);
  }

  return value;
}

function readBoolean(
  entity: Entity,
  component: AnyEcsComponent,
  field: string,
): boolean {
  return entity.getValue(component as never, field as never) === true;
}

function readString(
  entity: Entity,
  component: AnyEcsComponent,
  field: string,
): string {
  const value = entity.getValue(component as never, field as never);

  return typeof value === "string" ? value : "";
}

function readRigidBodyType(entity: Entity): PhysicsRigidBodyType {
  const value = entity.getValue(RigidBody, "type");

  switch (value) {
    case PhysicsRigidBodyType.Static:
    case PhysicsRigidBodyType.Dynamic:
    case PhysicsRigidBodyType.KinematicPosition:
    case PhysicsRigidBodyType.KinematicVelocity:
      return value;
    default:
      throw new Error(
        `Unsupported physics rigid body type '${String(value)}'.`,
      );
  }
}

function readJointKind(entity: Entity): PhysicsJointKind {
  const value = entity.getValue(PhysicsJoint, "kind");

  switch (value) {
    case PhysicsJointKind.Fixed:
    case PhysicsJointKind.Spherical:
    case PhysicsJointKind.Revolute:
    case PhysicsJointKind.Prismatic:
    case PhysicsJointKind.Distance:
    case PhysicsJointKind.Generic:
      return value;
    default:
      throw new Error(`Unsupported physics joint kind '${String(value)}'.`);
  }
}

function readJointMotorMode(entity: Entity): PhysicsJointMotorMode {
  const value = entity.getValue(PhysicsJoint, "motorMode");

  switch (value) {
    case PhysicsJointMotorMode.Position:
    case PhysicsJointMotorMode.Velocity:
      return value;
    default:
      throw new Error(
        `Unsupported physics joint motor mode '${String(value)}'.`,
      );
  }
}

function readJointMotorModel(entity: Entity): PhysicsJointMotorModel {
  const value = entity.getValue(PhysicsJoint, "motorModel");

  switch (value) {
    case PhysicsJointMotorModel.Acceleration:
    case PhysicsJointMotorModel.Force:
      return value;
    default:
      throw new Error(
        `Unsupported physics joint motor model '${String(value)}'.`,
      );
  }
}

function readColliderAxis(entity: Entity): PhysicsColliderAxis {
  return readString(entity, Collider, "axis") as PhysicsColliderAxis;
}

function addVec3(left: PhysicsVec3, right: PhysicsVec3): PhysicsVec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function rotateVec3(rotation: PhysicsQuat, value: PhysicsVec3): PhysicsVec3 {
  const [qx, qy, qz, qw] = normalizeQuat(rotation);
  const [x, y, z] = value;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);

  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

function multiplyQuat(left: PhysicsQuat, right: PhysicsQuat): PhysicsQuat {
  const [ax, ay, az, aw] = normalizeQuat(left);
  const [bx, by, bz, bw] = normalizeQuat(right);

  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function normalizeQuat(value: PhysicsQuat): PhysicsQuat {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);

  return length <= Number.EPSILON
    ? [0, 0, 0, 1]
    : [
        value[0] / length,
        value[1] / length,
        value[2] / length,
        value[3] / length,
      ];
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected vector value at index ${index}.`);
  }

  return value;
}
