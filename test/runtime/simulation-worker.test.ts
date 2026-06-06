import { describe, expect, it } from "vitest";
import {
  SIMULATION_WORKER_PROTOCOL,
  copyRenderSnapshotIntoBufferLease,
  createExtractionApp,
  createRenderSnapshotBufferPool,
  createSimulationWorker,
  estimateRenderSnapshotTransportCost,
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

  it("reuses transferred snapshot buffers across repeated round trips", () => {
    const pool = createRenderSnapshotBufferPool(2);

    for (let frame = 0; frame < 60; frame += 1) {
      const lease = pool.acquire({
        transformFloats: 16,
        viewMatrixFloats: 48,
      });
      lease.transforms[12] = frame;
      lease.viewMatrices[0] = 1;

      const sent = structuredClone(
        {
          id: lease.id,
          transforms: lease.transforms,
          viewMatrices: lease.viewMatrices,
        },
        { transfer: lease.transfer },
      );

      expect(lease.transforms.byteLength).toBe(0);
      expect(lease.viewMatrices.byteLength).toBe(0);

      const returned = structuredClone(sent, {
        transfer: [sent.transforms.buffer, sent.viewMatrices.buffer],
      });

      pool.release(returned);
    }

    expect(pool.stats()).toEqual({
      capacity: 2,
      available: 2,
      inUse: 0,
      allocations: 2,
    });
  });

  it("reuses transferred quad snapshot buffers across repeated round trips", () => {
    const pool = createRenderSnapshotBufferPool(1);
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
    const lease = pool.acquire({
      transformFloats: snapshot.transforms.length,
      viewMatrixFloats: snapshot.viewMatrices.length,
      quadInstanceFloats: snapshot.quads?.instanceFloats.length ?? 0,
      quadInstanceWords: snapshot.quads?.instanceWords.length ?? 0,
    });
    const leased = copyRenderSnapshotIntoBufferLease(snapshot, lease);

    const sent = structuredClone(
      {
        id: lease.id,
        transforms: leased.transforms,
        viewMatrices: leased.viewMatrices,
        quadInstanceFloats: leased.quads?.instanceFloats,
        quadInstanceWords: leased.quads?.instanceWords,
      },
      { transfer: lease.transfer },
    );

    expect(leased.quads?.instanceFloats.byteLength).toBe(0);
    expect(leased.quads?.instanceWords.byteLength).toBe(0);
    expect(sent.quadInstanceFloats).toEqual(new Float32Array(24).fill(3));
    expect(sent.quadInstanceWords).toEqual(new Uint32Array(8).fill(4));

    pool.release({
      id: sent.id,
      transforms: sent.transforms,
      viewMatrices: sent.viewMatrices,
      quadInstanceFloats: sent.quadInstanceFloats as Float32Array,
      quadInstanceWords: sent.quadInstanceWords as Uint32Array,
    });
    expect(pool.stats()).toEqual({
      capacity: 1,
      available: 1,
      inUse: 0,
      allocations: 4,
    });
  });

  it("estimates transferable snapshot transport as at least 80% cheaper than cloning typed arrays", () => {
    const snapshot = createSyntheticSnapshot(1_000);
    const report = estimateRenderSnapshotTransportCost(snapshot);

    expect(report.structuredCloneBytes).toBe(
      snapshot.transforms.byteLength +
        snapshot.viewMatrices.byteLength +
        (snapshot.instanceTints?.byteLength ?? 0),
    );
    expect(report.transferableBytes).toBe(0);
    expect(report.reductionRatio).toBeGreaterThanOrEqual(0.8);
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

function createSyntheticSnapshot(
  entityCount: number,
): Pick<RenderSnapshot, "transforms" | "viewMatrices" | "instanceTints"> {
  return {
    transforms: new Float32Array(entityCount * 16),
    viewMatrices: new Float32Array(48),
    instanceTints: new Float32Array(entityCount * 4),
  };
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
