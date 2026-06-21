import { createPhysicsResultBuffer, } from "./backend.js";
import { PhysicsRigidBodyType, } from "./components.js";
const identityRotation = [0, 0, 0, 1];
const defaultGravity = [0, -1, 0];
const groupA = 0x00010001;
const groupB = 0x00020002;
const querySphere = { kind: "sphere", radius: 0.45 };
export function createDefaultPhysicsBackendBenchmarkScenarios(options = {}) {
    const gravity = options.gravity;
    const execution = options.execution;
    const fixedDelta = options.fixedDelta;
    const jointCount = options.jointCount;
    const characterMoveRepeats = options.characterMoveRepeats;
    const debugGeometryRepeats = options.debugGeometryRepeats;
    const resyncRepeats = options.resyncRepeats;
    return [
        {
            name: "balanced",
            description: "Balanced body, contact, event, and query simulation-worker workload.",
            options: {
                dynamicBodyCount: options.dynamicBodyCount ?? 16,
                contactPairCount: options.contactPairCount ?? 4,
                fixedSteps: options.fixedSteps ?? 60,
                queryRepeats: options.queryRepeats ?? 12,
                ...(jointCount === undefined ? {} : { jointCount }),
                ...(characterMoveRepeats === undefined ? {} : { characterMoveRepeats }),
                ...(debugGeometryRepeats === undefined ? {} : { debugGeometryRepeats }),
                ...(resyncRepeats === undefined ? {} : { resyncRepeats }),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
        {
            name: "body-heavy",
            description: "Higher body-count simulation-worker workload with light query pressure.",
            options: {
                dynamicBodyCount: Math.max(options.dynamicBodyCount ?? 16, 64),
                contactPairCount: options.contactPairCount ?? 4,
                fixedSteps: options.fixedSteps ?? 60,
                queryRepeats: Math.max(4, Math.floor((options.queryRepeats ?? 12) / 2)),
                ...(jointCount === undefined ? {} : { jointCount }),
                ...(characterMoveRepeats === undefined ? {} : { characterMoveRepeats }),
                ...(debugGeometryRepeats === undefined ? {} : { debugGeometryRepeats }),
                ...(resyncRepeats === undefined ? {} : { resyncRepeats }),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
        {
            name: "contact-heavy",
            description: "Contact/event-heavy simulation-worker workload for force/event pressure.",
            options: {
                dynamicBodyCount: options.dynamicBodyCount ?? 16,
                contactPairCount: Math.max(options.contactPairCount ?? 4, 16),
                fixedSteps: options.fixedSteps ?? 60,
                queryRepeats: Math.max(4, Math.floor((options.queryRepeats ?? 12) / 2)),
                ...(jointCount === undefined ? {} : { jointCount }),
                ...(characterMoveRepeats === undefined ? {} : { characterMoveRepeats }),
                ...(debugGeometryRepeats === undefined ? {} : { debugGeometryRepeats }),
                ...(resyncRepeats === undefined ? {} : { resyncRepeats }),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
        {
            name: "query-heavy",
            description: "Query-heavy simulation-worker workload for synchronous gameplay query pressure.",
            options: {
                dynamicBodyCount: options.dynamicBodyCount ?? 16,
                contactPairCount: options.contactPairCount ?? 4,
                fixedSteps: Math.max(12, Math.floor((options.fixedSteps ?? 60) / 2)),
                queryRepeats: Math.max(options.queryRepeats ?? 12, 40),
                ...(jointCount === undefined ? {} : { jointCount }),
                ...(characterMoveRepeats === undefined ? {} : { characterMoveRepeats }),
                ...(debugGeometryRepeats === undefined ? {} : { debugGeometryRepeats }),
                ...(resyncRepeats === undefined ? {} : { resyncRepeats }),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
        {
            name: "character-heavy",
            description: "Character-controller simulation-worker workload for kinematic movement and collision pressure.",
            options: {
                dynamicBodyCount: options.dynamicBodyCount ?? 16,
                contactPairCount: options.contactPairCount ?? 4,
                ...(jointCount === undefined ? {} : { jointCount }),
                characterMoveRepeats: Math.max(options.characterMoveRepeats ?? 0, 24),
                ...(debugGeometryRepeats === undefined ? {} : { debugGeometryRepeats }),
                fixedSteps: options.fixedSteps ?? 60,
                queryRepeats: Math.max(4, Math.floor((options.queryRepeats ?? 12) / 2)),
                ...(resyncRepeats === undefined ? {} : { resyncRepeats }),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
        {
            name: "debug-heavy",
            description: "Debug-geometry simulation-worker workload for backend diagnostics pressure.",
            options: {
                dynamicBodyCount: options.dynamicBodyCount ?? 16,
                contactPairCount: options.contactPairCount ?? 4,
                ...(jointCount === undefined ? {} : { jointCount }),
                ...(characterMoveRepeats === undefined ? {} : { characterMoveRepeats }),
                debugGeometryRepeats: Math.max(options.debugGeometryRepeats ?? 0, 12),
                fixedSteps: options.fixedSteps ?? 60,
                queryRepeats: Math.max(4, Math.floor((options.queryRepeats ?? 12) / 2)),
                ...(resyncRepeats === undefined ? {} : { resyncRepeats }),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
        {
            name: "joint-heavy",
            description: "Joint-heavy simulation-worker workload for constraint sync and step pressure.",
            options: {
                dynamicBodyCount: options.dynamicBodyCount ?? 16,
                contactPairCount: options.contactPairCount ?? 4,
                jointCount: Math.max(options.jointCount ?? 0, 16),
                fixedSteps: options.fixedSteps ?? 60,
                queryRepeats: Math.max(4, Math.floor((options.queryRepeats ?? 12) / 2)),
                ...(characterMoveRepeats === undefined ? {} : { characterMoveRepeats }),
                ...(debugGeometryRepeats === undefined ? {} : { debugGeometryRepeats }),
                ...(resyncRepeats === undefined ? {} : { resyncRepeats }),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
        {
            name: "churn-heavy",
            description: "Repeated sync/create/destroy simulation-worker workload for command-churn and allocation pressure.",
            options: {
                dynamicBodyCount: options.dynamicBodyCount ?? 16,
                contactPairCount: options.contactPairCount ?? 4,
                ...(jointCount === undefined ? {} : { jointCount }),
                ...(characterMoveRepeats === undefined ? {} : { characterMoveRepeats }),
                ...(debugGeometryRepeats === undefined ? {} : { debugGeometryRepeats }),
                resyncRepeats: Math.max(options.resyncRepeats ?? 0, 12),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
        {
            name: "allocation-heavy",
            description: "Higher allocation-pressure simulation-worker workload with more bodies and contact pairs.",
            options: {
                dynamicBodyCount: Math.max(options.dynamicBodyCount ?? 16, 96),
                contactPairCount: Math.max(options.contactPairCount ?? 4, 24),
                fixedSteps: Math.max(24, Math.floor((options.fixedSteps ?? 60) / 2)),
                queryRepeats: Math.max(4, Math.floor((options.queryRepeats ?? 12) / 2)),
                ...(jointCount === undefined ? {} : { jointCount }),
                ...(characterMoveRepeats === undefined ? {} : { characterMoveRepeats }),
                ...(debugGeometryRepeats === undefined ? {} : { debugGeometryRepeats }),
                ...(resyncRepeats === undefined ? {} : { resyncRepeats }),
                ...(gravity === undefined ? {} : { gravity }),
                ...(execution === undefined ? {} : { execution }),
                ...(fixedDelta === undefined ? {} : { fixedDelta }),
            },
        },
    ];
}
export async function runPhysicsBackendBenchmarkScenarios(createBackend, scenarios = createDefaultPhysicsBackendBenchmarkScenarios()) {
    const reports = [];
    for (const scenario of scenarios) {
        const backend = await createBackend();
        const report = await runPhysicsBackendBenchmark(backend, scenario.options);
        reports.push({
            name: scenario.name,
            description: scenario.description,
            report,
        });
    }
    return {
        scenarioCount: reports.length,
        scenarios: reports,
    };
}
export async function runPhysicsBackendBenchmark(backend, options = {}) {
    const startedAt = performanceNow();
    const dynamicBodyCount = finiteInteger(options.dynamicBodyCount, 8, 0, 256);
    const contactPairCount = finiteInteger(options.contactPairCount, 4, 0, 256);
    const jointCount = finiteInteger(options.jointCount, 0, 0, 256);
    const characterMoveRepeats = finiteInteger(options.characterMoveRepeats, 0, 0, 10_000);
    const debugGeometryRepeats = finiteInteger(options.debugGeometryRepeats, 0, 0, 10_000);
    const resyncRepeats = finiteInteger(options.resyncRepeats, 0, 0, 10_000);
    const fixedSteps = finiteInteger(options.fixedSteps, 60, 0, 10_000);
    const fixedDelta = finitePositive(options.fixedDelta, 1 / 60);
    const queryRepeats = finiteInteger(options.queryRepeats, 8, 0, 10_000);
    const gravity = finiteVec3(options.gravity, defaultGravity);
    const execution = options.execution ?? backend.execution;
    const initialize = options.initialize !== false;
    const shouldDispose = options.dispose !== false;
    let initMs = 0;
    let syncMs;
    let stepMs = 0;
    let readbackMs = 0;
    let queryMs;
    let sync;
    let readback = null;
    let eventCount;
    const eventKindCounts = new Map();
    let raycastFirstHitCount = 0;
    let sensorRaycastHitCount = 0;
    let groupedRaycastHitCount = 0;
    let overlapHitCount = 0;
    let shapeCastHitCount = 0;
    let projectPointHitCount = 0;
    let characterMoveCount = 0;
    let characterCollisionCount = 0;
    let characterGroundedCount = 0;
    let debugGeometryCallCount = 0;
    let debugLineCount = 0;
    let commandCount;
    let syncCount;
    let resyncCommandCount = 0;
    let queryCount = 0;
    let lastRaycastFirst = null;
    let lastSensorRaycast = [];
    let lastGroupedRaycast = [];
    let lastOverlapEntities = [];
    let lastShapeCast = null;
    let lastProjection = null;
    let lastCharacterMove = null;
    const results = createPhysicsResultBuffer();
    const memoryCheckpoints = [];
    const stepSamplePoints = createStepSamplePoints(fixedSteps);
    recordBenchmarkMemoryCheckpoint(memoryCheckpoints, "beforeInit");
    try {
        if (initialize) {
            const initStartedAt = performanceNow();
            await backend.init({ gravity, execution });
            initMs = elapsedSince(initStartedAt);
        }
        recordBenchmarkMemoryCheckpoint(memoryCheckpoints, "afterInit");
        const commands = createBenchmarkCommands(dynamicBodyCount, contactPairCount, jointCount, characterMoveRepeats > 0);
        const syncStartedAt = performanceNow();
        sync = backend.sync({ commands });
        syncMs = elapsedSince(syncStartedAt);
        commandCount = commands.length;
        syncCount = 1;
        recordBenchmarkMemoryCheckpoint(memoryCheckpoints, "afterSync");
        if (resyncRepeats > 0) {
            const resyncStartedAt = performanceNow();
            for (let repeat = 0; repeat < resyncRepeats; repeat += 1) {
                const resyncCommands = createBenchmarkResyncCommands(repeat);
                resyncCommandCount += resyncCommands.length;
                commandCount += resyncCommands.length;
                sync = backend.sync({ commands: resyncCommands });
                syncCount += 1;
            }
            syncMs += elapsedSince(resyncStartedAt);
            recordBenchmarkMemoryCheckpoint(memoryCheckpoints, "afterResync");
        }
        for (let step = 0; step < fixedSteps; step += 1) {
            const stepIndex = step + 1;
            const stepStartedAt = performanceNow();
            backend.step(fixedDelta, stepIndex);
            stepMs += elapsedSince(stepStartedAt);
            const read = readBenchmarkResults(backend, results, eventKindCounts);
            readback = read.report;
            readbackMs += read.elapsedMs;
            if (stepSamplePoints.has(stepIndex)) {
                recordBenchmarkMemoryCheckpoint(memoryCheckpoints, `afterStep:${stepIndex}`, stepIndex);
            }
        }
        if (readback === null) {
            const read = readBenchmarkResults(backend, results, eventKindCounts);
            readback = read.report;
            readbackMs += read.elapsedMs;
        }
        recordBenchmarkMemoryCheckpoint(memoryCheckpoints, "afterReadback");
        eventCount = sumEventKindCounts(eventKindCounts);
        const queryStartedAt = performanceNow();
        for (let repeat = 0; repeat < queryRepeats; repeat += 1) {
            lastRaycastFirst = backend.raycastFirst({
                origin: [0, 0, 0],
                direction: [1, 0, 0],
                maxDistance: 8,
            });
            raycastFirstHitCount += lastRaycastFirst === null ? 0 : 1;
            queryCount += 1;
            lastSensorRaycast = backend.raycastAll({
                origin: [0, 0, 0],
                direction: [1, 0, 0],
                maxDistance: 8,
            }, { includeSensors: true });
            sensorRaycastHitCount += lastSensorRaycast.length;
            queryCount += 1;
            lastGroupedRaycast = backend.raycastAll({
                origin: [0, 0, 0],
                direction: [1, 0, 0],
                maxDistance: 8,
            }, { collisionGroups: groupA, includeSensors: true });
            groupedRaycastHitCount += lastGroupedRaycast.length;
            queryCount += 1;
            const overlap = backend.overlapShape?.(querySphere, {
                translation: [4, 0, 0],
                rotation: identityRotation,
            }, { includeSensors: true });
            if (overlap !== undefined) {
                lastOverlapEntities = overlap.map((hit) => hit.entity);
                overlapHitCount += overlap.length;
                queryCount += 1;
            }
            lastShapeCast =
                backend.castShapeFirst?.(querySphere, {
                    from: { translation: [0, 0, 0], rotation: identityRotation },
                    to: { translation: [7, 0, 0], rotation: identityRotation },
                }, { includeSensors: true }) ?? null;
            if (backend.castShapeFirst !== undefined) {
                shapeCastHitCount += lastShapeCast === null ? 0 : 1;
                queryCount += 1;
            }
            lastProjection =
                backend.projectPoint?.([4.2, 0, 0], {
                    includeSensors: true,
                }) ?? null;
            if (backend.projectPoint !== undefined) {
                projectPointHitCount += lastProjection === null ? 0 : 1;
                queryCount += 1;
            }
        }
        if (backend.moveCharacter !== undefined) {
            for (let repeat = 0; repeat < characterMoveRepeats; repeat += 1) {
                lastCharacterMove =
                    backend.moveCharacter({
                        entity: "benchmark::character",
                        desiredTranslation: [0.28, -0.02, 0.18],
                        settings: {
                            snapToGroundDistance: 0.12,
                            maxSlopeClimbAngle: Math.PI / 4,
                            minSlopeSlideAngle: Math.PI / 3,
                            autostep: false,
                        },
                    }) ?? null;
                queryCount += 1;
                if (lastCharacterMove !== null) {
                    characterMoveCount += 1;
                    characterCollisionCount += lastCharacterMove.collisions.length;
                    characterGroundedCount += lastCharacterMove.grounded ? 1 : 0;
                }
            }
        }
        if (backend.debugGeometry !== undefined) {
            for (let repeat = 0; repeat < debugGeometryRepeats; repeat += 1) {
                const geometry = backend.debugGeometry({
                    colliderWireframes: true,
                    broadphaseAabbs: true,
                    bodyStateMarkers: true,
                });
                debugGeometryCallCount += 1;
                debugLineCount += geometry.lines.length;
            }
        }
        queryMs = elapsedSince(queryStartedAt);
        recordBenchmarkMemoryCheckpoint(memoryCheckpoints, "afterQueries");
        const unsupportedFeatures = collectUnsupportedBenchmarkFeatures({
            backend: backend.kind,
            characterMoveRepeats,
            moveCharacterSupported: backend.moveCharacter !== undefined,
            debugGeometryRepeats,
            debugGeometrySupported: backend.debugGeometry !== undefined,
            syncUnsupportedFeatures: sync.unsupportedFeatures,
        });
        return {
            backend: {
                kind: backend.kind,
                version: backend.version,
                build: backend.build,
                execution: backend.execution,
                capabilities: clonePhysicsBackendCapabilities(backend.capabilities),
            },
            input: {
                dynamicBodyCount,
                contactPairCount,
                jointCount,
                characterMoveRepeats,
                debugGeometryRepeats,
                resyncRepeats,
                fixedSteps,
                fixedDelta,
                queryRepeats,
                gravity,
                execution,
            },
            support: {
                overlapShape: backend.overlapShape !== undefined,
                castShapeFirst: backend.castShapeFirst !== undefined,
                projectPoint: backend.projectPoint !== undefined,
                moveCharacter: backend.moveCharacter !== undefined,
                debugGeometry: backend.debugGeometry !== undefined,
            },
            counts: {
                commandCount,
                syncCount,
                resyncCommandCount,
                bodyCount: sync.bodyCount,
                colliderCount: sync.colliderCount,
                jointCount: sync.jointCount,
                readbackBodyCount: readback.bodyCount,
                eventCount,
                unsupportedFeatureCount: unsupportedFeatures.length,
                queryCount,
                raycastFirstHitCount,
                sensorRaycastHitCount,
                groupedRaycastHitCount,
                overlapHitCount,
                shapeCastHitCount,
                projectPointHitCount,
                characterMoveCount,
                characterCollisionCount,
                characterGroundedCount,
                debugGeometryCallCount,
                debugLineCount,
            },
            timingsMs: {
                initMs: roundMetric(initMs),
                syncMs: roundMetric(syncMs),
                stepMs: roundMetric(stepMs),
                readbackMs: roundMetric(readbackMs),
                queryMs: roundMetric(queryMs),
                totalMs: roundMetric(elapsedSince(startedAt)),
            },
            memory: createBenchmarkMemoryReport(memoryCheckpoints),
            events: {
                totalCount: eventCount,
                byKind: sortedEventKindCounts(eventKindCounts),
            },
            signature: createBenchmarkSignature({
                bodies: results.bodies.map((body) => ({
                    entity: body.entity,
                    y: body.transform.translation[1],
                })),
                raycastFirst: lastRaycastFirst,
                sensorRaycast: lastSensorRaycast,
                groupedRaycast: lastGroupedRaycast,
                overlapEntities: lastOverlapEntities,
                shapeCast: lastShapeCast,
                projection: lastProjection,
                characterMove: lastCharacterMove,
            }),
            unsupportedFeatures,
        };
    }
    finally {
        if (shouldDispose) {
            backend.dispose();
        }
    }
}
function collectUnsupportedBenchmarkFeatures(options) {
    const features = [...options.syncUnsupportedFeatures];
    if (options.characterMoveRepeats > 0 &&
        options.moveCharacterSupported !== true) {
        features.push({
            code: "physics.characterController.unsupported",
            feature: "characterController.moveCharacter",
            backend: options.backend,
            entity: "benchmark::character",
            value: options.characterMoveRepeats,
            message: "The benchmark requested character movement, but the active backend does not expose PhysicsBackend.moveCharacter(...).",
            suggestedFix: "Use a backend with character-controller support for character-heavy workloads, or treat this adapter as partial until moveCharacter is implemented.",
        });
    }
    if (options.debugGeometryRepeats > 0 &&
        options.debugGeometrySupported !== true) {
        features.push({
            code: "physics.debugGeometry.unsupported",
            feature: "debugGeometry",
            backend: options.backend,
            entity: "benchmark::debug",
            value: options.debugGeometryRepeats,
            message: "The benchmark requested debug geometry, but the active backend does not expose PhysicsBackend.debugGeometry(...).",
            suggestedFix: "Use a backend with debug-geometry support for debug-heavy workloads, or treat this adapter as partial until debugGeometry is implemented.",
        });
    }
    return features;
}
function clonePhysicsBackendCapabilities(capabilities) {
    return {
        compoundColliders: capabilities.compoundColliders,
        continuousCollisionDetection: capabilities.continuousCollisionDetection,
        characterController: capabilities.characterController,
        linkedBodyContacts: capabilities.linkedBodyContacts,
        combinedPositionVelocityMotors: capabilities.combinedPositionVelocityMotors,
        motorForceLimits: capabilities.motorForceLimits,
        automaticBreakForce: capabilities.automaticBreakForce,
        jointImpulseReadback: capabilities.jointImpulseReadback,
        pairedNonFixedFrameB: capabilities.pairedNonFixedFrameB,
    };
}
function readBenchmarkResults(backend, out, eventKinds) {
    const readbackStartedAt = performanceNow();
    const report = backend.readResults(out);
    const elapsedMs = elapsedSince(readbackStartedAt);
    for (const event of out.events) {
        eventKinds.set(event.kind, (eventKinds.get(event.kind) ?? 0) + 1);
    }
    return { report, elapsedMs };
}
function createBenchmarkCommands(dynamicBodyCount, contactPairCount, jointCount, includeCharacterController) {
    const commands = [
        bodyCommand("benchmark::solid-a", [2, 0, 0], {
            bodyType: PhysicsRigidBodyType.Static,
            radius: 0.5,
            collisionGroups: groupA,
        }),
        bodyCommand("benchmark::sensor-a", [4, 0, 0], {
            bodyType: PhysicsRigidBodyType.Static,
            radius: 0.5,
            sensor: true,
            collisionGroups: groupA,
        }),
        bodyCommand("benchmark::solid-b", [6, 0, 0], {
            bodyType: PhysicsRigidBodyType.Static,
            radius: 0.5,
            collisionGroups: groupB,
        }),
        bodyCommand("benchmark::event-sensor", [-4, 0, 0], {
            bodyType: PhysicsRigidBodyType.Static,
            radius: 0.5,
            sensor: true,
            collisionGroups: groupA,
        }),
        bodyCommand("benchmark::event-trigger-body", [-4, 0, 0], {
            bodyType: PhysicsRigidBodyType.Dynamic,
            radius: 0.25,
            collisionGroups: groupA,
        }),
        bodyCommand("benchmark::event-solid", [-5.25, 0, 0], {
            bodyType: PhysicsRigidBodyType.Static,
            radius: 0.5,
            collisionGroups: groupA,
        }),
        bodyCommand("benchmark::event-collider-body", [-5.25, 0.35, 0], {
            bodyType: PhysicsRigidBodyType.Dynamic,
            radius: 0.25,
            collisionGroups: groupA,
        }),
        {
            kind: "emitTrigger",
            entityA: "benchmark::event-sensor",
            entityB: "benchmark::event-trigger-body",
        },
    ];
    for (let index = 0; index < contactPairCount; index += 1) {
        const x = -8 - index * 0.8;
        commands.push(bodyCommand(`benchmark::contact-static-${index}`, [x, 0, 0], {
            bodyType: PhysicsRigidBodyType.Static,
            radius: 0.5,
            collisionGroups: groupA,
        }), bodyCommand(`benchmark::contact-dynamic-${index}`, [x, 0.6, 0], {
            bodyType: PhysicsRigidBodyType.Dynamic,
            radius: 0.25,
            collisionGroups: groupA,
            velocity: [0, -0.05, 0],
            externalForce: [0, -0.1, 0],
        }));
    }
    for (let index = 0; index < dynamicBodyCount; index += 1) {
        const column = index % 8;
        const row = Math.floor(index / 8);
        const x = -2.8 + column * 0.8;
        const y = 2 + row * 0.65 + column * 0.03;
        commands.push(bodyCommand(`benchmark::dynamic-${index}`, [x, y, 0], {
            bodyType: PhysicsRigidBodyType.Dynamic,
            radius: 0.25,
            collisionGroups: groupA,
            velocity: [0.015 * (column + 1), -0.02 * (row + 1), 0],
            externalForce: [0, -0.1, 0],
        }));
    }
    for (let index = 0; index < jointCount; index += 1) {
        const x = 10 + index * 0.75;
        const anchor = `benchmark::joint-anchor-${index}`;
        const bob = `benchmark::joint-bob-${index}`;
        commands.push(bodyCommand(anchor, [x, 1.5, 0], {
            bodyType: PhysicsRigidBodyType.Static,
            radius: 0.18,
            collisionGroups: groupB,
        }), bodyCommand(bob, [x, 0.7, 0], {
            bodyType: PhysicsRigidBodyType.Dynamic,
            radius: 0.18,
            collisionGroups: groupB,
            velocity: [0.01, -0.03, 0],
            externalForce: [0, -0.08, 0],
        }), {
            kind: "upsertJoint",
            entity: `benchmark::distance-joint-${index}`,
            joint: {
                kind: "distance",
                bodyARef: anchor,
                bodyBRef: bob,
                anchorA: [0, 0, 0],
                anchorB: [0, 0, 0],
                axis: [1, 0, 0],
                maxLimit: 1.25,
                contactsEnabled: true,
            },
        });
    }
    if (includeCharacterController) {
        commands.push(...createBenchmarkCharacterCommands());
    }
    return commands;
}
function createBenchmarkCharacterCommands() {
    return [
        {
            kind: "upsertBody",
            entity: "benchmark::character-floor",
            bodyType: PhysicsRigidBodyType.Static,
            transform: {
                translation: [0, -0.05, 0],
                rotation: identityRotation,
            },
            collider: {
                shape: { kind: "box", halfExtents: [6, 0.05, 6] },
                collisionGroups: groupA,
            },
        },
        {
            kind: "upsertBody",
            entity: "benchmark::character-wall",
            bodyType: PhysicsRigidBodyType.Static,
            transform: {
                translation: [0.8, 0.75, 0.25],
                rotation: identityRotation,
            },
            collider: {
                shape: { kind: "box", halfExtents: [0.05, 0.75, 0.5] },
                collisionGroups: groupA,
            },
        },
        {
            kind: "upsertBody",
            entity: "benchmark::character",
            bodyType: PhysicsRigidBodyType.KinematicPosition,
            transform: {
                translation: [0, 0.75, 0],
                rotation: identityRotation,
            },
            collider: {
                shape: { kind: "capsule", radius: 0.25, halfHeight: 0.5 },
                collisionGroups: groupA,
            },
        },
    ];
}
function createBenchmarkResyncCommands(repeat) {
    const commands = [];
    const previousEntity = `benchmark::churn-body-${repeat - 1}`;
    const entity = `benchmark::churn-body-${repeat}`;
    const column = repeat % 6;
    const row = Math.floor(repeat / 6);
    if (repeat > 0) {
        commands.push({ kind: "destroyBody", entity: previousEntity });
    }
    commands.push(bodyCommand(entity, [8 + column * 0.35, 1.25 + row * 0.12, -0.45], {
        bodyType: PhysicsRigidBodyType.Dynamic,
        radius: 0.16 + (repeat % 3) * 0.02,
        collisionGroups: groupB,
        velocity: [0.012 * (column + 1), -0.018, 0.006],
        externalForce: [0, -0.05, 0],
    }));
    return commands;
}
function bodyCommand(entity, translation, options) {
    return {
        kind: "upsertBody",
        entity,
        transform: {
            translation,
            rotation: identityRotation,
        },
        bodyType: options.bodyType,
        canSleep: false,
        velocity: {
            linear: options.velocity ?? [0, 0, 0],
            angular: [0, 0, 0],
        },
        ...(options.externalForce === undefined
            ? {}
            : {
                externalForce: {
                    force: options.externalForce,
                    torque: [0, 0, 0],
                },
            }),
        collider: {
            shape: { kind: "sphere", radius: options.radius },
            ...(options.sensor === undefined ? {} : { sensor: options.sensor }),
            density: options.bodyType === PhysicsRigidBodyType.Dynamic ? 1 : 0,
            collisionGroups: options.collisionGroups,
        },
    };
}
function createBenchmarkSignature(input) {
    const firstBody = input.bodies[0] ?? null;
    const bodyYs = input.bodies.map((body) => body.y);
    const minBodyY = bodyYs.length === 0 ? null : Math.min(...bodyYs);
    const maxBodyY = bodyYs.length === 0 ? null : Math.max(...bodyYs);
    const groupedRaycastEntities = input.groupedRaycast.map((hit) => hit.entity);
    const overlapEntities = [...input.overlapEntities].sort();
    const signature = {
        firstBodyEntity: firstBody?.entity ?? null,
        firstBodyY: firstBody === null ? null : roundMetric(firstBody.y),
        minBodyY: minBodyY === null ? null : roundMetric(minBodyY),
        maxBodyY: maxBodyY === null ? null : roundMetric(maxBodyY),
        raycastFirstEntity: input.raycastFirst?.entity ?? null,
        sensorRaycastFirstEntity: input.sensorRaycast[0]?.entity ?? null,
        groupedRaycastEntities,
        overlapEntities,
        shapeCastEntity: input.shapeCast?.entity ?? null,
        projectPointEntity: input.projection?.entity ?? null,
        characterEntity: input.characterMove?.entity ?? null,
        characterTargetX: input.characterMove === null
            ? null
            : roundMetric(input.characterMove.targetTranslation[0]),
        characterGrounded: input.characterMove?.grounded ?? null,
        characterCollisionCount: input.characterMove?.collisions.length ?? 0,
    };
    return {
        ...signature,
        value: JSON.stringify(signature),
    };
}
function sortedEventKindCounts(counts) {
    return [...counts.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((left, right) => left.kind.localeCompare(right.kind));
}
function sumEventKindCounts(counts) {
    let total = 0;
    for (const count of counts.values()) {
        total += count;
    }
    return total;
}
function finiteInteger(value, fallback, min, max) {
    if (value === undefined || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.trunc(value)));
}
function finitePositive(value, fallback) {
    return value !== undefined && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}
function finiteVec3(value, fallback) {
    if (value === undefined ||
        !Number.isFinite(value[0]) ||
        !Number.isFinite(value[1]) ||
        !Number.isFinite(value[2])) {
        return [fallback[0], fallback[1], fallback[2]];
    }
    return [value[0], value[1], value[2]];
}
function elapsedSince(start) {
    return Math.max(0, performanceNow() - start);
}
function performanceNow() {
    return globalThis.performance?.now() ?? Date.now();
}
function roundMetric(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.round(value * 1000) / 1000;
}
function createBenchmarkMemoryReport(checkpointSamples) {
    const before = checkpointSamples[0]?.sample ?? sampleBenchmarkMemory();
    const after = checkpointSamples[checkpointSamples.length - 1]?.sample ?? before;
    const usedBeforeBytes = finiteByteCount(before.usedBytes);
    const usedAfterBytes = finiteByteCount(after.usedBytes);
    const totalBeforeBytes = finiteByteCount(before.totalBytes);
    const totalAfterBytes = finiteByteCount(after.totalBytes);
    const limitBytes = finiteByteCount(after.limitBytes ?? before.limitBytes);
    const source = after.source !== "unavailable" || before.source === "unavailable"
        ? after.source
        : before.source;
    const checkpoints = createBenchmarkMemoryCheckpoints(checkpointSamples);
    const peakUsedBytes = maxFiniteByteCount(checkpoints.map((checkpoint) => checkpoint.usedBytes));
    const peakDeltaBytes = maxFiniteByteCount(checkpoints.map((checkpoint) => checkpoint.deltaFromStartBytes));
    return {
        available: usedBeforeBytes !== null && usedAfterBytes !== null,
        source,
        usedBeforeBytes,
        usedAfterBytes,
        deltaBytes: usedBeforeBytes === null || usedAfterBytes === null
            ? null
            : usedAfterBytes - usedBeforeBytes,
        totalBeforeBytes,
        totalAfterBytes,
        limitBytes,
        checkpointCount: checkpoints.length,
        peakUsedBytes,
        peakDeltaBytes,
        checkpoints,
    };
}
function recordBenchmarkMemoryCheckpoint(checkpoints, label, stepIndex = null) {
    checkpoints.push({
        label,
        stepIndex,
        sample: sampleBenchmarkMemory(),
    });
}
function createBenchmarkMemoryCheckpoints(checkpointSamples) {
    const firstUsedBytes = checkpointSamples.length === 0
        ? null
        : finiteByteCount(checkpointSamples[0]?.sample.usedBytes);
    let previousUsedBytes = null;
    return checkpointSamples.map((checkpoint) => {
        const usedBytes = finiteByteCount(checkpoint.sample.usedBytes);
        const totalBytes = finiteByteCount(checkpoint.sample.totalBytes);
        const limitBytes = finiteByteCount(checkpoint.sample.limitBytes);
        const deltaFromStartBytes = firstUsedBytes === null || usedBytes === null
            ? null
            : usedBytes - firstUsedBytes;
        const deltaFromPreviousBytes = previousUsedBytes === null || usedBytes === null
            ? null
            : usedBytes - previousUsedBytes;
        previousUsedBytes = usedBytes;
        return {
            label: checkpoint.label,
            stepIndex: checkpoint.stepIndex,
            source: checkpoint.sample.source,
            usedBytes,
            totalBytes,
            limitBytes,
            deltaFromStartBytes,
            deltaFromPreviousBytes,
        };
    });
}
function createStepSamplePoints(fixedSteps) {
    if (fixedSteps <= 0) {
        return new Set();
    }
    return new Set([1, Math.max(1, Math.floor(fixedSteps / 2)), fixedSteps]);
}
function sampleBenchmarkMemory() {
    const performanceMemory = globalThis.performance?.memory;
    if (performanceMemory !== undefined) {
        return {
            source: "performance.memory",
            usedBytes: finiteByteCount(performanceMemory.usedJSHeapSize),
            totalBytes: finiteByteCount(performanceMemory.totalJSHeapSize),
            limitBytes: finiteByteCount(performanceMemory.jsHeapSizeLimit),
        };
    }
    const processMemoryUsage = globalThis.process?.memoryUsage;
    if (processMemoryUsage !== undefined) {
        const memory = processMemoryUsage();
        return {
            source: "process.memoryUsage",
            usedBytes: finiteByteCount(memory.heapUsed),
            totalBytes: finiteByteCount(memory.heapTotal),
            limitBytes: null,
        };
    }
    return {
        source: "unavailable",
        usedBytes: null,
        totalBytes: null,
        limitBytes: null,
    };
}
function finiteByteCount(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return null;
    }
    return Math.max(0, Math.round(value));
}
function maxFiniteByteCount(values) {
    let max = null;
    for (const value of values) {
        if (value === null || value === undefined || !Number.isFinite(value)) {
            continue;
        }
        const byteCount = Math.round(value);
        max = max === null ? byteCount : Math.max(max, byteCount);
    }
    return max;
}
//# sourceMappingURL=benchmark.js.map