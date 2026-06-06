import type { EcsWorld } from "@aperture-engine/simulation";
import {
  type PhysicsBackend,
  type PhysicsCharacterMove,
  type PhysicsCommandBuffer,
  type PhysicsDebugOptions,
  type PhysicsOverlapHit,
  type PhysicsPointProjection,
  type PhysicsQueryOptions,
  type PhysicsRay,
  type PhysicsRaycastHit,
  type PhysicsReadbackReport,
  type PhysicsResultBuffer,
  type PhysicsShapeCast,
  type PhysicsShapeCastHit,
  type PhysicsStepReport,
  type PhysicsTransform,
  createPhysicsResultBuffer,
} from "./backend.js";
import type { PhysicsShape, PhysicsVec3 } from "./components.js";
import {
  applyPhysicsResultsToWorld,
  collectPhysicsCommands,
  createPhysicsWorldSyncState,
  type PhysicsWorldSyncState,
  type PhysicsWorldWritebackReport,
} from "./ecs-sync.js";
import {
  PHYSICS_WORKER_PROTOCOL,
  createPhysicsWorkerActionMessage,
  createPhysicsWorkerActionResultMessage,
  createPhysicsWorkerResultMessage,
  createPhysicsWorkerStepMessage,
  decodePhysicsResultPacket,
  type PhysicsTransferableResultPacket,
  type PhysicsWorkerActionMessage,
  type PhysicsWorkerErrorMessage,
  type PhysicsWorkerMessageWithTransfer,
  type PhysicsWorkerOutboundMessage,
  type PhysicsWorkerResultMessage,
  type PhysicsWorkerStepMessage,
} from "./worker-protocol.js";

export interface PhysicsWorkerTransferEndpoint {
  step(
    request: PhysicsWorkerMessageWithTransfer<PhysicsWorkerStepMessage>,
  ):
    | PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>
    | Promise<PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>>;
  action?(
    request: PhysicsWorkerMessageWithTransfer<PhysicsWorkerActionMessage>,
  ):
    | PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>
    | Promise<PhysicsWorkerMessageWithTransfer<PhysicsWorkerOutboundMessage>>;
}

export interface PhysicsWorkerTransferProxy {
  readonly execution: "physics-worker-transferable";
  stepWorld(
    options: PhysicsWorkerTransferStepWorldOptions,
  ): Promise<PhysicsWorkerTransferStepWorldReport>;
  raycastFirst(
    ray: PhysicsRay,
    options?: PhysicsQueryOptions,
  ): Promise<PhysicsRaycastHit | null>;
  raycastAll(
    ray: PhysicsRay,
    options?: PhysicsQueryOptions,
  ): Promise<readonly PhysicsRaycastHit[]>;
  overlapShape(
    shape: PhysicsShape,
    transform: PhysicsTransform,
    options?: PhysicsQueryOptions,
  ): Promise<readonly PhysicsOverlapHit[]>;
  castShapeFirst(
    shape: PhysicsShape,
    cast: PhysicsShapeCast,
    options?: PhysicsQueryOptions,
  ): Promise<PhysicsShapeCastHit | null>;
  projectPoint(
    point: PhysicsVec3,
    options?: PhysicsQueryOptions,
  ): Promise<PhysicsPointProjection | null>;
  moveCharacter(
    move: PhysicsCharacterMove,
  ): Promise<ReturnType<NonNullable<PhysicsBackend["moveCharacter"]>>>;
  sleepBody(entity: string): Promise<boolean>;
  wakeBody(entity: string): Promise<boolean>;
  debugGeometry(
    options?: PhysicsDebugOptions,
  ): Promise<ReturnType<NonNullable<PhysicsBackend["debugGeometry"]>>>;
}

export interface PhysicsWorkerTransferStepWorldOptions {
  readonly world: EcsWorld;
  readonly fixedDelta: number;
  readonly fixedStep: number;
  readonly state?: PhysicsWorldSyncState;
}

export interface PhysicsWorkerTransferCommandReport {
  readonly commandCount: number;
  readonly upsertBodyCount: number;
  readonly destroyBodyCount: number;
  readonly upsertJointCount: number;
  readonly destroyJointCount: number;
  readonly otherCommandCount: number;
}

export interface PhysicsWorkerTransferTransportReport {
  readonly mode: "physics-worker-transferable";
  readonly submittedFixedStep: number;
  readonly completedFixedStep: number;
  readonly latencyFrames: number;
  readonly transferBytes: number;
  readonly structuredCloneBytes: number;
  readonly totalResultBytes: number;
  readonly resultBodyBytes: number;
  readonly resultSleepingBytes: number;
  readonly resultEventCount: number;
}

export interface PhysicsWorkerTransferStepWorldReport {
  readonly commands: PhysicsWorkerTransferCommandReport;
  readonly step: PhysicsStepReport;
  readonly readback: PhysicsReadbackReport;
  readonly writeback: PhysicsWorldWritebackReport;
  readonly events: readonly PhysicsResultBuffer["events"][number][];
  readonly transport: PhysicsWorkerTransferTransportReport;
}

export class PhysicsWorkerTransferError extends Error {
  readonly reason: string;
  readonly diagnostics?: readonly unknown[];

  constructor(
    message: string,
    reason = "physics-worker-transfer.error",
    diagnostics?: readonly unknown[],
  ) {
    super(message);
    this.name = "PhysicsWorkerTransferError";
    this.reason = reason;
    if (diagnostics !== undefined) {
      this.diagnostics = diagnostics;
    }
  }
}

export function createPhysicsWorkerTransferProxy(
  endpoint: PhysicsWorkerTransferEndpoint,
): PhysicsWorkerTransferProxy {
  const defaultState = createPhysicsWorldSyncState();
  let nextRequestId = 1;
  const requestAction = async (
    action: PhysicsWorkerActionMessage["action"],
  ) => {
    if (endpoint.action === undefined) {
      throw new PhysicsWorkerTransferError(
        "Physics worker endpoint does not support action messages.",
        "physics-worker-transfer.unsupported-action-endpoint",
      );
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
      throw new PhysicsWorkerTransferError(
        `Physics worker action expected an action result, received '${String(
          message.type,
        )}'.`,
        "physics-worker-transfer.invalid-action-response",
      );
    }

    return message.result;
  };

  return {
    execution: "physics-worker-transferable",
    async stepWorld(options) {
      const state = options.state ?? defaultState;
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
        throw new PhysicsWorkerTransferError(
          `Physics worker step expected a step result, received '${String(
            message.type,
          )}'.`,
          "physics-worker-transfer.invalid-step-response",
        );
      }

      const decoded = decodePhysicsResultPacket(
        message.results,
        state.resultBuffer,
      );
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

export function createPhysicsWorkerBackendEndpoint(
  backend: PhysicsBackend,
): PhysicsWorkerTransferEndpoint {
  const resultBuffer = createPhysicsResultBuffer();

  return {
    step(request) {
      const message = request.message;

      if (message.type !== PHYSICS_WORKER_PROTOCOL.step) {
        return {
          message: {
            type: PHYSICS_WORKER_PROTOCOL.error,
            reason: "physics-worker-transfer.invalid-request",
            message: `Physics worker backend endpoint expected a step message, received '${String(
              message.type,
            )}'.`,
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
      } catch (error) {
        return {
          message: {
            type: PHYSICS_WORKER_PROTOCOL.error,
            reason: "physics-worker-transfer.backend-error",
            message:
              error instanceof Error
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
            message: `Physics worker backend endpoint expected an action message, received '${String(
              message.type,
            )}'.`,
          },
          transfer: [],
        };
      }

      try {
        return createPhysicsWorkerActionResultMessage({
          requestId: message.requestId,
          result: executePhysicsWorkerAction(backend, message),
        });
      } catch (error) {
        return {
          message: {
            type: PHYSICS_WORKER_PROTOCOL.error,
            reason: "physics-worker-transfer.backend-error",
            requestId: message.requestId,
            message:
              error instanceof Error
                ? error.message
                : "Physics worker backend action failed.",
          },
          transfer: [],
        };
      }
    },
  };
}

export function executePhysicsWorkerAction(
  backend: PhysicsBackend,
  message: PhysicsWorkerActionMessage,
) {
  const action = message.action;

  switch (action.kind) {
    case "raycastFirst":
      return {
        kind: action.kind,
        hit: backend.raycastFirst(action.ray, action.options),
      } as const;
    case "raycastAll":
      return {
        kind: action.kind,
        hits: backend.raycastAll(action.ray, action.options),
      } as const;
    case "overlapShape":
      return {
        kind: action.kind,
        hits:
          backend.overlapShape?.(
            action.shape,
            action.transform,
            action.options,
          ) ?? [],
      } as const;
    case "castShapeFirst":
      return {
        kind: action.kind,
        hit:
          backend.castShapeFirst?.(action.shape, action.cast, action.options) ??
          null,
      } as const;
    case "projectPoint":
      return {
        kind: action.kind,
        projection:
          backend.projectPoint?.(action.point, action.options) ?? null,
      } as const;
    case "moveCharacter":
      return {
        kind: action.kind,
        result: backend.moveCharacter?.(action.move) ?? null,
      } as const;
    case "sleepBody":
      return {
        kind: action.kind,
        changed: backend.sleepBody?.(action.entity) ?? false,
      } as const;
    case "wakeBody":
      return {
        kind: action.kind,
        changed: backend.wakeBody?.(action.entity) ?? false,
      } as const;
    case "debugGeometry":
      return {
        kind: action.kind,
        geometry: backend.debugGeometry?.(action.options) ?? { lines: [] },
      } as const;
  }
}

export function summarizePhysicsCommands(
  buffer: PhysicsCommandBuffer,
): PhysicsWorkerTransferCommandReport {
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

export function estimatePhysicsTransferableResultBytes(
  packet: PhysicsTransferableResultPacket,
): number {
  return (
    packet.bodyFloats.byteLength +
    packet.bodySleeping.byteLength +
    estimateStructuredCloneBytes(packet)
  );
}

function createTransportReport(
  submittedFixedStep: number,
  message: PhysicsWorkerResultMessage,
): PhysicsWorkerTransferTransportReport {
  const packet = message.results;
  const transferBytes =
    packet.bodyFloats.byteLength + packet.bodySleeping.byteLength;
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

function estimateStructuredCloneBytes(
  packet: PhysicsTransferableResultPacket,
): number {
  let bytes = 0;

  for (const entity of packet.bodyEntities) {
    bytes += utf8ByteLength(entity);
  }
  for (const event of packet.events) {
    bytes += utf8ByteLength(JSON.stringify(event));
  }

  return bytes;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

function createTransferError(
  message: PhysicsWorkerErrorMessage,
): PhysicsWorkerTransferError {
  return new PhysicsWorkerTransferError(
    message.message,
    message.reason,
    message.diagnostics,
  );
}
