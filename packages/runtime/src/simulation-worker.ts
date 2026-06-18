import type { RenderSnapshot } from "@aperture-engine/render";
import type { FixedStepClockOptions } from "@aperture-engine/physics";

export const SIMULATION_WORKER_PROTOCOL = {
  connect: "aperture.simulation.connect",
  start: "aperture.simulation.start",
  ready: "aperture.simulation.ready",
  snapshot: "aperture.simulation.snapshot",
  audioSnapshot: "aperture.simulation.audioSnapshot",
  error: "aperture.simulation.error",
} as const;

export interface SimulationWorkerStartOptions {
  readonly entityCapacity?: number;
  readonly fixedStep?: false | SimulationWorkerFixedStepOptions;
  readonly physicsInterpolation?:
    | boolean
    | SimulationWorkerPhysicsInterpolationOptions;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerFixedStepOptions extends FixedStepClockOptions {
  readonly enabled?: boolean;
}

export interface SimulationWorkerPhysicsInterpolationOptions {
  readonly enabled?: boolean;
}

export interface SimulationWorkerReadyMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.ready;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerSnapshotMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
  readonly snapshot: RenderSnapshot;
  readonly frame?: number;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerAudioSnapshotMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.audioSnapshot;
  readonly snapshot: RenderSnapshot;
  readonly frame?: number;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerErrorMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.error;
  readonly reason: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerSnapshotEvent {
  readonly snapshot: RenderSnapshot;
  readonly frame: number;
  readonly message: SimulationWorkerSnapshotMessage;
}

export interface SimulationWorkerErrorEvent {
  readonly reason: string;
  readonly message: string;
  readonly source: "worker" | "protocol";
  readonly diagnostics?: readonly unknown[];
  readonly raw?: unknown;
}

export type SimulationWorkerSnapshotCallback = (
  event: SimulationWorkerSnapshotEvent,
) => void;

export type SimulationWorkerErrorCallback = (
  event: SimulationWorkerErrorEvent,
) => void;

export type SimulationWorkerMessageCallback = (message: unknown) => void;

export interface SimulationWorker {
  readonly worker: SimulationWorkerTransport;
  start(options?: SimulationWorkerStartOptions): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onMessage(callback: SimulationWorkerMessageCallback): () => void;
  onSnapshot(callback: SimulationWorkerSnapshotCallback): () => void;
  onError(callback: SimulationWorkerErrorCallback): () => void;
  terminate(): void;
}

export interface SimulationWorkerTransport {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  addEventListener?(type: "error", listener: (event: ErrorEvent) => void): void;
  removeEventListener?(
    type: "error",
    listener: (event: ErrorEvent) => void,
  ): void;
}

export interface SimulationMessagePort {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  start?(): void;
  close?(): void;
}

export interface SimulationMessageChannel {
  readonly port1: SimulationMessagePort;
  readonly port2: SimulationMessagePort;
}

export type SimulationWorkerEntry = string | URL | SimulationWorkerTransport;

export type SimulationWorkerFactory = (
  entry: string | URL,
  options?: WorkerOptions,
) => SimulationWorkerTransport;

export interface CreateSimulationWorkerOptions extends SimulationWorkerStartOptions {
  readonly workerOptions?: WorkerOptions;
  readonly workerFactory?: SimulationWorkerFactory;
  readonly messageChannelFactory?: () => SimulationMessageChannel;
}

export interface SimulationWorkerConnectMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.connect;
  readonly port: SimulationMessagePort;
}

export function createSimulationWorker(
  workerEntry: SimulationWorkerEntry,
  options: CreateSimulationWorkerOptions = {},
): SimulationWorker {
  const worker = resolveWorker(workerEntry, options);
  const channelFactory =
    options.messageChannelFactory ?? createDefaultMessageChannel;
  const channel = channelFactory();
  const snapshotCallbacks = new Set<SimulationWorkerSnapshotCallback>();
  const errorCallbacks = new Set<SimulationWorkerErrorCallback>();
  const messageCallbacks = new Set<SimulationWorkerMessageCallback>();
  let terminated = false;

  const handleMessage = (event: MessageEvent<unknown>) => {
    const message = event.data;

    if (!isRecord(message)) {
      return;
    }

    if (message.type === SIMULATION_WORKER_PROTOCOL.snapshot) {
      if (!isSnapshotMessage(message)) {
        dispatchError({
          reason: "simulation-worker.invalid-snapshot",
          message:
            "Simulation worker sent a snapshot message without a valid RenderSnapshot.",
          source: "protocol",
          raw: message,
        });
        return;
      }

      const snapshotEvent: SimulationWorkerSnapshotEvent = {
        snapshot: message.snapshot,
        frame: message.frame ?? message.snapshot.frame,
        message,
      };

      for (const callback of snapshotCallbacks) {
        callback(snapshotEvent);
      }
      return;
    }

    if (message.type === SIMULATION_WORKER_PROTOCOL.error) {
      const diagnostics = Array.isArray(message.diagnostics)
        ? message.diagnostics
        : undefined;
      dispatchError({
        reason: readString(message.reason, "simulation-worker.error"),
        message: readString(
          message.message,
          "The simulation worker reported an error.",
        ),
        source: "worker",
        ...(diagnostics === undefined ? {} : { diagnostics }),
        raw: message,
      });
      return;
    }

    for (const callback of messageCallbacks) {
      callback(message);
    }
  };

  const handleWorkerError = (event: ErrorEvent) => {
    dispatchError({
      reason: "simulation-worker.transport-error",
      message: event.message || "Simulation worker transport failed.",
      source: "worker",
      raw: event,
    });
  };

  function dispatchError(event: SimulationWorkerErrorEvent): void {
    for (const callback of errorCallbacks) {
      callback(event);
    }
  }

  channel.port1.addEventListener("message", handleMessage);
  channel.port1.start?.();
  worker.addEventListener?.("error", handleWorkerError);
  worker.postMessage(
    {
      type: SIMULATION_WORKER_PROTOCOL.connect,
      port: channel.port2,
    } satisfies SimulationWorkerConnectMessage,
    [channel.port2 as unknown as Transferable],
  );

  return {
    worker,
    start(startOptions = {}) {
      if (terminated) {
        throw new Error("Cannot start a terminated SimulationWorker.");
      }

      channel.port1.postMessage({
        type: SIMULATION_WORKER_PROTOCOL.start,
        options: mergeStartOptions(options, startOptions),
      });
    },
    postMessage(message, transfer = []) {
      if (terminated) {
        throw new Error("Cannot post to a terminated SimulationWorker.");
      }

      channel.port1.postMessage(message, transfer);
    },
    onSnapshot(callback) {
      snapshotCallbacks.add(callback);
      return () => {
        snapshotCallbacks.delete(callback);
      };
    },
    onMessage(callback) {
      messageCallbacks.add(callback);
      return () => {
        messageCallbacks.delete(callback);
      };
    },
    onError(callback) {
      errorCallbacks.add(callback);
      return () => {
        errorCallbacks.delete(callback);
      };
    },
    terminate() {
      if (terminated) {
        return;
      }

      terminated = true;
      channel.port1.removeEventListener("message", handleMessage);
      channel.port1.close?.();
      channel.port2.close?.();
      worker.removeEventListener?.("error", handleWorkerError);
      worker.terminate();
      snapshotCallbacks.clear();
      errorCallbacks.clear();
      messageCallbacks.clear();
    },
  };
}

export function renderSnapshotTransferList(
  snapshot: Pick<
    RenderSnapshot,
    | "transforms"
    | "viewMatrices"
    | "bones"
    | "morphTargetWeights"
    | "morphTargetDeltas"
    | "morphInstanceDescriptors"
    | "instanceTints"
    | "instanceAttributes"
    | "quads"
  >,
): Transferable[] {
  return renderSnapshotBufferTransferList(snapshot);
}

function renderSnapshotBufferTransferList(input: {
  readonly transforms: Float32Array;
  readonly viewMatrices: Float32Array;
  readonly bones?: Float32Array;
  readonly morphTargetWeights?: Float32Array;
  readonly morphTargetDeltas?: Float32Array;
  readonly morphInstanceDescriptors?: Uint32Array;
  readonly instanceTints?: Float32Array;
  readonly instanceAttributes?: Float32Array;
  readonly quads?: RenderSnapshot["quads"];
  readonly quadInstanceFloats?: Float32Array;
  readonly quadInstanceWords?: Uint32Array;
}): Transferable[] {
  const transfer: Transferable[] = [
    input.transforms.buffer as ArrayBuffer,
    input.viewMatrices.buffer as ArrayBuffer,
  ];

  if (input.instanceTints !== undefined && input.instanceTints.byteLength > 0) {
    transfer.push(input.instanceTints.buffer as ArrayBuffer);
  }

  if (input.bones !== undefined && input.bones.byteLength > 0) {
    transfer.push(input.bones.buffer as ArrayBuffer);
  }

  if (
    input.morphTargetWeights !== undefined &&
    input.morphTargetWeights.byteLength > 0
  ) {
    transfer.push(input.morphTargetWeights.buffer as ArrayBuffer);
  }

  if (
    input.morphTargetDeltas !== undefined &&
    input.morphTargetDeltas.byteLength > 0
  ) {
    transfer.push(input.morphTargetDeltas.buffer as ArrayBuffer);
  }

  if (
    input.morphInstanceDescriptors !== undefined &&
    input.morphInstanceDescriptors.byteLength > 0
  ) {
    transfer.push(input.morphInstanceDescriptors.buffer as ArrayBuffer);
  }

  if (
    input.instanceAttributes !== undefined &&
    input.instanceAttributes.byteLength > 0
  ) {
    transfer.push(input.instanceAttributes.buffer as ArrayBuffer);
  }

  if (input.quads !== undefined) {
    if (input.quads.instanceFloats.byteLength > 0) {
      transfer.push(input.quads.instanceFloats.buffer as ArrayBuffer);
    }

    if (input.quads.instanceWords.byteLength > 0) {
      transfer.push(input.quads.instanceWords.buffer as ArrayBuffer);
    }
  }

  if (
    input.quadInstanceFloats !== undefined &&
    input.quadInstanceFloats.byteLength > 0
  ) {
    transfer.push(input.quadInstanceFloats.buffer as ArrayBuffer);
  }

  if (
    input.quadInstanceWords !== undefined &&
    input.quadInstanceWords.byteLength > 0
  ) {
    transfer.push(input.quadInstanceWords.buffer as ArrayBuffer);
  }

  return transfer;
}

function resolveWorker(
  workerEntry: SimulationWorkerEntry,
  options: CreateSimulationWorkerOptions,
): SimulationWorkerTransport {
  if (typeof workerEntry === "object" && "postMessage" in workerEntry) {
    return workerEntry;
  }

  const factory = options.workerFactory ?? createDefaultWorker;

  return factory(workerEntry, options.workerOptions);
}

function createDefaultWorker(
  entry: string | URL,
  options?: WorkerOptions,
): SimulationWorkerTransport {
  if (typeof Worker === "undefined") {
    throw new Error("createSimulationWorker requires a Worker implementation.");
  }

  return new Worker(entry, options);
}

function createDefaultMessageChannel(): SimulationMessageChannel {
  if (typeof MessageChannel === "undefined") {
    throw new Error(
      "createSimulationWorker requires a MessageChannel implementation.",
    );
  }

  return new MessageChannel();
}

function mergeStartOptions(
  createOptions: CreateSimulationWorkerOptions,
  startOptions: SimulationWorkerStartOptions,
): SimulationWorkerStartOptions {
  const {
    workerOptions: _workerOptions,
    workerFactory: _workerFactory,
    messageChannelFactory: _messageChannelFactory,
    ...defaults
  } = createOptions;

  return { ...defaults, ...startOptions };
}

function isSnapshotMessage(
  value: Record<string, unknown>,
): value is SimulationWorkerSnapshotMessage {
  return (
    value.type === SIMULATION_WORKER_PROTOCOL.snapshot &&
    isRenderSnapshotLike(value.snapshot)
  );
}

function isRenderSnapshotLike(value: unknown): value is RenderSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.frame === "number" &&
    Array.isArray(value.views) &&
    Array.isArray(value.meshDraws) &&
    Array.isArray(value.lights) &&
    Array.isArray(value.environments) &&
    Array.isArray(value.shadowRequests) &&
    Array.isArray(value.bounds) &&
    value.transforms instanceof Float32Array &&
    value.viewMatrices instanceof Float32Array &&
    Array.isArray(value.diagnostics) &&
    isRecord(value.report)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
