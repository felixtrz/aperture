import { collectUnsupportedPhysicsCommandFeatures, createPhysicsRayProbeDebugLines, physicsBodyCommandHasUnsupportedSyncFeature, physicsJointCommandHasUnsupportedSyncFeature, TEST_PHYSICS_BACKEND_CAPABILITIES, } from "../backend.js";
import { PhysicsRigidBodyType, } from "../components.js";
import { applyDamping, applyForceAndImpulse, bodyResult, colliderCenter, colliderCount, collidersForCommand, cloneExternalForce, cloneExternalImpulse, cloneTransform, cloneVelocity, integrateRotation, integrateTranslation, kinematicTransformForCommand, maskLockedAxes, velocityMagnitude, zeroExternalForce, zeroExternalImpulse, zeroVelocity, } from "./bodies.js";
import { bodyStateDebugLines, broadphaseAabbDebugLines, contactNormalDebugLines, jointFrameDebugLines, } from "./debug.js";
import { add, cloneVec3, distance, dot, finiteNonNegative, normalize, scale, } from "./math.js";
import { castSphereBounds, characterMovementAfterHit, isCharacterGrounded, nearestCharacterHit, projectPointToBody, queryAllowsCollider, raycastSphere, } from "./queries.js";
import { boundingRadiusForShape } from "./shapes.js";
export function createTestPhysicsBackend(options = {}) {
    const defaultGravity = cloneVec3(options.gravity ?? [0, 0, 0]);
    const bodies = new Map();
    const joints = new Map();
    let initialized = false;
    let queryCount = 0;
    let events = [];
    let pendingEvents = [];
    let gravity = cloneVec3(defaultGravity);
    const execution = options.execution ?? "simulation-worker";
    return {
        kind: "test",
        version: "0.0.0-test",
        build: "test",
        execution,
        capabilities: TEST_PHYSICS_BACKEND_CAPABILITIES,
        init(initOptions = {}) {
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
        sync(buffer) {
            const unsupportedFeatures = collectUnsupportedPhysicsCommandFeatures("test", buffer);
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
                            const velocity = cloneVelocity(command.velocity ?? zeroVelocity());
                            bodies.set(command.entity, {
                                entity: command.entity,
                                bodyType: command.bodyType ?? PhysicsRigidBodyType.Dynamic,
                                transform: cloneTransform(kinematicTransformForCommand(command) ?? command.transform),
                                velocity,
                                externalForce: cloneExternalForce(command.externalForce ?? zeroExternalForce()),
                                pendingImpulse: cloneExternalImpulse(command.externalImpulse ?? zeroExternalImpulse()),
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
                                sleeping: command.canSleep !== false &&
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
                        if (physicsJointCommandHasUnsupportedSyncFeature("test", command.joint)) {
                            joints.delete(command.entity);
                            break;
                        }
                        if (!bodies.has(command.joint.bodyARef) ||
                            !bodies.has(command.joint.bodyBRef)) {
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
                                linear: maskLockedAxes(command.velocity.linear, body.lockTranslations),
                                angular: maskLockedAxes(command.velocity.angular, body.lockRotations),
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
        step(fixedDelta, fixedStepIndex) {
            if (!initialized) {
                throw new Error("Test physics backend must be initialized before step().");
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
        readResults(out) {
            out.bodies.length = 0;
            out.events.length = 0;
            const sortedBodies = [...bodies.values()].sort((a, b) => a.entity.localeCompare(b.entity));
            for (const body of sortedBodies) {
                out.bodies.push(bodyResult(body));
            }
            out.events.push(...events);
            return {
                bodyCount: out.bodies.length,
                eventCount: out.events.length,
            };
        },
        raycastFirst(ray, options) {
            return this.raycastAll(ray, options)[0] ?? null;
        },
        raycastAll(ray, options = {}) {
            queryCount += 1;
            const hits = [];
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
            return hits.sort((a, b) => a.distance - b.distance ||
                a.entity.localeCompare(b.entity) ||
                (a.collider ?? "").localeCompare(b.collider ?? ""));
        },
        overlapShape(shape, transform, options = {}) {
            queryCount += 1;
            const queryRadius = boundingRadiusForShape(shape);
            const sortedBodies = [...bodies.values()].sort((a, b) => a.entity.localeCompare(b.entity));
            return sortedBodies.flatMap((body) => body.colliders
                .filter((collider) => queryAllowsCollider(body, collider, options) &&
                distance(colliderCenter(body, collider), transform.translation) <=
                    collider.radius + queryRadius)
                .map((collider) => ({
                entity: body.entity,
                collider: collider.entity,
            })));
        },
        castShapeFirst(shape, cast, options = {}) {
            queryCount += 1;
            const queryRadius = boundingRadiusForShape(shape);
            const hits = [];
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
            return (hits.sort((a, b) => a.timeOfImpact - b.timeOfImpact ||
                a.entity.localeCompare(b.entity) ||
                (a.collider ?? "").localeCompare(b.collider ?? ""))[0] ?? null);
        },
        projectPoint(point, options = {}) {
            queryCount += 1;
            const projections = [];
            for (const body of bodies.values()) {
                for (const collider of body.colliders) {
                    if (!queryAllowsCollider(body, collider, options)) {
                        continue;
                    }
                    projections.push(projectPointToBody(point, body, collider));
                }
            }
            return (projections.sort((a, b) => a.distance - b.distance ||
                a.entity.localeCompare(b.entity) ||
                (a.collider ?? "").localeCompare(b.collider ?? ""))[0] ?? null);
        },
        moveCharacter(move) {
            queryCount += 1;
            const body = bodies.get(move.entity);
            if (body === undefined) {
                return null;
            }
            const options = {
                ...move.options,
                excludeEntity: move.entity,
            };
            const up = normalize(move.settings?.up ?? [0, 1, 0]);
            const desiredTranslation = cloneVec3(move.desiredTranslation);
            const cast = {
                from: cloneTransform(body.transform),
                to: {
                    translation: add(body.transform.translation, desiredTranslation),
                    rotation: body.transform.rotation,
                },
            };
            const hit = nearestCharacterHit(bodies, body, cast, options);
            const collisions = hit === null
                ? []
                : [
                    {
                        entity: hit.entity,
                        translationDeltaApplied: scale(desiredTranslation, hit.timeOfImpact),
                        translationDeltaRemaining: scale(desiredTranslation, 1 - hit.timeOfImpact),
                        timeOfImpact: hit.timeOfImpact,
                        point: hit.point,
                        normal: hit.normal,
                    },
                ];
            const movement = hit === null
                ? desiredTranslation
                : characterMovementAfterHit(desiredTranslation, hit, move.settings?.slide !== false);
            const snapDistance = finiteNonNegative(move.settings?.snapToGroundDistance);
            const grounded = isCharacterGrounded(bodies, body, up, options, snapDistance) ||
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
        sleepBody(entity) {
            const body = bodies.get(entity);
            if (body === undefined) {
                return false;
            }
            body.sleeping = true;
            body.manualAwake = false;
            return true;
        },
        wakeBody(entity) {
            const body = bodies.get(entity);
            if (body === undefined) {
                return false;
            }
            body.sleeping = false;
            body.manualAwake = true;
            return true;
        },
        debugGeometry(options = {}) {
            const lines = [];
            const sortedBodies = [...bodies.values()].sort((a, b) => a.entity.localeCompare(b.entity));
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
                lines.push(...jointFrameDebugLines([...joints.values()].sort((a, b) => a.entity.localeCompare(b.entity)), bodies, options));
            }
            lines.push(...createPhysicsRayProbeDebugLines(options.rayProbes, (ray, query) => this.raycastFirst(ray, query)));
            return { lines };
        },
    };
    function destroyBody(entity) {
        bodies.delete(entity);
        for (const [jointEntity, joint] of joints) {
            if (joint.descriptor.bodyARef === entity ||
                joint.descriptor.bodyBRef === entity) {
                joints.delete(jointEntity);
            }
        }
    }
}
//# sourceMappingURL=backend.js.map