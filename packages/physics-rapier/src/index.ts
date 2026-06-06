import RAPIER from "@dimforge/rapier3d-compat";
import {
  collectUnsupportedPhysicsCommandFeatures,
  createPhysicsAabbDebugLines,
  physicsBodyCommandHasUnsupportedSyncFeature,
  physicsJointCommandHasUnsupportedSyncFeature,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
  RAPIER_PHYSICS_BACKEND_CAPABILITIES,
  createPhysicsRayProbeDebugLines,
  type PhysicsAabb,
  type PhysicsBackend,
  type PhysicsBackendInit,
  type PhysicsBodyResult,
  type PhysicsCharacterCollision,
  type PhysicsCharacterControllerSettings,
  type PhysicsCharacterMove,
  type PhysicsCharacterMoveResult,
  type PhysicsColliderDescriptor,
  type PhysicsCommand,
  type PhysicsCommandBuffer,
  type PhysicsDebugGeometry,
  type PhysicsDebugLine,
  type PhysicsDebugOptions,
  type PhysicsEvent,
  type PhysicsEventKind,
  type PhysicsExecutionMode,
  type PhysicsJointDescriptor,
  type PhysicsOverlapHit,
  type PhysicsPointProjection,
  type PhysicsQueryOptions,
  type PhysicsQuat,
  type PhysicsRay,
  type PhysicsRaycastHit,
  type PhysicsReadbackReport,
  type PhysicsResultBuffer,
  type PhysicsShape,
  type PhysicsShapeCast,
  type PhysicsShapeCastHit,
  type PhysicsStepReport,
  type PhysicsSyncReport,
  type PhysicsTransform,
  type PhysicsVelocityValue,
  type PhysicsVec3,
} from "@aperture-engine/physics";

interface RapierBodyEntry {
  readonly entity: string;
  body: RAPIER.RigidBody;
  colliders: readonly RapierColliderEntry[];
  bodyType: PhysicsRigidBodyType;
  colliderKey: string;
  canSleep: boolean;
  lockTranslations: readonly [boolean, boolean, boolean];
  lockRotations: readonly [boolean, boolean, boolean];
}

interface RapierColliderEntry {
  readonly entity: string;
  readonly collider: RAPIER.Collider;
  readonly descriptor: PhysicsColliderDescriptor;
}

interface RapierColliderMatch {
  readonly body: RapierBodyEntry;
  readonly collider: RapierColliderEntry;
}

interface RapierJointEntry {
  readonly entity: string;
  readonly bodyARef: string;
  readonly bodyBRef: string;
  readonly descriptor: PhysicsJointDescriptor;
  joint: RAPIER.ImpulseJoint;
  descriptorKey: string;
}

interface RapierEventPair {
  readonly key: string;
  readonly entityA: string;
  readonly entityB: string;
  readonly colliderA: string;
  readonly colliderB: string;
  readonly colliderAHandle: number;
  readonly colliderBHandle: number;
  readonly trigger: boolean;
}

interface RapierContactManifold {
  normal(): { readonly x: number; readonly y: number; readonly z: number };
  numSolverContacts(): number;
  solverContactPoint(index: number): {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

interface RapierContactEventData {
  readonly point: PhysicsVec3;
  readonly normal: PhysicsVec3;
}

export interface RapierPhysicsBackendOptions {
  readonly gravity?: PhysicsVec3;
  readonly execution?: PhysicsExecutionMode;
}

export function createRapierPhysicsBackend(
  options: RapierPhysicsBackendOptions = {},
): PhysicsBackend {
  const gravity = options.gravity ?? [0, -9.81, 0];
  let execution = options.execution ?? "simulation-worker";
  const bodies = new Map<string, RapierBodyEntry>();
  const joints = new Map<string, RapierJointEntry>();
  const activePairs = new Map<string, RapierEventPair>();
  let pendingEvents: PhysicsEvent[] = [];
  let world: RAPIER.World | null = null;
  let eventQueue: RAPIER.EventQueue | null = null;
  let initialized = false;
  let lastEventCount = 0;
  let queryCount = 0;
  let syncToBackendMs = 0;
  let backendStepMs = 0;
  let writebackMs = 0;

  return {
    kind: "rapier",
    version: "0.19.3",
    build: "performance",
    capabilities: RAPIER_PHYSICS_BACKEND_CAPABILITIES,
    get execution() {
      return execution;
    },
    async init(initOptions: PhysicsBackendInit = {}) {
      await RAPIER.init({});
      const nextGravity = initOptions.gravity ?? gravity;
      execution = initOptions.execution ?? execution;
      world = new RAPIER.World(vec(nextGravity));
      eventQueue = new RAPIER.EventQueue(true);
      initialized = true;
    },
    dispose() {
      bodies.clear();
      joints.clear();
      activePairs.clear();
      pendingEvents = [];
      eventQueue?.free();
      eventQueue = null;
      world?.free();
      world = null;
      initialized = false;
      lastEventCount = 0;
      queryCount = 0;
    },
    sync(buffer: PhysicsCommandBuffer): PhysicsSyncReport {
      const start = performanceNow();
      const rapierWorld = requireWorld(world, initialized);
      const unsupportedFeatures = collectUnsupportedPhysicsCommandFeatures(
        "rapier",
        buffer,
      );

      for (const command of buffer.commands) {
        switch (command.kind) {
          case "setGravity":
            rapierWorld.gravity = vec(command.gravity);
            break;
          case "upsertBody":
            if (physicsBodyCommandHasUnsupportedSyncFeature(command)) {
              destroyBody(rapierWorld, bodies, joints, command.entity);
            } else {
              upsertBody(rapierWorld, bodies, joints, command);
            }
            break;
          case "destroyBody":
            destroyBody(rapierWorld, bodies, joints, command.entity);
            break;
          case "upsertJoint":
            if (
              physicsJointCommandHasUnsupportedSyncFeature(
                "rapier",
                command.joint,
              )
            ) {
              destroyJoint(rapierWorld, joints, command.entity);
            } else {
              upsertJoint(rapierWorld, bodies, joints, command);
            }
            break;
          case "destroyJoint":
            destroyJoint(rapierWorld, joints, command.entity);
            break;
          case "setVelocity":
            setVelocity(bodies.get(command.entity), command.velocity);
            break;
          case "emitTrigger":
            break;
        }
      }

      syncToBackendMs = performanceNow() - start;

      return {
        commandCount: buffer.commands.length,
        bodyCount: bodies.size,
        colliderCount: colliderCount(bodies),
        jointCount: joints.size,
        unsupportedFeatureCount: unsupportedFeatures.length,
        unsupportedFeatures,
      };
    },
    step(fixedDelta: number, fixedStepIndex: number): PhysicsStepReport {
      const start = performanceNow();
      const rapierWorld = requireWorld(world, initialized);
      const rapierEvents = requireEventQueue(eventQueue, initialized);

      rapierWorld.timestep = fixedDelta;
      rapierWorld.step(rapierEvents);
      pendingEvents = collectRapierEvents({
        world: rapierWorld,
        eventQueue: rapierEvents,
        bodies,
        activePairs,
        fixedStep: fixedStepIndex,
        fixedDelta,
      });
      lastEventCount = pendingEvents.length;
      backendStepMs = performanceNow() - start;

      return {
        enabled: true,
        backend: "rapier",
        backendVersion: "0.19.3",
        backendBuild: "performance",
        execution,
        fixedDelta,
        fixedStep: fixedStepIndex,
        bodyCount: bodies.size,
        colliderCount: colliderCount(bodies),
        jointCount: joints.size,
        eventCount: lastEventCount,
        queryCount,
        syncToBackendMs,
        backendStepMs,
        writebackMs,
      };
    },
    readResults(out: PhysicsResultBuffer): PhysicsReadbackReport {
      const start = performanceNow();

      out.bodies.length = 0;
      out.events.length = 0;

      for (const entry of [...bodies.values()].sort((a, b) =>
        a.entity.localeCompare(b.entity),
      )) {
        out.bodies.push(bodyResult(entry));
      }
      out.events.push(...pendingEvents);
      pendingEvents = [];

      writebackMs = performanceNow() - start;

      return {
        bodyCount: out.bodies.length,
        eventCount: out.events.length,
      };
    },
    raycastFirst(
      ray: PhysicsRay,
      options?: PhysicsQueryOptions,
    ): PhysicsRaycastHit | null {
      return this.raycastAll(ray, options)[0] ?? null;
    },
    raycastAll(
      ray: PhysicsRay,
      options: PhysicsQueryOptions = {},
    ): readonly PhysicsRaycastHit[] {
      const rapierWorld = requireWorld(world, initialized);
      const rapierRay = new RAPIER.Ray(vec(ray.origin), vec(ray.direction));
      const maxToi = ray.maxDistance ?? Number.POSITIVE_INFINITY;
      const hits: PhysicsRaycastHit[] = [];

      queryCount += 1;
      rapierWorld.intersectionsWithRay(
        rapierRay,
        maxToi,
        true,
        (intersection: RAPIER.RayColliderIntersection) => {
          const collider = intersection.collider;
          const match = colliderMatchForCollider(bodies, collider);

          if (
            match === null ||
            !queryAllowsCollider(match.body, match.collider, options)
          ) {
            return true;
          }

          const point = rapierRay.pointAt(intersection.timeOfImpact);
          const normal = intersection.normal;

          hits.push({
            entity: match.body.entity,
            collider: match.collider.entity,
            point: [point.x, point.y, point.z],
            normal: [normal.x, normal.y, normal.z],
            distance: intersection.timeOfImpact,
          });

          return true;
        },
        options.includeSensors === true
          ? undefined
          : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        queryFilterGroups(options),
        undefined,
        undefined,
        undefined,
      );

      return hits.sort(
        (a, b) =>
          a.distance - b.distance ||
          a.entity.localeCompare(b.entity) ||
          (a.collider ?? "").localeCompare(b.collider ?? ""),
      );
    },
    overlapShape(
      shape: PhysicsShape,
      transform: PhysicsTransform,
      options: PhysicsQueryOptions = {},
    ): readonly PhysicsOverlapHit[] {
      const rapierWorld = requireWorld(world, initialized);
      const rapierShape = queryShape(shape);
      const rotation = queryShapeRotation(transform.rotation, shape);
      const hits: PhysicsOverlapHit[] = [];

      queryCount += 1;
      rapierWorld.intersectionsWithShape(
        vec(transform.translation),
        quat(rotation),
        rapierShape,
        (collider: RAPIER.Collider) => {
          const match = colliderMatchForCollider(bodies, collider);

          if (
            match === null ||
            !queryAllowsCollider(match.body, match.collider, options)
          ) {
            return true;
          }

          hits.push({
            entity: match.body.entity,
            collider: match.collider.entity,
          });

          return true;
        },
        options.includeSensors === true
          ? undefined
          : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        queryFilterGroups(options),
        undefined,
        undefined,
        undefined,
      );

      return hits.sort(
        (a, b) =>
          a.entity.localeCompare(b.entity) ||
          (a.collider ?? "").localeCompare(b.collider ?? ""),
      );
    },
    castShapeFirst(
      shape: PhysicsShape,
      cast: PhysicsShapeCast,
      options: PhysicsQueryOptions = {},
    ): PhysicsShapeCastHit | null {
      if (options.excludeEntity !== undefined) {
        queryCount += 1;
        return castShapeFirstByCollider(bodies, shape, cast, options);
      }

      const rapierWorld = requireWorld(world, initialized);
      const rotation = queryShapeRotation(cast.from.rotation, shape);
      const rapierHit = rapierWorld.castShape(
        vec(cast.from.translation),
        quat(rotation),
        vec(subtractVec3(cast.to.translation, cast.from.translation)),
        queryShape(shape),
        0,
        1,
        true,
        queryFilterFlags(options),
        queryFilterGroups(options),
        undefined,
        undefined,
        undefined,
      );

      queryCount += 1;

      if (rapierHit === null) {
        return null;
      }

      try {
        const match = colliderMatchForCollider(bodies, rapierHit.collider);

        if (
          match === null ||
          !queryAllowsCollider(match.body, match.collider, options)
        ) {
          return null;
        }

        const point = colliderLocalPointToWorld(
          rapierHit.collider,
          rapierHit.witness1,
        );
        const normal = normalizeVec3(
          colliderLocalVectorToWorld(rapierHit.collider, rapierHit.normal1),
        );

        return {
          entity: match.body.entity,
          collider: match.collider.entity,
          timeOfImpact: rapierHit.time_of_impact,
          point,
          normal,
        };
      } finally {
        freeRapierObject(rapierHit);
      }
    },
    projectPoint(
      point: PhysicsVec3,
      options: PhysicsQueryOptions = {},
    ): PhysicsPointProjection | null {
      if (options.excludeEntity !== undefined) {
        queryCount += 1;
        return projectPointByCollider(bodies, point, options);
      }

      const rapierWorld = requireWorld(world, initialized);
      const projection = rapierWorld.projectPoint(
        vec(point),
        false,
        queryFilterFlags(options),
        queryFilterGroups(options),
        undefined,
        undefined,
        undefined,
      );

      queryCount += 1;

      if (projection === null) {
        return null;
      }

      try {
        const match = colliderMatchForCollider(bodies, projection.collider);

        if (
          match === null ||
          !queryAllowsCollider(match.body, match.collider, options)
        ) {
          return null;
        }

        const projectedPoint = vec3(projection.point);

        return {
          entity: match.body.entity,
          collider: match.collider.entity,
          point: projectedPoint,
          normal: normalizeVec3(subtractVec3(point, projectedPoint)),
          distance: distanceVec3(point, projectedPoint),
          inside: projection.isInside,
        };
      } finally {
        freeRapierObject(projection);
      }
    },
    moveCharacter(
      move: PhysicsCharacterMove,
    ): PhysicsCharacterMoveResult | null {
      const rapierWorld = requireWorld(world, initialized);
      const entry = bodies.get(move.entity);
      const characterCollider =
        entry === undefined ? null : primaryCollider(entry);

      if (entry === undefined || characterCollider === null) {
        return null;
      }

      const options: PhysicsQueryOptions = move.options ?? {};
      const filterPredicate =
        options.excludeEntity === undefined ||
        options.excludeEntity === move.entity
          ? undefined
          : (collider: RAPIER.Collider) =>
              characterFilterAllowsCollider(bodies, collider, options);
      const controller = rapierWorld.createCharacterController(
        finitePositive(move.settings?.offset, 0.01),
      );

      queryCount += 1;

      try {
        configureCharacterController(controller, move.settings);
        controller.computeColliderMovement(
          characterCollider.collider,
          vec(move.desiredTranslation),
          queryFilterFlags(options),
          queryFilterGroups(options),
          filterPredicate,
        );

        const movement = vec3(controller.computedMovement());
        const currentTranslation = vec3(entry.body.translation());
        const targetTranslation = addVec3(currentTranslation, movement);

        if (entry.body.isKinematic()) {
          entry.body.setNextKinematicTranslation(vec(targetTranslation));
        } else {
          entry.body.setTranslation(vec(targetTranslation), true);
        }

        return {
          entity: move.entity,
          desiredTranslation: cloneVec3(move.desiredTranslation),
          movement,
          targetTranslation,
          grounded: controller.computedGrounded(),
          collisions: characterCollisions(controller, bodies),
        };
      } finally {
        rapierWorld.removeCharacterController(controller);
      }
    },
    sleepBody(entity: string): boolean {
      const entry = bodies.get(entity);

      if (entry === undefined) {
        return false;
      }

      entry.body.sleep();
      return true;
    },
    wakeBody(entity: string): boolean {
      const entry = bodies.get(entity);

      if (entry === undefined) {
        return false;
      }

      entry.body.wakeUp();
      return true;
    },
    debugGeometry(options: PhysicsDebugOptions = {}): PhysicsDebugGeometry {
      const rapierWorld = requireWorld(world, initialized);
      const lines: PhysicsDebugLine[] = [];

      if (options.colliderWireframes === true) {
        lines.push(
          ...debugGeometryFromRapierBuffers(rapierWorld.debugRender()).lines,
        );
      }
      if (options.contactNormals === true) {
        lines.push(...contactNormalDebugLines(rapierWorld, bodies, options));
      }
      if (options.bodyStateMarkers === true) {
        lines.push(...bodyStateDebugLines(bodies, options));
      }
      if (options.broadphaseAabbs === true) {
        lines.push(...broadphaseAabbDebugLines(bodies, options));
      }
      if (options.jointFrames === true) {
        lines.push(...jointFrameDebugLines(bodies, joints, options));
      }
      lines.push(
        ...createPhysicsRayProbeDebugLines(options.rayProbes, (ray, query) =>
          this.raycastFirst(ray, query),
        ),
      );

      return { lines };
    },
  };
}

function debugGeometryFromRapierBuffers(buffers: {
  readonly vertices: Float32Array;
  readonly colors: Float32Array;
}): PhysicsDebugGeometry {
  const lines: PhysicsDebugLine[] = [];

  for (let vertex = 0; vertex + 5 < buffers.vertices.length; vertex += 6) {
    const color = colorForDebugVertex(buffers.colors, vertex / 3);

    lines.push({
      from: [
        buffers.vertices[vertex] ?? 0,
        buffers.vertices[vertex + 1] ?? 0,
        buffers.vertices[vertex + 2] ?? 0,
      ],
      to: [
        buffers.vertices[vertex + 3] ?? 0,
        buffers.vertices[vertex + 4] ?? 0,
        buffers.vertices[vertex + 5] ?? 0,
      ],
      color,
    });
  }

  return { lines };
}

function broadphaseAabbDebugLines(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  return createPhysicsAabbDebugLines(
    [...bodies.values()]
      .sort((a, b) => a.entity.localeCompare(b.entity))
      .flatMap((entry) =>
        entry.colliders.map((collider) => ({ entry, collider })),
      )
      .map(({ entry, collider }) => colliderAabb(entry, collider))
      .filter((aabb): aabb is PhysicsAabb => aabb !== null),
    options.broadphaseAabbColor,
  ).filter(isFiniteLine);
}

function colliderAabb(
  _entry: RapierBodyEntry,
  colliderEntry: RapierColliderEntry,
): PhysicsAabb | null {
  const localHalfExtents = colliderLocalHalfExtents(
    colliderEntry.descriptor.shape,
  );

  if (localHalfExtents === null) {
    return null;
  }

  const center = vec3(colliderEntry.collider.translation());
  const rotation = quatFromRapierRotation(colliderEntry.collider.rotation());
  const halfExtents = rotatedAabbHalfExtents(localHalfExtents, rotation);

  return {
    min: subtractVec3(center, halfExtents),
    max: addVec3(center, halfExtents),
  };
}

function colliderLocalHalfExtents(shape: PhysicsShape): PhysicsVec3 | null {
  switch (shape.kind) {
    case "box":
      return cloneVec3(shape.halfExtents);
    case "sphere":
      return [shape.radius, shape.radius, shape.radius];
    case "capsule":
      return [shape.radius, shape.halfHeight + shape.radius, shape.radius];
    case "cylinder":
    case "cone":
      return [shape.radius, shape.halfHeight, shape.radius];
    case "convexHull":
    case "trimesh":
    case "heightfield":
      return null;
  }
}

function rotatedAabbHalfExtents(
  localHalfExtents: PhysicsVec3,
  rotation: PhysicsQuat,
): PhysicsVec3 {
  const normalized = normalizeQuat(rotation);
  const basisX = rotateVec3ByQuat([1, 0, 0], normalized);
  const basisY = rotateVec3ByQuat([0, 1, 0], normalized);
  const basisZ = rotateVec3ByQuat([0, 0, 1], normalized);

  return [
    Math.abs(basisX[0]) * localHalfExtents[0] +
      Math.abs(basisY[0]) * localHalfExtents[1] +
      Math.abs(basisZ[0]) * localHalfExtents[2],
    Math.abs(basisX[1]) * localHalfExtents[0] +
      Math.abs(basisY[1]) * localHalfExtents[1] +
      Math.abs(basisZ[1]) * localHalfExtents[2],
    Math.abs(basisX[2]) * localHalfExtents[0] +
      Math.abs(basisY[2]) * localHalfExtents[1] +
      Math.abs(basisZ[2]) * localHalfExtents[2],
  ];
}

function contactNormalDebugLines(
  world: RAPIER.World,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const lines: PhysicsDebugLine[] = [];
  const entries = colliderEntries(bodies);
  const length = finitePositive(options.contactNormalLength, 0.35);
  const color = options.contactNormalColor ?? [1, 0.2, 0.12, 1];

  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const leftEntry = entries[left];
      const rightEntry = entries[right];

      if (
        leftEntry === undefined ||
        rightEntry === undefined ||
        leftEntry.body.entity === rightEntry.body.entity
      ) {
        continue;
      }

      world.contactPair(
        leftEntry.collider.collider,
        rightEntry.collider.collider,
        (manifold: RapierContactManifold, flipped: boolean) => {
          const rawNormal = manifold.normal();
          const normal: PhysicsVec3 = flipped
            ? [-rawNormal.x, -rawNormal.y, -rawNormal.z]
            : [rawNormal.x, rawNormal.y, rawNormal.z];

          for (
            let contactIndex = 0;
            contactIndex < manifold.numSolverContacts();
            contactIndex += 1
          ) {
            const rawPoint = manifold.solverContactPoint(contactIndex);
            const point: PhysicsVec3 = [rawPoint.x, rawPoint.y, rawPoint.z];
            const line = {
              from: point,
              to: addScaledVec3(point, normal, length),
              color,
            };

            if (isFiniteLine(line)) {
              lines.push(line);
            }
          }
        },
      );
    }
  }

  return lines;
}

function bodyStateDebugLines(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const length = finitePositive(options.bodyStateMarkerLength, 0.25);
  const activeColor = options.activeBodyColor ?? [0.2, 1, 0.45, 1];
  const sleepingColor = options.sleepingBodyColor ?? [0.65, 0.7, 0.78, 1];

  return [...bodies.values()]
    .sort((a, b) => a.entity.localeCompare(b.entity))
    .map((entry) => {
      const translation = entry.body.translation();
      const from: PhysicsVec3 = [translation.x, translation.y, translation.z];

      return {
        from,
        to: addScaledVec3(from, [0, 1, 0], length),
        color: entry.body.isSleeping() ? sleepingColor : activeColor,
      };
    })
    .filter(isFiniteLine);
}

function jointFrameDebugLines(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  joints: ReadonlyMap<string, RapierJointEntry>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const lines: PhysicsDebugLine[] = [];
  const frameColor = options.jointFrameColor ?? [0.9, 0.45, 1, 1];
  const axisColor = options.jointAxisColor ?? [0.2, 0.95, 1, 1];
  const basisColors = fixedJointFrameBasisColors();
  const axisLength = finitePositive(options.jointFrameLength, 0.4);

  for (const entry of [...joints.values()].sort((a, b) =>
    a.entity.localeCompare(b.entity),
  )) {
    const bodyA = bodies.get(entry.bodyARef);
    const bodyB = bodies.get(entry.bodyBRef);

    if (bodyA === undefined || bodyB === undefined) {
      continue;
    }

    const anchorA = bodyLocalPointToWorld(bodyA.body, entry.descriptor.anchorA);
    const anchorB = bodyLocalPointToWorld(bodyB.body, entry.descriptor.anchorB);
    const axis = normalizeVec3(
      bodyLocalVectorToWorld(bodyA.body, jointAxis(entry.descriptor)),
    );

    lines.push({
      from: anchorA,
      to: anchorB,
      color: frameColor,
    });
    lines.push({
      from: anchorA,
      to: addScaledVec3(anchorA, axis, axisLength),
      color: axisColor,
    });

    if (entry.descriptor.kind === "fixed") {
      lines.push(
        ...fixedJointFrameBasisDebugLines(
          bodyA.body,
          anchorA,
          quatFromRapierRotation(entry.joint.frameX1()),
          axisLength,
          basisColors,
        ),
        ...fixedJointFrameBasisDebugLines(
          bodyB.body,
          anchorB,
          quatFromRapierRotation(entry.joint.frameX2()),
          axisLength,
          basisColors,
        ),
      );
    }
  }

  return lines.filter(isFiniteLine);
}

function fixedJointFrameBasisDebugLines(
  body: RAPIER.RigidBody,
  anchor: PhysicsVec3,
  frame: PhysicsQuat,
  length: number,
  colors: readonly PhysicsDebugLine["color"][],
): PhysicsDebugLine[] {
  const basis: readonly PhysicsVec3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  return basis.map((axis, index) => {
    const localAxis = rotateVec3ByQuat(axis, normalizeQuat(frame));
    const worldAxis = normalizeVec3(bodyLocalVectorToWorld(body, localAxis));

    return {
      from: anchor,
      to: addScaledVec3(anchor, worldAxis, length),
      color: colors[index] ?? [1, 1, 1, 1],
    };
  });
}

function fixedJointFrameBasisColors(): readonly PhysicsDebugLine["color"][] {
  return [
    [1, 0.25, 0.25, 1],
    [0.35, 1, 0.35, 1],
    [0.25, 0.55, 1, 1],
  ];
}

function configureCharacterController(
  controller: RAPIER.KinematicCharacterController,
  settings: PhysicsCharacterControllerSettings | undefined,
): void {
  controller.setUp(vec(normalizeVec3(settings?.up ?? [0, 1, 0])));
  controller.setSlideEnabled(settings?.slide !== false);
  controller.setApplyImpulsesToDynamicBodies(
    settings?.applyImpulsesToDynamicBodies === true,
  );

  if (settings?.characterMass !== undefined) {
    controller.setCharacterMass(
      settings.characterMass === null ||
        !Number.isFinite(settings.characterMass)
        ? null
        : settings.characterMass,
    );
  }
  if (
    settings?.maxSlopeClimbAngle !== undefined &&
    Number.isFinite(settings.maxSlopeClimbAngle)
  ) {
    controller.setMaxSlopeClimbAngle(settings.maxSlopeClimbAngle);
  }
  if (
    settings?.minSlopeSlideAngle !== undefined &&
    Number.isFinite(settings.minSlopeSlideAngle)
  ) {
    controller.setMinSlopeSlideAngle(settings.minSlopeSlideAngle);
  }
  if (
    settings?.snapToGroundDistance !== undefined &&
    Number.isFinite(settings.snapToGroundDistance) &&
    settings.snapToGroundDistance > 0
  ) {
    controller.enableSnapToGround(settings.snapToGroundDistance);
  } else {
    controller.disableSnapToGround();
  }

  if (settings?.autostep !== undefined && settings.autostep !== false) {
    controller.enableAutostep(
      finitePositive(settings.autostep.maxHeight, 0.1),
      finitePositive(settings.autostep.minWidth, 0.1),
      settings.autostep.includeDynamicBodies === true,
    );
  } else {
    controller.disableAutostep();
  }
}

function characterCollisions(
  controller: RAPIER.KinematicCharacterController,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
): readonly PhysicsCharacterCollision[] {
  const collisions: PhysicsCharacterCollision[] = [];

  for (let index = 0; index < controller.numComputedCollisions(); index += 1) {
    const collision = controller.computedCollision(index);

    if (collision === null) {
      continue;
    }

    collisions.push({
      entity:
        collision.collider === null
          ? null
          : entityForCollider(bodies, collision.collider),
      translationDeltaApplied: vec3(collision.translationDeltaApplied),
      translationDeltaRemaining: vec3(collision.translationDeltaRemaining),
      timeOfImpact: collision.toi,
      point: vec3(collision.witness1),
      normal: normalizeVec3(vec3(collision.normal1)),
    });
  }

  return collisions.sort(
    (left, right) =>
      left.timeOfImpact - right.timeOfImpact ||
      (left.entity ?? "").localeCompare(right.entity ?? ""),
  );
}

function characterFilterAllowsCollider(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  collider: RAPIER.Collider,
  options: PhysicsQueryOptions,
): boolean {
  const entry = colliderMatchForHandle(bodies, collider.handle);

  return (
    entry !== null && queryAllowsCollider(entry.body, entry.collider, options)
  );
}

function addScaledVec3(
  origin: PhysicsVec3,
  direction: PhysicsVec3,
  scale: number,
): PhysicsVec3 {
  return [
    origin[0] + direction[0] * scale,
    origin[1] + direction[1] * scale,
    origin[2] + direction[2] * scale,
  ];
}

function addVec3(left: PhysicsVec3, right: PhysicsVec3): PhysicsVec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function cloneVec3(value: PhysicsVec3): PhysicsVec3 {
  return [value[0], value[1], value[2]];
}

function subtractVec3(left: PhysicsVec3, right: PhysicsVec3): PhysicsVec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function distanceVec3(left: PhysicsVec3, right: PhysicsVec3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function normalizeVec3(value: PhysicsVec3): PhysicsVec3 {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length === 0) {
    return [0, 1, 0];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function vec3(value: RAPIER.Vector): PhysicsVec3 {
  return [value.x, value.y, value.z];
}

function colliderLocalPointToWorld(
  collider: RAPIER.Collider,
  point: RAPIER.Vector,
): PhysicsVec3 {
  const rotated = rotateVec3(vec3(point), collider.rotation());
  const translation = collider.translation();

  return [
    rotated[0] + translation.x,
    rotated[1] + translation.y,
    rotated[2] + translation.z,
  ];
}

function colliderLocalVectorToWorld(
  collider: RAPIER.Collider,
  value: RAPIER.Vector,
): PhysicsVec3 {
  return rotateVec3(vec3(value), collider.rotation());
}

function bodyLocalPointToWorld(
  body: RAPIER.RigidBody,
  point: PhysicsVec3,
): PhysicsVec3 {
  const rotated = bodyLocalVectorToWorld(body, point);
  const translation = body.translation();

  return [
    rotated[0] + translation.x,
    rotated[1] + translation.y,
    rotated[2] + translation.z,
  ];
}

function bodyLocalVectorToWorld(
  body: RAPIER.RigidBody,
  value: PhysicsVec3,
): PhysicsVec3 {
  return rotateVec3(value, body.rotation());
}

function rotateVec3(
  value: PhysicsVec3,
  rotation: RAPIER.Rotation,
): PhysicsVec3 {
  return rotateVec3ByQuat(value, [
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  ]);
}

function rotateVec3ByQuat(
  value: PhysicsVec3,
  rotation: PhysicsQuat,
): PhysicsVec3 {
  const qx = rotation[0];
  const qy = rotation[1];
  const qz = rotation[2];
  const qw = rotation[3];
  const x = value[0];
  const y = value[1];
  const z = value[2];
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function normalizeQuat(value: PhysicsQuat): PhysicsQuat {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);

  if (!Number.isFinite(length) || length === 0) {
    return [0, 0, 0, 1];
  }

  return [
    value[0] / length,
    value[1] / length,
    value[2] / length,
    value[3] / length,
  ];
}

function multiplyQuat(left: PhysicsQuat, right: PhysicsQuat): PhysicsQuat {
  const leftNormalized = normalizeQuat(left);
  const rightNormalized = normalizeQuat(right);
  const lx = leftNormalized[0];
  const ly = leftNormalized[1];
  const lz = leftNormalized[2];
  const lw = leftNormalized[3];
  const rx = rightNormalized[0];
  const ry = rightNormalized[1];
  const rz = rightNormalized[2];
  const rw = rightNormalized[3];

  return normalizeQuat([
    lw * rx + lx * rw + ly * rz - lz * ry,
    lw * ry - lx * rz + ly * rw + lz * rx,
    lw * rz + lx * ry - ly * rx + lz * rw,
    lw * rw - lx * rx - ly * ry - lz * rz,
  ]);
}

function isFiniteLine(line: PhysicsDebugLine): boolean {
  return (
    line.from.every(Number.isFinite) &&
    line.to.every(Number.isFinite) &&
    line.color.every(Number.isFinite)
  );
}

function colorForDebugVertex(
  colors: Float32Array,
  vertexIndex: number,
): PhysicsDebugLine["color"] {
  const offset = vertexIndex * 4;

  return [
    colors[offset] ?? 1,
    colors[offset + 1] ?? 1,
    colors[offset + 2] ?? 1,
    colors[offset + 3] ?? 1,
  ];
}

function upsertBody(
  world: RAPIER.World,
  bodies: Map<string, RapierBodyEntry>,
  joints: Map<string, RapierJointEntry>,
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): void {
  const bodyType = command.bodyType ?? PhysicsRigidBodyType.Dynamic;
  const colliderDescriptors = collidersForCommand(command);
  const colliderKey = colliderKeyFor(colliderDescriptors);
  const canSleep = command.canSleep !== false;
  const existing = bodies.get(command.entity);

  if (
    existing !== undefined &&
    existing.bodyType === bodyType &&
    existing.colliderKey === colliderKey &&
    existing.canSleep === canSleep
  ) {
    updateBodyLocks(existing, command);
    updateBody(existing.body, command);
    setVelocity(existing, command.velocity);
    configureBody(existing.body, command);
    applyExternalEffects(existing, command);
    return;
  }

  if (existing !== undefined) {
    destroyBody(world, bodies, joints, command.entity);
  }

  const body = world.createRigidBody(bodyDesc(command, bodyType));
  const colliders = colliderDescriptors.map((descriptor, index) => ({
    entity:
      descriptor.entity ??
      (index === 0 ? command.entity : `${command.entity}#${index}`),
    collider: world.createCollider(colliderDesc(descriptor), body),
    descriptor,
  }));

  const entry: RapierBodyEntry = {
    entity: command.entity,
    body,
    colliders,
    bodyType,
    colliderKey,
    canSleep,
    lockTranslations: locksOrDefault(command.lockTranslations),
    lockRotations: locksOrDefault(command.lockRotations),
  };

  bodies.set(command.entity, entry);
  updateBody(body, command);
  setVelocity(entry, command.velocity);
  configureBody(body, command);
  applyExternalEffects(entry, command);
}

function destroyBody(
  world: RAPIER.World,
  bodies: Map<string, RapierBodyEntry>,
  joints: Map<string, RapierJointEntry>,
  entity: string,
): void {
  const entry = bodies.get(entity);

  if (entry === undefined) {
    return;
  }

  destroyJointsForBody(world, joints, entity);
  world.removeRigidBody(entry.body);
  bodies.delete(entity);
}

function upsertJoint(
  world: RAPIER.World,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  joints: Map<string, RapierJointEntry>,
  command: Extract<PhysicsCommand, { readonly kind: "upsertJoint" }>,
): void {
  const descriptor = command.joint;
  const bodyA = bodies.get(descriptor.bodyARef);
  const bodyB = bodies.get(descriptor.bodyBRef);

  if (bodyA === undefined || bodyB === undefined) {
    destroyJoint(world, joints, command.entity);
    return;
  }

  const descriptorKey = JSON.stringify(descriptor);
  const existing = joints.get(command.entity);

  if (existing !== undefined && existing.descriptorKey === descriptorKey) {
    return;
  }
  if (existing !== undefined) {
    destroyJoint(world, joints, command.entity);
  }

  const joint = world.createImpulseJoint(
    jointData(descriptor),
    bodyA.body,
    bodyB.body,
    true,
  );

  joint.setContactsEnabled(descriptor.contactsEnabled !== false);
  applyJointParameters(joint, descriptor);

  joints.set(command.entity, {
    entity: command.entity,
    bodyARef: descriptor.bodyARef,
    bodyBRef: descriptor.bodyBRef,
    descriptor,
    joint,
    descriptorKey,
  });
}

function destroyJoint(
  world: RAPIER.World,
  joints: Map<string, RapierJointEntry>,
  entity: string,
): void {
  const entry = joints.get(entity);

  if (entry === undefined) {
    return;
  }

  world.removeImpulseJoint(entry.joint, true);
  joints.delete(entity);
}

function destroyJointsForBody(
  world: RAPIER.World,
  joints: Map<string, RapierJointEntry>,
  bodyRef: string,
): void {
  for (const entry of [...joints.values()]) {
    if (entry.bodyARef === bodyRef || entry.bodyBRef === bodyRef) {
      destroyJoint(world, joints, entry.entity);
    }
  }
}

function bodyDesc(
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
  bodyType: PhysicsRigidBodyType,
): RAPIER.RigidBodyDesc {
  const desc = bodyDescForType(bodyType);
  const transform = command.transform;

  desc.setTranslation(...transform.translation);
  desc.setRotation(quat(transform.rotation));

  if (command.velocity !== undefined) {
    const velocity = maskedVelocityForCommand(command.velocity, command);

    desc.setLinvel(...velocity.linear);
    desc.setAngvel(vec(velocity.angular));
  }
  if (command.gravityScale !== undefined) {
    desc.setGravityScale(command.gravityScale);
  }
  if (command.linearDamping !== undefined) {
    desc.setLinearDamping(command.linearDamping);
  }
  if (command.angularDamping !== undefined) {
    desc.setAngularDamping(command.angularDamping);
  }
  if (command.canSleep !== undefined) {
    desc.setCanSleep(command.canSleep);
  }
  if (command.ccdEnabled !== undefined) {
    desc.setCcdEnabled(command.ccdEnabled);
  }
  if (command.lockTranslations !== undefined) {
    desc.enabledTranslations(
      !command.lockTranslations[0],
      !command.lockTranslations[1],
      !command.lockTranslations[2],
    );
  }
  if (command.lockRotations !== undefined) {
    desc.enabledRotations(
      !command.lockRotations[0],
      !command.lockRotations[1],
      !command.lockRotations[2],
    );
  }

  return desc;
}

function configureBody(
  body: RAPIER.RigidBody,
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): void {
  if (command.gravityScale !== undefined) {
    body.setGravityScale(command.gravityScale, false);
  }
  if (command.linearDamping !== undefined) {
    body.setLinearDamping(command.linearDamping);
  }
  if (command.angularDamping !== undefined) {
    body.setAngularDamping(command.angularDamping);
  }
  if (command.ccdEnabled !== undefined) {
    body.enableCcd(command.ccdEnabled);
  }
  if (command.lockTranslations !== undefined) {
    body.setEnabledTranslations(
      !command.lockTranslations[0],
      !command.lockTranslations[1],
      !command.lockTranslations[2],
      false,
    );
  }
  if (command.lockRotations !== undefined) {
    body.setEnabledRotations(
      !command.lockRotations[0],
      !command.lockRotations[1],
      !command.lockRotations[2],
      false,
    );
  }
}

function updateBodyLocks(
  entry: RapierBodyEntry,
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): void {
  entry.lockTranslations = locksOrDefault(command.lockTranslations);
  entry.lockRotations = locksOrDefault(command.lockRotations);
}

function bodyDescForType(bodyType: PhysicsRigidBodyType): RAPIER.RigidBodyDesc {
  switch (bodyType) {
    case PhysicsRigidBodyType.Static:
      return RAPIER.RigidBodyDesc.fixed();
    case PhysicsRigidBodyType.KinematicPosition:
      return RAPIER.RigidBodyDesc.kinematicPositionBased();
    case PhysicsRigidBodyType.KinematicVelocity:
      return RAPIER.RigidBodyDesc.kinematicVelocityBased();
    case PhysicsRigidBodyType.Dynamic:
      return RAPIER.RigidBodyDesc.dynamic();
  }
}

function updateBody(
  body: RAPIER.RigidBody,
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): void {
  const translation = vec(command.transform.translation);
  const rotation = quat(command.transform.rotation);
  const bodyType = command.bodyType ?? PhysicsRigidBodyType.Dynamic;
  const kinematicTarget = command.kinematicTarget ?? command.transform;

  if (bodyType === PhysicsRigidBodyType.KinematicPosition) {
    body.setNextKinematicTranslation(vec(kinematicTarget.translation));
    body.setNextKinematicRotation(quat(kinematicTarget.rotation));
  } else {
    body.setTranslation(translation, false);
    body.setRotation(rotation, false);
  }
}

function setVelocity(
  entry: RapierBodyEntry | undefined,
  velocity: PhysicsVelocityValue | undefined,
): void {
  if (entry === undefined || velocity === undefined) {
    return;
  }

  const maskedVelocity = {
    linear: maskLockedAxes(velocity.linear, entry.lockTranslations),
    angular: maskLockedAxes(velocity.angular, entry.lockRotations),
  };

  const wakeUp = velocityMagnitude(maskedVelocity) > 0;

  entry.body.setLinvel(vec(maskedVelocity.linear), wakeUp);
  entry.body.setAngvel(vec(maskedVelocity.angular), wakeUp);
}

function applyExternalEffects(
  entry: RapierBodyEntry | undefined,
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): void {
  if (entry === undefined || !entry.body.isDynamic()) {
    return;
  }

  if (command.externalForce !== undefined) {
    entry.body.addForce(
      vec(maskLockedAxes(command.externalForce.force, entry.lockTranslations)),
      true,
    );
    entry.body.addTorque(
      vec(maskLockedAxes(command.externalForce.torque, entry.lockRotations)),
      true,
    );
  }
  if (command.externalImpulse !== undefined) {
    entry.body.applyImpulse(
      vec(
        maskLockedAxes(command.externalImpulse.impulse, entry.lockTranslations),
      ),
      true,
    );
    entry.body.applyTorqueImpulse(
      vec(
        maskLockedAxes(
          command.externalImpulse.angularImpulse,
          entry.lockRotations,
        ),
      ),
      true,
    );
  }
}

function maskedVelocityForCommand(
  velocity: PhysicsVelocityValue,
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): PhysicsVelocityValue {
  return {
    linear: maskLockedAxes(velocity.linear, command.lockTranslations),
    angular: maskLockedAxes(velocity.angular, command.lockRotations),
  };
}

function locksOrDefault(
  locks: readonly [boolean, boolean, boolean] | undefined,
): readonly [boolean, boolean, boolean] {
  return locks ?? [false, false, false];
}

function maskLockedAxes(
  value: PhysicsVec3,
  locks: readonly [boolean, boolean, boolean] | undefined,
): PhysicsVec3 {
  if (locks === undefined) {
    return value;
  }

  return [
    locks[0] ? 0 : value[0],
    locks[1] ? 0 : value[1],
    locks[2] ? 0 : value[2],
  ];
}

function velocityMagnitude(velocity: PhysicsVelocityValue): number {
  return Math.hypot(
    velocity.linear[0],
    velocity.linear[1],
    velocity.linear[2],
    velocity.angular[0],
    velocity.angular[1],
    velocity.angular[2],
  );
}

function colliderDesc(
  collider: PhysicsColliderDescriptor,
): RAPIER.ColliderDesc {
  const shape = collider.shape;
  let desc: RAPIER.ColliderDesc;

  switch (shape.kind) {
    case "box":
      desc = RAPIER.ColliderDesc.cuboid(...shape.halfExtents);
      break;
    case "sphere":
      desc = RAPIER.ColliderDesc.ball(shape.radius);
      break;
    case "capsule":
      desc = RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius);
      break;
    case "cylinder":
      desc = RAPIER.ColliderDesc.cylinder(shape.halfHeight, shape.radius);
      break;
    case "cone":
      desc = RAPIER.ColliderDesc.cone(shape.halfHeight, shape.radius);
      break;
    case "convexHull":
    case "trimesh":
    case "heightfield":
      throw new Error(
        `Rapier backend does not support '${shape.kind}' colliders in this slice.`,
      );
  }

  if (collider.offsetTranslation !== undefined) {
    desc.setTranslation(...collider.offsetTranslation);
  }
  const rotation = colliderShapeRotation(collider);

  if (rotation !== null) {
    desc.setRotation(quat(rotation));
  }
  if (collider.sensor !== undefined) {
    desc.setSensor(collider.sensor);
  }
  if (collider.density !== undefined) {
    desc.setDensity(collider.density);
  }
  if (collider.friction !== undefined) {
    desc.setFriction(collider.friction);
  }
  if (collider.restitution !== undefined) {
    desc.setRestitution(collider.restitution);
  }
  if (collider.frictionCombine !== undefined) {
    desc.setFrictionCombineRule(
      coefficientCombineRule(collider.frictionCombine),
    );
  }
  if (collider.restitutionCombine !== undefined) {
    desc.setRestitutionCombineRule(
      coefficientCombineRule(collider.restitutionCombine),
    );
  }
  if (collider.collisionGroups !== undefined) {
    desc.setCollisionGroups(collider.collisionGroups);
  }
  if (collider.solverGroups !== undefined) {
    desc.setSolverGroups(collider.solverGroups);
  }
  desc.setActiveEvents(
    RAPIER.ActiveEvents.COLLISION_EVENTS |
      RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
  );
  desc.setContactForceEventThreshold(0);

  return desc;
}

function coefficientCombineRule(
  rule: PhysicsMaterialCombineRule,
): RAPIER.CoefficientCombineRule {
  switch (rule) {
    case PhysicsMaterialCombineRule.Average:
      return RAPIER.CoefficientCombineRule.Average;
    case PhysicsMaterialCombineRule.Min:
      return RAPIER.CoefficientCombineRule.Min;
    case PhysicsMaterialCombineRule.Multiply:
      return RAPIER.CoefficientCombineRule.Multiply;
    case PhysicsMaterialCombineRule.Max:
      return RAPIER.CoefficientCombineRule.Max;
  }
}

function jointData(descriptor: PhysicsJointDescriptor): RAPIER.JointData {
  switch (descriptor.kind) {
    case "fixed":
      return RAPIER.JointData.fixed(
        vec(descriptor.anchorA),
        quat(normalizeQuat(descriptor.frameA ?? [0, 0, 0, 1])),
        vec(descriptor.anchorB),
        quat(normalizeQuat(descriptor.frameB ?? [0, 0, 0, 1])),
      );
    case "spherical":
      return RAPIER.JointData.spherical(
        vec(descriptor.anchorA),
        vec(descriptor.anchorB),
      );
    case "revolute":
      return RAPIER.JointData.revolute(
        vec(descriptor.anchorA),
        vec(descriptor.anchorB),
        vec(jointAxis(descriptor)),
      );
    case "prismatic":
      return RAPIER.JointData.prismatic(
        vec(descriptor.anchorA),
        vec(descriptor.anchorB),
        vec(jointAxis(descriptor)),
      );
    case "distance":
      return RAPIER.JointData.rope(
        finitePositive(descriptor.maxLimit, 1),
        vec(descriptor.anchorA),
        vec(descriptor.anchorB),
      );
    case "generic":
      throw new Error(
        "Rapier backend does not support generic joints in this slice.",
      );
  }
}

function jointAxis(descriptor: PhysicsJointDescriptor): PhysicsVec3 {
  return normalizeVec3(
    rotateVec3ByQuat(
      descriptor.axis,
      normalizeQuat(descriptor.frameA ?? [0, 0, 0, 1]),
    ),
  );
}

function applyJointParameters(
  joint: RAPIER.ImpulseJoint,
  descriptor: PhysicsJointDescriptor,
): void {
  if (!isUnitImpulseJoint(joint)) {
    return;
  }

  const minLimit = descriptor.minLimit;
  const maxLimit = descriptor.maxLimit;

  if (
    minLimit !== undefined &&
    maxLimit !== undefined &&
    Number.isFinite(minLimit) &&
    Number.isFinite(maxLimit) &&
    maxLimit > minLimit
  ) {
    joint.setLimits(minLimit, maxLimit);
  }

  if (
    descriptor.motorModel === "force" &&
    typeof (joint as { readonly configureMotorModel?: unknown })
      .configureMotorModel === "function"
  ) {
    joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
  }

  if (descriptor.motorMode === "velocity") {
    const motorFactor = finiteNonNegative(
      descriptor.motorFactor ?? descriptor.motorDamping,
    );

    if (motorFactor > 0) {
      const motorVelocity =
        descriptor.motorVelocity !== undefined &&
        Number.isFinite(descriptor.motorVelocity)
          ? descriptor.motorVelocity
          : 0;

      joint.configureMotorVelocity(motorVelocity, motorFactor);
    }

    return;
  }

  const motorStiffness = finiteNonNegative(descriptor.motorStiffness);
  const motorDamping = finiteNonNegative(descriptor.motorDamping);

  if (motorStiffness > 0 || motorDamping > 0) {
    const motorTarget =
      descriptor.motorTarget !== undefined &&
      Number.isFinite(descriptor.motorTarget)
        ? descriptor.motorTarget
        : 0;
    const motorVelocity =
      descriptor.motorVelocity !== undefined &&
      Number.isFinite(descriptor.motorVelocity)
        ? descriptor.motorVelocity
        : undefined;

    if (motorVelocity !== undefined) {
      joint.configureMotor(
        motorTarget,
        motorVelocity,
        motorStiffness,
        motorDamping,
      );
    } else {
      joint.configureMotorPosition(motorTarget, motorStiffness, motorDamping);
    }
  }
}

function isUnitImpulseJoint(
  joint: RAPIER.ImpulseJoint,
): joint is RAPIER.UnitImpulseJoint {
  return (
    typeof (joint as { readonly setLimits?: unknown }).setLimits === "function"
  );
}

function queryShape(shape: PhysicsShape): RAPIER.Shape {
  switch (shape.kind) {
    case "box":
      return new RAPIER.Cuboid(...shape.halfExtents);
    case "sphere":
      return new RAPIER.Ball(shape.radius);
    case "capsule":
      return new RAPIER.Capsule(shape.halfHeight, shape.radius);
    case "cylinder":
      return new RAPIER.Cylinder(shape.halfHeight, shape.radius);
    case "cone":
      return new RAPIER.Cone(shape.halfHeight, shape.radius);
    case "convexHull":
    case "trimesh":
    case "heightfield":
      throw new Error(
        `Rapier backend does not support '${shape.kind}' overlap queries in this slice.`,
      );
  }
}

function colliderShapeRotation(
  collider: PhysicsColliderDescriptor,
): PhysicsQuat | null {
  const axisRotation = primitiveAxisRotation(collider.shape);

  if (collider.offsetRotation === undefined) {
    return axisRotation;
  }

  const offsetRotation = normalizeQuat(collider.offsetRotation);

  if (axisRotation === null) {
    return offsetRotation;
  }

  return multiplyQuat(offsetRotation, axisRotation);
}

function queryShapeRotation(
  rotation: PhysicsQuat,
  shape: PhysicsShape,
): PhysicsQuat {
  const axisRotation = primitiveAxisRotation(shape);
  const normalized = normalizeQuat(rotation);

  return axisRotation === null
    ? normalized
    : multiplyQuat(normalized, axisRotation);
}

function primitiveAxisRotation(shape: PhysicsShape): PhysicsQuat | null {
  switch (shape.kind) {
    case "capsule":
    case "cylinder":
    case "cone":
      switch (shape.axis) {
        case "x":
          return [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
        case "z":
          return [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
        case "y":
        case undefined:
          return null;
      }
      return null;
    case "box":
    case "sphere":
    case "convexHull":
    case "trimesh":
    case "heightfield":
      return null;
  }
}

function queryFilterFlags(
  options: PhysicsQueryOptions,
): RAPIER.QueryFilterFlags | undefined {
  return options.includeSensors === true
    ? undefined
    : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
}

function queryFilterGroups(options: PhysicsQueryOptions): number | undefined {
  return options.collisionGroups;
}

function castShapeFirstByCollider(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  shape: PhysicsShape,
  cast: PhysicsShapeCast,
  options: PhysicsQueryOptions,
): PhysicsShapeCastHit | null {
  const rapierShape = queryShape(shape);
  const shapeRotation = queryShapeRotation(cast.from.rotation, shape);
  const shapeVelocity = subtractVec3(
    cast.to.translation,
    cast.from.translation,
  );
  const hits: PhysicsShapeCastHit[] = [];

  for (const entry of bodies.values()) {
    for (const colliderEntry of entry.colliders) {
      if (!queryAllowsCollider(entry, colliderEntry, options)) {
        continue;
      }

      const hit = colliderEntry.collider.castShape(
        vec([0, 0, 0]),
        rapierShape,
        vec(cast.from.translation),
        quat(shapeRotation),
        vec(shapeVelocity),
        0,
        1,
        true,
      );

      if (hit === null) {
        continue;
      }

      hits.push({
        entity: entry.entity,
        collider: colliderEntry.entity,
        timeOfImpact: hit.time_of_impact,
        point: colliderLocalPointToWorld(colliderEntry.collider, hit.witness1),
        normal: normalizeVec3(
          colliderLocalVectorToWorld(colliderEntry.collider, hit.normal1),
        ),
      });
    }
  }

  return (
    hits.sort(
      (left, right) =>
        left.timeOfImpact - right.timeOfImpact ||
        left.entity.localeCompare(right.entity) ||
        (left.collider ?? "").localeCompare(right.collider ?? ""),
    )[0] ?? null
  );
}

function projectPointByCollider(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  point: PhysicsVec3,
  options: PhysicsQueryOptions,
): PhysicsPointProjection | null {
  const projections: PhysicsPointProjection[] = [];

  for (const entry of bodies.values()) {
    for (const colliderEntry of entry.colliders) {
      if (!queryAllowsCollider(entry, colliderEntry, options)) {
        continue;
      }

      const projection = colliderEntry.collider.projectPoint(vec(point), false);

      if (projection === null) {
        continue;
      }

      const projectedPoint = vec3(projection.point);

      projections.push({
        entity: entry.entity,
        collider: colliderEntry.entity,
        point: projectedPoint,
        normal: normalizeVec3(subtractVec3(point, projectedPoint)),
        distance: distanceVec3(point, projectedPoint),
        inside: projection.isInside,
      });
    }
  }

  return (
    projections.sort(
      (left, right) =>
        left.distance - right.distance ||
        left.entity.localeCompare(right.entity) ||
        (left.collider ?? "").localeCompare(right.collider ?? ""),
    )[0] ?? null
  );
}

function queryAllowsCollider(
  entry: RapierBodyEntry,
  colliderEntry: RapierColliderEntry,
  options: PhysicsQueryOptions,
): boolean {
  const collider = colliderEntry.collider;

  if (
    entry.entity === options.excludeEntity ||
    colliderEntry.entity === options.excludeEntity
  ) {
    return false;
  }
  if (collider.isSensor() && options.includeSensors !== true) {
    return false;
  }
  if (
    options.collisionGroups !== undefined &&
    !interactionGroupsCompatible(
      options.collisionGroups,
      collider.collisionGroups(),
    )
  ) {
    return false;
  }

  return true;
}

function interactionGroupsCompatible(query: number, collider: number): boolean {
  return ((query >>> 16) & collider) !== 0 && ((collider >>> 16) & query) !== 0;
}

function collectRapierEvents(options: {
  readonly world: RAPIER.World;
  readonly eventQueue: RAPIER.EventQueue;
  readonly bodies: ReadonlyMap<string, RapierBodyEntry>;
  readonly activePairs: Map<string, RapierEventPair>;
  readonly fixedStep: number;
  readonly fixedDelta: number;
}): PhysicsEvent[] {
  const events: PhysicsEvent[] = [];
  const changedPairs = new Set<string>();

  options.eventQueue.drainCollisionEvents(
    (handle1: number, handle2: number, started: boolean) => {
      const pair = eventPairForColliderHandles(
        options.bodies,
        handle1,
        handle2,
      );

      if (pair === null) {
        return;
      }

      changedPairs.add(pair.key);

      if (started) {
        options.activePairs.set(pair.key, pair);
        events.push(
          physicsEvent(
            pair,
            pair.trigger ? "triggerEnter" : "collisionStart",
            options.fixedStep,
            pair.trigger
              ? undefined
              : contactEventData(options.world, options.bodies, pair),
          ),
        );
        return;
      }

      const activePair = options.activePairs.get(pair.key) ?? pair;
      options.activePairs.delete(pair.key);
      events.push(
        physicsEvent(
          activePair,
          activePair.trigger ? "triggerExit" : "collisionEnd",
          options.fixedStep,
        ),
      );
    },
  );

  options.eventQueue.drainContactForceEvents(
    (forceEvent: RAPIER.TempContactForceEvent) => {
      const event = contactForcePhysicsEvent(
        forceEvent,
        options.bodies,
        options.fixedStep,
        options.fixedDelta,
      );

      if (event !== null) {
        events.push(event);
      }
    },
  );

  for (const pair of options.activePairs.values()) {
    if (!changedPairs.has(pair.key)) {
      events.push(
        physicsEvent(
          pair,
          pair.trigger ? "triggerStay" : "collisionStay",
          options.fixedStep,
          pair.trigger
            ? undefined
            : contactEventData(options.world, options.bodies, pair),
        ),
      );
    }
  }

  return events.sort(comparePhysicsEvents);
}

function eventPairForColliderHandles(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  handle1: number,
  handle2: number,
): RapierEventPair | null {
  const first = colliderMatchForHandle(bodies, handle1);
  const second = colliderMatchForHandle(bodies, handle2);

  if (first === null || second === null) {
    return null;
  }

  const [a, b] =
    compareColliderMatches(first, second) <= 0
      ? [first, second]
      : [second, first];

  return {
    key: `${a.body.entity}|${a.collider.entity}|${b.body.entity}|${b.collider.entity}`,
    entityA: a.body.entity,
    entityB: b.body.entity,
    colliderA: a.collider.entity,
    colliderB: b.collider.entity,
    colliderAHandle: a.collider.collider.handle,
    colliderBHandle: b.collider.collider.handle,
    trigger: a.collider.collider.isSensor() || b.collider.collider.isSensor(),
  };
}

function colliderMatchForHandle(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  handle: number,
): RapierColliderMatch | null {
  for (const entry of bodies.values()) {
    for (const collider of entry.colliders) {
      if (collider.collider.handle === handle) {
        return { body: entry, collider };
      }
    }
  }

  return null;
}

function compareColliderMatches(
  left: RapierColliderMatch,
  right: RapierColliderMatch,
): number {
  return (
    left.body.entity.localeCompare(right.body.entity) ||
    left.collider.entity.localeCompare(right.collider.entity)
  );
}

function physicsEvent(
  pair: RapierEventPair,
  kind: PhysicsEventKind,
  fixedStep: number,
  contact?: RapierContactEventData,
): PhysicsEvent {
  return {
    kind,
    frame: fixedStep,
    fixedStep,
    substep: 0,
    entityA: pair.entityA,
    entityB: pair.entityB,
    colliderA: pair.colliderA,
    colliderB: pair.colliderB,
    ...(contact === undefined
      ? {}
      : {
          point: contact.point,
          normal: contact.normal,
        }),
  };
}

function contactForcePhysicsEvent(
  event: RAPIER.TempContactForceEvent,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  fixedStep: number,
  fixedDelta: number,
): PhysicsEvent | null {
  const pair = eventPairForColliderHandles(
    bodies,
    event.collider1(),
    event.collider2(),
  );

  if (pair === null || pair.trigger) {
    return null;
  }

  const force = vec3(event.totalForce());
  const normal = normalizeVec3(vec3(event.maxForceDirection()));
  const forceMagnitude = event.totalForceMagnitude();
  const maxForceMagnitude = event.maxForceMagnitude();
  const impulse = forceMagnitude * fixedDelta;

  if (
    !force.every(Number.isFinite) ||
    !normal.every(Number.isFinite) ||
    !Number.isFinite(forceMagnitude) ||
    !Number.isFinite(maxForceMagnitude) ||
    !Number.isFinite(impulse)
  ) {
    return null;
  }

  return {
    ...physicsEvent(pair, "contactForce", fixedStep),
    normal,
    force,
    forceMagnitude,
    maxForceMagnitude,
    impulse,
  };
}

function contactEventData(
  world: RAPIER.World,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  pair: RapierEventPair,
): RapierContactEventData | undefined {
  const colliderA = colliderMatchForHandle(bodies, pair.colliderAHandle);
  const colliderB = colliderMatchForHandle(bodies, pair.colliderBHandle);

  if (colliderA === null || colliderB === null) {
    return undefined;
  }

  let contact: RapierContactEventData | undefined;

  world.contactPair(
    colliderA.collider.collider,
    colliderB.collider.collider,
    (manifold: RapierContactManifold, flipped: boolean) => {
      if (contact !== undefined) {
        return;
      }

      const rawNormal = manifold.normal();
      const normal: PhysicsVec3 = flipped
        ? [-rawNormal.x, -rawNormal.y, -rawNormal.z]
        : [rawNormal.x, rawNormal.y, rawNormal.z];

      for (
        let contactIndex = 0;
        contactIndex < manifold.numSolverContacts();
        contactIndex += 1
      ) {
        const rawPoint = manifold.solverContactPoint(contactIndex);
        const point: PhysicsVec3 = [rawPoint.x, rawPoint.y, rawPoint.z];
        const normalized = normalizeVec3(normal);

        if (point.every(Number.isFinite) && normalized.every(Number.isFinite)) {
          contact = {
            point,
            normal: normalized,
          };
          return;
        }
      }
    },
  );

  return contact;
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

function bodyResult(entry: RapierBodyEntry): PhysicsBodyResult {
  const translation = entry.body.translation();
  const rotation = entry.body.rotation();
  const linear = maskLockedAxes(
    vec3(entry.body.linvel()),
    entry.lockTranslations,
  );
  const angular = maskLockedAxes(
    vec3(entry.body.angvel()),
    entry.lockRotations,
  );

  return {
    entity: entry.entity,
    transform: {
      translation: [translation.x, translation.y, translation.z],
      rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
    },
    velocity: {
      linear,
      angular,
    },
    sleeping: entry.body.isSleeping(),
  };
}

function collidersForCommand(
  command: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): readonly PhysicsColliderDescriptor[] {
  return (
    command.colliders ??
    (command.collider === undefined ? [] : [command.collider])
  );
}

function primaryCollider(entry: RapierBodyEntry): RapierColliderEntry | null {
  return entry.colliders[0] ?? null;
}

function colliderCount(bodies: ReadonlyMap<string, RapierBodyEntry>): number {
  return [...bodies.values()].reduce(
    (total, entry) => total + entry.colliders.length,
    0,
  );
}

function colliderEntries(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
): readonly RapierColliderMatch[] {
  return [...bodies.values()]
    .sort((left, right) => left.entity.localeCompare(right.entity))
    .flatMap((body) =>
      body.colliders
        .slice()
        .sort((left, right) => left.entity.localeCompare(right.entity))
        .map((collider) => ({ body, collider })),
    );
}

function colliderMatchForCollider(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  collider: RAPIER.Collider,
): RapierColliderMatch | null {
  return colliderMatchForHandle(bodies, collider.handle);
}

function entityForCollider(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  collider: RAPIER.Collider,
): string | null {
  return colliderMatchForCollider(bodies, collider)?.body.entity ?? null;
}

function colliderKeyFor(
  colliders: readonly PhysicsColliderDescriptor[],
): string {
  return colliders.length === 0 ? "none" : JSON.stringify(colliders);
}

function requireWorld(
  world: RAPIER.World | null,
  initialized: boolean,
): RAPIER.World {
  if (!initialized || world === null) {
    throw new Error("Rapier physics backend must be initialized before use.");
  }

  return world;
}

function requireEventQueue(
  eventQueue: RAPIER.EventQueue | null,
  initialized: boolean,
): RAPIER.EventQueue {
  if (!initialized || eventQueue === null) {
    throw new Error("Rapier physics backend must be initialized before use.");
  }

  return eventQueue;
}

function freeRapierObject(value: unknown): void {
  const free = (value as { readonly free?: unknown }).free;

  if (typeof free === "function") {
    free.call(value);
  }
}

function vec(value: PhysicsVec3): RAPIER.Vector3 {
  return { x: value[0], y: value[1], z: value[2] };
}

function quat(
  value: readonly [number, number, number, number],
): RAPIER.Rotation {
  return { x: value[0], y: value[1], z: value[2], w: value[3] };
}

function quatFromRapierRotation(rotation: RAPIER.Rotation): PhysicsQuat {
  return [rotation.x, rotation.y, rotation.z, rotation.w];
}

function performanceNow(): number {
  return typeof performance === "undefined" ? 0 : performance.now();
}

function finitePositive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function finiteNonNegative(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}
