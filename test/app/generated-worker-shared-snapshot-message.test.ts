import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AssetRegistry,
  createAudioClipHandle,
} from "@aperture-engine/simulation";
import {
  SIMULATION_WORKER_PROTOCOL,
  createSharedSnapshotTransport,
  type SimulationMessagePort,
} from "@aperture-engine/runtime";
import type {
  AudioEmitterPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import type { ApertureApp } from "../../packages/app/src/advanced.js";
import type { ApertureConfig } from "../../packages/app/src/config.js";
import { createSourceAssetSerializationState } from "../../packages/app/src/asset-mirror.js";
import { createInputResource } from "../../packages/app/src/input/state.js";
import {
  createGeneratedWorkerSnapshotTransport,
  publishGeneratedWorkerSnapshot,
  type GeneratedWorkerSummaryCadence,
} from "../../packages/app/src/worker/snapshot.js";

describe("generated worker shared snapshot message cadence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("continues publishing frames to SAB while throttling unchanged sideband messages", () => {
    let now = 0;
    vi.stubGlobal("performance", {
      now: () => now,
    });

    const shared = createSharedSnapshotTransport({
      maxEntities: 4,
      maxViews: 1,
      maxPacketWords: 128,
      requireCrossOriginIsolated: false,
    });
    const transport = createGeneratedWorkerSnapshotTransport({
      transport: {
        mode: "shared-array-buffer",
        layout: shared.layout,
        headerBuffer: shared.headerBuffer,
        transformBuffer: shared.transformBuffer,
        instanceTintBuffer: shared.instanceTintBuffer,
        viewMatrixBuffer: shared.viewMatrixBuffer,
        quadInstanceFloatBuffer: shared.quadInstanceFloatBuffer,
        quadInstanceWordBuffer: shared.quadInstanceWordBuffer,
        packetBuffer: shared.packetBuffer,
      },
    });
    expect(transport.mode).toBe("shared-array-buffer");
    if (transport.mode !== "shared-array-buffer") {
      throw new Error("expected shared transport");
    }

    const messages: unknown[] = [];
    const app = createFakeApp();
    const options = {
      app,
      config: { mode: "browser" } as ApertureConfig,
      port: createMessagePort(messages),
      transport,
      pendingInput: [],
      sourceAssetState: createSourceAssetSerializationState(),
      entityTools: { summary: () => ({ available: true }) },
      summaryCadence: thinSummaryCadence(),
      delta: 1 / 60,
      previousPublishTiming: null,
    };

    const initialReport = publishGeneratedWorkerSnapshot({
      ...options,
      frame: 1,
      time: 1,
    });
    expect(messages).toHaveLength(1);
    expect(readMessageType(messages[0])).toBe(
      SIMULATION_WORKER_PROTOCOL.snapshot,
    );
    expect(initialReport.timing.postedMessage).toBe("snapshot");
    expect(initialReport.timing.postMessageReasons).toEqual(["sharedInitial"]);
    expect(transport.shared.reader.readLatestFrame()?.frame).toBe(1);

    now = 1;
    const secondReport = publishGeneratedWorkerSnapshot({
      ...options,
      frame: 2,
      time: 1 + 1 / 60,
    });
    expect(messages).toHaveLength(1);
    expect(secondReport.timing.postedMessage).toBe("none");
    expect(secondReport.timing.postMessageReasons).toEqual([]);
    expect(transport.shared.reader.readLatestFrame()?.frame).toBe(2);

    now = 20;
    const thirdReport = publishGeneratedWorkerSnapshot({
      ...options,
      frame: 3,
      time: 1 + 2 / 60,
    });
    expect(messages).toHaveLength(1);
    expect(thirdReport.timing.postedMessage).toBe("none");
    expect(thirdReport.timing.postMessageReasons).toEqual([]);
    expect(transport.shared.reader.readLatestFrame()?.frame).toBe(3);

    now = 40;
    const heartbeatReport = publishGeneratedWorkerSnapshot({
      ...options,
      frame: 4,
      time: 1 + 3 / 60,
    });
    expect(messages).toHaveLength(2);
    expect(readMessageType(messages[1])).toBe(
      SIMULATION_WORKER_PROTOCOL.snapshot,
    );
    expect(heartbeatReport.timing.postedMessage).toBe("snapshot");
    expect(heartbeatReport.timing.postMessageReasons).toEqual([
      "sharedHeartbeat",
    ]);
    expect(transport.shared.reader.readLatestFrame()?.frame).toBe(4);
  });

  it("sends audio sideband at display cadence without forcing render snapshot messages", () => {
    let now = 0;
    vi.stubGlobal("performance", {
      now: () => now,
    });

    const shared = createSharedSnapshotTransport({
      maxEntities: 4,
      maxViews: 1,
      maxPacketWords: 128,
      requireCrossOriginIsolated: false,
    });
    const transport = createGeneratedWorkerSnapshotTransport({
      transport: {
        mode: "shared-array-buffer",
        layout: shared.layout,
        headerBuffer: shared.headerBuffer,
        transformBuffer: shared.transformBuffer,
        instanceTintBuffer: shared.instanceTintBuffer,
        viewMatrixBuffer: shared.viewMatrixBuffer,
        quadInstanceFloatBuffer: shared.quadInstanceFloatBuffer,
        quadInstanceWordBuffer: shared.quadInstanceWordBuffer,
        packetBuffer: shared.packetBuffer,
      },
    });
    expect(transport.mode).toBe("shared-array-buffer");
    if (transport.mode !== "shared-array-buffer") {
      throw new Error("expected shared transport");
    }

    const messages: unknown[] = [];
    const app = createFakeApp((frame) =>
      baseSnapshot({
        frame,
        audioEmitters: [audioEmitter()],
      }),
    );
    const options = {
      app,
      config: { mode: "browser" } as ApertureConfig,
      port: createMessagePort(messages),
      transport,
      pendingInput: [],
      sourceAssetState: createSourceAssetSerializationState(),
      entityTools: { summary: () => ({ available: true }) },
      summaryCadence: thinSummaryCadence(),
      delta: 1 / 60,
      previousPublishTiming: null,
    };

    const initialReport = publishGeneratedWorkerSnapshot({
      ...options,
      frame: 1,
      time: 1,
    });
    expect(messages).toHaveLength(1);
    expect(readMessageType(messages[0])).toBe(
      SIMULATION_WORKER_PROTOCOL.snapshot,
    );
    expect(initialReport.timing.postedMessage).toBe("snapshot");
    expect(initialReport.timing.postMessageReasons).toEqual(["sharedInitial"]);

    now = 20;
    const audioReport = publishGeneratedWorkerSnapshot({
      ...options,
      frame: 2,
      time: 1 + 1 / 60,
    });
    expect(messages).toHaveLength(2);
    expect(readMessageType(messages[1])).toBe(
      SIMULATION_WORKER_PROTOCOL.audioSnapshot,
    );
    expect(readMessageFrame(messages[1])).toBe(2);
    expect(audioReport.timing.postedMessage).toBe("audioSnapshot");
    expect(audioReport.timing.postMessageReasons).toEqual(["sharedAudio"]);
    expect(transport.shared.reader.readLatestFrame()?.frame).toBe(2);
  });
});

function createFakeApp(
  snapshotForFrame: (frame: number) => RenderSnapshot = (frame) =>
    baseSnapshot({ frame }),
): ApertureApp {
  const assets = new AssetRegistry();
  const input = createInputResource(undefined);
  const app = {
    context: {
      signals: {},
      input,
      commands: { summary: () => ({ queued: 0 }) },
      diagnostics: { list: () => [] },
      particles: { summary: () => ({ active: 0 }) },
    },
    lowLevel: { assets },
    step: () => ({ timing: {} }),
    extract: snapshotForFrame,
  };

  return app as unknown as ApertureApp;
}

function readMessageType(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? (message as { readonly type?: unknown }).type
    : undefined;
}

function readMessageFrame(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? (message as { readonly frame?: unknown }).frame
    : undefined;
}

function createMessagePort(messages: unknown[]): SimulationMessagePort {
  return {
    postMessage(message) {
      messages.push(message);
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

function audioEmitter(
  input: Partial<AudioEmitterPacket> = {},
): AudioEmitterPacket {
  return {
    key: { kind: "entity", id: 1 },
    entity: { index: 1, generation: 0 },
    clip: createAudioClipHandle("engine"),
    clipVersion: 1,
    busId: "sfx",
    gain: 1,
    loop: true,
    autoplay: true,
    playEpoch: 1,
    stopEpoch: 0,
    timeScale: 1,
    priority: 0,
    panningModel: "equalpower",
    simulationSpace: "local",
    distanceModel: "inverse",
    refDistance: 1,
    maxDistance: 100,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    occlusion: 0,
    lowpassFrequency: 22050,
    lowpassQ: 0.7,
    offsetSec: 0,
    loopStart: 0,
    loopEnd: 0,
    audibility: "audible",
    muted: false,
    worldTransformOffset: 0,
    layerMask: 1,
    ...input,
  };
}

function thinSummaryCadence(): GeneratedWorkerSummaryCadence {
  return {
    intervalMilliseconds: 500,
    shouldPublishFull() {
      return false;
    },
  };
}

function baseSnapshot(extra: Partial<RenderSnapshot> = {}): RenderSnapshot {
  return {
    frame: 0,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(16),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
    ...extra,
  };
}
