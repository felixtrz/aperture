import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SIMULATION_WORKER_PROTOCOL,
  createSimulationWorker,
  renderSnapshotTransferList,
  type SimulationMessageChannel,
  type SimulationMessagePort,
  type SimulationWorkerErrorEvent,
  type SimulationWorkerSnapshotEvent,
  type SimulationWorkerTransport,
} from "@aperture-engine/runtime";
import {
  createQuadSnapshotBuffers,
  type RenderSnapshot,
} from "@aperture-engine/render";

describe("createSimulationWorker protocol handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects through the message channel and transfers the worker port", () => {
    const harness = createWorkerHarness();

    expect(harness.transport.posted).toEqual([
      {
        message: {
          type: SIMULATION_WORKER_PROTOCOL.connect,
          port: harness.channel.port2,
        },
        transfer: [harness.channel.port2 as unknown as Transferable],
      },
    ]);
    expect(harness.channel.port1.startCalls).toBe(1);
  });

  it("ignores non-record messages and forwards unknown records to onMessage", () => {
    const harness = createWorkerHarness();
    const received: unknown[] = [];
    const errors: SimulationWorkerErrorEvent[] = [];
    harness.worker.onError((event) => errors.push(event));
    const unsubscribe = harness.worker.onMessage((message) =>
      received.push(message),
    );

    harness.channel.port1.dispatch("not-a-record");
    harness.channel.port1.dispatch({ type: "custom.message", value: 7 });
    unsubscribe();
    harness.channel.port1.dispatch({ type: "custom.message", value: 8 });

    expect(received).toEqual([{ type: "custom.message", value: 7 }]);
    expect(errors).toEqual([]);
  });

  it("dispatches snapshots with the message frame falling back to the snapshot frame", () => {
    const harness = createWorkerHarness();
    const events: SimulationWorkerSnapshotEvent[] = [];
    harness.worker.onSnapshot((event) => events.push(event));

    const snapshot = createSnapshotLike(3);
    harness.channel.port1.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.snapshot,
      snapshot,
    });
    harness.channel.port1.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.snapshot,
      snapshot,
      frame: 11,
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.frame).toBe(3);
    expect(events[0]?.snapshot).toBe(snapshot);
    expect(events[1]?.frame).toBe(11);
  });

  it("reports protocol errors for snapshot messages without a valid RenderSnapshot", () => {
    const harness = createWorkerHarness();
    const errors: SimulationWorkerErrorEvent[] = [];
    harness.worker.onError((event) => errors.push(event));

    harness.channel.port1.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.snapshot,
      snapshot: null,
    });
    harness.channel.port1.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.snapshot,
      snapshot: { frame: 1, views: [] },
    });

    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      reason: "simulation-worker.invalid-snapshot",
      source: "protocol",
    });
    expect(errors[1]?.reason).toBe("simulation-worker.invalid-snapshot");
  });

  it("normalizes worker error messages and preserves diagnostics arrays", () => {
    const harness = createWorkerHarness();
    const errors: SimulationWorkerErrorEvent[] = [];
    harness.worker.onError((event) => errors.push(event));

    harness.channel.port1.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.error,
      reason: 42,
      message: "",
      diagnostics: "not-an-array",
    });
    harness.channel.port1.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.error,
      reason: "custom.reason",
      message: "simulation exploded",
      diagnostics: [{ code: "x" }],
    });

    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      reason: "simulation-worker.error",
      message: "The simulation worker reported an error.",
      source: "worker",
    });
    expect(errors[0]?.diagnostics).toBeUndefined();
    expect(errors[1]).toMatchObject({
      reason: "custom.reason",
      message: "simulation exploded",
      diagnostics: [{ code: "x" }],
    });
  });

  it("reports transport errors raised by the worker error listener", () => {
    const harness = createWorkerHarness();
    const errors: SimulationWorkerErrorEvent[] = [];
    harness.worker.onError((event) => errors.push(event));

    harness.transport.emitError({ message: "kaboom" } as ErrorEvent);
    harness.transport.emitError({ message: "" } as ErrorEvent);

    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      reason: "simulation-worker.transport-error",
      message: "kaboom",
      source: "worker",
    });
    expect(errors[1]?.message).toBe("Simulation worker transport failed.");
  });

  it("starts with merged options, posts messages, and rejects use after terminate", () => {
    const harness = createWorkerHarness({
      entityCapacity: 8,
      fixedStep: false,
    });

    harness.worker.start({ entityCapacity: 16 });
    harness.worker.postMessage({ hello: true }, []);
    harness.worker.terminate();
    harness.worker.terminate();

    expect(harness.channel.port1.posted).toEqual([
      {
        message: {
          type: SIMULATION_WORKER_PROTOCOL.start,
          options: { entityCapacity: 16, fixedStep: false },
        },
        transfer: [],
      },
      { message: { hello: true }, transfer: [] },
    ]);
    expect(harness.transport.terminateCalls).toBe(1);
    expect(harness.channel.port1.closeCalls).toBe(1);
    expect(harness.channel.port2.closeCalls).toBe(1);
    expect(harness.channel.port1.listenerCount).toBe(0);
    expect(harness.transport.errorListenerCount).toBe(0);
    expect(() => harness.worker.start()).toThrow(
      "Cannot start a terminated SimulationWorker.",
    );
    expect(() => harness.worker.postMessage({})).toThrow(
      "Cannot post to a terminated SimulationWorker.",
    );
  });

  it("resolves string entries through the worker factory or the Worker global", () => {
    const factoryEntries: (string | URL)[] = [];
    const factoryTransport = new FakeWorkerTransport();
    const worker = createSimulationWorker("./worker.js", {
      workerFactory: (entry) => {
        factoryEntries.push(entry);
        return factoryTransport;
      },
      messageChannelFactory: () => createFakeChannel(),
    });

    expect(factoryEntries).toEqual(["./worker.js"]);
    expect(worker.worker).toBe(factoryTransport);
    expect(factoryTransport.posted).toHaveLength(1);

    expect(() =>
      createSimulationWorker("./worker.js", {
        messageChannelFactory: () => createFakeChannel(),
      }),
    ).toThrow("createSimulationWorker requires a Worker implementation.");

    const constructed: (string | URL)[] = [];
    class StubWorker extends FakeWorkerTransport {
      constructor(entry: string | URL) {
        super();
        constructed.push(entry);
      }
    }
    vi.stubGlobal("Worker", StubWorker);
    const defaultWorker = createSimulationWorker("./global-worker.js", {
      messageChannelFactory: () => createFakeChannel(),
    });

    expect(constructed).toEqual(["./global-worker.js"]);
    expect(defaultWorker.worker).toBeInstanceOf(StubWorker);
  });

  it("requires a MessageChannel implementation for the default channel factory", () => {
    vi.stubGlobal("MessageChannel", undefined);

    expect(() => createSimulationWorker(new FakeWorkerTransport())).toThrow(
      "createSimulationWorker requires a MessageChannel implementation.",
    );
  });

  it("collects every populated optional snapshot buffer into the transfer list", () => {
    const input = {
      transforms: new Float32Array(16),
      viewMatrices: new Float32Array(48),
      bones: new Float32Array(12),
      morphTargetWeights: new Float32Array(4),
      morphTargetDeltas: new Float32Array(8),
      morphInstanceDescriptors: new Uint32Array(4),
      instanceTints: new Float32Array(4),
      instanceAttributes: new Float32Array(4),
      quads: createQuadSnapshotBuffers({
        instanceFloats: new Float32Array(24),
        instanceWords: new Uint32Array(8),
      }),
      quadInstanceFloats: new Float32Array(6),
      quadInstanceWords: new Uint32Array(2),
    };

    const transfer = renderSnapshotTransferList(
      input as unknown as Parameters<typeof renderSnapshotTransferList>[0],
    );

    expect(transfer).toEqual([
      input.transforms.buffer,
      input.viewMatrices.buffer,
      input.instanceTints.buffer,
      input.bones.buffer,
      input.morphTargetWeights.buffer,
      input.morphTargetDeltas.buffer,
      input.morphInstanceDescriptors.buffer,
      input.instanceAttributes.buffer,
      input.quads.instanceFloats.buffer,
      input.quads.instanceWords.buffer,
      input.quadInstanceFloats.buffer,
      input.quadInstanceWords.buffer,
    ]);
  });

  it("skips zero-length optional snapshot buffers", () => {
    const input = {
      transforms: new Float32Array(16),
      viewMatrices: new Float32Array(48),
      bones: new Float32Array(0),
      morphTargetWeights: new Float32Array(0),
      morphTargetDeltas: new Float32Array(0),
      morphInstanceDescriptors: new Uint32Array(0),
      instanceTints: new Float32Array(0),
      instanceAttributes: new Float32Array(0),
      quads: createQuadSnapshotBuffers({
        instanceFloats: new Float32Array(0),
        instanceWords: new Uint32Array(0),
      }),
    };

    const transfer = renderSnapshotTransferList(
      input as unknown as Parameters<typeof renderSnapshotTransferList>[0],
    );

    expect(transfer).toEqual([
      input.transforms.buffer,
      input.viewMatrices.buffer,
    ]);
  });
});

interface WorkerHarness {
  readonly worker: ReturnType<typeof createSimulationWorker>;
  readonly transport: FakeWorkerTransport;
  readonly channel: FakeMessageChannel;
}

function createWorkerHarness(
  options: Record<string, unknown> = {},
): WorkerHarness {
  const transport = new FakeWorkerTransport();
  const channel = createFakeChannel();
  const worker = createSimulationWorker(transport, {
    ...options,
    messageChannelFactory: () => channel,
  });

  return { worker, transport, channel };
}

interface FakeMessageChannel extends SimulationMessageChannel {
  readonly port1: FakeMessagePort;
  readonly port2: FakeMessagePort;
}

function createFakeChannel(): FakeMessageChannel {
  return { port1: new FakeMessagePort(), port2: new FakeMessagePort() };
}

class FakeMessagePort implements SimulationMessagePort {
  readonly posted: { message: unknown; transfer: Transferable[] }[] = [];
  startCalls = 0;
  closeCalls = 0;
  private readonly listeners = new Set<
    (event: MessageEvent<unknown>) => void
  >();

  get listenerCount(): number {
    return this.listeners.size;
  }

  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.posted.push({ message, transfer });
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  start(): void {
    this.startCalls += 1;
  }

  close(): void {
    this.closeCalls += 1;
  }

  dispatch(message: unknown): void {
    for (const listener of [...this.listeners]) {
      listener({ data: message } as MessageEvent<unknown>);
    }
  }
}

class FakeWorkerTransport implements SimulationWorkerTransport {
  readonly posted: { message: unknown; transfer: Transferable[] }[] = [];
  terminateCalls = 0;
  private readonly errorListeners = new Set<(event: ErrorEvent) => void>();

  get errorListenerCount(): number {
    return this.errorListeners.size;
  }

  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.posted.push({ message, transfer });
  }

  terminate(): void {
    this.terminateCalls += 1;
  }

  addEventListener(
    _type: "error",
    listener: (event: ErrorEvent) => void,
  ): void {
    this.errorListeners.add(listener);
  }

  removeEventListener(
    _type: "error",
    listener: (event: ErrorEvent) => void,
  ): void {
    this.errorListeners.delete(listener);
  }

  emitError(event: ErrorEvent): void {
    for (const listener of [...this.errorListeners]) {
      listener(event);
    }
  }
}

function createSnapshotLike(frame: number): RenderSnapshot {
  return {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(16),
    viewMatrices: new Float32Array(48),
    diagnostics: [],
    report: {},
  } as unknown as RenderSnapshot;
}
