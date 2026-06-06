import type { EcsWorld } from "@aperture-engine/simulation";
import {
  type PhysicsBackend,
  type PhysicsCommandBuffer,
  type PhysicsReadbackReport,
  type PhysicsResultBuffer,
  type PhysicsStepReport,
  createPhysicsResultBuffer,
} from "./backend.js";
import {
  applyPhysicsResultsToWorld,
  collectPhysicsCommands,
  createPhysicsWorldSyncState,
  type PhysicsWorldSyncState,
  type PhysicsWorldWritebackReport,
} from "./ecs-sync.js";
import {
  PHYSICS_WORKER_PROTOCOL,
  createPhysicsWorkerResultMessage,
  createPhysicsWorkerStepMessage,
  decodePhysicsResultPacket,
  type PhysicsTransferableResultPacket,
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
}

export interface PhysicsWorkerTransferProxy {
  readonly execution: "physics-worker-transferable";
  stepWorld(
    options: PhysicsWorkerTransferStepWorldOptions,
  ): Promise<PhysicsWorkerTransferStepWorldReport>;
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
  };
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
