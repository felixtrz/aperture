import { describe, expect, it } from "vitest";
import {
  SIMULATION_WORKER_PROTOCOL,
  createExtractionApp,
  createSimulationWorker,
  renderSnapshotTransferList,
  withCamera,
  withMaterial,
  withMesh,
  withRenderLayer,
  withTransform,
  withVisibility,
  type SimulationMessagePort,
  type SimulationWorker,
  type SimulationWorkerSnapshotEvent,
  type SimulationWorkerTransport,
} from "@aperture-engine/runtime";
import {
  createBoxMeshAsset,
  createRenderAssetCollections,
  createQuadSnapshotBuffers,
  createUnlitMaterialAsset,
  type RenderSnapshot,
} from "@aperture-engine/render";

describe("createSimulationWorker", () => {
  it("receives a structurally valid snapshot from a worker entry", async () => {
    const transport = new InlineSimulationWorkerTransport((port) => {
      port.addEventListener("message", (event) => {
        const data = event.data;

        if (
          typeof data !== "object" ||
          data === null ||
          !("type" in data) ||
          data.type !== SIMULATION_WORKER_PROTOCOL.start
        ) {
          return;
        }

        const options =
          "options" in data && typeof data.options === "object"
            ? data.options
            : {};
        const entityCapacity =
          options !== null &&
          "entityCapacity" in options &&
          typeof options.entityCapacity === "number"
            ? options.entityCapacity
            : 8;

        port.postMessage({
          type: SIMULATION_WORKER_PROTOCOL.snapshot,
          snapshot: createOneEntitySnapshot(entityCapacity),
        });
      });
      port.start?.();
    });
    const worker = createSimulationWorker(transport, { entityCapacity: 8 });
    const snapshot = await nextSnapshot(worker, () => worker.start());

    expect(snapshot.frame).toBe(1);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.transforms).toBeInstanceOf(Float32Array);
    expect(snapshot.viewMatrices).toBeInstanceOf(Float32Array);
    expect(snapshot.transforms.length).toBeGreaterThanOrEqual(16);
    expect(snapshot.viewMatrices.length).toBeGreaterThanOrEqual(48);
    expect(snapshot.diagnostics).toEqual([]);

    worker.terminate();
    expect(transport.terminated).toBe(true);
  });

  it("transfers snapshot buffers without cloning typed-array payloads", () => {
    const snapshot: RenderSnapshot = {
      frame: 1,
      views: [],
      meshDraws: [],
      lights: [],
      environments: [],
      shadowRequests: [],
      bounds: [],
      transforms: new Float32Array(16).fill(1),
      viewMatrices: new Float32Array(48).fill(2),
      quads: createQuadSnapshotBuffers({
        instanceFloats: new Float32Array(24).fill(3),
        instanceWords: new Uint32Array(8).fill(4),
      }),
      diagnostics: [],
      report: {
        views: 0,
        meshDraws: 0,
        lights: 0,
        environments: 0,
        shadowRequests: 0,
        bounds: 0,
        quadInstances: 1,
        quadBatches: 0,
        diagnostics: 0,
      },
    };
    const expectedQuadFloats = new Float32Array(24).fill(3);
    const expectedQuadWords = new Uint32Array(8).fill(4);

    const sent = structuredClone(
      {
        snapshot,
      },
      { transfer: renderSnapshotTransferList(snapshot) },
    );

    expect(snapshot.transforms.byteLength).toBe(0);
    expect(snapshot.viewMatrices.byteLength).toBe(0);
    expect(snapshot.quads?.instanceFloats.byteLength).toBe(0);
    expect(snapshot.quads?.instanceWords.byteLength).toBe(0);
    expect(sent.snapshot.transforms).toEqual(new Float32Array(16).fill(1));
    expect(sent.snapshot.viewMatrices).toEqual(new Float32Array(48).fill(2));
    expect(sent.snapshot.quads?.instanceFloats).toEqual(expectedQuadFloats);
    expect(sent.snapshot.quads?.instanceWords).toEqual(expectedQuadWords);
  });
});

function createOneEntitySnapshot(entityCapacity: number): RenderSnapshot {
  const app = createExtractionApp({
    worldOptions: { entityCapacity },
  });
  const assets = createRenderAssetCollections({ registry: app.assets });
  const mesh = assets.meshes.add(
    createBoxMeshAsset({
      label: "WorkerTestBox",
      width: 1,
      height: 1,
      depth: 1,
    }),
    { id: "worker-test-box" },
  );
  const material = assets.materials.unlit.add(
    createUnlitMaterialAsset({
      label: "WorkerTestMaterial",
      baseColorFactor: new Float32Array([1, 1, 1, 1]),
    }),
    { id: "worker-test-material" },
  );

  app.spawn(
    withTransform({ translation: [0, 0, 5] }),
    withCamera({ near: 0.1, far: 100, layerMask: 1 }),
  );
  app.spawn(
    withTransform(),
    withMesh(mesh),
    withMaterial(material),
    withRenderLayer(1),
    withVisibility(true),
  );

  return app.stepAndExtract(1 / 60, 1, 1);
}

function nextSnapshot(
  worker: SimulationWorker,
  start: () => void,
): Promise<RenderSnapshot> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribeSnapshot();
      unsubscribeError();
      reject(new Error("Timed out waiting for simulation worker snapshot."));
    }, 1000);
    const unsubscribeSnapshot = worker.onSnapshot(
      (event: SimulationWorkerSnapshotEvent) => {
        clearTimeout(timeout);
        unsubscribeSnapshot();
        unsubscribeError();
        resolve(event.snapshot);
      },
    );
    const unsubscribeError = worker.onError((event) => {
      clearTimeout(timeout);
      unsubscribeSnapshot();
      unsubscribeError();
      reject(new Error(`${event.reason}: ${event.message}`));
    });

    start();
  });
}

class InlineSimulationWorkerTransport implements SimulationWorkerTransport {
  terminated = false;

  constructor(private readonly entry: (port: SimulationMessagePort) => void) {}

  postMessage(message: unknown): void {
    if (
      typeof message !== "object" ||
      message === null ||
      !("type" in message) ||
      message.type !== SIMULATION_WORKER_PROTOCOL.connect ||
      !("port" in message)
    ) {
      return;
    }

    this.entry(message.port as SimulationMessagePort);
  }

  terminate(): void {
    this.terminated = true;
  }
}
