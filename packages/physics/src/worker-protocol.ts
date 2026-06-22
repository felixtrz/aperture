import type {
  PhysicsBackendBuild,
  PhysicsBackendKind,
  PhysicsCharacterMove,
  PhysicsCharacterMoveResult,
  PhysicsCommandBuffer,
  PhysicsDebugGeometry,
  PhysicsDebugOptions,
  PhysicsEvent,
  PhysicsExecutionMode,
  PhysicsOverlapHit,
  PhysicsPointProjection,
  PhysicsQueryOptions,
  PhysicsRay,
  PhysicsRaycastHit,
  PhysicsReadbackReport,
  PhysicsResultBuffer,
  PhysicsShapeCast,
  PhysicsShapeCastHit,
  PhysicsStepReport,
  PhysicsTransform,
  PhysicsVelocityValue,
} from "./backend.js";
import { createPhysicsResultBuffer } from "./backend.js";
import type { PhysicsShape, PhysicsVec3 } from "./components.js";

export const PHYSICS_WORKER_PROTOCOL = {
  init: "aperture.physics.init",
  step: "aperture.physics.step",
  action: "aperture.physics.action",
  result: "aperture.physics.result",
  actionResult: "aperture.physics.actionResult",
  error: "aperture.physics.error",
  dispose: "aperture.physics.dispose",
} as const;

export const PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE = 13;

export type PhysicsWorkerExecutionMode = Exclude<
  PhysicsExecutionMode,
  "simulation-worker"
>;

export interface PhysicsWorkerInitMessage {
  readonly type: typeof PHYSICS_WORKER_PROTOCOL.init;
  readonly backend: PhysicsBackendKind;
  readonly backendBuild?: PhysicsBackendBuild;
  readonly execution: PhysicsWorkerExecutionMode;
  readonly gravity?: PhysicsVec3;
}

export interface PhysicsWorkerStepMessage {
  readonly type: typeof PHYSICS_WORKER_PROTOCOL.step;
  readonly fixedDelta: number;
  readonly fixedStep: number;
  readonly commands: PhysicsCommandBuffer;
}

export type PhysicsWorkerAction =
  | {
      readonly kind: "raycastFirst";
      readonly ray: PhysicsRay;
      readonly options?: PhysicsQueryOptions;
    }
  | {
      readonly kind: "raycastAll";
      readonly ray: PhysicsRay;
      readonly options?: PhysicsQueryOptions;
    }
  | {
      readonly kind: "overlapShape";
      readonly shape: PhysicsShape;
      readonly transform: PhysicsTransform;
      readonly options?: PhysicsQueryOptions;
    }
  | {
      readonly kind: "castShapeFirst";
      readonly shape: PhysicsShape;
      readonly cast: PhysicsShapeCast;
      readonly options?: PhysicsQueryOptions;
    }
  | {
      readonly kind: "projectPoint";
      readonly point: PhysicsVec3;
      readonly options?: PhysicsQueryOptions;
    }
  | {
      readonly kind: "moveCharacter";
      readonly move: PhysicsCharacterMove;
    }
  | {
      readonly kind: "sleepBody";
      readonly entity: string;
    }
  | {
      readonly kind: "wakeBody";
      readonly entity: string;
    }
  | {
      readonly kind: "debugGeometry";
      readonly options?: PhysicsDebugOptions;
    };

export interface PhysicsWorkerActionMessage {
  readonly type: typeof PHYSICS_WORKER_PROTOCOL.action;
  readonly requestId: number;
  readonly action: PhysicsWorkerAction;
}

export type PhysicsWorkerActionResult =
  | {
      readonly kind: "raycastFirst";
      readonly hit: PhysicsRaycastHit | null;
    }
  | {
      readonly kind: "raycastAll";
      readonly hits: readonly PhysicsRaycastHit[];
    }
  | {
      readonly kind: "overlapShape";
      readonly hits: readonly PhysicsOverlapHit[];
    }
  | {
      readonly kind: "castShapeFirst";
      readonly hit: PhysicsShapeCastHit | null;
    }
  | {
      readonly kind: "projectPoint";
      readonly projection: PhysicsPointProjection | null;
    }
  | {
      readonly kind: "moveCharacter";
      readonly result: PhysicsCharacterMoveResult | null;
    }
  | {
      readonly kind: "sleepBody";
      readonly changed: boolean;
    }
  | {
      readonly kind: "wakeBody";
      readonly changed: boolean;
    }
  | {
      readonly kind: "debugGeometry";
      readonly geometry: PhysicsDebugGeometry;
    };

export interface PhysicsTransferableResultPacket {
  readonly bodyEntities: readonly string[];
  readonly bodyFloats: Float32Array;
  readonly bodySleeping: Uint8Array;
  readonly events: readonly PhysicsEvent[];
}

export interface PhysicsWorkerResultMessage {
  readonly type: typeof PHYSICS_WORKER_PROTOCOL.result;
  readonly fixedStep: number;
  readonly step: PhysicsStepReport;
  readonly readback: PhysicsReadbackReport;
  readonly results: PhysicsTransferableResultPacket;
}

export interface PhysicsWorkerActionResultMessage {
  readonly type: typeof PHYSICS_WORKER_PROTOCOL.actionResult;
  readonly requestId: number;
  readonly result: PhysicsWorkerActionResult;
}

export interface PhysicsWorkerErrorMessage {
  readonly type: typeof PHYSICS_WORKER_PROTOCOL.error;
  readonly reason: string;
  readonly message: string;
  readonly requestId?: number;
  readonly diagnostics?: readonly unknown[];
}

export interface PhysicsWorkerDisposeMessage {
  readonly type: typeof PHYSICS_WORKER_PROTOCOL.dispose;
}

export type PhysicsWorkerInboundMessage =
  | PhysicsWorkerInitMessage
  | PhysicsWorkerStepMessage
  | PhysicsWorkerActionMessage
  | PhysicsWorkerDisposeMessage;

export type PhysicsWorkerOutboundMessage =
  | PhysicsWorkerResultMessage
  | PhysicsWorkerActionResultMessage
  | PhysicsWorkerErrorMessage;

export interface PhysicsWorkerMessageWithTransfer<TMessage> {
  readonly message: TMessage;
  readonly transfer: Transferable[];
}

export function createPhysicsWorkerStepMessage(input: {
  readonly fixedDelta: number;
  readonly fixedStep: number;
  readonly commands: PhysicsCommandBuffer;
}): PhysicsWorkerMessageWithTransfer<PhysicsWorkerStepMessage> {
  return {
    message: {
      type: PHYSICS_WORKER_PROTOCOL.step,
      fixedDelta: input.fixedDelta,
      fixedStep: input.fixedStep,
      commands: input.commands,
    },
    transfer: [],
  };
}

export function createPhysicsWorkerActionMessage(input: {
  readonly requestId: number;
  readonly action: PhysicsWorkerAction;
}): PhysicsWorkerMessageWithTransfer<PhysicsWorkerActionMessage> {
  return {
    message: {
      type: PHYSICS_WORKER_PROTOCOL.action,
      requestId: input.requestId,
      action: input.action,
    },
    transfer: [],
  };
}

export function createPhysicsWorkerResultMessage(input: {
  readonly fixedStep: number;
  readonly step: PhysicsStepReport;
  readonly readback: PhysicsReadbackReport;
  readonly results: PhysicsResultBuffer;
}): PhysicsWorkerMessageWithTransfer<PhysicsWorkerResultMessage> {
  const packet = encodePhysicsResultPacket(input.results);

  return {
    message: {
      type: PHYSICS_WORKER_PROTOCOL.result,
      fixedStep: input.fixedStep,
      step: input.step,
      readback: input.readback,
      results: packet,
    },
    transfer: collectPhysicsResultTransferables(packet),
  };
}

export function createPhysicsWorkerActionResultMessage(input: {
  readonly requestId: number;
  readonly result: PhysicsWorkerActionResult;
}): PhysicsWorkerMessageWithTransfer<PhysicsWorkerActionResultMessage> {
  return {
    message: {
      type: PHYSICS_WORKER_PROTOCOL.actionResult,
      requestId: input.requestId,
      result: input.result,
    },
    transfer: [],
  };
}

export function encodePhysicsResultPacket(
  results: PhysicsResultBuffer,
): PhysicsTransferableResultPacket {
  const bodyEntities: string[] = [];
  const bodyFloats = new Float32Array(
    results.bodies.length * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE,
  );
  const bodySleeping = new Uint8Array(results.bodies.length);

  results.bodies.forEach((body, index) => {
    bodyEntities.push(body.entity);
    writeBodyFloats(bodyFloats, index, body.transform, body.velocity);
    bodySleeping[index] = body.sleeping ? 1 : 0;
  });

  return {
    bodyEntities,
    bodyFloats,
    bodySleeping,
    events: results.events.map(clonePhysicsEvent),
  };
}

export function decodePhysicsResultPacket(
  packet: PhysicsTransferableResultPacket,
  out: PhysicsResultBuffer = createPhysicsResultBuffer(),
): PhysicsResultBuffer {
  const bodyCount = packet.bodyEntities.length;
  const expectedFloats = bodyCount * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE;

  if (packet.bodyFloats.length !== expectedFloats) {
    throw new Error(
      `Physics worker result packet bodyFloats length mismatch: expected ${expectedFloats}, received ${packet.bodyFloats.length}.`,
    );
  }
  if (packet.bodySleeping.length !== bodyCount) {
    throw new Error(
      `Physics worker result packet bodySleeping length mismatch: expected ${bodyCount}, received ${packet.bodySleeping.length}.`,
    );
  }

  out.bodies.length = 0;
  out.events.length = 0;

  for (let index = 0; index < bodyCount; index += 1) {
    out.bodies.push({
      entity: packet.bodyEntities[index] ?? "",
      transform: readBodyTransform(packet.bodyFloats, index),
      velocity: readBodyVelocity(packet.bodyFloats, index),
      sleeping: packet.bodySleeping[index] !== 0,
    });
  }

  out.events.push(...packet.events.map(clonePhysicsEvent));
  return out;
}

export function collectPhysicsResultTransferables(
  packet: PhysicsTransferableResultPacket,
): Transferable[] {
  const transfer: Transferable[] = [];
  pushTransferableBuffer(transfer, packet.bodyFloats.buffer);
  pushTransferableBuffer(transfer, packet.bodySleeping.buffer);
  return transfer;
}

function writeBodyFloats(
  bodyFloats: Float32Array,
  index: number,
  transform: PhysicsTransform,
  velocity: PhysicsVelocityValue,
): void {
  const offset = index * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE;

  bodyFloats.set(transform.translation, offset);
  bodyFloats.set(transform.rotation, offset + 3);
  bodyFloats.set(velocity.linear, offset + 7);
  bodyFloats.set(velocity.angular, offset + 10);
}

function readBodyTransform(
  bodyFloats: Float32Array,
  index: number,
): PhysicsTransform {
  const offset = index * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE;

  return {
    translation: [
      bodyFloats[offset] ?? 0,
      bodyFloats[offset + 1] ?? 0,
      bodyFloats[offset + 2] ?? 0,
    ],
    rotation: [
      bodyFloats[offset + 3] ?? 0,
      bodyFloats[offset + 4] ?? 0,
      bodyFloats[offset + 5] ?? 0,
      bodyFloats[offset + 6] ?? 1,
    ],
  };
}

function readBodyVelocity(
  bodyFloats: Float32Array,
  index: number,
): PhysicsVelocityValue {
  const offset = index * PHYSICS_TRANSFERABLE_BODY_FLOAT_STRIDE;

  return {
    linear: [
      bodyFloats[offset + 7] ?? 0,
      bodyFloats[offset + 8] ?? 0,
      bodyFloats[offset + 9] ?? 0,
    ],
    angular: [
      bodyFloats[offset + 10] ?? 0,
      bodyFloats[offset + 11] ?? 0,
      bodyFloats[offset + 12] ?? 0,
    ],
  };
}

function clonePhysicsEvent(event: PhysicsEvent): PhysicsEvent {
  return {
    ...event,
    ...(event.point === undefined
      ? {}
      : { point: [...event.point] as [number, number, number] }),
    ...(event.normal === undefined
      ? {}
      : { normal: [...event.normal] as [number, number, number] }),
    ...(event.force === undefined
      ? {}
      : { force: [...event.force] as [number, number, number] }),
  };
}

function pushTransferableBuffer(
  transfer: Transferable[],
  buffer: ArrayBufferLike,
): void {
  if (buffer instanceof ArrayBuffer && buffer.byteLength > 0) {
    transfer.push(buffer);
  }
}
