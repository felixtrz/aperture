import {
  collectUnsupportedPhysicsCommandFeatures,
  createPhysicsAabbDebugLines,
  createPhysicsRayProbeDebugLines,
  physicsBodyCommandHasUnsupportedSyncFeature,
  physicsJointCommandHasUnsupportedSyncFeature,
  TEST_PHYSICS_BACKEND_CAPABILITIES,
  type PhysicsBackend,
  type PhysicsBackendInit,
  type PhysicsAabb,
  type PhysicsBodyResult,
  type PhysicsCharacterMove,
  type PhysicsCharacterMoveResult,
  type PhysicsCommandBuffer,
  type PhysicsColliderDescriptor,
  type PhysicsDebugGeometry,
  type PhysicsDebugLine,
  type PhysicsDebugOptions,
  type PhysicsEvent,
  type PhysicsExecutionMode,
  type PhysicsExternalForceValue,
  type PhysicsExternalImpulseValue,
  type PhysicsJointDescriptor,
  type PhysicsPointProjection,
  type PhysicsQueryOptions,
  type PhysicsRay,
  type PhysicsRaycastHit,
  type PhysicsReadbackReport,
  type PhysicsResultBuffer,
  type PhysicsShapeCast,
  type PhysicsShapeCastHit,
  type PhysicsStepReport,
  type PhysicsSyncReport,
  type PhysicsTransform,
  type PhysicsVelocityValue,
} from "./backend.js";
import {
  PhysicsRigidBodyType,
  type PhysicsQuat,
  type PhysicsShape,
  type PhysicsVec3,
} from "./components.js";

interface TestBody {
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

interface TestCollider {
  readonly entity: string;
  radius: number;
  colliderOffsetTranslation: PhysicsVec3;
  sensor: boolean;
  collisionGroups: number;
}

interface TestJoint {
  readonly entity: string;
  descriptor: PhysicsJointDescriptor;
}

export interface TestPhysicsBackendOptions {
  readonly gravity?: PhysicsVec3;
  readonly execution?: PhysicsExecutionMode;
}

export function createTestPhysicsBackend(
  options: TestPhysicsBackendOptions = {},
): PhysicsBackend {
  const defaultGravity = cloneVec3(options.gravity ?? [0, 0, 0]);
  const bodies = new Map<string, TestBody>();
  const joints = new Map<string, TestJoint>();
  let initialized = false;
  let queryCount = 0;
  let events: PhysicsEvent[] = [];
  let pendingEvents: PhysicsEvent[] = [];
  let gravity = cloneVec3(defaultGravity);
  const execution = options.execution ?? "simulation-worker";

  return {
    kind: "test",
    version: "0.0.0-test",
    build: "test",
    execution,
    capabilities: TEST_PHYSICS_BACKEND_CAPABILITIES,
    init(initOptions: PhysicsBackendInit = {}) {
      gravity = cloneVec3(initOptions.gravity ?? defaultGravity);
      initialized = true;
    },
    dispose() {
      initialized = false;
      bodies.clear();
      joints.clear();
      events = [];
      pendingEvents = [];
      queryCount = 0;
      gravity = cloneVec3(defaultGravity);
    },
    sync(buffer: PhysicsCommandBuffer): PhysicsSyncReport {
      const unsupportedFeatures = collectUnsupportedPhysicsCommandFeatures(
        "test",
        buffer,
      );

      for (const command of buffer.commands) {
        switch (command.kind) {
          case "setGravity":
            gravity = cloneVec3(command.gravity);
            break;
          case "upsertBody":
            {
              if (physicsBodyCommandHasUnsupportedSyncFeature(command)) {
                destroyBody(command.entity);
                break;
              }

              const previous = bodies.get(command.entity);
              const velocity = cloneVelocity(
                command.velocity ?? zeroVelocity(),
              );

              bodies.set(command.entity, {
                entity: command.entity,
                bodyType: command.bodyType ?? PhysicsRigidBodyType.Dynamic,
                transform: cloneTransform(
                  kinematicTransformForCommand(command) ?? command.transform,
                ),
                velocity,
                externalForce: cloneExternalForce(
                  command.externalForce ?? zeroExternalForce(),
                ),
                pendingImpulse: cloneExternalImpulse(
                  command.externalImpulse ?? zeroExternalImpulse(),
                ),
                gravityScale: command.gravityScale ?? 1,
                linearDamping: command.linearDamping ?? 0,
                angularDamping: command.angularDamping ?? 0,
                canSleep: command.canSleep !== false,
                lockTranslations: command.lockTranslations ?? [
                  false,
                  false,
                  false,
                ],
                lockRotations: command.lockRotations ?? [false, false, false],
                colliders: collidersForCommand(command),
                sleeping:
                  command.canSleep !== false &&
                  previous?.sleeping === true &&
                  velocityMagnitude(velocity) === 0,
                manualAwake: previous?.manualAwake ?? false,
              });
            }
            break;
          case "destroyBody":
            destroyBody(command.entity);
            break;
          case "upsertJoint":
            if (
              physicsJointCommandHasUnsupportedSyncFeature(
                "test",
                command.joint,
              )
            ) {
              joints.delete(command.entity);
              break;
            }
            if (
              !bodies.has(command.joint.bodyARef) ||
              !bodies.has(command.joint.bodyBRef)
            ) {
              joints.delete(command.entity);
              break;
            }
            joints.set(command.entity, {
              entity: command.entity,
              descriptor: command.joint,
            });
            break;
          case "destroyJoint":
            joints.delete(command.entity);
            break;
          case "setVelocity": {
            const body = bodies.get(command.entity);
            if (body !== undefined) {
              body.velocity = {
                linear: maskLockedAxes(
                  command.velocity.linear,
                  body.lockTranslations,
                ),
                angular: maskLockedAxes(
                  command.velocity.angular,
                  body.lockRotations,
                ),
              };
            }
            break;
          }
          case "emitTrigger":
            pendingEvents.push({
              kind: "triggerEnter",
              frame: 0,
              fixedStep: 0,
              substep: 0,
              entityA: command.entityA,
              entityB: command.entityB,
              colliderA: command.entityA,
              colliderB: command.entityB,
            });
            break;
        }
      }

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
      if (!initialized) {
        throw new Error(
          "Test physics backend must be initialized before step().",
        );
      }
      for (const body of bodies.values()) {
        const manualAwake = body.manualAwake;
        body.manualAwake = false;

        if (body.bodyType === PhysicsRigidBodyType.KinematicVelocity) {
          body.velocity = {
            linear: maskLockedAxes(body.velocity.linear, body.lockTranslations),
            angular: maskLockedAxes(body.velocity.angular, body.lockRotations),
          };
          body.sleeping = manualAwake
            ? false
            : body.canSleep && velocityMagnitude(body.velocity) === 0;
          body.transform = {
            translation: integrateTranslation(body, fixedDelta),
            rotation: integrateRotation(body, fixedDelta),
          };
          continue;
        }
        if (body.bodyType !== PhysicsRigidBodyType.Dynamic) {
          continue;
        }
        applyForceAndImpulse(body, fixedDelta, gravity);
        if (velocityMagnitude(body.velocity) === 0) {
          body.sleeping = manualAwake ? false : body.canSleep;
          continue;
        }
        body.sleeping = false;
        body.transform = {
          translation: integrateTranslation(body, fixedDelta),
          rotation: integrateRotation(body, fixedDelta),
        };
        applyDamping(body, fixedDelta);
      }
      events = pendingEvents.map((event) => ({
        ...event,
        fixedStep: fixedStepIndex,
      }));
      pendingEvents = [];

      return {
        enabled: true,
        backend: "test",
        backendVersion: "0.0.0-test",
        backendBuild: "test",
        execution,
        fixedDelta,
        fixedStep: fixedStepIndex,
        bodyCount: bodies.size,
        colliderCount: colliderCount(bodies),
        jointCount: joints.size,
        eventCount: events.length,
        queryCount,
        syncToBackendMs: 0,
        backendStepMs: 0,
        writebackMs: 0,
      };
    },
    readResults(out: PhysicsResultBuffer): PhysicsReadbackReport {
      out.bodies.length = 0;
      out.events.length = 0;
      const sortedBodies = [...bodies.values()].sort((a, b) =>
        a.entity.localeCompare(b.entity),
      );
      for (const body of sortedBodies) {
        out.bodies.push(bodyResult(body));
      }
      out.events.push(...events);
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
      queryCount += 1;
      const hits: PhysicsRaycastHit[] = [];
      const maxDistance = ray.maxDistance ?? Number.POSITIVE_INFINITY;
      for (const body of bodies.values()) {
        for (const collider of body.colliders) {
          if (!queryAllowsCollider(body, collider, options)) {
            continue;
          }
          const hit = raycastSphere(ray, body, collider, maxDistance);
          if (hit !== null) {
            hits.push(hit);
          }
        }
      }
      return hits.sort(
        (a, b) =>
          a.distance - b.distance ||
          a.entity.localeCompare(b.entity) ||
          (a.collider ?? "").localeCompare(b.collider ?? ""),
      );
    },
    overlapShape(
      shape,
      transform: PhysicsTransform,
      options: PhysicsQueryOptions = {},
    ) {
      queryCount += 1;
      const queryRadius = boundingRadiusForShape(shape);
      const sortedBodies = [...bodies.values()].sort((a, b) =>
        a.entity.localeCompare(b.entity),
      );
      return sortedBodies.flatMap((body) =>
        body.colliders
          .filter(
            (collider) =>
              queryAllowsCollider(body, collider, options) &&
              distance(colliderCenter(body, collider), transform.translation) <=
                collider.radius + queryRadius,
          )
          .map((collider) => ({
            entity: body.entity,
            collider: collider.entity,
          })),
      );
    },
    castShapeFirst(
      shape: PhysicsShape,
      cast: PhysicsShapeCast,
      options: PhysicsQueryOptions = {},
    ): PhysicsShapeCastHit | null {
      queryCount += 1;
      const queryRadius = boundingRadiusForShape(shape);
      const hits: PhysicsShapeCastHit[] = [];

      for (const body of bodies.values()) {
        for (const collider of body.colliders) {
          if (!queryAllowsCollider(body, collider, options)) {
            continue;
          }
          const hit = castSphereBounds(queryRadius, cast, body, collider);

          if (hit !== null) {
            hits.push(hit);
          }
        }
      }

      return (
        hits.sort(
          (a, b) =>
            a.timeOfImpact - b.timeOfImpact ||
            a.entity.localeCompare(b.entity) ||
            (a.collider ?? "").localeCompare(b.collider ?? ""),
        )[0] ?? null
      );
    },
    projectPoint(
      point: PhysicsVec3,
      options: PhysicsQueryOptions = {},
    ): PhysicsPointProjection | null {
      queryCount += 1;
      const projections: PhysicsPointProjection[] = [];

      for (const body of bodies.values()) {
        for (const collider of body.colliders) {
          if (!queryAllowsCollider(body, collider, options)) {
            continue;
          }
          projections.push(projectPointToBody(point, body, collider));
        }
      }

      return (
        projections.sort(
          (a, b) =>
            a.distance - b.distance ||
            a.entity.localeCompare(b.entity) ||
            (a.collider ?? "").localeCompare(b.collider ?? ""),
        )[0] ?? null
      );
    },
    moveCharacter(
      move: PhysicsCharacterMove,
    ): PhysicsCharacterMoveResult | null {
      queryCount += 1;
      const body = bodies.get(move.entity);

      if (body === undefined) {
        return null;
      }

      const options: PhysicsQueryOptions = {
        ...move.options,
        excludeEntity: move.entity,
      };
      const up = normalize(move.settings?.up ?? [0, 1, 0]);
      const desiredTranslation = cloneVec3(move.desiredTranslation);
      const cast: PhysicsShapeCast = {
        from: cloneTransform(body.transform),
        to: {
          translation: add(body.transform.translation, desiredTranslation),
          rotation: body.transform.rotation,
        },
      };
      const hit = nearestCharacterHit(bodies, body, cast, options);
      const collisions =
        hit === null
          ? []
          : [
              {
                entity: hit.entity,
                translationDeltaApplied: scale(
                  desiredTranslation,
                  hit.timeOfImpact,
                ),
                translationDeltaRemaining: scale(
                  desiredTranslation,
                  1 - hit.timeOfImpact,
                ),
                timeOfImpact: hit.timeOfImpact,
                point: hit.point,
                normal: hit.normal,
              },
            ];
      const movement =
        hit === null
          ? desiredTranslation
          : characterMovementAfterHit(
              desiredTranslation,
              hit,
              move.settings?.slide !== false,
            );
      const snapDistance = finiteNonNegative(
        move.settings?.snapToGroundDistance,
      );
      const grounded =
        isCharacterGrounded(bodies, body, up, options, snapDistance) ||
        collisions.some((collision) => dot(collision.normal, up) > 0.5);
      const targetTranslation = add(body.transform.translation, movement);

      body.transform = {
        translation: targetTranslation,
        rotation: body.transform.rotation,
      };

      return {
        entity: move.entity,
        desiredTranslation,
        movement,
        targetTranslation,
        grounded,
        collisions,
      };
    },
    sleepBody(entity: string): boolean {
      const body = bodies.get(entity);

      if (body === undefined) {
        return false;
      }

      body.sleeping = true;
      body.manualAwake = false;
      return true;
    },
    wakeBody(entity: string): boolean {
      const body = bodies.get(entity);

      if (body === undefined) {
        return false;
      }

      body.sleeping = false;
      body.manualAwake = true;
      return true;
    },
    debugGeometry(options: PhysicsDebugOptions = {}): PhysicsDebugGeometry {
      const lines: PhysicsDebugLine[] = [];
      const sortedBodies = [...bodies.values()].sort((a, b) =>
        a.entity.localeCompare(b.entity),
      );

      if (options.colliderWireframes === true) {
        for (const body of sortedBodies) {
          for (const collider of body.colliders) {
            const center = colliderCenter(body, collider);

            lines.push({
              from: [center[0] - collider.radius, center[1], center[2]],
              to: [center[0] + collider.radius, center[1], center[2]],
              color: [0.2, 0.8, 1, 1],
            });
          }
        }
      }
      if (options.contactNormals === true) {
        lines.push(...contactNormalDebugLines(sortedBodies, options));
      }
      if (options.bodyStateMarkers === true) {
        lines.push(...bodyStateDebugLines(sortedBodies, options));
      }
      if (options.broadphaseAabbs === true) {
        lines.push(...broadphaseAabbDebugLines(sortedBodies, options));
      }
      if (options.jointFrames === true) {
        lines.push(
          ...jointFrameDebugLines(
            [...joints.values()].sort((a, b) =>
              a.entity.localeCompare(b.entity),
            ),
            bodies,
            options,
          ),
        );
      }
      lines.push(
        ...createPhysicsRayProbeDebugLines(options.rayProbes, (ray, query) =>
          this.raycastFirst(ray, query),
        ),
      );

      return { lines };
    },
  };

  function destroyBody(entity: string): void {
    bodies.delete(entity);
    for (const [jointEntity, joint] of joints) {
      if (
        joint.descriptor.bodyARef === entity ||
        joint.descriptor.bodyBRef === entity
      ) {
        joints.delete(jointEntity);
      }
    }
  }
}

function broadphaseAabbDebugLines(
  bodies: readonly TestBody[],
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  return createPhysicsAabbDebugLines(
    bodies.flatMap((body) =>
      body.colliders.map((collider): PhysicsAabb => {
        const radius = collider.radius;
        const center = colliderCenter(body, collider);

        return {
          min: [center[0] - radius, center[1] - radius, center[2] - radius],
          max: [center[0] + radius, center[1] + radius, center[2] + radius],
        };
      }),
    ),
    options.broadphaseAabbColor,
  );
}

function contactNormalDebugLines(
  bodies: readonly TestBody[],
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const lines: PhysicsDebugLine[] = [];
  const length = finitePositive(options.contactNormalLength, 0.35);
  const color = options.contactNormalColor ?? [1, 0.2, 0.12, 1];

  for (let left = 0; left < bodies.length; left += 1) {
    for (let right = left + 1; right < bodies.length; right += 1) {
      const leftBody = bodies[left];
      const rightBody = bodies[right];

      if (leftBody === undefined || rightBody === undefined) {
        continue;
      }

      for (const leftCollider of leftBody.colliders) {
        for (const rightCollider of rightBody.colliders) {
          const delta = subtract(
            colliderCenter(rightBody, rightCollider),
            colliderCenter(leftBody, leftCollider),
          );
          const separation = Math.hypot(delta[0], delta[1], delta[2]);
          const contactDistance = leftCollider.radius + rightCollider.radius;

          if (separation > contactDistance + 0.0001) {
            continue;
          }

          const normal = normalize(delta);
          const point = addScaled(
            colliderCenter(leftBody, leftCollider),
            normal,
            leftCollider.radius,
          );

          lines.push({
            from: point,
            to: addScaled(point, normal, length),
            color,
          });
        }
      }
    }
  }

  return lines;
}

function bodyStateDebugLines(
  bodies: readonly TestBody[],
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const length = finitePositive(options.bodyStateMarkerLength, 0.25);
  const activeColor = options.activeBodyColor ?? [0.2, 1, 0.45, 1];
  const sleepingColor = options.sleepingBodyColor ?? [0.65, 0.7, 0.78, 1];

  return bodies.map((body) => ({
    from: cloneVec3(body.transform.translation),
    to: addScaled(body.transform.translation, [0, 1, 0], length),
    color: body.sleeping ? sleepingColor : activeColor,
  }));
}

function jointFrameDebugLines(
  joints: readonly TestJoint[],
  bodies: ReadonlyMap<string, TestBody>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const lines: PhysicsDebugLine[] = [];
  const frameColor = options.jointFrameColor ?? [0.9, 0.45, 1, 1];
  const axisColor = options.jointAxisColor ?? [0.2, 0.95, 1, 1];
  const basisColors = fixedJointFrameBasisColors();
  const axisLength = finitePositive(options.jointFrameLength, 0.4);

  for (const joint of joints) {
    const bodyA = bodies.get(joint.descriptor.bodyARef);
    const bodyB = bodies.get(joint.descriptor.bodyBRef);

    if (bodyA === undefined || bodyB === undefined) {
      continue;
    }

    const anchorA = transformLocalPoint(
      bodyA.transform,
      joint.descriptor.anchorA,
    );
    const anchorB = transformLocalPoint(
      bodyB.transform,
      joint.descriptor.anchorB,
    );
    const axis = normalize(
      transformLocalVector(bodyA.transform, jointAxis(joint.descriptor)),
    );

    lines.push({
      from: anchorA,
      to: anchorB,
      color: frameColor,
    });
    lines.push({
      from: anchorA,
      to: addScaled(anchorA, axis, axisLength),
      color: axisColor,
    });

    if (joint.descriptor.kind === "fixed") {
      lines.push(
        ...fixedJointFrameBasisDebugLines(
          bodyA.transform,
          anchorA,
          joint.descriptor.frameA ?? [0, 0, 0, 1],
          axisLength,
          basisColors,
        ),
        ...fixedJointFrameBasisDebugLines(
          bodyB.transform,
          anchorB,
          joint.descriptor.frameB ?? [0, 0, 0, 1],
          axisLength,
          basisColors,
        ),
      );
    }
  }

  return lines;
}

function fixedJointFrameBasisDebugLines(
  transform: PhysicsTransform,
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
    const worldAxis = normalize(transformLocalVector(transform, localAxis));

    return {
      from: anchor,
      to: addScaled(anchor, worldAxis, length),
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

function jointAxis(descriptor: PhysicsJointDescriptor): PhysicsVec3 {
  return normalize(
    rotateVec3ByQuat(
      descriptor.axis,
      normalizeQuat(descriptor.frameA ?? [0, 0, 0, 1]),
    ),
  );
}

function bodyResult(body: TestBody): PhysicsBodyResult {
  return {
    entity: body.entity,
    transform: cloneTransform(body.transform),
    velocity: cloneVelocity(body.velocity),
    sleeping: body.sleeping,
  };
}

function collidersForCommand(
  command: Extract<
    PhysicsCommandBuffer["commands"][number],
    { readonly kind: "upsertBody" }
  >,
): readonly TestCollider[] {
  const descriptors =
    command.colliders ??
    (command.collider === undefined ? undefined : [command.collider]);

  if (descriptors !== undefined && descriptors.length > 0) {
    return descriptors.map((descriptor, index) =>
      testColliderForDescriptor(command.entity, descriptor, index),
    );
  }

  return [
    {
      entity: command.entity,
      radius: command.radius ?? 0.5,
      colliderOffsetTranslation: [0, 0, 0],
      sensor: false,
      collisionGroups: -1,
    },
  ];
}

function testColliderForDescriptor(
  body: string,
  descriptor: PhysicsColliderDescriptor,
  index: number,
): TestCollider {
  return {
    entity: descriptor.entity ?? (index === 0 ? body : `${body}#${index}`),
    radius: boundingRadiusForShape(descriptor.shape),
    colliderOffsetTranslation: cloneVec3(
      descriptor.offsetTranslation ?? [0, 0, 0],
    ),
    sensor: descriptor.sensor === true,
    collisionGroups: descriptor.collisionGroups ?? -1,
  };
}

function colliderCount(bodies: ReadonlyMap<string, TestBody>): number {
  return [...bodies.values()].reduce(
    (total, body) => total + body.colliders.length,
    0,
  );
}

function colliderCenter(body: TestBody, collider: TestCollider): PhysicsVec3 {
  return transformLocalPoint(
    body.transform,
    collider.colliderOffsetTranslation,
  );
}

function raycastSphere(
  ray: PhysicsRay,
  body: TestBody,
  collider: TestCollider,
  maxDistance: number,
): PhysicsRaycastHit | null {
  const center = colliderCenter(body, collider);
  const originToCenter = subtract(center, ray.origin);
  const tca = dot(originToCenter, ray.direction);
  if (tca < 0) {
    return null;
  }
  const closestDistanceSq = dot(originToCenter, originToCenter) - tca * tca;
  const radiusSq = collider.radius * collider.radius;
  if (closestDistanceSq > radiusSq) {
    return null;
  }
  const thc = Math.sqrt(radiusSq - closestDistanceSq);
  const distanceValue = tca - thc;
  if (distanceValue < 0 || distanceValue > maxDistance) {
    return null;
  }
  const point = addScaled(ray.origin, ray.direction, distanceValue);
  const normal = normalize(subtract(point, center));
  return {
    entity: body.entity,
    collider: collider.entity,
    point,
    normal,
    distance: distanceValue,
  };
}

function castSphereBounds(
  queryRadius: number,
  cast: PhysicsShapeCast,
  body: TestBody,
  collider: TestCollider,
): PhysicsShapeCastHit | null {
  const start = cast.from.translation;
  const end = cast.to.translation;
  const delta = subtract(end, start);
  const center = colliderCenter(body, collider);
  const startToCenter = subtract(start, center);
  const combinedRadius = collider.radius + queryRadius;
  const c = dot(startToCenter, startToCenter) - combinedRadius * combinedRadius;

  if (c <= 0) {
    const normal = normalize(startToCenter);

    return {
      entity: body.entity,
      collider: collider.entity,
      timeOfImpact: 0,
      point: addScaled(center, normal, collider.radius),
      normal,
    };
  }

  const a = dot(delta, delta);

  if (a <= Number.EPSILON) {
    return null;
  }

  const b = dot(startToCenter, delta);
  const discriminant = b * b - a * c;

  if (discriminant < 0) {
    return null;
  }

  const timeOfImpact = (-b - Math.sqrt(discriminant)) / a;

  if (timeOfImpact < 0 || timeOfImpact > 1) {
    return null;
  }

  const queryCenterAtImpact = addScaled(start, delta, timeOfImpact);
  const normal = normalize(subtract(queryCenterAtImpact, center));

  return {
    entity: body.entity,
    collider: collider.entity,
    timeOfImpact,
    point: addScaled(center, normal, collider.radius),
    normal,
  };
}

function projectPointToBody(
  point: PhysicsVec3,
  body: TestBody,
  collider: TestCollider,
): PhysicsPointProjection {
  const center = colliderCenter(body, collider);
  const centerToPoint = subtract(point, center);
  const distanceToCenter = Math.hypot(
    centerToPoint[0],
    centerToPoint[1],
    centerToPoint[2],
  );
  const radius = collider.radius;
  const normal = normalize(centerToPoint);
  const projectedPoint = addScaled(center, normal, radius);

  return {
    entity: body.entity,
    collider: collider.entity,
    point: projectedPoint,
    normal,
    distance: Math.abs(distanceToCenter - radius),
    inside: distanceToCenter <= radius,
  };
}

function nearestCharacterHit(
  bodies: ReadonlyMap<string, TestBody>,
  character: TestBody,
  cast: PhysicsShapeCast,
  options: PhysicsQueryOptions,
): PhysicsShapeCastHit | null {
  const hits: PhysicsShapeCastHit[] = [];
  const delta = subtract(cast.to.translation, cast.from.translation);

  for (const body of bodies.values()) {
    if (body.entity === character.entity) {
      continue;
    }

    for (const collider of body.colliders) {
      if (!queryAllowsCollider(body, collider, options)) {
        continue;
      }

      const hit = castSphereBounds(bodyRadius(character), cast, body, collider);

      if (hit !== null && dot(hit.normal, delta) < -0.000001) {
        hits.push(hit);
      }
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

function characterMovementAfterHit(
  desiredTranslation: PhysicsVec3,
  hit: PhysicsShapeCastHit,
  slide: boolean,
): PhysicsVec3 {
  const applied = scale(desiredTranslation, hit.timeOfImpact);
  const remaining = scale(desiredTranslation, 1 - hit.timeOfImpact);

  if (!slide) {
    return applied;
  }

  const intoNormal = dot(remaining, hit.normal);
  const slideRemaining =
    intoNormal < 0
      ? subtract(remaining, scale(hit.normal, intoNormal))
      : remaining;

  return add(applied, slideRemaining);
}

function isCharacterGrounded(
  bodies: ReadonlyMap<string, TestBody>,
  character: TestBody,
  up: PhysicsVec3,
  options: PhysicsQueryOptions,
  snapDistance: number,
): boolean {
  const probeDistance = Math.max(0.001, snapDistance + 0.001);
  const down = scale(up, -probeDistance);
  const cast: PhysicsShapeCast = {
    from: cloneTransform(character.transform),
    to: {
      translation: add(character.transform.translation, down),
      rotation: character.transform.rotation,
    },
  };
  const hit = nearestCharacterHit(bodies, character, cast, options);

  return hit !== null && dot(hit.normal, up) > 0.5;
}

function cloneTransform(transform: PhysicsTransform): PhysicsTransform {
  return {
    translation: cloneVec3(transform.translation),
    rotation: [
      transform.rotation[0],
      transform.rotation[1],
      transform.rotation[2],
      transform.rotation[3],
    ],
  };
}

function kinematicTransformForCommand(
  command: Extract<
    PhysicsCommandBuffer["commands"][number],
    { readonly kind: "upsertBody" }
  >,
): PhysicsTransform | undefined {
  const bodyType = command.bodyType ?? PhysicsRigidBodyType.Dynamic;

  return bodyType === PhysicsRigidBodyType.KinematicPosition
    ? command.kinematicTarget
    : undefined;
}

function cloneVelocity(velocity: PhysicsVelocityValue): PhysicsVelocityValue {
  return {
    linear: cloneVec3(velocity.linear),
    angular: cloneVec3(velocity.angular),
  };
}

function zeroVelocity(): PhysicsVelocityValue {
  return {
    linear: [0, 0, 0],
    angular: [0, 0, 0],
  };
}

function cloneExternalForce(
  value: PhysicsExternalForceValue,
): PhysicsExternalForceValue {
  return {
    force: cloneVec3(value.force),
    torque: cloneVec3(value.torque),
  };
}

function zeroExternalForce(): PhysicsExternalForceValue {
  return {
    force: [0, 0, 0],
    torque: [0, 0, 0],
  };
}

function cloneExternalImpulse(
  value: PhysicsExternalImpulseValue,
): PhysicsExternalImpulseValue {
  return {
    impulse: cloneVec3(value.impulse),
    angularImpulse: cloneVec3(value.angularImpulse),
  };
}

function zeroExternalImpulse(): PhysicsExternalImpulseValue {
  return {
    impulse: [0, 0, 0],
    angularImpulse: [0, 0, 0],
  };
}

function applyForceAndImpulse(
  body: TestBody,
  fixedDelta: number,
  gravity: PhysicsVec3,
): void {
  const linear = maskLockedAxes(
    add(
      addScaled(
        addScaled(
          body.velocity.linear,
          gravity,
          fixedDelta * body.gravityScale,
        ),
        body.externalForce.force,
        fixedDelta,
      ),
      body.pendingImpulse.impulse,
    ),
    body.lockTranslations,
  );
  const angular = maskLockedAxes(
    add(
      addScaled(body.velocity.angular, body.externalForce.torque, fixedDelta),
      body.pendingImpulse.angularImpulse,
    ),
    body.lockRotations,
  );

  body.velocity = {
    linear,
    angular,
  };
  body.pendingImpulse = zeroExternalImpulse();
}

function integrateTranslation(body: TestBody, fixedDelta: number): PhysicsVec3 {
  return [
    body.lockTranslations[0]
      ? body.transform.translation[0]
      : body.transform.translation[0] + body.velocity.linear[0] * fixedDelta,
    body.lockTranslations[1]
      ? body.transform.translation[1]
      : body.transform.translation[1] + body.velocity.linear[1] * fixedDelta,
    body.lockTranslations[2]
      ? body.transform.translation[2]
      : body.transform.translation[2] + body.velocity.linear[2] * fixedDelta,
  ];
}

function integrateRotation(body: TestBody, fixedDelta: number): PhysicsQuat {
  const angularSpeed = Math.hypot(
    body.velocity.angular[0],
    body.velocity.angular[1],
    body.velocity.angular[2],
  );

  if (!Number.isFinite(angularSpeed) || angularSpeed === 0) {
    return normalizeQuat(body.transform.rotation);
  }

  const halfAngle = (angularSpeed * fixedDelta) / 2;
  const scaleByAxis = Math.sin(halfAngle) / angularSpeed;
  const delta: PhysicsQuat = normalizeQuat([
    body.velocity.angular[0] * scaleByAxis,
    body.velocity.angular[1] * scaleByAxis,
    body.velocity.angular[2] * scaleByAxis,
    Math.cos(halfAngle),
  ]);

  return multiplyQuat(delta, body.transform.rotation);
}

function applyDamping(body: TestBody, fixedDelta: number): void {
  body.velocity = {
    linear: scale(
      body.velocity.linear,
      dampingFactor(body.linearDamping, fixedDelta),
    ),
    angular: scale(
      body.velocity.angular,
      dampingFactor(body.angularDamping, fixedDelta),
    ),
  };
}

function dampingFactor(damping: number, fixedDelta: number): number {
  if (!Number.isFinite(damping) || damping <= 0) {
    return 1;
  }

  return 1 / (1 + damping * fixedDelta);
}

function maskLockedAxes(
  value: PhysicsVec3,
  locks: readonly [boolean, boolean, boolean],
): PhysicsVec3 {
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

function cloneVec3(values: PhysicsVec3): [number, number, number] {
  return [values[0], values[1], values[2]];
}

function addScaled(
  a: PhysicsVec3,
  b: PhysicsVec3,
  scale: number,
): [number, number, number] {
  return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
}

function add(a: PhysicsVec3, b: PhysicsVec3): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a: PhysicsVec3, value: number): [number, number, number] {
  return [a[0] * value, a[1] * value, a[2] * value];
}

function subtract(a: PhysicsVec3, b: PhysicsVec3): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function transformLocalPoint(
  transform: PhysicsTransform,
  point: PhysicsVec3,
): [number, number, number] {
  const rotated = transformLocalVector(transform, point);

  return [
    rotated[0] + transform.translation[0],
    rotated[1] + transform.translation[1],
    rotated[2] + transform.translation[2],
  ];
}

function transformLocalVector(
  transform: PhysicsTransform,
  value: PhysicsVec3,
): [number, number, number] {
  return rotateVec3ByQuat(value, transform.rotation);
}

function rotateVec3ByQuat(
  value: PhysicsVec3,
  rotation: PhysicsQuat,
): [number, number, number] {
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

function dot(a: PhysicsVec3, b: PhysicsVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function distance(a: PhysicsVec3, b: PhysicsVec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function bodyRadius(body: TestBody): number {
  return body.colliders[0]?.radius ?? 0.5;
}

function queryAllowsCollider(
  body: TestBody,
  collider: TestCollider,
  options: PhysicsQueryOptions,
): boolean {
  if (
    body.entity === options.excludeEntity ||
    collider.entity === options.excludeEntity
  ) {
    return false;
  }
  if (collider.sensor && options.includeSensors !== true) {
    return false;
  }
  if (
    options.collisionGroups !== undefined &&
    !interactionGroupsCompatible(
      options.collisionGroups,
      collider.collisionGroups,
    )
  ) {
    return false;
  }

  return true;
}

function interactionGroupsCompatible(query: number, collider: number): boolean {
  return ((query >>> 16) & collider) !== 0 && ((collider >>> 16) & query) !== 0;
}

function boundingRadiusForShape(shape: PhysicsShape): number {
  switch (shape.kind) {
    case "box":
      return Math.hypot(...shape.halfExtents);
    case "sphere":
      return shape.radius;
    case "capsule":
    case "cylinder":
    case "cone":
      return Math.hypot(shape.radius, shape.halfHeight);
    case "convexHull":
    case "trimesh":
    case "heightfield":
      return 0.5;
  }
}

function normalize(value: PhysicsVec3): [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length === 0) {
    return [0, 1, 0];
  }
  return [value[0] / length, value[1] / length, value[2] / length];
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
