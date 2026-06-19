import { AssetRegistry } from "@aperture-engine/simulation";
import type {
  SimulationWorker,
  SimulationWorkerMessageCallback,
  SimulationWorkerSnapshotCallback,
  SimulationWorkerSnapshotEvent,
} from "@aperture-engine/runtime";
import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
import type { RenderSnapshot } from "@aperture-engine/render";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mirrorSimulationWorkerSourceAssets } from "../../packages/app/src/browser/assets.js";
import { syncGeneratedDiagnostics } from "../../packages/app/src/browser/diagnostics.js";
import type { GeneratedBrowserAppStatus } from "../../packages/app/src/browser/status.js";

describe("generated browser performance status", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("projects worker publish phase timings onto generated app status", () => {
    let snapshotCallback: SimulationWorkerSnapshotCallback | null = null;
    const worker: SimulationWorker = {
      worker: {
        postMessage() {},
        terminate() {},
      },
      start() {},
      postMessage() {},
      onMessage() {
        return () => {};
      },
      onSnapshot(callback) {
        snapshotCallback = callback;
        return () => {
          snapshotCallback = null;
        };
      },
      onError() {
        return () => {};
      },
      terminate() {},
    };
    const status = createStatus();
    const mirrored = mirrorSimulationWorkerSourceAssets(
      worker,
      new AssetRegistry(),
      status,
    );
    const forwarded: SimulationWorkerSnapshotEvent[] = [];

    mirrored.onSnapshot((event) => {
      forwarded.push(event);
    });

    emitSnapshotEvent(snapshotCallback, {
      snapshot: snapshot(7),
      frame: 7,
      message: {
        type: "aperture.simulation.snapshot",
        snapshot: snapshot(7),
        frame: 7,
        workerSummary: {
          previousPublishTiming: {
            frame: 6,
            transport: "transferable",
            totalMilliseconds: 8,
            inputMilliseconds: 1,
            stepMilliseconds: 4,
            extractMilliseconds: 2,
            sourceAssetsMilliseconds: 0.5,
            summaryMilliseconds: 0.25,
            transportMilliseconds: 0.125,
            postMessageMilliseconds: 0.75,
            commitMilliseconds: 0.375,
            stepTiming: {
              totalMilliseconds: 3.5,
              preStepResolveSpatialMilliseconds: 0.1,
              inputEffectsMilliseconds: 0.2,
              lowLevelStepMilliseconds: 2.5,
              postStepSpatialMilliseconds: 0.3,
              interactionMilliseconds: 0.25,
              postUpdateEffectsMilliseconds: 0.15,
              preStepWorldChanged: true,
              lowLevel: {
                totalMilliseconds: 2.4,
                worldUpdateMilliseconds: 1.1,
                animationMilliseconds: 0.2,
                fixedStepMilliseconds: 0.4,
                transformMilliseconds: 0.5,
                skeletonMilliseconds: 0.2,
              },
            },
          },
        },
      },
    });

    expect(forwarded).toHaveLength(1);
    expect(status.performance).toMatchObject({
      sampleWindow: 240,
      latest: {
        frame: 6,
        transport: "transferable",
        preStepWorldChanged: true,
        publish: {
          totalMilliseconds: 8,
          stepMilliseconds: 4,
          postMessageMilliseconds: 0.75,
        },
        step: {
          totalMilliseconds: 3.5,
          postStepSpatialMilliseconds: 0.3,
        },
        lowLevel: {
          totalMilliseconds: 2.4,
          worldUpdateMilliseconds: 1.1,
        },
      },
      rolling: {
        publish: {
          totalMilliseconds: {
            count: 1,
            latest: 8,
            average: 8,
            p95: 8,
          },
        },
        step: {
          lowLevelStepMilliseconds: {
            latest: 2.5,
          },
        },
        lowLevel: {
          transformMilliseconds: {
            latest: 0.5,
          },
        },
      },
    });
  });

  it("mirrors source asset sideband messages without counting render snapshots", () => {
    let messageCallback: SimulationWorkerMessageCallback | null = null;
    const worker: SimulationWorker = {
      worker: {
        postMessage() {},
        terminate() {},
      },
      start() {},
      postMessage() {},
      onMessage(callback) {
        messageCallback = callback;
        return () => {
          messageCallback = null;
        };
      },
      onSnapshot() {
        return () => {};
      },
      onError() {
        return () => {};
      },
      terminate() {},
    };
    const status = createStatus();
    const sourceAssets = new AssetRegistry();

    mirrorSimulationWorkerSourceAssets(worker, sourceAssets, status);
    emitWorkerMessage(messageCallback, {
      type: SIMULATION_WORKER_PROTOCOL.sourceAssets,
      frame: 2,
      sourceAssets: {
        entries: [
          {
            handle: { kind: "mesh", id: "dynamic.trail" },
            label: "Dynamic Trail",
            status: "ready",
            version: 3,
            asset: { kind: "mesh", label: "Dynamic Trail" },
            dependencies: [],
            diagnostics: [],
          },
        ],
      },
      postMessageDecision: {
        frame: 2,
        postedMessage: "sourceAssets",
        postMessageReasons: ["sourceAssetsChanged"],
      },
    });

    expect(status.snapshots).toBe(0);
    expect(status.mirroredSourceAssets).toBe(1);
    expect(status.workerMessages.snapshotDecisions.total).toBe(0);
    expect(status.workerMessages.sidebandDecisions).toMatchObject({
      total: 1,
      postedMessages: { sourceAssets: 1 },
      postMessageReasons: { sourceAssetsChanged: 1 },
    });
    expect(sourceAssets.list({ kind: "mesh" })).toHaveLength(1);
  });

  it("publishes browser performance status on a telemetry cadence while retaining samples", () => {
    vi.useFakeTimers();
    let snapshotCallback: SimulationWorkerSnapshotCallback | null = null;
    const worker: SimulationWorker = {
      worker: {
        postMessage() {},
        terminate() {},
      },
      start() {},
      postMessage() {},
      onMessage() {
        return () => {};
      },
      onSnapshot(callback) {
        snapshotCallback = callback;
        return () => {
          snapshotCallback = null;
        };
      },
      onError() {
        return () => {};
      },
      terminate() {},
    };
    const status = createStatus();
    const mirrored = mirrorSimulationWorkerSourceAssets(
      worker,
      new AssetRegistry(),
      status,
      { performanceStatusIntervalMilliseconds: 100 },
    );

    mirrored.onSnapshot(() => {});

    emitTimedSnapshot(snapshotCallback, 1, 1);
    const firstPerformance = status.performance;

    expect(firstPerformance).toMatchObject({
      latest: {
        frame: 1,
        publish: { totalMilliseconds: 1 },
      },
      rolling: {
        publish: {
          totalMilliseconds: {
            count: 1,
            latest: 1,
            average: 1,
          },
        },
      },
    });

    vi.advanceTimersByTime(50);
    emitTimedSnapshot(snapshotCallback, 2, 2);

    expect(status.performance).toBe(firstPerformance);
    expect(status.performance?.latest?.frame).toBe(1);

    vi.advanceTimersByTime(50);
    emitTimedSnapshot(snapshotCallback, 3, 3);

    expect(status.performance).not.toBe(firstPerformance);
    expect(status.performance).toMatchObject({
      latest: {
        frame: 3,
        publish: { totalMilliseconds: 3 },
      },
      rolling: {
        publish: {
          totalMilliseconds: {
            count: 3,
            latest: 3,
            average: 2,
            p95: 3,
          },
        },
      },
    });
  });

  it("drops retained full worker summaries from browser status while preserving on-demand entity tools", () => {
    let snapshotCallback: SimulationWorkerSnapshotCallback | null = null;
    const worker: SimulationWorker = {
      worker: {
        postMessage() {},
        terminate() {},
      },
      start() {},
      postMessage() {},
      onMessage() {
        return () => {};
      },
      onSnapshot(callback) {
        snapshotCallback = callback;
        return () => {
          snapshotCallback = null;
        };
      },
      onError() {
        return () => {};
      },
      terminate() {},
    };
    const status = createStatus();
    const mirrored = mirrorSimulationWorkerSourceAssets(
      worker,
      new AssetRegistry(),
      status,
    );

    mirrored.onSnapshot(() => {});
    emitSnapshotEvent(snapshotCallback, {
      snapshot: snapshot(1),
      frame: 1,
      message: {
        type: "aperture.simulation.snapshot",
        snapshot: snapshot(1),
        frame: 1,
        workerSummary: {
          entities: {
            total: 1,
            summaries: [{ key: "heavy.entity" }],
            truncated: false,
            diagnostics: [],
          },
          assets: [{ id: "heavy-asset" }],
          resources: { count: 1 },
          physics: { backend: "none" },
          startOptions: { entries: [{ key: "route" }] },
          entityTools: {
            finds: 1,
            lastFind: { total: 1 },
          },
        },
      },
    });

    expect(
      (status.lastWorkerSummary as { readonly entities?: unknown }).entities,
    ).toBeDefined();

    emitSnapshotEvent(snapshotCallback, {
      snapshot: snapshot(2),
      frame: 2,
      message: {
        type: "aperture.simulation.snapshot",
        snapshot: snapshot(2),
        frame: 2,
        workerSummary: {
          signals: {},
        },
      },
    });

    expect(
      (status.lastWorkerSummary as { readonly entities?: unknown }).entities,
    ).toBeUndefined();
    expect(
      (status.lastWorkerSummary as { readonly assets?: unknown }).assets,
    ).toBeUndefined();
    expect(
      (status.lastWorkerSummary as { readonly resources?: unknown }).resources,
    ).toBeUndefined();
    expect(
      (status.lastWorkerSummary as { readonly physics?: unknown }).physics,
    ).toBeUndefined();
    expect(
      (status.lastWorkerSummary as { readonly startOptions?: unknown })
        .startOptions,
    ).toBeUndefined();
    expect(status.lastWorkerSummary).toMatchObject({
      entityTools: {
        finds: 1,
        lastFind: { total: 1 },
      },
      signals: {},
    });
  });

  it("polls generated render diagnostics on a telemetry cadence instead of every RAF", () => {
    vi.useFakeTimers();
    const status = createStatus();
    let calls = 0;
    const dispose = syncGeneratedDiagnostics(
      () => {
        calls += 1;
        return {
          lastFrame: {
            frame: calls,
            ok: true,
            counts: {
              views: 1,
              meshDraws: 1,
              spriteDraws: 0,
              particleEmitters: 0,
              quadInstances: 0,
              uiNodes: 0,
            },
            diagnostics: [],
          },
        };
      },
      status,
      { intervalMilliseconds: 50 },
    );

    expect(calls).toBe(0);
    expect(status.diagnostics).toBeNull();

    vi.advanceTimersByTime(49);
    expect(calls).toBe(0);
    expect(status.diagnostics).toBeNull();

    vi.advanceTimersByTime(1);
    expect(calls).toBe(1);
    expect(status.diagnostics).toMatchObject({
      lastFrame: { frame: 1, ok: true },
    });

    vi.advanceTimersByTime(49);
    expect(calls).toBe(1);

    vi.advanceTimersByTime(1);
    expect(calls).toBe(2);
    expect(status.diagnostics).toMatchObject({
      lastFrame: { frame: 2, ok: true },
    });

    dispose();
    vi.advanceTimersByTime(100);
    expect(calls).toBe(2);
  });
});

function createStatus(): GeneratedBrowserAppStatus {
  return {
    status: "running",
    webgpuOk: true,
    snapshots: 0,
    mirroredSourceAssets: 0,
    skippedSourceAssets: 0,
    forwardedInputEvents: 0,
    forwardedInputFrames: 0,
    connectedGamepads: 0,
    lastInputReset: null,
    lastInputEvent: null,
    forwardedCommandEvents: 0,
    lastCommandEvent: null,
    lastFrame: null,
    lastError: null,
    lastFailure: null,
    lastWorkerSummary: null,
    workerMessages: {
      snapshotDecisions: {
        total: 0,
        latest: null,
        postedMessages: {},
        postMessageReasons: {},
      },
      sidebandDecisions: {
        total: 0,
        latest: null,
        postedMessages: {},
        postMessageReasons: {},
      },
    },
    performance: null,
    diagnostics: null,
    render: null,
    canvas: null,
    systems: [],
  };
}

function snapshot(frame: number): RenderSnapshot {
  return {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      fogs: 0,
      shadowRequests: 0,
      bounds: 0,
      quadBatches: 0,
      quadInstances: 0,
      diagnostics: 0,
    },
  };
}

function emitSnapshotEvent(
  callback: SimulationWorkerSnapshotCallback | null,
  event: Parameters<SimulationWorkerSnapshotCallback>[0],
): void {
  callback?.(event);
}

function emitWorkerMessage(
  callback: SimulationWorkerMessageCallback | null,
  message: Parameters<SimulationWorkerMessageCallback>[0],
): void {
  callback?.(message);
}

function emitTimedSnapshot(
  callback: SimulationWorkerSnapshotCallback | null,
  frame: number,
  totalMilliseconds: number,
): void {
  callback?.({
    snapshot: snapshot(frame),
    frame,
    message: {
      type: "aperture.simulation.snapshot",
      snapshot: snapshot(frame),
      frame,
      workerSummary: {
        previousPublishTiming: {
          frame,
          transport: "shared-array-buffer",
          totalMilliseconds,
        },
      },
    },
  });
}
