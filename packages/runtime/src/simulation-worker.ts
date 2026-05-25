import type { RenderSnapshot } from "@aperture-engine/render";

export const SIMULATION_WORKER_PROTOCOL = {
  connect: "aperture.simulation.connect",
  start: "aperture.simulation.start",
  ready: "aperture.simulation.ready",
  snapshot: "aperture.simulation.snapshot",
  error: "aperture.simulation.error",
  recycleSnapshotBuffers: "aperture.simulation.recycleSnapshotBuffers",
} as const;

export interface SimulationWorkerStartOptions {
  readonly entityCapacity?: number;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerReadyMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.ready;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerSnapshotMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
  readonly snapshot: RenderSnapshot;
  readonly frame?: number;
  readonly bufferLeaseId?: number;
  readonly [key: string]: unknown;
}

export interface SimulationWorkerErrorMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.error;
  readonly reason: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

export type SimulationWorkerInboundMessage =
  | SimulationWorkerReadyMessage
  | SimulationWorkerSnapshotMessage
  | SimulationWorkerErrorMessage;

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

export interface SimulationWorker {
  readonly worker: SimulationWorkerTransport;
  start(options?: SimulationWorkerStartOptions): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
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
    },
  };
}

export interface RenderSnapshotBufferLease {
  readonly id: number;
  readonly transforms: Float32Array;
  readonly viewMatrices: Float32Array;
  readonly instanceTints: Float32Array;
  readonly transfer: Transferable[];
}

export interface RenderSnapshotBufferRequest {
  readonly transformFloats?: number;
  readonly viewMatrixFloats?: number;
  readonly instanceTintFloats?: number;
}

export interface ReturnedRenderSnapshotBuffers {
  readonly id: number;
  readonly transforms: Float32Array;
  readonly viewMatrices: Float32Array;
  readonly instanceTints?: Float32Array;
}

export interface RenderSnapshotBufferPoolStats {
  readonly capacity: number;
  readonly available: number;
  readonly inUse: number;
  readonly allocations: number;
}

export interface RenderSnapshotBufferPool {
  readonly capacity: number;
  acquire(request?: RenderSnapshotBufferRequest): RenderSnapshotBufferLease;
  release(buffers: ReturnedRenderSnapshotBuffers): void;
  stats(): RenderSnapshotBufferPoolStats;
}

export type RenderSnapshotBufferPoolOptions = RenderSnapshotBufferRequest;

export function createRenderSnapshotBufferPool(
  capacity: number,
  options: RenderSnapshotBufferPoolOptions = {},
): RenderSnapshotBufferPool {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError("Render snapshot buffer pool capacity must be > 0.");
  }

  let allocations = 0;
  const slots = Array.from({ length: capacity }, (_, index) =>
    createBufferSlot(index, {
      transformFloats: options.transformFloats ?? 0,
      viewMatrixFloats: options.viewMatrixFloats ?? 0,
      instanceTintFloats: options.instanceTintFloats ?? 0,
    }),
  );

  allocations += slots.reduce(
    (count, slot) =>
      count +
      (slot.transformCapacity > 0 ? 1 : 0) +
      (slot.viewMatrixCapacity > 0 ? 1 : 0) +
      (slot.instanceTintCapacity > 0 ? 1 : 0),
    0,
  );

  return {
    capacity,
    acquire(request = {}) {
      const slot = slots.find((candidate) => !candidate.inUse);

      if (slot === undefined) {
        throw new Error(
          `Render snapshot buffer pool exhausted (${capacity} slots in use).`,
        );
      }

      const transformFloats = request.transformFloats ?? 0;
      const viewMatrixFloats = request.viewMatrixFloats ?? 0;
      const instanceTintFloats = request.instanceTintFloats ?? 0;

      allocations += ensureSlotCapacity(slot, {
        transformFloats,
        viewMatrixFloats,
        instanceTintFloats,
      });
      slot.inUse = true;

      const transforms = new Float32Array(
        slot.transformBuffer,
        0,
        transformFloats,
      );
      const viewMatrices = new Float32Array(
        slot.viewMatrixBuffer,
        0,
        viewMatrixFloats,
      );
      const instanceTints = new Float32Array(
        slot.instanceTintBuffer,
        0,
        instanceTintFloats,
      );

      return {
        id: slot.id,
        transforms,
        viewMatrices,
        instanceTints,
        transfer: renderSnapshotBufferTransferList({
          transforms,
          viewMatrices,
          instanceTints,
        }),
      };
    },
    release(buffers) {
      const slot = slots[buffers.id];

      if (slot === undefined) {
        throw new RangeError(
          `Unknown render snapshot buffer pool slot ${buffers.id}.`,
        );
      }

      if (!slot.inUse) {
        throw new Error(
          `Render snapshot buffer pool slot ${buffers.id} is not leased.`,
        );
      }

      slot.transformBuffer = buffers.transforms.buffer as ArrayBuffer;
      slot.transformCapacity = buffers.transforms.buffer.byteLength / 4;
      slot.viewMatrixBuffer = buffers.viewMatrices.buffer as ArrayBuffer;
      slot.viewMatrixCapacity = buffers.viewMatrices.buffer.byteLength / 4;

      if (buffers.instanceTints !== undefined) {
        slot.instanceTintBuffer = buffers.instanceTints.buffer as ArrayBuffer;
        slot.instanceTintCapacity = buffers.instanceTints.buffer.byteLength / 4;
      }

      slot.inUse = false;
    },
    stats() {
      const inUse = slots.filter((slot) => slot.inUse).length;

      return {
        capacity,
        available: capacity - inUse,
        inUse,
        allocations,
      };
    },
  };
}

export function copyRenderSnapshotIntoBufferLease(
  snapshot: RenderSnapshot,
  lease: RenderSnapshotBufferLease,
): RenderSnapshot {
  if (lease.transforms.length < snapshot.transforms.length) {
    throw new RangeError(
      "Render snapshot transform buffer lease is too small.",
    );
  }

  if (lease.viewMatrices.length < snapshot.viewMatrices.length) {
    throw new RangeError(
      "Render snapshot view-matrix buffer lease is too small.",
    );
  }

  const instanceTints = snapshot.instanceTints;

  if (
    instanceTints !== undefined &&
    lease.instanceTints.length < instanceTints.length
  ) {
    throw new RangeError(
      "Render snapshot instance-tint buffer lease is too small.",
    );
  }

  lease.transforms.set(snapshot.transforms);
  lease.viewMatrices.set(snapshot.viewMatrices);

  const next: RenderSnapshot = {
    ...snapshot,
    transforms: lease.transforms,
    viewMatrices: lease.viewMatrices,
  };

  if (instanceTints === undefined) {
    return next;
  }

  lease.instanceTints.set(instanceTints);

  return {
    ...next,
    instanceTints: lease.instanceTints,
  };
}

export function renderSnapshotTransferList(
  snapshot: Pick<
    RenderSnapshot,
    | "transforms"
    | "viewMatrices"
    | "bones"
    | "morphTargetWeights"
    | "instanceTints"
    | "instanceAttributes"
  >,
): Transferable[] {
  return renderSnapshotBufferTransferList(snapshot);
}

export interface RenderSnapshotTransportCostReport {
  readonly structuredCloneBytes: number;
  readonly transferableBytes: number;
  readonly reductionRatio: number;
}

export function estimateRenderSnapshotTransportCost(
  snapshot: Pick<
    RenderSnapshot,
    | "transforms"
    | "viewMatrices"
    | "bones"
    | "morphTargetWeights"
    | "instanceTints"
    | "instanceAttributes"
  >,
): RenderSnapshotTransportCostReport {
  const structuredCloneBytes =
    snapshot.transforms.byteLength +
    snapshot.viewMatrices.byteLength +
    (snapshot.bones?.byteLength ?? 0) +
    (snapshot.morphTargetWeights?.byteLength ?? 0) +
    (snapshot.instanceTints?.byteLength ?? 0) +
    (snapshot.instanceAttributes?.byteLength ?? 0);
  const transferableBytes = 0;

  return {
    structuredCloneBytes,
    transferableBytes,
    reductionRatio:
      structuredCloneBytes === 0
        ? 0
        : (structuredCloneBytes - transferableBytes) / structuredCloneBytes,
  };
}

function renderSnapshotBufferTransferList(input: {
  readonly transforms: Float32Array;
  readonly viewMatrices: Float32Array;
  readonly bones?: Float32Array;
  readonly morphTargetWeights?: Float32Array;
  readonly instanceTints?: Float32Array;
  readonly instanceAttributes?: Float32Array;
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
    input.instanceAttributes !== undefined &&
    input.instanceAttributes.byteLength > 0
  ) {
    transfer.push(input.instanceAttributes.buffer as ArrayBuffer);
  }

  return transfer;
}

interface RenderSnapshotBufferSlot {
  readonly id: number;
  inUse: boolean;
  transformBuffer: ArrayBuffer;
  transformCapacity: number;
  viewMatrixBuffer: ArrayBuffer;
  viewMatrixCapacity: number;
  instanceTintBuffer: ArrayBuffer;
  instanceTintCapacity: number;
}

function createBufferSlot(
  id: number,
  request: Required<RenderSnapshotBufferRequest>,
): RenderSnapshotBufferSlot {
  return {
    id,
    inUse: false,
    transformBuffer: new ArrayBuffer(request.transformFloats * 4),
    transformCapacity: request.transformFloats,
    viewMatrixBuffer: new ArrayBuffer(request.viewMatrixFloats * 4),
    viewMatrixCapacity: request.viewMatrixFloats,
    instanceTintBuffer: new ArrayBuffer(request.instanceTintFloats * 4),
    instanceTintCapacity: request.instanceTintFloats,
  };
}

function ensureSlotCapacity(
  slot: RenderSnapshotBufferSlot,
  request: Required<RenderSnapshotBufferRequest>,
): number {
  let allocations = 0;

  if (slot.transformCapacity < request.transformFloats) {
    slot.transformBuffer = new ArrayBuffer(request.transformFloats * 4);
    slot.transformCapacity = request.transformFloats;
    allocations += 1;
  }

  if (slot.viewMatrixCapacity < request.viewMatrixFloats) {
    slot.viewMatrixBuffer = new ArrayBuffer(request.viewMatrixFloats * 4);
    slot.viewMatrixCapacity = request.viewMatrixFloats;
    allocations += 1;
  }

  if (slot.instanceTintCapacity < request.instanceTintFloats) {
    slot.instanceTintBuffer = new ArrayBuffer(request.instanceTintFloats * 4);
    slot.instanceTintCapacity = request.instanceTintFloats;
    allocations += 1;
  }

  return allocations;
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
