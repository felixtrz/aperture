import { describe, expect, it, vi } from "vitest";
import { AssetRegistry } from "@aperture-engine/simulation";
import { createBoxMeshAsset, createRenderAssetCollections, createUnlitMaterialAsset, createSnapshotPacketRegistry, encodeSnapshotPackets } from "@aperture-engine/render";
import { createExtractionApp, createSharedSnapshotTransportViews, withCamera, withTransform, withMesh, withMaterial, SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
import { createWebGpuApp } from "@aperture-engine/webgpu/test-support";
import { mirrorSimulationWorkerSourceAssets } from "../../packages/app/src/browser/assets.ts";
import { serializeSourceAssetRegistry, createSourceAssetSerializationState, commitSerializedSourceAssets } from "../../packages/app/src/asset-mirror.ts";
import { waitFor } from "../../test/helpers/wait.ts";
import { createCpuHarness } from "./cpu-harness.mjs";

const changedMesh = () => createBoxMeshAsset({ label: "Probe box changed", width: 2, height: 2, depth: 2 });
function empty(frame) {
  return { frame, views: [], meshDraws: [], lights: [], environments: [], shadowRequests: [], bounds: [], transforms: new Float32Array(), viewMatrices: new Float32Array(), diagnostics: [], report: { views: 0, meshDraws: 0, lights: 0, environments: 0, shadowRequests: 0, bounds: 0, diagnostics: 0 } };
}
function status() {
  return { status: "running", snapshots: 0, mirroredSourceAssets: 0, skippedSourceAssets: 0, lastFrame: null, lastWorkerSummary: null, performance: null, workerMessages: { snapshotDecisions: { total: 0, latest: null, postedMessages: {}, postMessageReasons: {} }, sidebandDecisions: { total: 0, latest: null, postedMessages: {}, postMessageReasons: {} } } };
}
async function fixture(cadence, cold = false) {
  const simulation = createExtractionApp({ worldOptions: { entityCapacity: 8 } });
  const collections = createRenderAssetCollections({ registry: simulation.assets });
  const mesh = collections.meshes.add(createBoxMeshAsset({ label: "Probe box baseline" }));
  const material = collections.materials.unlit.add(createUnlitMaterialAsset());
  simulation.spawn(withTransform({ translation: [0, 0, 5] }), withCamera());
  simulation.spawn(withTransform(), withMesh(mesh), withMaterial(material));
  if (cold) simulation.assets.markReady(mesh, changedMesh());
  const mirror = new AssetRegistry();
  const browserStatus = status();
  const serial = createSourceAssetSerializationState();
  const registry = createSnapshotPacketRegistry();
  const snapshots = new Set();
  const messages = new Set();
  const delivered = [];
  const presentations = [];
  let shared;
  const worker = {
    worker: { postMessage() {}, terminate() {} }, postMessage() {}, terminate() {},
    start(options) { shared = createSharedSnapshotTransportViews(options.transport); },
    onSnapshot(listener) { snapshots.add(listener); return () => snapshots.delete(listener); },
    onMessage(listener) { messages.add(listener); return () => messages.delete(listener); },
    onError() { return () => {}; },
  };
  const mirrored = mirrorSimulationWorkerSourceAssets(worker, mirror, browserStatus);
  const queue = new Map();
  let ticket = 0;
  vi.stubGlobal("requestAnimationFrame", (callback) => { queue.set(++ticket, callback); return ticket; });
  vi.stubGlobal("cancelAnimationFrame", (id) => queue.delete(id));
  const cpu = createCpuHarness();
  const created = await createWebGpuApp({
    canvas: cpu.canvas, environment: cpu.environment, simulationWorker: mirrored, sourceAssets: mirror,
    presentationCadence: cadence, transport: "shared-array-buffer", tonemap: "none", msaa: 1,
    sharedSnapshotTransport: { maxEntities: 8, maxViews: 2, maxPacketWords: 2048, requireCrossOriginIsolated: false },
    onPresentationSnapshot(snapshot) {
      const observation = { frame: snapshot.frame, mirrorVersion: mirror.get(mesh)?.version, sourceVersion: simulation.assets.get(mesh)?.version, snapshotNotifications: browserStatus.snapshots };
      presentations.push(observation); cpu.setContext(observation);
    },
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw Error(JSON.stringify(created));
  const app = created.app;
  app.start();
  const publish = (frame) => {
    const snapshot = simulation.stepAndExtract(1 / 60, frame, frame);
    expect(snapshot.meshDraws).toHaveLength(1);
    const encoded = encodeSnapshotPackets(snapshot, { registry });
    shared.writer.writeFrame({ frame, transforms: snapshot.transforms, viewMatrices: snapshot.viewMatrices, packetWords: encoded.words });
    return snapshot;
  };
  const notify = (frame, type) => {
    const sourceAssets = serializeSourceAssetRegistry(simulation.assets, { state: serial });
    const message = structuredClone({ type, frame, sourceAssets,
      ...(type === SIMULATION_WORKER_PROTOCOL.snapshot ? { snapshot: empty(frame), transport: { mode: "shared-array-buffer", registry: registry.snapshot() } } : {}),
      postMessageDecision: { postedMessage: type === SIMULATION_WORKER_PROTOCOL.snapshot ? "snapshot" : "sourceAssets", postMessageReasons: ["sourceAssetsChanged"] },
    });
    delivered.push({ type, frame, versions: sourceAssets.entries.map((entry) => ({ handle: entry.handle, version: entry.version })) });
    if (type === SIMULATION_WORKER_PROTOCOL.snapshot) {
      for (const listener of snapshots) listener({ snapshot: message.snapshot, frame, message });
    } else {
      for (const listener of messages) listener(message);
    }
    commitSerializedSourceAssets(serial, sourceAssets);
  };
  const raf = async (expectedCompleted) => {
    const entry = queue.entries().next().value;
    expect(entry, "An actual scheduler callback must be pending").toBeDefined();
    queue.delete(entry[0]); entry[1](ticket * 16);
    await waitFor(() => app.getDiagnostics().cadence.rendersCompleted.total === expectedCompleted, { label: "expected completed CPU renderer calls" });
    expect(app.getDiagnostics().cadence.renderFailures).toBe(0);
  };
  return { app, mesh, mirror, simulation, browserStatus, cpu, presentations, delivered, queue, publish, notify, raf,
    change() { simulation.assets.markReady(mesh, changedMesh()); },
    record(name, extra = {}) { console.log("SIDEBAND_EVIDENCE " + JSON.stringify({ name, cadence, cold, delivered, presentations, submissions: cpu.submissions, diagnostics: app.getDiagnostics(), ...extra })); },
    async stop() { await app.dispose(); mirrored.terminate(); vi.unstubAllGlobals(); },
  };
}
function geometry(submission) {
  expect(submission.draws).toHaveLength(1);
  const draw = submission.draws[0];
  expect(draw.method).toBe("drawIndexed");
  return { method: draw.method, args: draw.args, vertices: draw.vertices.map(({ slot, bytes }) => ({ slot, bytes })), index: { format: draw.index.format, bytes: draw.index.bytes } };
}
async function coldGeometry() {
  const f = await fixture("continuous", true);
  try {
    f.publish(2); f.notify(2, SIMULATION_WORKER_PROTOCOL.snapshot); await f.raf(1);
    expect(f.presentations).toEqual([{ frame: 2, mirrorVersion: 1, sourceVersion: 2, snapshotNotifications: 1 }]);
    const result = geometry(f.cpu.submissions.at(-1)); f.record("cold-changed-control"); return result;
  } finally { await f.stop(); }
}
describe("source-assets-only real mirror/scheduler CPU probe", () => {
  it("continuous SAB consumes changed sideband without another snapshot when delivery precedes polling", async () => {
    const cold = await coldGeometry();
    const f = await fixture("continuous");
    try {
      f.publish(1); f.notify(1, SIMULATION_WORKER_PROTOCOL.snapshot); await f.raf(1);
      const baseline = geometry(f.cpu.submissions.at(-1));
      f.change(); f.publish(2); f.notify(2, SIMULATION_WORKER_PROTOCOL.sourceAssets);
      expect(f.browserStatus.snapshots).toBe(1); expect(f.mirror.get(f.mesh).version).toBe(2);
      await f.raf(2);
      expect(f.presentations.map(({ frame, mirrorVersion }) => [frame, mirrorVersion])).toEqual([[1, 1], [2, 2]]);
      const changed = geometry(f.cpu.submissions.at(-1)); expect(changed).not.toEqual(baseline); expect(changed).toEqual(cold);
      f.record("continuous-sideband-before-poll", { coldExactGeometryMatch: true });
    } finally { await f.stop(); }
  });
  it("continuous SAB converges on the next frame after a late sideband; characterizes frozen same-frame deduplication", async () => {
    const cold = await coldGeometry();
    const f = await fixture("continuous");
    try {
      f.publish(1); f.notify(1, SIMULATION_WORKER_PROTOCOL.snapshot); await f.raf(1);
      const baseline = geometry(f.cpu.submissions.at(-1));
      f.change(); f.publish(2); await f.raf(2);
      expect(f.presentations.at(-1).mirrorVersion).toBe(1); expect(geometry(f.cpu.submissions.at(-1))).toEqual(baseline);
      f.notify(2, SIMULATION_WORKER_PROTOCOL.sourceAssets);
      expect(f.mirror.get(f.mesh).version).toBe(2); expect(f.browserStatus.snapshots).toBe(1);
      await f.raf(2);
      expect(f.presentations).toHaveLength(2);
      const stationary = { frame: 2, mirrorVersion: 2, lastSubmissionMirrorVersion: f.cpu.submissions.at(-1).mirrorVersion, completedRenders: 2, sameFrameRerendered: false };
      // No cross-frame atomicity or same-frame invalidation promise is invented.
      // The continuously publishing producer's next unchanged-geometry SAB frame must converge.
      f.publish(3); await f.raf(3);
      expect(f.presentations.map(({ frame, mirrorVersion }) => [frame, mirrorVersion])).toEqual([[1, 1], [2, 1], [3, 2]]);
      expect(f.browserStatus.snapshots).toBe(1); expect(geometry(f.cpu.submissions.at(-1))).toEqual(cold);
      f.record("continuous-poll-before-sideband", { stationary, coldExactGeometryMatch: true });
    } finally { await f.stop(); }
  });
  it("snapshot cadence remains asleep after a sideband and consumes changed SAB on a legitimate matching snapshot wake", async () => {
    const cold = await coldGeometry();
    const f = await fixture("snapshot");
    try {
      f.publish(1); f.notify(1, SIMULATION_WORKER_PROTOCOL.snapshot); await f.raf(1);
      expect(f.queue.size).toBe(0);
      f.change(); f.publish(2); expect(f.queue.size).toBe(0); expect(f.mirror.get(f.mesh).version).toBe(1);
      f.notify(2, SIMULATION_WORKER_PROTOCOL.sourceAssets);
      expect(f.mirror.get(f.mesh).version).toBe(2); expect(f.queue.size).toBe(0); expect(f.presentations).toHaveLength(1);
      expect(f.browserStatus.snapshots).toBe(1);
      f.notify(2, SIMULATION_WORKER_PROTOCOL.snapshot); await f.raf(2);
      expect(f.presentations.map(({ frame, mirrorVersion }) => [frame, mirrorVersion])).toEqual([[1, 1], [2, 2]]);
      expect(geometry(f.cpu.submissions.at(-1))).toEqual(cold); expect(f.queue.size).toBe(0);
      f.record("demand-later-snapshot-wake", { coldExactGeometryMatch: true, sidebandScheduledNoWake: true });
    } finally { await f.stop(); }
  });
});
