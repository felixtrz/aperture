import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  createSharedSnapshotTransport,
  type SimulationMessagePort,
} from "@aperture-engine/runtime";
import type { RenderSnapshot } from "@aperture-engine/render";
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

    publishGeneratedWorkerSnapshot({
      ...options,
      frame: 1,
      time: 1,
    });
    expect(messages).toHaveLength(1);
    expect(transport.shared.reader.readLatestFrame()?.frame).toBe(1);

    now = 1;
    publishGeneratedWorkerSnapshot({
      ...options,
      frame: 2,
      time: 1 + 1 / 60,
    });
    expect(messages).toHaveLength(1);
    expect(transport.shared.reader.readLatestFrame()?.frame).toBe(2);

    now = 20;
    publishGeneratedWorkerSnapshot({
      ...options,
      frame: 3,
      time: 1 + 2 / 60,
    });
    expect(messages).toHaveLength(2);
    expect(transport.shared.reader.readLatestFrame()?.frame).toBe(3);
  });
});

function createFakeApp(): ApertureApp {
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
    extract: (frame: number) => baseSnapshot({ frame }),
  };

  return app as unknown as ApertureApp;
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
