import { resolveWorldTransforms, } from "@aperture-engine/simulation";
import { createPhysicsResultBuffer, } from "./backend.js";
import { applyPhysicsResultsToWorld, collectPhysicsCommands, createPhysicsWorldSyncState, ensureParentedPhysicsBodyWorldTransforms, } from "./ecs-sync.js";
import { PHYSICS_WORKER_PROTOCOL, createPhysicsWorkerActionMessage, createPhysicsWorkerActionResultMessage, createPhysicsWorkerResultMessage, createPhysicsWorkerStepMessage, decodePhysicsResultPacket, } from "./worker-protocol.js";
export class PhysicsWorkerTransferError extends Error {
    reason;
    diagnostics;
    constructor(message, reason = "physics-worker-transfer.error", diagnostics) {
        super(message);
        this.name = "PhysicsWorkerTransferError";
        this.reason = reason;
        if (diagnostics !== undefined) {
            this.diagnostics = diagnostics;
        }
    }
}
export function createPhysicsWorkerTransferProxy(endpoint) {
    const defaultState = createPhysicsWorldSyncState();
    let nextRequestId = 1;
    const requestAction = async (action) => {
        if (endpoint.action === undefined) {
            throw new PhysicsWorkerTransferError("Physics worker endpoint does not support action messages.", "physics-worker-transfer.unsupported-action-endpoint");
        }
        const request = createPhysicsWorkerActionMessage({
            requestId: nextRequestId,
            action,
        });
        nextRequestId += 1;
        const response = await endpoint.action(request);
        const message = response.message;
        if (message.type === PHYSICS_WORKER_PROTOCOL.error) {
            throw createTransferError(message);
        }
        if (message.type !== PHYSICS_WORKER_PROTOCOL.actionResult) {
            throw new PhysicsWorkerTransferError(`Physics worker action expected an action result, received '${String(message.type)}'.`, "physics-worker-transfer.invalid-action-response");
        }
        return message.result;
    };
    return {
        execution: "physics-worker-transferable",
        async stepWorld(options) {
            const state = options.state ?? defaultState;
            // Match stepPhysicsWorld's contract: parented bodies are guaranteed a
            // resolved WorldTransform before commands are collected (AI-3).
            ensureParentedPhysicsBodyWorldTransforms(options.world);
            resolveWorldTransforms(options.world);
            const commands = collectPhysicsCommands(options.world, state);
            const request = createPhysicsWorkerStepMessage({
                fixedDelta: options.fixedDelta,
                fixedStep: options.fixedStep,
                commands,
            });
            const response = await endpoint.step(request);
            const message = response.message;
            if (message.type === PHYSICS_WORKER_PROTOCOL.error) {
                throw createTransferError(message);
            }
            if (message.type !== PHYSICS_WORKER_PROTOCOL.result) {
                throw new PhysicsWorkerTransferError(`Physics worker step expected a step result, received '${String(message.type)}'.`, "physics-worker-transfer.invalid-step-response");
            }
            const decoded = decodePhysicsResultPacket(message.results, state.resultBuffer);
            const writeback = applyPhysicsResultsToWorld(options.world, decoded);
            const events = [...decoded.events];
            return {
                commands: summarizePhysicsCommands(commands),
                step: message.step,
                readback: message.readback,
                writeback,
                events,
                transport: createTransportReport(options.fixedStep, message),
            };
        },
        async raycastFirst(ray, options) {
            const result = await requestAction({
                kind: "raycastFirst",
                ray,
                ...(options === undefined ? {} : { options }),
            });
            return result.kind === "raycastFirst" ? result.hit : null;
        },
        async raycastAll(ray, options) {
            const result = await requestAction({
                kind: "raycastAll",
                ray,
                ...(options === undefined ? {} : { options }),
            });
            return result.kind === "raycastAll" ? result.hits : [];
        },
        async overlapShape(shape, transform, options) {
            const result = await requestAction({
                kind: "overlapShape",
                shape,
                transform,
                ...(options === undefined ? {} : { options }),
            });
            return result.kind === "overlapShape" ? result.hits : [];
        },
        async castShapeFirst(shape, cast, options) {
            const result = await requestAction({
                kind: "castShapeFirst",
                shape,
                cast,
                ...(options === undefined ? {} : { options }),
            });
            return result.kind === "castShapeFirst" ? result.hit : null;
        },
        async projectPoint(point, options) {
            const result = await requestAction({
                kind: "projectPoint",
                point,
                ...(options === undefined ? {} : { options }),
            });
            return result.kind === "projectPoint" ? result.projection : null;
        },
        async moveCharacter(move) {
            const result = await requestAction({ kind: "moveCharacter", move });
            return result.kind === "moveCharacter" ? result.result : null;
        },
        async sleepBody(entity) {
            const result = await requestAction({ kind: "sleepBody", entity });
            return result.kind === "sleepBody" ? result.changed : false;
        },
        async wakeBody(entity) {
            const result = await requestAction({ kind: "wakeBody", entity });
            return result.kind === "wakeBody" ? result.changed : false;
        },
        async debugGeometry(options) {
            const result = await requestAction({
                kind: "debugGeometry",
                ...(options === undefined ? {} : { options }),
            });
            return result.kind === "debugGeometry" ? result.geometry : { lines: [] };
        },
    };
}
export function createPhysicsWorkerBackendEndpoint(backend) {
    const resultBuffer = createPhysicsResultBuffer();
    return {
        step(request) {
            const message = request.message;
            if (message.type !== PHYSICS_WORKER_PROTOCOL.step) {
                return {
                    message: {
                        type: PHYSICS_WORKER_PROTOCOL.error,
                        reason: "physics-worker-transfer.invalid-request",
                        message: `Physics worker backend endpoint expected a step message, received '${String(message.type)}'.`,
                    },
                    transfer: [],
                };
            }
            try {
                backend.sync(message.commands);
                const step = backend.step(message.fixedDelta, message.fixedStep);
                const readback = backend.readResults(resultBuffer);
                return createPhysicsWorkerResultMessage({
                    fixedStep: message.fixedStep,
                    step,
                    readback,
                    results: resultBuffer,
                });
            }
            catch (error) {
                return {
                    message: {
                        type: PHYSICS_WORKER_PROTOCOL.error,
                        reason: "physics-worker-transfer.backend-error",
                        message: error instanceof Error
                            ? error.message
                            : "Physics worker backend step failed.",
                    },
                    transfer: [],
                };
            }
        },
        action(request) {
            const message = request.message;
            if (message.type !== PHYSICS_WORKER_PROTOCOL.action) {
                return {
                    message: {
                        type: PHYSICS_WORKER_PROTOCOL.error,
                        reason: "physics-worker-transfer.invalid-request",
                        message: `Physics worker backend endpoint expected an action message, received '${String(message.type)}'.`,
                    },
                    transfer: [],
                };
            }
            try {
                return createPhysicsWorkerActionResultMessage({
                    requestId: message.requestId,
                    result: executePhysicsWorkerAction(backend, message),
                });
            }
            catch (error) {
                return {
                    message: {
                        type: PHYSICS_WORKER_PROTOCOL.error,
                        reason: "physics-worker-transfer.backend-error",
                        requestId: message.requestId,
                        message: error instanceof Error
                            ? error.message
                            : "Physics worker backend action failed.",
                    },
                    transfer: [],
                };
            }
        },
    };
}
function executePhysicsWorkerAction(backend, message) {
    const action = message.action;
    switch (action.kind) {
        case "raycastFirst":
            return {
                kind: action.kind,
                hit: backend.raycastFirst(action.ray, action.options),
            };
        case "raycastAll":
            return {
                kind: action.kind,
                hits: backend.raycastAll(action.ray, action.options),
            };
        case "overlapShape":
            return {
                kind: action.kind,
                hits: backend.overlapShape?.(action.shape, action.transform, action.options) ?? [],
            };
        case "castShapeFirst":
            return {
                kind: action.kind,
                hit: backend.castShapeFirst?.(action.shape, action.cast, action.options) ??
                    null,
            };
        case "projectPoint":
            return {
                kind: action.kind,
                projection: backend.projectPoint?.(action.point, action.options) ?? null,
            };
        case "moveCharacter":
            return {
                kind: action.kind,
                result: backend.moveCharacter?.(action.move) ?? null,
            };
        case "sleepBody":
            return {
                kind: action.kind,
                changed: backend.sleepBody?.(action.entity) ?? false,
            };
        case "wakeBody":
            return {
                kind: action.kind,
                changed: backend.wakeBody?.(action.entity) ?? false,
            };
        case "debugGeometry":
            return {
                kind: action.kind,
                geometry: backend.debugGeometry?.(action.options) ?? { lines: [] },
            };
    }
}
function summarizePhysicsCommands(buffer) {
    let upsertBodyCount = 0;
    let destroyBodyCount = 0;
    let upsertJointCount = 0;
    let destroyJointCount = 0;
    let otherCommandCount = 0;
    for (const command of buffer.commands) {
        switch (command.kind) {
            case "upsertBody":
                upsertBodyCount += 1;
                break;
            case "destroyBody":
                destroyBodyCount += 1;
                break;
            case "upsertJoint":
                upsertJointCount += 1;
                break;
            case "destroyJoint":
                destroyJointCount += 1;
                break;
            default:
                otherCommandCount += 1;
                break;
        }
    }
    return {
        commandCount: buffer.commands.length,
        upsertBodyCount,
        destroyBodyCount,
        upsertJointCount,
        destroyJointCount,
        otherCommandCount,
    };
}
function createTransportReport(submittedFixedStep, message) {
    const packet = message.results;
    const transferBytes = packet.bodyFloats.byteLength + packet.bodySleeping.byteLength;
    const structuredCloneBytes = estimateStructuredCloneBytes(packet);
    return {
        mode: "physics-worker-transferable",
        submittedFixedStep,
        completedFixedStep: message.fixedStep,
        latencyFrames: Math.max(0, submittedFixedStep - message.fixedStep),
        transferBytes,
        structuredCloneBytes,
        totalResultBytes: transferBytes + structuredCloneBytes,
        resultBodyBytes: packet.bodyFloats.byteLength,
        resultSleepingBytes: packet.bodySleeping.byteLength,
        resultEventCount: packet.events.length,
    };
}
function estimateStructuredCloneBytes(packet) {
    let bytes = 0;
    for (const entity of packet.bodyEntities) {
        bytes += utf8ByteLength(entity);
    }
    for (const event of packet.events) {
        bytes += utf8ByteLength(JSON.stringify(event));
    }
    return bytes;
}
function utf8ByteLength(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code < 0x80) {
            bytes += 1;
        }
        else if (code < 0x800) {
            bytes += 2;
        }
        else if (code >= 0xd800 && code <= 0xdbff) {
            bytes += 4;
            index += 1;
        }
        else {
            bytes += 3;
        }
    }
    return bytes;
}
function createTransferError(message) {
    return new PhysicsWorkerTransferError(message.message, message.reason, message.diagnostics);
}
//# sourceMappingURL=worker-transfer.js.map