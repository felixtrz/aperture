import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRecord, sameStructure } from "./checks.mjs";
import { CONFIG, WORKER_SETTINGS, MODES, STATES } from "./contract.mjs";
import {
  nativeArrayEvidence,
  nativeEvidenceBytes,
} from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/native-evidence.mjs";
import { compareNativeUploadBytes } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/gpu-observer.mjs";
import { selection } from "./run.mjs";
import { observeStartSettings } from "./worker-proof.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));
// Retained genuine component captures seed only the renderer portion. Added
// worker fields are synthetic negative-test data, never new native evidence.
function record(mode = "directional", index = 0, variant = "live") {
  const state =
    variant === "live"
      ? STATES[index]
      : selection(mode, variant, "attempt-001")[0];
  const r = JSON.parse(
    readFileSync(
      new URL(
        `../native-shadow-light-matrix-v2-20261003/renders/${mode}/${variant}/attempt-001/${state.id}.json`,
        import.meta.url,
      ),
    ),
  );
  r.frame += 10;
  r.snapshot.frame = r.report.frame = r.frame;
  r.revision = index + 1;
  r.identity.sceneId = "synthetic-scene";
  r.sourceMesh.entityId = r.identity.entityId;
  const assets = r.snapshot.meshDraws
    .flatMap((packet) => [packet.mesh, packet.material])
    .map((handle) => ({
      handle,
      version: handle.id === r.identity.meshId ? state.version : 1,
      status: "ready",
    }));
  const delivered =
    index === 0
      ? assets
      : state.reuse
        ? []
        : assets.filter((entry) => entry.handle.id === r.identity.meshId);
  const observedStart = {
    ...WORKER_SETTINGS,
    transport: "shared-array-buffer",
    sharedHeaderIsNative: true,
    simulationPaused: true,
  };
  r.worker = {
    mode,
    variant,
    stateId: state.id,
    revision: r.revision,
    snapshotFrame: r.frame,
    snapshotFrameField: r.frame,
    assetVersion: state.version,
    identity: clone(r.identity),
    sourceMesh: clone(r.sourceMesh),
    assetVersions: assets,
    observedStart,
    resources: {
      meshAssetReplacements: state.version - 1,
      publishedVertexArrayReplacements: state.version - 1,
      publishedIndexArrayReplacements: state.version - 1,
    },
    publication: {
      transport: "shared-array-buffer",
      sourceAssets: delivered,
      summaryCadence: { fullSummaryIntervalMilliseconds: 16 },
    },
  };
  r.reception = {
    frame: r.frame,
    snapshotFrame: r.frame,
    stateId: state.id,
    revision: r.revision,
    assetVersion: state.version,
    sourceMesh: clone(r.sourceMesh),
    transport: "shared-array-buffer",
    availableAssets: clone(assets),
    deliveredAssets: clone(delivered),
  };
  r.completion = {
    nativeRenderMethodCompletionObserved: true,
    ack: {
      ok: true,
      requestId: `matrix-${r.revision}`,
      result: { frame: r.frame + 1 },
    },
  };
  r.runtime = {
    nativeWorkerCount: 1,
    nativeWorkerScope: true,
    crossOriginIsolated: true,
    transport: {
      active: "shared-array-buffer",
      fallback: null,
      sharedArrayBuffer: { supported: true },
    },
    config: CONFIG,
    useFrameGraph: true,
    renderSettings: { requestedSampleCount: 1, pixelRatio: 1 },
    validationErrors: [],
  };
  return r;
}
test("all 48 retained renderer states accept synthetic exact worker joins with non-1 baseline frames", () => {
  for (const mode of MODES) {
    let previous;
    for (const [index, state] of STATES.entries()) {
      const r = record(mode, index);
      assert.equal(validateRecord(r, state, previous), true);
      previous = r;
    }
    for (const shape of ["baseline", "vertices", "indices"]) {
      const r = record(mode, 0, `fresh-${shape}`);
      assert.equal(validateRecord(r, r.state), true);
    }
  }
});
const mutations = {
  missingPublication: (r) => {
    delete r.worker;
  },
  wrongRevision: (r) => r.worker.revision++,
  wrongState: (r) => {
    r.worker.stateId = "noop";
  },
  wrongPublicationFrame: (r) => r.worker.snapshotFrame++,
  wrongReceivedFrame: (r) => r.reception.frame++,
  wrongReceivedSnapshot: (r) => r.reception.snapshotFrame++,
  wrongConsumedFrame: (r) => r.snapshot.frame++,
  wrongCompletedFrame: (r) => r.report.frame++,
  missingProductionCompletion: (r) => {
    r.completion.nativeRenderMethodCompletionObserved = false;
  },
  wrongAck: (r) => r.completion.ack.result.frame++,
  missingAssets: (r) => {
    r.reception.availableAssets = [];
  },
  missingDelivery: (r) => {
    r.reception.deliveredAssets = [];
  },
  wrongSourceVersion: (r) => r.worker.assetVersion++,
  staleReceivedBytes: (r) =>
    (r.reception.sourceMesh.streams[0].rawBytes[0] ^= 1),
  corruptGpuUpload: (r) => (r.gpu.buffers[0].fullUploadBytes[0] ^= 1),
  missingRawBytes: (r) => {
    delete r.sourceMesh.streams[0].rawBytes;
  },
  noNativeWorker: (r) => {
    r.runtime.nativeWorkerScope = false;
  },
  workerCount: (r) => r.runtime.nativeWorkerCount++,
  fallback: (r) => {
    r.runtime.transport.active = "transferable";
  },
  hiddenFallback: (r) => {
    r.runtime.transport.fallback = "transferable";
  },
  fakeSharedBuffer: (r) => {
    r.worker.observedStart.sharedHeaderIsNative = false;
  },
  wrongCadence: (r) => r.worker.observedStart.sharedSnapshotMessageRateHz++,
  continuousSimulation: (r) => {
    r.worker.observedStart.simulationPaused = false;
  },
  omittedLight: (r) => r.report.shadow.requestCoverage.omittedCount++,
  wrongPipeline: (r) => {
    r.report.resourceReuse.autoShadowFrameCache.pipelineKind = "spot";
  },
  wrongCache: (r) => {
    r.report.resourceReuse.autoShadowFramesReused = 1;
  },
  noCasterSubmission: (r) => {
    r.report.shadow.casterCounts.submittedDrawCalls = 0;
  },
  wrongInvalidation: (r) => {
    r.report.resourceReuse.autoShadowFrameCache.firstChangedInputSection =
      "bounds";
  },
  identityDrift: (r) => {
    r.identity.meshId = "other";
  },
  geometryDrift: (r) => r.snapshot.bounds.push("other"),
  omittedGpuFence: (r) => {
    r.capture.gpuFenceCompleted = false;
  },
  noSwapchain: (r) => {
    r.report.renderTargets = [];
  },
  wrongDimensions: (r) => {
    r.report.renderTargets[0].width = 1024;
  },
  webgl: (r) => r.proof.webglAttempts++,
  nativeError: (r) => r.proof.errors.push("test"),
  deviceLost: (r) => r.proof.deviceLost.push("test"),
  noNewSubmission: (r) => {
    r.proof.submissions = 0;
  },
};
for (const [name, mutate] of Object.entries(mutations))
  test(`fail closed: ${name}`, () => {
    const r = record("directional", 2);
    mutate(r);
    assert.throws(() => validateRecord(r, STATES[2], record("directional", 1)));
  });
test("numeric JSON cannot erase signed-zero native byte evidence", () => {
  const backing = new Float32Array([99, -0, 0, 4, 99]),
    view = backing.subarray(1, 4),
    evidence = clone(nativeArrayEvidence(view));
  assert.equal(evidence.dataByteOffset, 4);
  assert.deepEqual(
    nativeEvidenceBytes(evidence),
    new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
  );
  assert.equal(
    compareNativeUploadBytes(
      new Uint8Array(new Float32Array(evidence.data).buffer),
      evidence,
    ).ok,
    false,
  );
});
test("structural comparison ignores key order only", () => {
  assert.ok(sameStructure({ a: 1, b: [2] }, { b: [2], a: 1 }));
  for (const [a, b] of [
    [{ a: 1 }, { a: 2 }],
    [
      [1, 2],
      [2, 1],
    ],
    [0, -0],
    [{ a: 1 }, { a: "1" }],
  ])
    assert.equal(sameStructure(a, b), false);
});
test("native start observer reads production nested options without inventing transport", () => {
  const options = {
    ...WORKER_SETTINGS,
    simulationPaused: true,
    transport: {
      mode: "shared-array-buffer",
      headerBuffer: new SharedArrayBuffer(44),
    },
  };
  for (const message of [
    options,
    { type: "aperture.simulation.start", options },
  ]) {
    assert.deepEqual(observeStartSettings(message), {
      ...WORKER_SETTINGS,
      simulationPaused: true,
      transport: "shared-array-buffer",
      sharedHeaderIsNative: true,
    });
  }
  assert.equal(
    observeStartSettings({
      options: {
        ...options,
        transport: {
          mode: "shared-array-buffer",
          headerBuffer: new ArrayBuffer(44),
        },
      },
    }).sharedHeaderIsNative,
    false,
  );
  assert.equal(
    observeStartSettings({ options: WORKER_SETTINGS }).transport,
    null,
  );
});
