import RAPIER from "/aperture/worker-modules/packages/physics-rapier/node_modules/@dimforge/rapier3d-compat/rapier.mjs";
import { collectUnsupportedPhysicsCommandFeatures, physicsBodyCommandHasUnsupportedSyncFeature, physicsJointCommandHasUnsupportedSyncFeature, RAPIER_PHYSICS_BACKEND_CAPABILITIES, createPhysicsRayProbeDebugLines, } from "/aperture/worker-modules/packages/physics/dist/index.js";
import { bodyResult, destroyBody, setVelocity, upsertBody } from "./bodies.js";
import { characterCollisions, characterFilterAllowsCollider, configureCharacterController, } from "./character.js";
import { colliderCount, colliderMatchForCollider, isRapierColliderSyncError, primaryCollider, } from "./colliders.js";
import { bodyStateDebugLines, broadphaseAabbDebugLines, contactNormalDebugLines, debugGeometryFromRapierBuffers, jointFrameDebugLines, } from "./debug.js";
import { collectRapierEvents } from "./events.js";
import { destroyJoint, upsertJoint } from "./joints.js";
import { addVec3, cloneVec3, colliderLocalPointToWorld, colliderLocalVectorToWorld, distanceVec3, normalizeVec3, quat, subtractVec3, vec, vec3, } from "./math.js";
import { castShapeFirstByCollider, projectPointByCollider, queryAllowsCollider, queryFilterFlags, queryFilterGroups, } from "./queries.js";
import { queryShape, queryShapeRotation } from "./shapes.js";
import { finitePositive, freeRapierObject, performanceNow, requireEventQueue, requireWorld, } from "./util.js";
export function createRapierPhysicsBackend(options = {}) {
    const gravity = options.gravity ?? [0, -9.81, 0];
    let execution = options.execution ?? "simulation-worker";
    const bodies = new Map();
    const joints = new Map();
    const activePairs = new Map();
    let pendingEvents = [];
    let colliderGeometryProvider = options.colliderGeometryProvider;
    let world = null;
    let eventQueue = null;
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
        async init(initOptions = {}) {
            await RAPIER.init({});
            const nextGravity = initOptions.gravity ?? gravity;
            execution = initOptions.execution ?? execution;
            colliderGeometryProvider =
                initOptions.colliderGeometryProvider ?? colliderGeometryProvider;
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
        sync(buffer) {
            const start = performanceNow();
            const rapierWorld = requireWorld(world, initialized);
            const assetBackedColliders = colliderGeometryProvider === undefined ? "unsupported" : "provider";
            const unsupportedFeatures = collectUnsupportedPhysicsCommandFeatures("rapier", buffer, { assetBackedColliders });
            for (const command of buffer.commands) {
                switch (command.kind) {
                    case "setGravity":
                        rapierWorld.gravity = vec(command.gravity);
                        break;
                    case "upsertBody":
                        if (physicsBodyCommandHasUnsupportedSyncFeature(command, {
                            assetBackedColliders,
                        })) {
                            destroyBody(rapierWorld, bodies, joints, command.entity);
                        }
                        else {
                            try {
                                upsertBody(rapierWorld, bodies, joints, command, {
                                    ...(colliderGeometryProvider === undefined
                                        ? {}
                                        : { colliderGeometryProvider }),
                                });
                            }
                            catch (error) {
                                if (!isRapierColliderSyncError(error)) {
                                    throw error;
                                }
                                unsupportedFeatures.push(error.feature);
                                destroyBody(rapierWorld, bodies, joints, command.entity);
                            }
                        }
                        break;
                    case "destroyBody":
                        destroyBody(rapierWorld, bodies, joints, command.entity);
                        break;
                    case "upsertJoint":
                        if (physicsJointCommandHasUnsupportedSyncFeature("rapier", command.joint)) {
                            destroyJoint(rapierWorld, joints, command.entity);
                        }
                        else {
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
        step(fixedDelta, fixedStepIndex) {
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
        readResults(out) {
            const start = performanceNow();
            out.bodies.length = 0;
            out.events.length = 0;
            for (const entry of [...bodies.values()].sort((a, b) => a.entity.localeCompare(b.entity))) {
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
        raycastFirst(ray, options) {
            return this.raycastAll(ray, options)[0] ?? null;
        },
        raycastAll(ray, options = {}) {
            const rapierWorld = requireWorld(world, initialized);
            const rapierRay = new RAPIER.Ray(vec(ray.origin), vec(ray.direction));
            const maxToi = ray.maxDistance ?? Number.POSITIVE_INFINITY;
            const hits = [];
            queryCount += 1;
            rapierWorld.intersectionsWithRay(rapierRay, maxToi, true, (intersection) => {
                const collider = intersection.collider;
                const match = colliderMatchForCollider(bodies, collider);
                if (match === null ||
                    !queryAllowsCollider(match.body, match.collider, options)) {
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
            }, options.includeSensors === true
                ? undefined
                : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, queryFilterGroups(options), undefined, undefined, undefined);
            return hits.sort((a, b) => a.distance - b.distance ||
                a.entity.localeCompare(b.entity) ||
                (a.collider ?? "").localeCompare(b.collider ?? ""));
        },
        overlapShape(shape, transform, options = {}) {
            const rapierWorld = requireWorld(world, initialized);
            const rapierShape = queryShape(shape);
            const rotation = queryShapeRotation(transform.rotation, shape);
            const hits = [];
            queryCount += 1;
            rapierWorld.intersectionsWithShape(vec(transform.translation), quat(rotation), rapierShape, (collider) => {
                const match = colliderMatchForCollider(bodies, collider);
                if (match === null ||
                    !queryAllowsCollider(match.body, match.collider, options)) {
                    return true;
                }
                hits.push({
                    entity: match.body.entity,
                    collider: match.collider.entity,
                });
                return true;
            }, options.includeSensors === true
                ? undefined
                : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, queryFilterGroups(options), undefined, undefined, undefined);
            return hits.sort((a, b) => a.entity.localeCompare(b.entity) ||
                (a.collider ?? "").localeCompare(b.collider ?? ""));
        },
        castShapeFirst(shape, cast, options = {}) {
            if (options.excludeEntity !== undefined) {
                queryCount += 1;
                return castShapeFirstByCollider(bodies, shape, cast, options);
            }
            const rapierWorld = requireWorld(world, initialized);
            const rotation = queryShapeRotation(cast.from.rotation, shape);
            const rapierHit = rapierWorld.castShape(vec(cast.from.translation), quat(rotation), vec(subtractVec3(cast.to.translation, cast.from.translation)), queryShape(shape), 0, 1, true, queryFilterFlags(options), queryFilterGroups(options), undefined, undefined, undefined);
            queryCount += 1;
            if (rapierHit === null) {
                return null;
            }
            try {
                const match = colliderMatchForCollider(bodies, rapierHit.collider);
                if (match === null ||
                    !queryAllowsCollider(match.body, match.collider, options)) {
                    return null;
                }
                const point = colliderLocalPointToWorld(rapierHit.collider, rapierHit.witness1);
                const normal = normalizeVec3(colliderLocalVectorToWorld(rapierHit.collider, rapierHit.normal1));
                return {
                    entity: match.body.entity,
                    collider: match.collider.entity,
                    timeOfImpact: rapierHit.time_of_impact,
                    point,
                    normal,
                };
            }
            finally {
                freeRapierObject(rapierHit);
            }
        },
        projectPoint(point, options = {}) {
            if (options.excludeEntity !== undefined) {
                queryCount += 1;
                return projectPointByCollider(bodies, point, options);
            }
            const rapierWorld = requireWorld(world, initialized);
            const projection = rapierWorld.projectPoint(vec(point), false, queryFilterFlags(options), queryFilterGroups(options), undefined, undefined, undefined);
            queryCount += 1;
            if (projection === null) {
                return null;
            }
            try {
                const match = colliderMatchForCollider(bodies, projection.collider);
                if (match === null ||
                    !queryAllowsCollider(match.body, match.collider, options)) {
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
            }
            finally {
                freeRapierObject(projection);
            }
        },
        moveCharacter(move) {
            const rapierWorld = requireWorld(world, initialized);
            const entry = bodies.get(move.entity);
            const characterCollider = entry === undefined ? null : primaryCollider(entry);
            if (entry === undefined || characterCollider === null) {
                return null;
            }
            const options = move.options ?? {};
            const filterPredicate = options.excludeEntity === undefined ||
                options.excludeEntity === move.entity
                ? undefined
                : (collider) => characterFilterAllowsCollider(bodies, collider, options);
            const controller = rapierWorld.createCharacterController(finitePositive(move.settings?.offset, 0.01));
            queryCount += 1;
            try {
                configureCharacterController(controller, move.settings);
                controller.computeColliderMovement(characterCollider.collider, vec(move.desiredTranslation), queryFilterFlags(options), queryFilterGroups(options), filterPredicate);
                const movement = vec3(controller.computedMovement());
                const currentTranslation = vec3(entry.body.translation());
                const targetTranslation = addVec3(currentTranslation, movement);
                if (entry.body.isKinematic()) {
                    entry.body.setNextKinematicTranslation(vec(targetTranslation));
                }
                else {
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
            }
            finally {
                rapierWorld.removeCharacterController(controller);
            }
        },
        sleepBody(entity) {
            const entry = bodies.get(entity);
            if (entry === undefined) {
                return false;
            }
            entry.body.sleep();
            return true;
        },
        wakeBody(entity) {
            const entry = bodies.get(entity);
            if (entry === undefined) {
                return false;
            }
            entry.body.wakeUp();
            return true;
        },
        debugGeometry(options = {}) {
            const rapierWorld = requireWorld(world, initialized);
            const lines = [];
            if (options.colliderWireframes === true) {
                lines.push(...debugGeometryFromRapierBuffers(rapierWorld.debugRender()).lines);
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
            lines.push(...createPhysicsRayProbeDebugLines(options.rayProbes, (ray, query) => this.raycastFirst(ray, query)));
            return { lines };
        },
    };
}
//# sourceMappingURL=backend.js.map