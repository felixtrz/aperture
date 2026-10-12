import { createSimulationWorker } from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import { mirrorSourceAssetRegistryFromMessage } from "@aperture-engine/app/asset-mirror";
import {
  createApertureDevtoolsRequest,
  createGeneratedCommandMessage,
} from "@aperture-engine/app/commands";
import { createWebGpuApp } from "@aperture-engine/webgpu";
const canvas = document.querySelector("canvas");
const assets = new AssetRegistry();
const worker = createSimulationWorker(
  new Worker(new URL("./worker.js", import.meta.url), { type: "module" }),
);
let gpu,
  latest,
  requestNumber = 0;
const pending = new Map();
const meshWorldMatrices = new Map();
let snapshotWaiters = [];
worker.onMessage((msg) => {
  mirrorSourceAssetRegistryFromMessage(assets, msg);
  if (msg?.type === "aperture.devtools.response") {
    const p = pending.get(msg.requestId);
    if (p) {
      pending.delete(msg.requestId);
      msg.ok
        ? p.resolve(msg.result)
        : p.reject(new Error(JSON.stringify(msg.diagnostics)));
    }
  }
});
worker.onSnapshot((event) => {
  mirrorSourceAssetRegistryFromMessage(assets, event.message);
  latest = event.snapshot;
  for (const draw of [
    ...latest.meshDraws,
    ...(latest.shadowCasterDraws ?? []),
  ]) {
    meshWorldMatrices.set(
      draw.mesh.id,
      latest.transforms.slice(
        draw.worldTransformOffset,
        draw.worldTransformOffset + 16,
      ),
    );
  }
  for (const p of snapshotWaiters.splice(0)) p.resolve(latest);
});
worker.onError((e) => {
  console.error(e);
  for (const p of pending.values()) p.reject(new Error(e.message));
  for (const p of snapshotWaiters.splice(0)) p.reject(new Error(e.message));
});
function tool(name, payload) {
  return new Promise((resolve, reject) => {
    const requestId = `bench-${++requestNumber}`;
    pending.set(requestId, { resolve, reject });
    worker.postMessage(
      createApertureDevtoolsRequest({ requestId, tool: name, payload }),
    );
  });
}
async function step(delta = 0, time = 0) {
  const snap = new Promise((resolve, reject) =>
    snapshotWaiters.push({ resolve, reject }),
  );
  await tool("ecs_step", { delta, time });
  return await snap;
}
const ready = (async () => {
  const result = await createWebGpuApp({
    canvas,
    simulationWorker: worker,
    sourceAssets: assets,
    autoStart: false,
    msaaSampleCount: 4,
    tonemap: "aces",
    exposure: 1,
    useFrameGraph: true,
  });
  if (!result.ok) throw new Error(JSON.stringify(result));
  gpu = result.app;
  const started = new Promise((resolve, reject) => {
    const off = worker.onMessage((m) => {
      if (m?.type === "aperture.simulation.ready") {
        off();
        resolve();
      }
    });
    worker.onError((e) => reject(new Error(e.message)));
  });
  worker.start({
    simulationPaused: true,
    entityCapacity: 2048,
    transport: { mode: "transferable" },
  });
  await started;
  await step(0, 0);
})();

globalThis.__AGENT_BENCHMARK__ = {
  engine: "aperture",
  canvas,
  ready,
  async setCamera(c) {
    await ready;
    worker.postMessage(
      createGeneratedCommandMessage({ channel: "bench.camera", payload: c }),
    );
  },
  async renderFrame(f) {
    await ready;
    const snapshot = await step(f.deltaSeconds, f.timeSeconds);
    await gpu.renderSnapshot(snapshot, { frame: f.frame });
  },
  async inspectGeometry() {
    await ready;
    const meshes = [];
    for (const entry of assets.list()) {
      const m = entry.asset;
      if (m?.kind !== "mesh") continue;
      const p = m.vertexStreams.find((s) =>
        s.attributes.some((a) => a.semantic === "POSITION"),
      );
      if (!p) continue;
      const attr = p.attributes.find((a) => a.semantic === "POSITION");
      const n = p.attributes.find((a) => a.semantic === "NORMAL");
      const stride = p.arrayStride / 4;
      const pos = new Float32Array(p.vertexCount * 3),
        norm = new Float32Array(p.vertexCount * 3);
      for (let i = 0; i < p.vertexCount; i++) {
        for (let k = 0; k < 3; k++) {
          pos[i * 3 + k] = p.data[i * stride + attr.offset / 4 + k];
          if (n) norm[i * 3 + k] = p.data[i * stride + n.offset / 4 + k];
        }
      }
      meshes.push({
        id: entry.handle.id,
        positions: pos,
        normals: n ? norm : undefined,
        indices: m.indexBuffer?.data,
        worldMatrix: meshWorldMatrices.get(entry.handle.id),
      });
    }
    return { meshes };
  },
  async dispose() {
    worker.terminate();
    if (gpu) await gpu.dispose();
  },
};
