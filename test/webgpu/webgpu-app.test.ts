import { describe, expect, it } from "vitest";
import {
  assetHandleKey,
  createRenderTargetHandle,
  createSamplerHandle,
  createTextureHandle,
  LocalTransform,
  type Entity,
} from "@aperture-engine/simulation";
import {
  createBoxMeshAsset,
  createCustomWgslMaterialAsset,
  createDebugNormalMaterialAsset,
  createMatcapMaterialAsset,
  createRenderAssetCollections,
  createSamplerAsset,
  createStandardMaterialAsset,
  createTextureAsset,
  createUnlitMaterialAsset,
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
  Light,
  LightKind,
  Material,
  Visibility,
  type MeshAsset,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createSharedSnapshotTransportViews,
  createExtractionApp,
  withCamera,
  withLight,
  withLightShadowSettings,
  withMaterial,
  withMesh,
  withRenderLayer,
  withSkybox,
  withSprite,
  withTransform,
  withVisibility,
  type SharedSnapshotTransportBuffers,
  type SpawnEntityInitializer,
  type CreateExtractionAppOptions,
} from "@aperture-engine/runtime";
import {
  createQueuedMaterialAdapterRegistry,
  createWebGpuCopyPostEffect,
  createWebGpuSsaoPostEffect,
  createWebGpuApp as createRendererOnlyWebGpuApp,
  createWebGpuAppRenderTargetAsset,
  createWebGpuAppDiagnosticsSummary,
  createWebGpuAppDrawResourceSetPlan,
  queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue,
  validateQueuedBuiltInAppResourceAdapterRegistry,
  type CreateWebGpuAppOptions,
  type CreateWebGpuAppResult,
  type WebGpuApp,
  type WebGpuAppRenderOptions,
  type WebGpuAppRenderReport,
  type WebGpuAppSimulationWorker,
  type WebGpuAppSimulationWorkerSnapshotCallback,
  type WebGpuAppSimulationWorkerErrorCallback,
  webGpuAppRenderReportToJson,
  webGpuAppRenderReportToJsonValue,
} from "@aperture-engine/webgpu/test-support";

type LegacyCreateWebGpuAppOptions = Omit<
  CreateWebGpuAppOptions,
  "simulationWorker" | "sourceAssets" | "autoStart" | "workerStartOptions"
> & {
  readonly worldOptions?: CreateExtractionAppOptions["worldOptions"];
};

type LegacyWebGpuApp = WebGpuApp &
  ReturnType<typeof createExtractionApp> & {
    render(options?: WebGpuAppRenderOptions): Promise<WebGpuAppRenderReport>;
    stepAndRender(
      delta?: number,
      time?: number,
      frame?: number,
    ): Promise<WebGpuAppRenderReport>;
  };

type LegacyCreateWebGpuAppResult =
  | (Omit<Extract<CreateWebGpuAppResult, { ok: true }>, "app"> & {
      readonly app: LegacyWebGpuApp;
    })
  | Extract<CreateWebGpuAppResult, { ok: false }>;

async function createWebGpuApp(
  options: LegacyCreateWebGpuAppOptions,
): Promise<LegacyCreateWebGpuAppResult> {
  const extraction = createExtractionApp({
    ...(options.worldOptions === undefined
      ? {}
      : { worldOptions: options.worldOptions }),
  });
  const simulationWorker = createManualSimulationWorker();
  const { worldOptions: _worldOptions, ...rendererOptions } = options;
  const created = await createRendererOnlyWebGpuApp({
    ...rendererOptions,
    simulationWorker,
    sourceAssets: extraction.assets,
  });

  if (!created.ok) {
    return created;
  }

  const renderer = created.app;
  const legacyApp: LegacyWebGpuApp = {
    ...renderer,
    world: extraction.world,
    assets: extraction.assets,
    spawn(...initializers: SpawnEntityInitializer[]): Entity {
      return extraction.spawn(...initializers);
    },
    registerSystem(system) {
      extraction.registerSystem(system);
      return legacyApp;
    },
    registerFixedStepTask(task) {
      return extraction.registerFixedStepTask(task);
    },
    resetFixedStepClock() {
      extraction.resetFixedStepClock();
    },
    step(delta = 0, time = 0) {
      return extraction.step(delta, time);
    },
    extract(frame = 0) {
      return extraction.extract(frame);
    },
    stepAndExtract(delta = 0, time = 0, frame = 0) {
      return extraction.stepAndExtract(delta, time, frame);
    },
    async render(renderOptions = {}) {
      const { snapshot: explicitSnapshot, ...rendererRenderOptions } =
        renderOptions;
      const snapshot =
        explicitSnapshot ?? extraction.extract(renderOptions.frame ?? 0);

      return renderer.renderSnapshot(snapshot, rendererRenderOptions);
    },
    async stepAndRender(delta = 0, time = 0, frame = 0) {
      const snapshot = extraction.stepAndExtract(delta, time, frame);

      return renderer.renderSnapshot(snapshot, { frame });
    },
  };

  return { ...created, app: legacyApp };
}

function createManualSimulationWorker(): WebGpuAppSimulationWorker & {
  emitSnapshot(snapshot: RenderSnapshot, frame?: number): void;
} {
  const snapshotCallbacks =
    new Set<WebGpuAppSimulationWorkerSnapshotCallback>();
  const errorCallbacks = new Set<WebGpuAppSimulationWorkerErrorCallback>();

  return {
    start() {},
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
    emitSnapshot(snapshot, frame = snapshot.frame) {
      void errorCallbacks;
      for (const callback of snapshotCallbacks) {
        callback({ snapshot, frame });
      }
    },
  };
}

function createStartOptionsCaptureSimulationWorker(): WebGpuAppSimulationWorker & {
  readonly startOptions: Record<string, unknown> | null;
} {
  let startOptions: Record<string, unknown> | null = null;

  return {
    get startOptions() {
      return startOptions;
    },
    start(options = {}) {
      startOptions = options;
    },
    onSnapshot() {
      return () => {};
    },
    onError() {
      return () => {};
    },
  };
}

function createSharedSnapshotManualSimulationWorker(
  snapshot: RenderSnapshot,
): WebGpuAppSimulationWorker & {
  readonly startedTransportMode: "shared-array-buffer" | null;
} {
  const snapshotCallbacks =
    new Set<WebGpuAppSimulationWorkerSnapshotCallback>();
  const errorCallbacks = new Set<WebGpuAppSimulationWorkerErrorCallback>();
  let startedTransportMode: "shared-array-buffer" | null = null;

  return {
    get startedTransportMode() {
      return startedTransportMode;
    },
    start(options = {}) {
      const transport = readSharedSnapshotTransportBuffers(options);

      if (transport === null) {
        for (const callback of errorCallbacks) {
          callback({
            reason: "test.shared-transport-missing",
            message: "Expected SharedArrayBuffer transport start payload.",
          });
        }
        return;
      }

      const shared = createSharedSnapshotTransportViews(transport);
      const registry = createSnapshotPacketRegistry();
      const encoded = encodeSnapshotPackets(snapshot, { registry });

      startedTransportMode = "shared-array-buffer";
      shared.writer.writeFrame({
        frame: snapshot.frame,
        transforms: snapshot.transforms,
        ...(snapshot.instanceTints === undefined
          ? {}
          : { instanceTints: snapshot.instanceTints }),
        ...(snapshot.quads === undefined
          ? {}
          : {
              quadInstanceFloats: snapshot.quads.instanceFloats,
              quadInstanceWords: snapshot.quads.instanceWords,
            }),
        viewMatrices: snapshot.viewMatrices,
        packetWords: encoded.words,
      });

      for (const callback of snapshotCallbacks) {
        callback({
          frame: snapshot.frame,
          snapshot: createPlaceholderSnapshot(snapshot.frame),
          message: {
            type: "aperture.simulation.snapshot",
            frame: snapshot.frame,
            snapshot: createPlaceholderSnapshot(snapshot.frame),
            transport: {
              mode: "shared-array-buffer",
              registry: registry.snapshot(),
              diagnostics: snapshot.diagnostics,
            },
          },
        });
      }
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
  };
}

function readSharedSnapshotTransportBuffers(
  value: Record<string, unknown>,
): SharedSnapshotTransportBuffers | null {
  const transport = value.transport;

  if (
    typeof transport !== "object" ||
    transport === null ||
    !("mode" in transport) ||
    transport.mode !== "shared-array-buffer"
  ) {
    return null;
  }

  return transport as unknown as SharedSnapshotTransportBuffers;
}

function createPlaceholderSnapshot(frame: number): RenderSnapshot {
  return {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
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
  };
}

function runNextScheduledRaf(scheduledRafs: FrameRequestCallback[]): void {
  const callback = scheduledRafs.shift();

  if (callback === undefined) {
    throw new Error("Expected a scheduled requestAnimationFrame callback.");
  }

  callback(performance.now());
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 100,
): Promise<void> {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition.");
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("WebGPU app facade", () => {
  it("creates a renderer-only app that consumes worker snapshots without ECS authoring APIs", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const simulation = createExtractionApp({
      worldOptions: { entityCapacity: 8 },
    });
    const sourceAssets = createRenderAssetCollections({
      registry: simulation.assets,
    });
    const mesh = sourceAssets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = sourceAssets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );
    const worker = createManualSimulationWorker();
    const created = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: worker,
      sourceAssets: simulation.assets,
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;

    expect("world" in app).toBe(false);
    expect("assets" in app).toBe(false);
    expect("spawn" in app).toBe(false);

    simulation.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    simulation.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    app.start();
    worker.emitSnapshot(simulation.stepAndExtract(1 / 60, 1, 6));
    worker.emitSnapshot(simulation.stepAndExtract(1 / 60, 1 + 1 / 60, 7));
    await waitForCondition(() => {
      const diagnostics = app.getDiagnostics();

      return (
        diagnostics.lastFrame?.frame === 7 &&
        diagnostics.cadence.rendersCompleted.total === 1
      );
    });

    const diagnostics = app.getDiagnostics();

    expect(diagnostics.lastError).toBeNull();
    expect(diagnostics.lastFrame?.ok).toBe(true);
    expect(diagnostics.lastFrame?.frame).toBe(7);
    expect(app.getDiagnostics().lastFrame).toBe(diagnostics.lastFrame);
    expect(diagnostics.cadence).toMatchObject({
      sampleWindow: 120,
      pendingSnapshotsReplaced: 1,
      renderCompletionDrains: 0,
      renderFailures: 0,
      pendingSnapshot: false,
      scheduled: false,
      inFlight: false,
      snapshotsReceived: {
        total: 2,
        intervalSamples: 1,
        latestFrame: 7,
      },
      presentationCallbacks: {
        total: 1,
      },
      rendersStarted: {
        total: 1,
        latestFrame: 7,
      },
      rendersCompleted: {
        total: 1,
        latestFrame: 7,
      },
      pacing: {
        snapshotQueueAgeMilliseconds: {
          count: 1,
        },
        renderedFrameGap: {
          count: 0,
        },
        skippedSnapshotFrames: 0,
      },
    });
    expect(
      diagnostics.cadence.pacing.snapshotQueueAgeMilliseconds.latest,
    ).toBeGreaterThanOrEqual(0);
    app.stop();
  });

  it("renders a pending worker snapshot on the next RAF after a presentation tick is missed in flight", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const simulation = createExtractionApp({
      worldOptions: { entityCapacity: 8 },
    });
    const sourceAssets = createRenderAssetCollections({
      registry: simulation.assets,
    });
    const mesh = sourceAssets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = sourceAssets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );
    const worker = createManualSimulationWorker();
    const rafScope = globalThis as typeof globalThis & {
      requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    };
    const previousRequestAnimationFrame = rafScope.requestAnimationFrame;
    const scheduledRafs: FrameRequestCallback[] = [];

    rafScope.requestAnimationFrame = (callback) => {
      scheduledRafs.push(callback);
      return scheduledRafs.length;
    };

    try {
      const created = await createRendererOnlyWebGpuApp({
        canvas,
        environment,
        simulationWorker: worker,
        sourceAssets: simulation.assets,
      });

      expect(created.ok).toBe(true);

      if (!created.ok) {
        return;
      }

      const app = created.app;
      const originalRenderSnapshot = app.renderSnapshot.bind(app);
      let releaseFirstRender: (() => void) | null = null;
      const firstRenderGate = new Promise<void>((resolve) => {
        releaseFirstRender = resolve;
      });
      let resolveFirstRenderStarted: (() => void) | null = null;
      const firstRenderStarted = new Promise<void>((resolve) => {
        resolveFirstRenderStarted = resolve;
      });
      let renderCalls = 0;
      let rafCallbackRunning = false;
      const renderStartedDuringRaf: boolean[] = [];
      const runRaf = (): void => {
        const callback = scheduledRafs.shift();

        if (callback === undefined) {
          throw new Error(
            "Expected a scheduled requestAnimationFrame callback.",
          );
        }

        rafCallbackRunning = true;
        try {
          callback(performance.now());
        } finally {
          rafCallbackRunning = false;
        }
      };

      app.renderSnapshot = async (snapshot, renderOptions = {}) => {
        renderCalls += 1;
        renderStartedDuringRaf.push(rafCallbackRunning);
        if (renderCalls === 1) {
          resolveFirstRenderStarted?.();
          await firstRenderGate;
        }

        return originalRenderSnapshot(snapshot, renderOptions);
      };

      simulation.spawn(
        withTransform({ translation: [0, 0, 5] }),
        withCamera({ priority: 0, layerMask: 1 }),
      );
      simulation.spawn(
        withTransform(),
        withMesh(mesh),
        withMaterial(material),
        withRenderLayer(1),
        withVisibility(true),
      );

      const firstSnapshot = simulation.stepAndExtract(1 / 60, 1, 1);
      const secondSnapshot = simulation.stepAndExtract(1 / 60, 1 + 1 / 60, 2);

      app.start();
      worker.emitSnapshot(firstSnapshot);
      runRaf();
      await firstRenderStarted;

      worker.emitSnapshot(secondSnapshot);
      expect(scheduledRafs).toHaveLength(1);
      runRaf();

      releaseFirstRender?.();
      await waitForCondition(() => {
        const diagnostics = app.getDiagnostics();

        return (
          diagnostics.lastFrame?.frame === 1 &&
          diagnostics.cadence.rendersCompleted.total === 1
        );
      }, 500);
      expect(scheduledRafs).toHaveLength(1);
      runRaf();

      await waitForCondition(() => {
        const diagnostics = app.getDiagnostics();

        return (
          diagnostics.lastFrame?.frame === 2 &&
          diagnostics.cadence.rendersCompleted.total === 2
        );
      }, 500);

      const diagnostics = app.getDiagnostics();

      expect(renderCalls).toBe(2);
      expect(renderStartedDuringRaf).toEqual([true, true]);
      expect(diagnostics.cadence.presentationCallbacks.total).toBe(3);
      expect(diagnostics.cadence.presentationCallbacksWhileInFlight).toBe(1);
      expect(diagnostics.cadence.renderCompletionDrains).toBe(0);
      expect(diagnostics.cadence.rendersCompleted.latestFrame).toBe(2);
      expect(diagnostics.cadence.pacing.renderedFrameGap.latest).toBe(1);
      expect(diagnostics.cadence.pacing.skippedSnapshotFrames).toBe(0);
      expect(diagnostics.cadence.pendingSnapshot).toBe(false);
      expect(diagnostics.cadence.renderFailures).toBe(0);
      app.stop();
    } finally {
      if (previousRequestAnimationFrame === undefined) {
        delete rafScope.requestAnimationFrame;
      } else {
        rafScope.requestAnimationFrame = previousRequestAnimationFrame;
      }
    }
  });

  it("consumes opt-in SharedArrayBuffer snapshots through createWebGpuApp", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const simulation = createExtractionApp({
      worldOptions: { entityCapacity: 8 },
    });
    const sourceAssets = createRenderAssetCollections({
      registry: simulation.assets,
    });
    const mesh = sourceAssets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = sourceAssets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );

    simulation.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    simulation.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const worker = createSharedSnapshotManualSimulationWorker(
      simulation.stepAndExtract(1 / 60, 1, 11),
    );
    const created = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: worker,
      sourceAssets: simulation.assets,
      transport: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 8,
        maxViews: 2,
        maxPacketWords: 2048,
        requireCrossOriginIsolated: false,
      },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;

    app.start();
    await waitForCondition(() => app.getDiagnostics().lastFrame !== null);

    const diagnostics = app.getDiagnostics();

    expect(worker.startedTransportMode).toBe("shared-array-buffer");
    expect(diagnostics.transport).toMatchObject({
      requested: "shared-array-buffer",
      active: "shared-array-buffer",
      fallback: null,
      sharedArrayBuffer: {
        supported: true,
      },
    });
    expect(diagnostics.lastFrame?.ok).toBe(true);
    expect(diagnostics.lastFrame?.frame).toBe(11);
    expect(diagnostics.lastFrame?.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
    });
    app.stop();
  });

  it("uses SharedArrayBuffer snapshots by default when auto transport is supported", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const simulation = createExtractionApp({
      worldOptions: { entityCapacity: 8 },
    });
    const sourceAssets = createRenderAssetCollections({
      registry: simulation.assets,
    });
    const mesh = sourceAssets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = sourceAssets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );

    simulation.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    simulation.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const worker = createSharedSnapshotManualSimulationWorker(
      simulation.stepAndExtract(1 / 60, 1, 13),
    );
    const created = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: worker,
      sourceAssets: simulation.assets,
      sharedSnapshotTransport: {
        maxEntities: 8,
        maxViews: 2,
        maxPacketWords: 2048,
        crossOriginIsolated: true,
      },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;

    app.start();
    await waitForCondition(() => app.getDiagnostics().lastFrame !== null);

    const diagnostics = app.getDiagnostics();

    expect(worker.startedTransportMode).toBe("shared-array-buffer");
    expect(diagnostics.transport).toMatchObject({
      requested: "auto",
      active: "shared-array-buffer",
      fallback: null,
      sharedArrayBuffer: {
        supported: true,
      },
    });
    expect(diagnostics.lastFrame?.frame).toBe(13);
    expect(diagnostics.lastFrame?.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
    });
    app.stop();
  });

  it("falls back to transferable diagnostics when SAB is unavailable", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: createManualSimulationWorker(),
      transport: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        sharedArrayBufferConstructor: null,
        requireCrossOriginIsolated: false,
      },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    expect(created.app.getDiagnostics().transport).toMatchObject({
      requested: "shared-array-buffer",
      active: "transferable",
      fallback: "transferable",
      sharedArrayBuffer: {
        supported: false,
        diagnostic: {
          code: "webGpuApp.sharedSnapshotTransportUnsupported",
          reason: "shared-array-buffer-unavailable",
        },
      },
    });
  });

  it("falls back to transferable snapshots by default when auto transport is not isolated", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: createManualSimulationWorker(),
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        crossOriginIsolated: false,
      },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    expect(created.app.getDiagnostics().transport).toMatchObject({
      requested: "auto",
      active: "transferable",
      fallback: "transferable",
      sharedArrayBuffer: {
        supported: false,
        diagnostic: {
          reason: "cross-origin-isolation-required",
        },
      },
    });
  });

  it("starts generated workers with KTX2 texture-compression support from WebGPU features", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events, {
      features: ["texture-compression-bc"],
    });
    const worker = createStartOptionsCaptureSimulationWorker();

    const created = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: worker,
      autoStart: true,
    });

    expect(created.ok).toBe(true);
    expect(worker.startOptions).toMatchObject({
      assetDecoders: {
        ktx2TextureCompression: {
          astc: false,
          bc: true,
          etc2: false,
        },
      },
    });
  });

  it("stores the selected output tonemap operator on renderer-only apps", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: createManualSimulationWorker(),
      tonemap: "aces",
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    expect(created.app.tonemap).toBe("aces");
    expect(created.app.outputColorSpace).toBe("srgb");
  });

  it("defaults useFrameGraph to ON and lets an explicit false force the legacy route (AI-25)", async () => {
    const { canvas, environment } = webGpuHarness([]);
    const defaulted = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: createManualSimulationWorker(),
    });

    expect(defaulted.ok).toBe(true);
    if (defaulted.ok) {
      expect(defaulted.app.useFrameGraph).toBe(true);
    }

    const legacy = await createRendererOnlyWebGpuApp({
      canvas,
      environment,
      simulationWorker: createManualSimulationWorker(),
      useFrameGraph: false,
    });

    expect(legacy.ok).toBe(true);
    if (legacy.ok) {
      expect(legacy.app.useFrameGraph).toBe(false);
    }
  });

  it("initializes WebGPU and renders the unlit queue path from ECS-authored entities", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 11);

    expect(frame.ok).toBe(true);
    expect(frame.frame).toBe(11);
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(frame.depthAttachment).toEqual({
      format: "depth24plus",
      attached: true,
      width: 1,
      height: 1,
      opaquePipelineDepthWriteCount: 1,
    });
    expect(
      frame.boundary?.attachments?.plan?.depthStencilAttachment,
    ).toMatchObject({
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialCache: {
        totalEntries: 1,
        families: {
          unlit: { entries: 1 },
          matcap: { entries: 0 },
          standard: { entries: 0 },
        },
      },
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMeshFacadeSummary(frame, { totalEntries: 1 });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      1,
    );
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "matcap"),
    ).toBe(0);
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(0);
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(events).toContain("context:configure:bgra8unorm");
    expect(events).toContain("device:texture:aperture/webgpu-app/depth");
    expect(events).toContain("textureResource:view:aperture/webgpu-app/depth");
    expect(events).toContain("queue:submit:1");
    expect(events.some((event) => event.startsWith("pass:draw"))).toBe(true);
    // AI-11: a frame with no pending readbacks must not drain the GPU queue.
    expect(events).not.toContain("queue:done");
    expect(webGpuAppRenderReportToJsonValue(frame).depthAttachment).toEqual(
      frame.depthAttachment,
    );

    const firstResourceEvents = resourceEventCounts(events);
    const firstEventCount = events.length;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 12);
    const secondEvents = events.slice(firstEventCount);
    const firstResources = frame.resources?.resources;
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(1);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersReused: 0,
      materialBuffersReused: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialCache: {
        totalEntries: 1,
        families: {
          unlit: { entries: 1 },
          matcap: { entries: 0 },
          standard: { entries: 0 },
        },
      },
      bindGroupsReused: 3,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(secondResources?.mesh).toBe(firstResources?.mesh);
    expect(singleMaterialResource(secondResources)).toBe(
      singleMaterialResource(firstResources),
    );
    expect(secondResources?.viewUniform.buffer).toBe(
      firstResources?.viewUniform.buffer,
    );
    expect(secondResources?.worldTransforms.buffer).toBe(
      firstResources?.worldTransforms.buffer,
    );
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(secondEvents).toContain("queue:submit:1");
    expect(secondEvents.some((event) => event.startsWith("pass:draw"))).toBe(
      true,
    );
    // AI-64: a static second frame issues zero world-transform bytes — the
    // version-gated upload skips the unchanged buffer entirely.
    expect(secondEvents).not.toContain(
      "queue:writeBuffer:WorldTransforms/storage",
    );
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.assets.markReady(
      material,
      createUnlitMaterialAsset({
        label: "White Updated",
        baseColorFactor: [0.8, 0.85, 1, 1],
      }),
    );

    const sourceVersionFrame = await app.stepAndRender(1 / 60, 3, 13);

    expect(sourceVersionFrame.ok).toBe(true);
    expect(sourceVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expectPreparedMaterialCacheSummary(sourceVersionFrame, {
      unlit: 2,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(sourceVersionFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMeshFacadeSummary(sourceVersionFrame, { totalEntries: 1 });
  });

  it("evicts stale prepared mesh and material cache entries after asset churn", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({ canvas, environment });

    if (!created.ok) {
      expect(created.ok).toBe(true);
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "EvictionMesh1" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "EvictionMaterial1" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 1);
    let latestFrame = firstFrame;

    for (let frame = 2; frame <= 6; frame += 1) {
      assets.meshes.markReady(
        mesh,
        createBoxMeshAsset({ label: `EvictionMesh${frame}` }),
      );
      assets.materials.unlit.markReady(
        material,
        createUnlitMaterialAsset({
          label: `EvictionMaterial${frame}`,
          baseColorFactor: [1, 1 - frame * 0.05, 1, 1],
        }),
      );
      latestFrame = await app.stepAndRender(1 / 60, frame, frame);
    }

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse.preparedMeshCacheEviction).toEqual({
      checked: 1,
      retained: 0,
      evicted: 0,
      skippedInUse: 1,
    });
    expect(
      firstFrame.resourceReuse.preparedMaterialCacheEviction,
    ).toMatchObject({
      checked: 1,
      retained: 0,
      evicted: 0,
      skippedInUse: 1,
      families: {
        unlit: { checked: 1, retained: 0, evicted: 0, skippedInUse: 1 },
      },
    });

    expect(latestFrame.ok).toBe(true);
    expectPreparedMeshCacheSummary(latestFrame, {
      totalEntries: 4,
      layoutEntryCounts: [4],
    });
    expectPreparedMeshFacadeSummary(latestFrame, { totalEntries: 1 });
    expectPreparedMaterialCacheSummary(latestFrame, {
      unlit: 4,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(latestFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });

    const resourceReuse =
      webGpuAppRenderReportToJsonValue(latestFrame).resourceReuse;

    expect(resourceReuse.preparedMeshCacheEviction).toEqual({
      checked: 5,
      retained: 3,
      evicted: 1,
      skippedInUse: 1,
    });
    expect(resourceReuse.preparedMaterialCacheEviction).toEqual({
      checked: 5,
      retained: 3,
      evicted: 1,
      skippedInUse: 1,
      families: {
        unlit: { checked: 5, retained: 3, evicted: 1, skippedInUse: 1 },
        matcap: { checked: 0, retained: 0, evicted: 0, skippedInUse: 0 },
        standard: { checked: 0, retained: 0, evicted: 0, skippedInUse: 0 },
        "debug-normal": {
          checked: 0,
          retained: 0,
          evicted: 0,
          skippedInUse: 0,
        },
      },
    });
    expect(
      JSON.stringify({
        mesh: resourceReuse.preparedMeshCacheEviction,
        material: resourceReuse.preparedMaterialCacheEviction,
      }),
    ).not.toContain("GPU");
  });

  it("runs a no-op post effect chain after rendering the swapchain scene", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
      postEffects: [createWebGpuCopyPostEffect({ id: "noop" })],
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 14);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.boundaries).toHaveLength(2);
    expect(frame.postEffects).toEqual([
      {
        effectId: "noop",
        label: "Copy Post Effect",
        viewId: 0,
        input: "aperture-webgpu-app:post:scene",
        output: "swapchain",
        ok: true,
        drawCalls: 1,
      },
    ]);
    expect(frame.renderTargets).toMatchObject([
      {
        source: "swapchain",
        ok: true,
        drawCalls: 1,
      },
    ]);
    expect(events).toContain("device:texture:aperture-webgpu-app:post:scene");
    expect(events).toContain(
      "device:pipeline:aperture-webgpu-app:post:noop:noop:pipeline",
    );
    // AI-25: the FrameGraph route is the default — the scene + post chain fold
    // into ONE single-encoder submit (the legacy route submitted 2).
    expect(events.filter((event) => event === "queue:submit:1")).toHaveLength(
      1,
    );
    expect(webGpuAppRenderReportToJsonValue(frame).postEffects).toEqual(
      frame.postEffects,
    );
  });

  it("toggles configured post effects by id between frames", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
      postEffects: [createWebGpuCopyPostEffect({ id: "noop" })],
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const enabledFrame = await app.stepAndRender(1 / 60, 1, 14);
    expect(enabledFrame.postEffects).toMatchObject([{ effectId: "noop" }]);

    expect(app.setPostEffectEnabled("noop", false)).toBe(true);
    expect(app.setPostEffectEnabled("missing", false)).toBe(false);

    const disabledFrame = await app.stepAndRender(1 / 60, 1, 14);
    expect(disabledFrame.postEffects).toEqual([]);
    expect(disabledFrame.counts.drawCalls).toBe(1);

    expect(app.setPostEffectEnabled("noop", true)).toBe(true);

    const reenabledFrame = await app.stepAndRender(1 / 60, 1, 14);
    expect(reenabledFrame.postEffects).toMatchObject([{ effectId: "noop" }]);
  });

  it("passes the renderer-owned scene depth texture to SSAO post effects", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
      postEffects: [createWebGpuSsaoPostEffect({ radiusPixels: 6 })],
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 141);

    expect(frame.ok).toBe(true);
    expect(frame.postEffects).toEqual([
      {
        effectId: "ssao",
        label: "SSAO Post Effect",
        viewId: 0,
        input: "aperture-webgpu-app:post:scene",
        output: "swapchain",
        ok: true,
        drawCalls: 1,
      },
    ]);
    expect(frame.depthAttachment).toMatchObject({
      format: "depth24plus",
      width: 1,
      height: 1,
      attached: true,
    });
    expect(events).toContain(
      "device:pipeline:aperture-webgpu-app:post:ssao:ssao:pipeline",
    );
    expect(
      events.filter(
        (event) => event === "textureResource:view:aperture/webgpu-app/depth",
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("passes multisampled scene depth to SSAO post effects", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      msaa: 8,
      worldOptions: { entityCapacity: 8 },
      postEffects: [createWebGpuSsaoPostEffect({ radiusPixels: 6 })],
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "MsaaCube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "MsaaWhite" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 142);

    expect(frame.ok).toBe(true);
    expect(frame.msaa).toMatchObject({
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      colorTargets: 1,
    });
    expect(frame.renderTargets).toMatchObject([
      {
        source: "swapchain",
        ok: true,
        drawCalls: 1,
        msaaSampleCount: 4,
      },
    ]);
    expect(frame.postEffects).toEqual([
      {
        effectId: "ssao",
        label: "SSAO Post Effect",
        viewId: 0,
        input: "aperture-webgpu-app:post:scene",
        output: "swapchain",
        ok: true,
        drawCalls: 1,
      },
    ]);
    expect(frame.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuPostPass.depthTextureUnsupportedSampleCount",
        }),
      ]),
    );
    expect(events).toContain(
      "device:texture:aperture/webgpu-app/msaa/swapchain",
    );
    expect(events).toContain(
      "device:pipeline:aperture-webgpu-app:post:ssao:ssao:pipeline",
    );
  });

  it("surfaces per-pass GPU timings in the app diagnostics summary", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events, {
      timestampQuery: true,
    });
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "TimedCube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "TimedWhite" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 21);
    const json = webGpuAppRenderReportToJsonValue(frame);

    expect(frame.ok).toBe(true);
    expect(frame.gpuTimings).toMatchObject({
      ready: true,
      supported: true,
      queryCount: 2,
      passes: [{ pass: "main", startQuery: 0, endQuery: 1 }],
      diagnostics: [],
    });
    expect(frame.gpuTimings?.passes[0]?.microseconds).toBeGreaterThan(0);
    expect(frame.phaseTimings).toMatchObject({
      ready: true,
      frame: 21,
      sampleWindow: 60,
    });
    expect(frame.phaseTimings?.phases.map((phase) => phase.phase)).toEqual([
      "extract",
      "collect",
      "prepare",
      "queue",
      "sort",
      "submit",
    ]);
    expect(
      frame.phaseTimings?.phases.every((phase) => phase.sampleCount === 1),
    ).toBe(true);
    expect(frame.phaseTimings?.totalMilliseconds).toBeGreaterThanOrEqual(0);
    expect(json.phaseTimings?.phases.map((phase) => phase.phase)).toEqual([
      "extract",
      "collect",
      "prepare",
      "queue",
      "sort",
      "submit",
    ]);
    expect(json.diagnosticsSummary?.gpuTimings).toEqual(json.gpuTimings);
    expect(json.diagnosticsSummary?.gpuTimings?.passes[0]).toMatchObject({
      pass: "main",
    });
    expect(
      json.diagnosticsSummary?.gpuTimings?.passes[0]?.microseconds,
    ).toBeGreaterThan(0);
    expect(events).toContain("encoder:timestamp:0");
    expect(events).toContain("encoder:timestamp:1");
    expect(events).toContain("encoder:resolve:2");

    const secondFrame = await app.stepAndRender(1 / 60, 2, 22);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.gpuTimings?.ready).toBe(true);
    expect(
      secondFrame.phaseTimings?.phases.every(
        (phase) => phase.sampleCount === 2,
      ),
    ).toBe(true);
    expect(
      events.filter((event) => event.startsWith("device:querySet:")),
    ).toHaveLength(1);
  });

  it("submits ViewPacket render targets to registered off-screen textures and the swapchain", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "RenderTargetCube" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "RenderTargetWhite" }),
    );
    const renderTarget = createRenderTargetHandle("mixed-offscreen");
    const offscreenTexture = {
      createView: () => {
        events.push("offscreen:view");
        return { label: "offscreen-view" };
      },
    };

    app.assets.register(renderTarget);
    app.assets.markReady(
      renderTarget,
      createWebGpuAppRenderTargetAsset({
        texture: offscreenTexture,
        width: 1,
        height: 1,
        format: "bgra8unorm",
        label: "Mixed offscreen",
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({
        priority: 0,
        layerMask: 1,
        renderTargetId: assetHandleKey(renderTarget),
      }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 1, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 16);
    const json = webGpuAppRenderReportToJsonValue(frame);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      views: 2,
      meshDraws: 1,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.boundaries).toHaveLength(2);
    expect(frame.renderTargets).toEqual([
      {
        viewId: frame.snapshot.views[0]?.viewId,
        source: "offscreen",
        renderTargetKey: assetHandleKey(renderTarget),
        width: 1,
        height: 1,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
      },
      {
        viewId: frame.snapshot.views[1]?.viewId,
        source: "swapchain",
        renderTargetKey: null,
        width: 1,
        height: 1,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
      },
    ]);
    expect(json.renderTargets).toEqual(frame.renderTargets);
    expect(events).toContain("offscreen:view");
    expect(events).toContain("texture:view");
    // AI-25: the FrameGraph route is the default — both targets fold into ONE
    // single-encoder submit (the legacy route submitted one per target).
    expect(events.filter((event) => event === "queue:submit:1")).toHaveLength(
      1,
    );
    expect(
      events.filter((event) => event.startsWith("pass:draw")),
    ).toHaveLength(2);
  });

  it("loads repeated ViewPacket render-target submissions after the first clear", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "SameTargetCube" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "SameTargetWhite" }),
    );
    const renderTarget = createRenderTargetHandle("same-offscreen");
    const offscreenTexture = {
      createView: () => {
        events.push("same-offscreen:view");
        return { label: "same-offscreen-view" };
      },
    };

    app.assets.register(renderTarget);
    app.assets.markReady(
      renderTarget,
      createWebGpuAppRenderTargetAsset({
        texture: offscreenTexture,
        width: 1,
        height: 1,
        format: "bgra8unorm",
        label: "Same offscreen",
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({
        priority: 0,
        layerMask: 1,
        renderTargetId: assetHandleKey(renderTarget),
      }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({
        priority: 1,
        layerMask: 1,
        renderTargetId: assetHandleKey(renderTarget),
      }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 17);
    const colorLoadOps = (frame.boundaries ?? []).map(
      (boundary) =>
        boundary.attachments?.plan?.colorAttachments[0]?.loadOp ?? null,
    );
    const depthLoadOps = (frame.boundaries ?? []).map(
      (boundary) =>
        boundary.attachments?.plan?.depthStencilAttachment?.depthLoadOp ?? null,
    );

    expect(frame.ok).toBe(true);
    expect(frame.boundaries).toHaveLength(2);
    expect(colorLoadOps).toEqual(["clear", "load"]);
    expect(depthLoadOps).toEqual(["clear", "load"]);
    expect(frame.renderTargets).toEqual([
      {
        viewId: frame.snapshot.views[0]?.viewId,
        source: "offscreen",
        renderTargetKey: assetHandleKey(renderTarget),
        width: 1,
        height: 1,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
      },
      {
        viewId: frame.snapshot.views[1]?.viewId,
        source: "offscreen",
        renderTargetKey: assetHandleKey(renderTarget),
        width: 1,
        height: 1,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
      },
    ]);
  });

  it("loads repeated MSAA ViewPacket render-target submissions after storing the first pass", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      msaa: 8,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "SameMsaaTargetCube" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "SameMsaaTargetWhite" }),
    );
    const renderTarget = createRenderTargetHandle("same-msaa-offscreen");
    const offscreenTexture = {
      createView: () => {
        events.push("same-msaa-offscreen:view");
        return { label: "same-msaa-offscreen-view" };
      },
    };

    app.assets.register(renderTarget);
    app.assets.markReady(
      renderTarget,
      createWebGpuAppRenderTargetAsset({
        texture: offscreenTexture,
        width: 1,
        height: 1,
        format: "bgra8unorm",
        label: "Same MSAA offscreen",
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({
        priority: 0,
        layerMask: 1,
        renderTargetId: assetHandleKey(renderTarget),
      }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({
        priority: 1,
        layerMask: 1,
        renderTargetId: assetHandleKey(renderTarget),
      }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 17);
    const colorAttachments = (frame.boundaries ?? []).map(
      (boundary) => boundary.attachments?.plan?.colorAttachments[0] ?? null,
    );
    const depthLoadOps = (frame.boundaries ?? []).map(
      (boundary) =>
        boundary.attachments?.plan?.depthStencilAttachment?.depthLoadOp ?? null,
    );

    expect(frame.ok).toBe(true);
    expect(frame.boundaries).toHaveLength(2);
    expect(colorAttachments.map((attachment) => attachment?.loadOp)).toEqual([
      "clear",
      "load",
    ]);
    expect(colorAttachments.map((attachment) => attachment?.storeOp)).toEqual([
      "store",
      "discard",
    ]);
    expect(
      colorAttachments.map((attachment) => attachment?.resolveTarget),
    ).toEqual([expect.anything(), expect.anything()]);
    expect(depthLoadOps).toEqual(["clear", "load"]);
    expect(frame.msaa).toMatchObject({
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 2,
      colorTexturesCreated: 1,
      colorTexturesReused: 1,
    });
    expect(frame.renderTargets).toEqual([
      {
        viewId: frame.snapshot.views[0]?.viewId,
        source: "offscreen",
        renderTargetKey: assetHandleKey(renderTarget),
        width: 1,
        height: 1,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
        msaaSampleCount: 4,
      },
      {
        viewId: frame.snapshot.views[1]?.viewId,
        source: "offscreen",
        renderTargetKey: assetHandleKey(renderTarget),
        width: 1,
        height: 1,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
        msaaSampleCount: 4,
      },
    ]);
  });

  it("renders swapchain frames through cached MSAA color and depth attachments", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);

    Object.assign(canvas, { width: 320, height: 180 });

    const created = await createWebGpuApp({
      canvas,
      environment,
      msaa: 8,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "MsaaCube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "MsaaWhite" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 70);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 71);
    const pipelineDescriptor = firstFrame.pipeline?.resource?.descriptor as
      | { readonly multisample?: { readonly count?: number } }
      | undefined;

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.msaa).toEqual({
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 1,
      colorTexturesCreated: 1,
      colorTexturesReused: 0,
    });
    expect(firstFrame.renderTargets).toEqual([
      {
        viewId: firstFrame.snapshot.views[0]?.viewId,
        source: "swapchain",
        renderTargetKey: null,
        width: 320,
        height: 180,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
        msaaSampleCount: 4,
      },
    ]);
    expect(
      firstFrame.boundary?.attachments?.plan?.colorAttachments[0],
    ).toMatchObject({
      storeOp: "discard",
      resolveTarget: expect.anything(),
    });
    expect(pipelineDescriptor?.multisample?.count).toBe(4);
    expect(secondFrame.msaa).toMatchObject({
      requestedSampleCount: 8,
      sampleCount: 4,
      colorTexturesCreated: 0,
      colorTexturesReused: 1,
    });
    expect(webGpuAppRenderReportToJsonValue(firstFrame).msaa).toBe(
      firstFrame.msaa,
    );
    expect(events).toContain(
      "device:texture:aperture/webgpu-app/msaa/swapchain",
    );
  });

  it("reuses prepared scalar unlit mesh buffers across frame-resource misses", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedMeshCube" }),
    );
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Prepared Mesh White" }),
    );
    const secondMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Prepared Mesh Blue" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    const cube = app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 60);
    const firstResources = firstFrame.resources?.resources;
    const firstMeshResource = firstResources?.mesh;
    const firstMaterialResource = singleMaterialResource(firstResources);
    const firstEventCounts = resourceEventCounts(events);

    cube.removeComponent(Material);
    cube.addComponent(Material, { materialId: assetHandleKey(secondMaterial) });

    const secondFrame = await app.stepAndRender(1 / 60, 2, 61);
    const secondResources = secondFrame.resources?.resources;

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 1,
      materialBuffersReused: 0,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expect(secondResources?.mesh).toBe(firstMeshResource);
    expect(singleMaterialResource(secondResources)).not.toBe(
      firstMaterialResource,
    );
    expect(resourceEventCounts(events).buffers).toBe(
      firstEventCounts.buffers + 3,
    );
  });

  it("updates app depth attachment reports when the canvas size changes", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);

    Object.assign(canvas, { width: 320, height: 180 });

    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "ResizeDepthCube" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "ResizeDepthWhite" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 64);
    const firstEventCounts = resourceEventCounts(events);

    Object.assign(canvas, { width: 640, height: 360 });

    const resizedFrame = await app.stepAndRender(1 / 60, 2, 65);

    expect(firstFrame.depthAttachment).toEqual({
      format: "depth24plus",
      attached: true,
      width: 320,
      height: 180,
      opaquePipelineDepthWriteCount: 1,
    });
    expect(resizedFrame.depthAttachment).toEqual({
      format: "depth24plus",
      attached: true,
      width: 640,
      height: 360,
      opaquePipelineDepthWriteCount: 1,
    });
    expect(webGpuAppRenderReportToJsonValue(resizedFrame).depthAttachment).toBe(
      resizedFrame.depthAttachment,
    );
    expect(resourceEventCounts(events)).toMatchObject({
      textures: firstEventCounts.textures + 1,
      textureViews: firstEventCounts.textureViews + 1,
    });
  });

  it("reports scalar unlit prepared mesh and material source-version invalidation", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "VersionedMeshA" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "VersionedMaterialA" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 62);

    assets.meshes.markReady(
      mesh,
      createBoxMeshAsset({ label: "VersionedMeshB" }),
    );

    const meshVersionFrame = await app.stepAndRender(1 / 60, 2, 63);

    assets.materials.unlit.markReady(
      material,
      createUnlitMaterialAsset({ label: "VersionedMaterialB" }),
    );

    const materialVersionFrame = await app.stepAndRender(1 / 60, 3, 64);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      preparedMeshBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(meshVersionFrame.ok).toBe(true);
    expect(meshVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 0,
      materialBuffersReused: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsReused: 1,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(meshVersionFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(materialVersionFrame.ok).toBe(true);
    expect(materialVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(materialVersionFrame, {
      unlit: 2,
      matcap: 0,
      standard: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(materialVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expect(JSON.stringify(materialVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("renders same-resource multi-draw frames through the material queue resource set", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "SharedCube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "SharedWhite" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 21);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(createWebGpuAppDrawResourceSetPlan(frame.snapshot)).toMatchObject({
      drawCount: 2,
      sets: [
        {
          index: 0,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(material),
          drawIndices: [0, 1],
        },
      ],
    });
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      2,
    );
    expect(
      queuedMaterialResources(frame.resources?.resources, "unlit").map(
        (resource) => resource.material,
      ),
    ).toEqual([
      queuedMaterialResources(frame.resources?.resources, "unlit")[0]?.material,
      queuedMaterialResources(frame.resources?.resources, "unlit")[0]?.material,
    ]);
    expect(
      events.filter((event) => event.startsWith("pass:draw")),
    ).toHaveLength(1);
  });

  it("reuses scalar unlit prepared material resources across frame-resource cache misses", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const firstMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedUnlitFirst" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedUnlitSecond" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Prepared Unlit White" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(firstMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 14);
    const firstUnlitResource = queuedMaterialResources(
      frame.resources?.resources,
      "unlit",
    )[0];
    const firstMaterialResource = firstUnlitResource?.material;
    const firstMaterialBindGroup = firstUnlitResource?.bindGroups?.find(
      (bindGroup) => bindGroup.group === 2,
    );

    expect(frame.ok).toBe(true);
    expect(frame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      materialBuffersCreated: 1,
      bindGroupsCreated: 3,
    });
    expect(firstMaterialResource).toBeDefined();
    expect(firstMaterialBindGroup).toBeDefined();

    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const secondFrame = await app.stepAndRender(1 / 60, 2, 15);
    const secondUnlitResources = queuedMaterialResources(
      secondFrame.resources?.resources,
      "unlit",
    );

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      bindGroupsCreated: 4,
      bindGroupsReused: 2,
      queuedBindGroupsCreated: 2,
      queuedBindGroupsReused: 2,
      queuedBindGroupCacheSize: 2,
      dynamicBufferWrites: 0,
    });
    expect(secondUnlitResources).toHaveLength(2);
    expect(secondUnlitResources[0]?.material).toBe(firstMaterialResource);
    expect(secondUnlitResources[1]?.material).toBe(firstMaterialResource);
    expect(
      secondUnlitResources[0]?.bindGroups?.find(
        (bindGroup) => bindGroup.group === 2,
      ),
    ).toBe(firstMaterialBindGroup);
    expect(
      secondUnlitResources[1]?.bindGroups?.find(
        (bindGroup) => bindGroup.group === 2,
      ),
    ).toBe(firstMaterialBindGroup);
  });

  it("renders multiple unlit app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "SharedCube" }));
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "FirstWhite" }),
    );
    const secondMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "SecondBlue" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(secondMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 22);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 1,
      meshBuffersCreated: 1,
      materialBuffersCreated: 2,
      bindGroupsCreated: 4,
    });
    expect(createWebGpuAppDrawResourceSetPlan(frame.snapshot)).toMatchObject({
      drawCount: 2,
      sets: [
        {
          index: 0,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(firstMaterial),
          drawIndices: [0],
        },
        {
          index: 1,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(secondMaterial),
          drawIndices: [1],
        },
      ],
    });
    expect(
      events.filter((event) => event.startsWith("pass:draw")),
    ).toHaveLength(2);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("queue:submit:1");
  });

  it("prunes stale prepared material facade entries without evicting backend caches", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const firstMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "FacadeRetainedCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "FacadePrunedCube" }),
    );
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Facade Retained White" }),
    );
    const secondMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Facade Pruned Standard" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.45, 0, 0] }),
      withMesh(firstMesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    const prunedEntity = app.spawn(
      withTransform({ translation: [0.45, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(secondMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 76);

    prunedEntity.setValue(Visibility, "visible", false);

    const secondFrame = await app.stepAndRender(1 / 60, 2, 77);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.counts.drawCalls).toBe(2);
    expect(firstFrame.resourceReuse).toMatchObject({
      preparedMeshBuffersCreated: 2,
      preparedMeshBuffersReused: 0,
    });
    expectPreparedMeshCacheSummary(firstFrame, {
      totalEntries: 2,
      layoutEntryCounts: [2],
    });
    expectPreparedMeshFacadeSummary(firstFrame, {
      totalEntries: 2,
      meshResourceKeys: [
        `prepared-mesh:${assetHandleKey(firstMesh)}`,
        `prepared-mesh:${assetHandleKey(secondMesh)}`,
      ],
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 1,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(1);
    expect(secondFrame.resourceReuse).toMatchObject({
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
    });
    expectPreparedMeshCacheSummary(secondFrame, {
      totalEntries: 2,
      layoutEntryCounts: [2],
    });
    expectPreparedMeshFacadeSummary(secondFrame, {
      totalEntries: 1,
      meshResourceKeys: [`prepared-mesh:${assetHandleKey(firstMesh)}`],
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 1,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeResourceKeys(secondFrame, [
      assetHandleKey(firstMaterial),
    ]);
    expect(JSON.stringify(secondFrame.resourceReuse)).not.toContain(
      "Facade Pruned Standard",
    );
  });

  it("renders mixed unlit and standard app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "SharedCube" }));
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "FirstWhite" }),
    );
    const secondMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "SecondStandard" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(secondMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 22);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(createWebGpuAppDrawResourceSetPlan(frame.snapshot)).toMatchObject({
      drawCount: 2,
      sets: expect.arrayContaining([
        expect.objectContaining({
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(firstMaterial),
          drawIndices: [expect.any(Number)],
        }),
        expect.objectContaining({
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(secondMaterial),
          drawIndices: [expect.any(Number)],
        }),
      ]),
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 2,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 2,
      bindGroupsCreated: 7,
      lightBuffersCreated: 1,
    });
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(2);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("pass:bind:3");
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 23);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersReused: 2,
      materialBuffersReused: 2,
      bindGroupsReused: 7,
      lightBuffersReused: 1,
      dynamicBufferWrites: 0,
    });
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("surfaces material source dependency readiness before app rendering", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const texture = createTextureHandle("not-registered");
    const sampler = createSamplerHandle("loading-sampler");

    app.assets.register(sampler);
    app.assets.markLoading(sampler);

    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "BlockedTexture",
        baseColorTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 23);

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 0,
      drawCalls: 0,
    });
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(material),
        slots: [
          {
            field: "baseColorTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "baseColorTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "loading",
          },
        ],
        diagnostics: [
          {
            code: "materialDependency.dependencyMissing",
            field: "baseColorTexture",
            dependencyKey: assetHandleKey(texture),
          },
          {
            code: "materialDependency.dependencyLoading",
            field: "baseColorTexture",
            dependencyKey: assetHandleKey(sampler),
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    const value = webGpuAppRenderReportToJsonValue(frame);
    const json = webGpuAppRenderReportToJson(frame);

    expect(value).toMatchObject({
      ok: false,
      frame: 23,
      counts: {
        meshDraws: 0,
        drawCalls: 0,
      },
      materialDependencyReadiness: [
        {
          ready: false,
          materialKey: assetHandleKey(material),
          slots: [
            { handleKey: assetHandleKey(texture), status: "missing" },
            { handleKey: assetHandleKey(sampler), status: "loading" },
          ],
        },
      ],
    });
    expect(json).toBe(JSON.stringify(value));
    expect(json).not.toContain("snapshot");
    expect(json).not.toContain("commandBuffer");
    expect(events).not.toContain("queue:submit:1");
  });

  it("renders an ECS-authored skybox before opaque mesh draws", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(createUnlitMaterialAsset());
    const skyboxTexture = createTextureHandle("unit-skybox");
    const skyboxSampler = createSamplerHandle("unit-skybox-sampler");

    app.assets.register(skyboxTexture);
    app.assets.markReady(
      skyboxTexture,
      createTextureAsset({
        label: "UnitSkybox",
        dimension: "cube",
        width: 1,
        height: 1,
        depthOrLayers: 6,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array(24),
          bytesPerRow: 4,
          rowsPerImage: 1,
        },
      }),
    );
    app.assets.register(skyboxSampler);
    app.assets.markReady(
      skyboxSampler,
      createSamplerAsset({ label: "UnitSkyboxSampler" }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withSkybox({ texture: skyboxTexture, sampler: skyboxSampler }),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 24);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      skyboxes: 1,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
    expect(events).toContain("device:pipeline:aperture/skybox:bgra8unorm");
    expect(events).toContain("textureResource:view:UnitSkybox");
    expect(events.indexOf("pass:draw:3")).toBeLessThan(
      events.indexOf("pass:drawIndexed:36"),
    );
  });

  it("renders ECS sprite billboards alongside opaque mesh draws", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(createUnlitMaterialAsset());
    const spriteTexture = createTextureHandle("unit-sprite");
    const spriteSampler = createSamplerHandle("unit-sprite-sampler");

    app.assets.register(spriteTexture);
    app.assets.markReady(
      spriteTexture,
      createTextureAsset({
        label: "UnitSprite",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([255, 255, 255, 255]),
          bytesPerRow: 4,
          rowsPerImage: 1,
        },
      }),
    );
    app.assets.register(spriteSampler);
    app.assets.markReady(
      spriteSampler,
      createSamplerAsset({ label: "UnitSpriteSampler" }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withSprite({
        texture: spriteTexture,
        sampler: spriteSampler,
        size: [0.5, 0.5],
      }),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 24);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      spriteDraws: 1,
      quadInstances: 1,
      quadBatches: 1,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(events).toContain(
      "device:pipeline:aperture/sprite-billboard:bgra8unorm",
    );
    expect(events).toContain("textureResource:view:UnitSprite");
    expect(events.indexOf("pass:drawIndexed:36")).toBeLessThan(
      events.lastIndexOf("pass:draw:6"),
    );
  });

  it("prepares and reuses textured unlit app material resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TexturedCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TexturedCubeSecond" }),
    );
    const texture = createTextureHandle("app-albedo");
    const sampler = createSamplerHandle("app-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "AppAlbedo",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(sampler, createSamplerAsset({ label: "AppLinear" }));

    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "TexturedApp",
        baseColorTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 24);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
      bindGroupsCreated: 3,
    });
    expectPreparedMaterialCacheSummary(frame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectTextureSamplerCacheSummary(frame, {
      textureEntries: 1,
      samplerEntries: 1,
    });
    expect(events).toContain("device:texture:AppAlbedo");
    expect(events).toContain("textureResource:view:AppAlbedo");
    expect(events).toContain("device:sampler:AppLinear");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}@v1`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
        expect.stringContaining(
          pipelineKeyJsonFragment(
            "unlit|baseColorTexture|opaque|back|less|none",
          ),
        ) as string,
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstUnlitResource = queuedMaterialResources(
      frame.resources?.resources,
      "unlit",
    )[0];
    const firstMaterialResource = firstUnlitResource?.material;
    const firstMaterialBindGroup = firstUnlitResource?.bindGroups?.find(
      (bindGroup) => bindGroup.group === 2,
    );
    app.spawn(
      withTransform({ translation: [0.7, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    const secondFrame = await app.stepAndRender(1 / 60, 2, 25);
    const secondUnlitResources = queuedMaterialResources(
      secondFrame.resources?.resources,
      "unlit",
    );

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 2,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 4,
      bindGroupsReused: 2,
      dynamicBufferWrites: 0,
    });
    expectTextureSamplerCacheSummary(secondFrame, {
      textureEntries: 1,
      samplerEntries: 1,
    });
    expect(secondUnlitResources).toHaveLength(2);
    expect(secondUnlitResources[0]?.material).toBe(firstMaterialResource);
    expect(secondUnlitResources[1]?.material).toBe(firstMaterialResource);
    expect(
      secondUnlitResources[0]?.bindGroups?.find(
        (bindGroup) => bindGroup.group === 2,
      ),
    ).toBe(firstMaterialBindGroup);
    expect(
      secondUnlitResources[1]?.bindGroups?.find(
        (bindGroup) => bindGroup.group === 2,
      ),
    ).toBe(firstMaterialBindGroup);
    expect(resourceEventCounts(events)).toMatchObject({
      textures: firstResourceEvents.textures,
      textureViews: firstResourceEvents.textureViews,
      samplers: firstResourceEvents.samplers,
      buffers: firstResourceEvents.buffers + 8,
      bindGroups: firstResourceEvents.bindGroups + 2,
    });
    expect(
      webGpuAppRenderReportToJsonValue(secondFrame).resourceReuse,
    ).toMatchObject({
      materialBuffersReused: 2,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 2,
      samplerResourcesReused: 2,
    });
  });

  it("reports textured unlit texture and sampler source-version invalidation", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "VersionedTextureCube" }),
    );
    const texture = createTextureHandle("versioned-unlit-albedo");
    const sampler = createSamplerHandle("versioned-unlit-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "VersionedUnlitAlbedoA",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "VersionedUnlitSamplerA" }),
    );

    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "VersionedTexturedUnlit",
        baseColorTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 65);

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "VersionedUnlitAlbedoB",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 2, 66);

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "VersionedUnlitSamplerB" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 3, 67);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expectTextureSamplerCacheSummary(firstFrame, {
      textureEntries: 1,
      samplerEntries: 1,
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      dynamicBufferWrites: 0,
    });
    expectTextureSamplerCacheSummary(textureVersionFrame, {
      textureEntries: 2,
      samplerEntries: 1,
    });
    expectPreparedMaterialCacheSummary(textureVersionFrame, {
      unlit: 2,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(textureVersionFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      dynamicBufferWrites: 0,
    });
    expectTextureSamplerCacheSummary(samplerVersionFrame, {
      textureEntries: 2,
      samplerEntries: 2,
    });
    expectPreparedMaterialCacheSummary(samplerVersionFrame, {
      unlit: 3,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(samplerVersionFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(samplerVersionFrame).resourceReuse,
    ).toMatchObject({
      textureResourcesReused: 1,
      samplerResourcesCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expect(JSON.stringify(samplerVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("surfaces app texture upload layout diagnostics without submitting", async () => {
    const cases = [
      {
        id: "bad-row",
        expectedCode: "textureResource.invalidBytesPerRow",
        sourceData: {
          bytes: new Uint8Array(16),
          bytesPerRow: 4,
          rowsPerImage: 2,
        },
      },
      {
        id: "too-small",
        expectedCode: "textureResource.uploadDataTooSmall",
        sourceData: {
          bytes: new Uint8Array(4),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      },
    ] as const;

    for (const testCase of cases) {
      const events: string[] = [];
      const { canvas, environment } = webGpuHarness(events);
      const created = await createWebGpuApp({
        canvas,
        environment,
        worldOptions: { entityCapacity: 8 },
      });

      expect(created.ok).toBe(true);

      if (!created.ok) {
        return;
      }

      const app = created.app;
      const assets = createRenderAssetCollections({ registry: app.assets });
      const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
      const texture = createTextureHandle(`upload-${testCase.id}`);
      const sampler = createSamplerHandle(`upload-${testCase.id}-sampler`);

      app.assets.register(texture);
      app.assets.markReady(
        texture,
        createTextureAsset({
          label: `Upload ${testCase.id}`,
          dimension: "2d",
          width: 2,
          height: 2,
          format: "rgba8unorm",
          colorSpace: "linear",
          semantic: "data",
          usage: ["sampled", "copy-dst"],
          sourceData: testCase.sourceData,
        }),
      );
      app.assets.register(sampler);
      app.assets.markReady(sampler, createSamplerAsset());

      const material = assets.materials.unlit.add(
        createUnlitMaterialAsset({
          label: `Upload ${testCase.id}`,
          baseColorTexture: { texture, sampler },
        }),
      );

      app.spawn(
        withTransform({ translation: [0, 0, 5] }),
        withCamera({ priority: 0, layerMask: 1 }),
      );
      app.spawn(
        withTransform(),
        withMesh(mesh),
        withMaterial(material),
        withRenderLayer(1),
        withVisibility(true),
      );

      const frame = await app.stepAndRender(1 / 60, 1, 29);
      const diagnosticCodes = frame.diagnostics.map((diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic
          ? diagnostic.code
          : null,
      );
      const json = webGpuAppRenderReportToJson(frame);

      expect(frame.ok).toBe(false);
      expect(diagnosticCodes).toContain(testCase.expectedCode);
      expect(json).toContain(testCase.expectedCode);
      expect(json).not.toContain("commandBuffer");
      expect(events).not.toContain("queue:submit:1");
    }
  });

  it("renders and reuses the single-material matcap queue path", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "MatcapCube" }));
    const texture = createTextureHandle("studio-matcap");
    const sampler = createSamplerHandle("matcap-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StudioMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "MatcapLinear" }),
    );

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Studio Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 26);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "matcap|matcapTexture|opaque|back|less|none",
    );
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialCache: {
        totalEntries: 1,
        families: {
          unlit: { entries: 0 },
          matcap: { entries: 1 },
          standard: { entries: 0 },
        },
      },
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      0,
    );
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "matcap"),
    ).toBe(1);
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(0);
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(events).toContain("device:texture:StudioMatcap");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:MatcapLinear");
    expect(events).toContain("pass:bind:2");
    expect(events).toContain("queue:submit:1");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}@v1`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
        expect.stringContaining(
          pipelineKeyJsonFragment("matcap|matcapTexture|opaque|back|less|none"),
        ) as string,
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 27);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersReused: 0,
      materialBuffersReused: 1,
      preparedMaterialCache: {
        totalEntries: 1,
        families: {
          unlit: { entries: 0 },
          matcap: { entries: 1 },
          standard: { entries: 0 },
        },
      },
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      bindGroupsReused: 3,
      dynamicBufferWrites: 0,
    });
    expect(secondResources?.mesh).toBe(firstResources?.mesh);
    expect(singleMaterialResource(secondResources)).toBe(
      singleMaterialResource(firstResources),
    );
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("reuses prepared matcap mesh buffers across frame-resource misses", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedMatcapCube" }),
    );
    const texture = createTextureHandle("prepared-matcap");
    const sampler = createSamplerHandle("prepared-matcap-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "PreparedMatcapA",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled"],
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "PreparedMatcapSampler" }),
    );

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Prepared Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 68);

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "PreparedMatcapB",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled"],
      }),
    );

    const secondFrame = await app.stepAndRender(1 / 60, 2, 69);

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "PreparedMatcapSamplerB" }),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 70);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 0,
      matcap: 1,
      standard: 0,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 0,
      matcap: 2,
      standard: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(secondFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(thirdFrame, {
      unlit: 0,
      matcap: 3,
      standard: 0,
    });
  });

  it("surfaces matcap material dependency readiness before app rendering", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "MatcapCube" }));
    const texture = createTextureHandle("missing-matcap");
    const sampler = createSamplerHandle("loading-matcap-sampler");

    app.assets.register(sampler);
    app.assets.markLoading(sampler);

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Blocked Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 28);

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 1,
      drawCalls: 0,
    });
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(material),
        materialKind: "matcap",
        slots: [
          {
            field: "matcapTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "matcapTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "loading",
          },
        ],
      },
    });
    expect(events).not.toContain("queue:submit:1");
  });

  it("renders mixed unlit and matcap app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedMaterialCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Mixed Unlit" }),
    );
    const texture = createTextureHandle("mixed-studio-matcap");
    const sampler = createSamplerHandle("mixed-matcap-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "MixedStudioMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "MixedMatcapLinear" }),
    );

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Mixed Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 30);

    expect(frame.ok).toBe(true);
    expect(
      frame.snapshot.meshDraws.map((draw) => draw.batchKey.pipelineKey),
    ).toEqual([
      "matcap|matcapTexture|opaque|back|less|none",
      "unlit|opaque|back|less|none",
    ]);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(createWebGpuAppDrawResourceSetPlan(frame.snapshot)).toMatchObject({
      drawCount: 2,
      sets: [
        {
          index: 0,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(matcapMaterial),
          drawIndices: [0],
        },
        {
          index: 1,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(unlitMaterial),
          drawIndices: [1],
        },
      ],
    });
    expectNoMaterialQueueRouteReport(frame);
    expectNoFrameResourceRouteDiagnostic(frame);
    expect(
      webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
    ).toMatchObject({
      sectionCount: 5,
      materialQueue: {
        itemCount: 2,
        byPhase: [{ phase: "opaque", itemCount: 2 }],
        byFamily: [
          { family: "matcap", itemCount: 1 },
          { family: "unlit", itemCount: 1 },
        ],
        byPhaseAndFamily: [
          { phase: "opaque", family: "matcap", itemCount: 1 },
          { phase: "opaque", family: "unlit", itemCount: 1 },
        ],
      },
      routedResourceSet: {
        itemCount: 2,
        byFamily: [
          { family: "matcap", itemCount: 1 },
          { family: "unlit", itemCount: 1 },
        ],
        byPipeline: [
          {
            pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
            itemCount: 1,
          },
          { pipelineKey: "unlit|opaque|back|less|none", itemCount: 1 },
        ],
        byFamilyAndPipeline: [
          {
            family: "matcap",
            pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
            itemCount: 1,
          },
          {
            family: "unlit",
            pipelineKey: "unlit|opaque|back|less|none",
            itemCount: 1,
          },
        ],
      },
      builtInAppResourceAdapters: {
        valid: true,
        expectedFamilies: ["unlit", "matcap", "standard", "debug-normal"],
        registeredFamilies: ["unlit", "matcap", "standard", "debug-normal"],
        diagnostics: [],
      },
      renderQueueSortPhases: [{ phase: "opaque", recordCount: 2 }],
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
      ),
    ).not.toMatch(/GPU|Mixed Unlit|Mixed Matcap|MixedMaterialCube/);
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 2,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 2,
    });
    expect(events).toContain("device:texture:MixedStudioMatcap");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:MixedMatcapLinear");
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(2);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 31);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersReused: 2,
      materialBuffersReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      dynamicBufferWrites: 0,
    });
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("renders mixed textured unlit and matcap app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedTexturedCube" }),
    );
    const unlitTexture = createTextureHandle("mixed-unlit-albedo");
    const unlitSampler = createSamplerHandle("mixed-unlit-nearest");
    const matcapTexture = createTextureHandle("mixed-textured-studio-matcap");
    const matcapSampler = createSamplerHandle("mixed-textured-matcap-linear");

    app.assets.register(unlitTexture);
    app.assets.markReady(
      unlitTexture,
      createTextureAsset({
        label: "MixedUnlitAlbedo",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 64, 32, 255, 255, 128, 32, 255, 128, 32, 255, 255, 32, 255,
            128, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(unlitSampler);
    app.assets.markReady(
      unlitSampler,
      createSamplerAsset({ label: "MixedUnlitNearest" }),
    );
    app.assets.register(matcapTexture);
    app.assets.markReady(
      matcapTexture,
      createTextureAsset({
        label: "MixedTexturedStudioMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(matcapSampler);
    app.assets.markReady(
      matcapSampler,
      createSamplerAsset({ label: "MixedTexturedMatcapLinear" }),
    );

    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Mixed Textured Unlit",
        baseColorTexture: { texture: unlitTexture, sampler: unlitSampler },
      }),
    );
    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Mixed Textured Matcap",
        matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 35);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 2,
      textureResourcesCreated: 2,
      samplerResourcesCreated: 2,
      materialBuffersCreated: 2,
    });
    expect(events).toContain("device:texture:MixedUnlitAlbedo");
    expect(events).toContain("device:texture:MixedTexturedStudioMatcap");
    expect(
      events.filter((event) => event === "queue:writeTexture:16"),
    ).toHaveLength(2);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 36);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      dynamicBufferWrites: 0,
    });
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("blocks mixed unlit and matcap rendering when the matcap texture dependency is missing", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedBlockedCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Mixed Ready Unlit" }),
    );
    const texture = createTextureHandle("missing-mixed-matcap");
    const sampler = createSamplerHandle("ready-mixed-matcap-sampler");

    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "ReadyMixedMatcapSampler" }),
    );

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Mixed Blocked Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 32);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts.drawCalls).toBe(0);
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(matcapMaterial),
        materialKind: "matcap",
        slots: [
          {
            field: "matcapTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "matcapTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "ready",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("blocks mixed textured unlit and matcap rendering when the unlit texture dependency is missing", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedBlockedTexturedCube" }),
    );
    const unlitTexture = createTextureHandle("missing-mixed-unlit-albedo");
    const unlitSampler = createSamplerHandle("ready-mixed-unlit-sampler");
    const matcapTexture = createTextureHandle("ready-mixed-matcap");
    const matcapSampler = createSamplerHandle("ready-mixed-matcap-sampler");

    app.assets.register(unlitSampler);
    app.assets.markReady(
      unlitSampler,
      createSamplerAsset({ label: "ReadyMixedUnlitSampler" }),
    );
    app.assets.register(matcapTexture);
    app.assets.markReady(
      matcapTexture,
      createTextureAsset({
        label: "ReadyMixedMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(matcapSampler);
    app.assets.markReady(
      matcapSampler,
      createSamplerAsset({ label: "ReadyMixedMatcapSampler" }),
    );

    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Mixed Blocked Textured Unlit",
        baseColorTexture: { texture: unlitTexture, sampler: unlitSampler },
      }),
    );
    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Mixed Ready Matcap",
        matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 37);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts.drawCalls).toBe(0);
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(unlitMaterial),
        materialKind: "unlit",
        slots: [
          {
            field: "baseColorTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(unlitTexture),
            status: "missing",
          },
          {
            field: "baseColorTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(unlitSampler),
            status: "ready",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("renders mixed standard and matcap app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "StandardMatcapCube" }),
    );
    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Mixed Standard",
        metallicFactor: 0.35,
        roughnessFactor: 0.45,
      }),
    );
    const texture = createTextureHandle("standard-mixed-studio-matcap");
    const sampler = createSamplerHandle("standard-mixed-matcap-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardMixedStudioMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardMixedMatcapLinear" }),
    );

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Standard Mixed Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 33);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(
      new Set(frame.snapshot.meshDraws.map((draw) => draw.material)),
    ).toEqual(new Set([standardMaterial, matcapMaterial]));
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 2,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 2,
      lightBuffersCreated: 1,
    });
    expect(events).toContain("device:texture:StandardMixedStudioMatcap");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("pass:bind:3");
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("queue:submit:1");
  });

  it("blocks mixed standard rendering when extracted lights are missing", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "BlockedLit" }));
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Ready Unlit" }),
    );
    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "No Lights Standard" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 34);
    const diagnosticCodes = frame.diagnostics.map((diagnostic) =>
      typeof diagnostic === "object" &&
      diagnostic !== null &&
      "code" in diagnostic
        ? diagnostic.code
        : null,
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 0,
    });
    expect(diagnosticCodes).toContain("standardFrameResources.missingLights");
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("blocks mixed standard rendering when StandardMaterial texture dependencies are not ready", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "BlockedStandardTexture" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Ready Standard Peer Unlit" }),
    );
    const texture = createTextureHandle("missing-standard-base-color");
    const sampler = createSamplerHandle("loading-standard-base-color");

    app.assets.register(sampler);
    app.assets.markLoading(sampler);

    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Blocked Texture Standard",
        baseColorTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 41);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 1,
      drawCalls: 0,
    });
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(standardMaterial),
        materialKind: "standard",
        slots: [
          {
            field: "baseColorTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "baseColorTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "loading",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("reuses unlit, standard, and matcap app resource cache slots without successful route diagnostics", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "ThreeFamilyCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Three Family Unlit" }),
    );
    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Three Family Standard" }),
    );
    const texture = createTextureHandle("three-family-matcap");
    const sampler = createSamplerHandle("three-family-matcap-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "ThreeFamilyMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "ThreeFamilyMatcapSampler" }),
    );

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Three Family Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    const unlitEntity = app.spawn(
      withTransform({ translation: [-0.8, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.8, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    const ambientLight = app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 38);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 3,
      drawPackages: 3,
      drawCalls: 3,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(frame);
    expectNoFrameResourceRouteDiagnostic(frame);
    const diagnosticsSummary =
      webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary;

    expect(diagnosticsSummary).toHaveProperty("routedResourceSet");
    expect(diagnosticsSummary).not.toHaveProperty("standardResourceSet");
    expect(diagnosticsSummary).not.toHaveProperty("unlitResourceSet");
    expect(diagnosticsSummary).not.toHaveProperty("matcapResourceSet");
    expect(diagnosticsSummary).toMatchObject({
      sectionCount: 6,
      materialQueue: {
        itemCount: 3,
        byPhase: [{ phase: "opaque", itemCount: 3 }],
        byFamily: [
          { family: "matcap", itemCount: 1 },
          { family: "standard", itemCount: 1 },
          { family: "unlit", itemCount: 1 },
        ],
        byPhaseAndFamily: [
          { phase: "opaque", family: "matcap", itemCount: 1 },
          { phase: "opaque", family: "standard", itemCount: 1 },
          { phase: "opaque", family: "unlit", itemCount: 1 },
        ],
      },
      routedResourceSet: {
        itemCount: 3,
        byFamily: [
          { family: "matcap", itemCount: 1 },
          { family: "standard", itemCount: 1 },
          { family: "unlit", itemCount: 1 },
        ],
        byPipeline: [
          {
            pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
            itemCount: 1,
          },
          { pipelineKey: "standard|opaque|back|less|none", itemCount: 1 },
          { pipelineKey: "unlit|opaque|back|less|none", itemCount: 1 },
        ],
        byFamilyAndPipeline: [
          {
            family: "matcap",
            pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
            itemCount: 1,
          },
          {
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            itemCount: 1,
          },
          {
            family: "unlit",
            pipelineKey: "unlit|opaque|back|less|none",
            itemCount: 1,
          },
        ],
      },
      directLighting: {
        ready: true,
        resources: {
          lightGpuBufferResourceKey: "light-buffer:main",
          lightBindGroupLayoutKey: expect.stringContaining(
            "webgpu-app/standard/group-3",
          ) as string,
          lightBindGroupResourceKey:
            "bind-group:lights/group-3/light-buffer:main",
        },
      },
      renderQueueSortPhases: [{ phase: "opaque", recordCount: 3 }],
    });
    expect(JSON.stringify(diagnosticsSummary)).not.toMatch(
      /GPUBuffer|GPUTexture|Three Family Unlit|Three Family Standard|Three Family Matcap|ThreeFamilyCube|standardResourceSet|unlitResourceSet|matcapResourceSet/,
    );
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 3,
      meshBuffersCreated: 1,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 3,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 10,
      lightBuffersCreated: 1,
    });
    expectPreparedMaterialCacheSummary(frame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expectPreparedMaterialFacadeResourceKeys(frame, [
      assetHandleKey(unlitMaterial),
      assetHandleKey(matcapMaterial),
      assetHandleKey(standardMaterial),
    ]);
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(3);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(3);
    expect(events).toContain("pass:bind:3");
    expect(events).toContain("queue:submit:1");

    const firstResources = frame.resources?.resources;
    const firstUnlitResource = queuedMaterialResources(
      firstResources,
      "unlit",
    )[0];
    const firstMatcapResource = queuedMaterialResources(
      firstResources,
      "matcap",
    )[0];
    const firstStandardResource = queuedMaterialResources(
      firstResources,
      "standard",
    )[0];

    expect(queuedFamilyResourceCount(firstResources, "unlit")).toBe(1);
    expect(queuedFamilyResourceCount(firstResources, "matcap")).toBe(1);
    expect(queuedFamilyResourceCount(firstResources, "standard")).toBe(1);
    expect(firstUnlitResource?.material).toBeDefined();
    expect(firstMatcapResource?.material).toBeDefined();
    expect(firstStandardResource?.material).toBeDefined();
    expect(hasStandardLightResources(firstStandardResource)).toBe(true);

    const firstUnlitMaterialResource = firstUnlitResource?.material;
    const firstMatcapMaterialResource = firstMatcapResource?.material;
    const firstStandardMaterialResource = firstStandardResource?.material;
    const firstStandardLightResource = hasStandardLightResources(
      firstStandardResource,
    )
      ? firstStandardResource.lightGpuBuffers.resource
      : null;
    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 39);
    const secondResources = secondFrame.resources?.resources;
    const secondUnlitResource = queuedMaterialResources(
      secondResources,
      "unlit",
    )[0];
    const secondMatcapResource = queuedMaterialResources(
      secondResources,
      "matcap",
    )[0];
    const secondStandardResource = queuedMaterialResources(
      secondResources,
      "standard",
    )[0];

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts).toMatchObject({
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(secondFrame);
    expectNoFrameResourceRouteDiagnostic(secondFrame);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 3,
      pipelineMisses: 0,
      meshBuffersReused: 3,
      materialBuffersReused: 3,
      textureResourcesReused: 1,
      samplerResourcesReused: 1,
      bindGroupsReused: 10,
      lightBuffersReused: 1,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expect(queuedFamilyResourceCount(secondResources, "unlit")).toBe(1);
    expect(queuedFamilyResourceCount(secondResources, "matcap")).toBe(1);
    expect(queuedFamilyResourceCount(secondResources, "standard")).toBe(1);
    expect(secondUnlitResource).toBe(firstUnlitResource);
    expect(secondMatcapResource).toBe(firstMatcapResource);
    expect(secondStandardResource).toBe(firstStandardResource);
    expect(secondUnlitResource?.material).toBe(firstUnlitMaterialResource);
    expect(secondMatcapResource?.material).toBe(firstMatcapMaterialResource);
    expect(secondStandardResource?.material).toBe(
      firstStandardMaterialResource,
    );
    expect(hasStandardLightResources(secondStandardResource)).toBe(true);

    if (hasStandardLightResources(secondStandardResource)) {
      expect(secondStandardResource.lightGpuBuffers.resource).toBe(
        firstStandardLightResource,
      );
    }

    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    unlitEntity.getVectorView(LocalTransform, "translation").set([-1, 0, 0]);
    ambientLight.setValue(Light, "intensity", 0.35);

    const transformLightFrame = await app.stepAndRender(1 / 60, 3, 40);

    expect(transformLightFrame.ok).toBe(true);
    expect(transformLightFrame.counts).toMatchObject({
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(transformLightFrame);
    expectNoFrameResourceRouteDiagnostic(transformLightFrame);
    expect(transformLightFrame.resourceReuse).toMatchObject({
      pipelineHits: 3,
      pipelineMisses: 0,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBindGroupsCreated: 0,
      lightBuffersReused: 1,
    });
    expectPreparedMaterialCacheSummary(transformLightFrame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(transformLightFrame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(transformLightFrame).resourceReuse
          .preparedMaterialCache,
      ),
    ).not.toContain("prepared-material");
  });

  it("routes scalar and textured StandardMaterial queue items with unlit and matcap draws", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "QueuedBuiltInCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Queued Unlit" }),
    );
    const scalarStandardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Queued Scalar Standard" }),
    );
    const standardTexture = createTextureHandle("queued-standard-base-color");
    const standardSampler = createSamplerHandle(
      "queued-standard-base-color-sampler",
    );
    const matcapTexture = createTextureHandle("queued-matcap");
    const matcapSampler = createSamplerHandle("queued-matcap-sampler");

    app.assets.register(standardTexture);
    app.assets.markReady(
      standardTexture,
      createTextureAsset({
        label: "QueuedStandardBaseColor",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 64, 64, 255, 64, 255, 64, 255, 64, 64, 255, 255, 255, 255, 64,
            255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(standardSampler);
    app.assets.markReady(
      standardSampler,
      createSamplerAsset({ label: "QueuedStandardBaseColorSampler" }),
    );
    app.assets.register(matcapTexture);
    app.assets.markReady(
      matcapTexture,
      createTextureAsset({
        label: "QueuedMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(matcapSampler);
    app.assets.markReady(
      matcapSampler,
      createSamplerAsset({ label: "QueuedMatcapSampler" }),
    );

    const texturedStandardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Queued Textured Standard",
        baseColorTexture: {
          texture: standardTexture,
          sampler: standardSampler,
        },
      }),
    );
    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Queued Matcap",
        matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-1.2, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [-0.4, 0, 0] }),
      withMesh(mesh),
      withMaterial(scalarStandardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.4, 0, 0] }),
      withMesh(mesh),
      withMaterial(texturedStandardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [1.2, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 42);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 4,
      drawPackages: 4,
      drawCalls: 4,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(frame);
    expectNoFrameResourceRouteDiagnostic(frame);
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 4,
      meshBuffersCreated: 1,
      meshBuffersReused: 3,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 3,
      materialBuffersCreated: 4,
      textureResourcesCreated: 2,
      samplerResourcesCreated: 2,
      bindGroupsCreated: 14,
      lightBuffersCreated: 2,
    });
    expectPreparedMaterialCacheSummary(frame, {
      unlit: 1,
      matcap: 1,
      standard: 2,
    });
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 1,
      matcap: 1,
      standard: 2,
    });
    expectPreparedMaterialFacadeResourceKeys(frame, [
      assetHandleKey(unlitMaterial),
      assetHandleKey(scalarStandardMaterial),
      assetHandleKey(texturedStandardMaterial),
      assetHandleKey(matcapMaterial),
    ]);
    expect(
      new Set(
        frame.snapshot.meshDraws.map((draw) => draw.batchKey.pipelineKey),
      ),
    ).toEqual(
      new Set([
        "unlit|opaque|back|less|none",
        "matcap|matcapTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
        "standard|baseColorTexture|opaque|back|less|none",
      ]),
    );
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(4);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(4);
    expect(events.filter((event) => event === "pass:bind:3")).toHaveLength(2);
    expect(events).toContain("device:texture:QueuedStandardBaseColor");
    expect(events).toContain("device:texture:QueuedMatcap");
    expect(events).toContain("queue:submit:1");

    const secondFrame = await app.stepAndRender(1 / 60, 2, 45);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts).toMatchObject({
      meshDraws: 4,
      drawCalls: 4,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(secondFrame);
    expectNoFrameResourceRouteDiagnostic(secondFrame);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 4,
      pipelineMisses: 0,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 1,
      matcap: 1,
      standard: 2,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 1,
      matcap: 1,
      standard: 2,
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(secondFrame).resourceReuse
          .preparedMaterialCache,
      ),
    ).not.toContain("GPU");
  });

  it("routes DebugNormalMaterial app resources with JSON-safe summaries", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "UnsupportedQueueFamilyCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Queue Supported Unlit" }),
    );
    const debugNormalMaterial = assets.materials.debugNormal.add(
      createDebugNormalMaterialAsset({ label: "Queue Debug Normal" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(debugNormalMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 43);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 2,
    });
    expect(frame.diagnostics).toEqual([]);
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
      debugNormal: 1,
    });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      1,
    );
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "debug-normal"),
    ).toBe(1);
    expect(webGpuAppRenderReportToJsonValue(frame)).toMatchObject({
      diagnosticsSummary: {
        sectionCount: 5,
        materialQueue: {
          itemCount: 2,
          byFamily: expect.arrayContaining([
            expect.objectContaining({ family: "unlit", itemCount: 1 }),
            expect.objectContaining({
              family: "debug-normal",
              itemCount: 1,
            }),
          ]),
        },
        routedResourceSet: {
          itemCount: 2,
          byFamily: expect.arrayContaining([
            expect.objectContaining({
              family: "unlit",
              itemCount: 1,
            }),
            expect.objectContaining({
              family: "debug-normal",
              itemCount: 1,
            }),
          ]),
          byFamilyAndPipeline: expect.arrayContaining([
            expect.objectContaining({
              family: "debug-normal",
              pipelineKey: "debug-normal|opaque|back|less|none",
              itemCount: 1,
            }),
          ]),
        },
        renderQueueSortPhases: [{ phase: "opaque", recordCount: 2 }],
      },
    });
    expect(JSON.parse(webGpuAppRenderReportToJson(frame))).toMatchObject({
      diagnosticsSummary: {
        routedResourceSet: {
          byFamily: expect.arrayContaining([
            expect.objectContaining({
              family: "debug-normal",
              itemCount: 1,
            }),
          ]),
        },
      },
    });
    expect(
      JSON.stringify(webGpuAppRenderReportToJsonValue(frame)),
    ).not.toContain("GPUBuffer");
    expect(events).toContain("queue:submit:1");
  });

  it("diagnoses unregistered route family keys without built-in fallback", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "UnregisteredRouteKeyCube" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Unregistered Route Source" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 0] }),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    app.step(1 / 60, 1);
    const snapshot = app.extract(44);
    const [draw] = snapshot.meshDraws;

    expect(draw).toBeDefined();

    if (draw === undefined) {
      return;
    }

    const pipelineKey = "example/toon-shaded|opaque|back|less|none";
    const frame = await app.render({
      snapshot: renderSnapshotWithDraws(snapshot, 44, [
        {
          ...draw,
          sortKey: {
            ...draw.sortKey,
            pipelineKey,
          },
          batchKey: {
            ...draw.batchKey,
            pipelineKey,
          },
        },
      ]),
    });

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 1,
      drawCalls: 0,
    });
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueFamily",
          materialFamily: "example/toon-shaded",
        }),
      ]),
    );

    const routeReport = materialQueueRouteReport(frame);

    expect(routeReport).toMatchObject({
      valid: false,
      queueItemCount: 1,
      routedItemCount: 0,
      skippedItemCount: 1,
      byFamily: [
        {
          key: "example/toon-shaded",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      diagnosticSummary: expect.objectContaining({
        total: 1,
        byCode: { "webGpuApp.unsupportedMaterialQueueFamily": 1 },
      }),
    });

    const jsonReport = webGpuAppRenderReportToJsonValue(frame);

    expect(jsonReport.diagnosticsSummary).toMatchObject({
      sectionCount: 2,
      materialQueueRoute: {
        valid: false,
        queueItemCount: 1,
        routedItemCount: 0,
        skippedItemCount: 1,
        byFamily: [
          {
            key: "example/toon-shaded",
            queuedCount: 1,
            routedCount: 0,
            skippedCount: 1,
          },
        ],
        byPhase: [
          {
            key: "opaque",
            queuedCount: 1,
            routedCount: 0,
            skippedCount: 1,
          },
        ],
        diagnosticSummary: {
          total: 1,
          bySeverity: { info: 0, warning: 0, error: 1 },
          byCode: { "webGpuApp.unsupportedMaterialQueueFamily": 1 },
        },
        diagnostics: [
          expect.objectContaining({
            code: "webGpuApp.unsupportedMaterialQueueFamily",
            materialFamily: "example/toon-shaded",
            renderId: expect.any(Number),
            drawIndex: 0,
            entity: expect.objectContaining({
              index: expect.any(Number),
              generation: expect.any(Number),
            }),
          }),
        ],
      },
      builtInAppResourceAdapters: {
        valid: true,
        diagnostics: [],
      },
    });
    expect(jsonReport.diagnosticsSummary).toHaveProperty("materialQueueRoute");
    expect(jsonReport.diagnosticsSummary).not.toHaveProperty(
      "standardResourceSet",
    );
    expect(jsonReport.diagnosticsSummary).not.toHaveProperty(
      "unlitResourceSet",
    );
    expect(jsonReport.diagnosticsSummary).not.toHaveProperty(
      "matcapResourceSet",
    );
    const serialized = JSON.stringify(jsonReport);

    expect(events).not.toContain("queue:submit:1");
    expect(serialized).not.toContain("standardResourceSet");
    expect(serialized).not.toContain("unlitResourceSet");
    expect(serialized).not.toContain("matcapResourceSet");
    expect(serialized).not.toContain("GPUBuffer");
  });

  it("renders custom-first mixed built-in frames through the app route", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedCustomRouteCube" }),
    );
    const customMaterial = assets.materials.customWgsl.add(
      createCustomWgslMaterialAsset({
        familyKey: "example/mixed-route",
        label: "Mixed Route Custom",
        shader: {
          kind: "inline-wgsl",
          virtualPath: "mixed-route.wgsl",
          code: `
            struct ViewProjectionUniform {
              viewProjection: mat4x4f,
              cameraPosition: vec4f,
            };

            struct MixedMaterialUniform {
              color: vec4f,
            };

            struct VertexInput {
              @location(0) position: vec3f,
              @location(1) normal: vec3f,
              @location(2) uv: vec2f,
              @builtin(instance_index) instanceIndex: u32,
            };

            @group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
            @group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
            @group(2) @binding(0) var<uniform> material: MixedMaterialUniform;

            @vertex
            fn vs_main(input: VertexInput) -> @builtin(position) vec4f {
              let world = worldTransforms[input.instanceIndex];
              return view.viewProjection * world * vec4f(input.position, 1.0);
            }

            @fragment
            fn fs_main() -> @location(0) vec4f {
              return material.color;
            }
          `,
        },
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        bindings: [
          {
            name: "material",
            binding: 0,
            kind: "uniform-buffer",
            visibility: ["fragment"],
            fields: {
              color: { type: "vec4", default: [0, 0.4, 1, 1] },
            },
          },
        ],
      }),
      { id: "mixed-route-custom" },
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Mixed Route Unlit" }),
      { id: "mixed-route-unlit" },
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.7, 0, 0] }),
      withMesh(mesh),
      withMaterial(customMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.7, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    app.step(1 / 60, 1);
    const snapshot = app.extract(77);
    const customDraw = drawForMaterial(snapshot, customMaterial);
    const unlitDraw = drawForMaterial(snapshot, unlitMaterial);
    const frame = await app.render({
      snapshot: renderSnapshotWithDraws(snapshot, 78, [customDraw, unlitDraw]),
    });

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 2,
    });
    expect(frame.diagnostics).toEqual([]);
    expect(frame.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueFamily",
        }),
        expect.objectContaining({
          code: "webGpuApp.materialQueueRouteReport",
        }),
        expect.objectContaining({
          code: "webGpuApp.customWgslMixedRouteDeferred",
        }),
      ]),
    );

    expect(frame.diagnosticsSummary).toMatchObject({
      routedResourceSet: {
        byFamily: expect.arrayContaining([
          expect.objectContaining({
            family: "unlit",
            itemCount: 1,
          }),
        ]),
      },
    });
    expect(events).toContain("queue:submit:1");
    expect(
      JSON.stringify(webGpuAppRenderReportToJsonValue(frame)),
    ).not.toContain("GPUBuffer");
  });

  it("renders custom WGSL texture and sampler app bindings", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "CustomTextureCube" }),
    );
    const texture = createTextureHandle("custom-wgsl-albedo");
    const sampler = createSamplerHandle("custom-wgsl-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "CustomWgslAlbedo",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            0, 200, 255, 255, 255, 255, 255, 255, 20, 40, 80, 255, 40, 180, 220,
            255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "CustomWgslLinear" }),
    );

    const material = assets.materials.customWgsl.add(
      createCustomWgslMaterialAsset({
        familyKey: "example/custom-textured",
        label: "Textured Custom WGSL",
        shader: {
          kind: "inline-wgsl",
          virtualPath: "custom-textured.wgsl",
          code: `
            struct ViewProjectionUniform {
              viewProjection: mat4x4f,
              cameraPosition: vec4f,
            };

            struct VertexInput {
              @location(0) position: vec3f,
              @location(1) normal: vec3f,
              @location(2) uv: vec2f,
              @builtin(instance_index) instanceIndex: u32,
            };

            struct VertexOutput {
              @builtin(position) position: vec4f,
              @location(0) uv: vec2f,
            };

            @group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
            @group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
            @group(2) @binding(0) var customTexture: texture_2d<f32>;
            @group(2) @binding(1) var customSampler: sampler;

            @vertex
            fn vs_main(input: VertexInput) -> VertexOutput {
              var output: VertexOutput;
              let world = worldTransforms[input.instanceIndex];
              output.position = view.viewProjection * world * vec4f(input.position, 1.0);
              output.uv = input.uv;
              return output;
            }

            @fragment
            fn fs_main(input: VertexOutput) -> @location(0) vec4f {
              return textureSample(customTexture, customSampler, input.uv);
            }
          `,
        },
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        bindings: [
          {
            name: "customTexture",
            binding: 0,
            kind: "texture",
            visibility: ["fragment"],
            texture,
          },
          {
            name: "customSampler",
            binding: 1,
            kind: "sampler",
            visibility: ["fragment"],
            sampler,
          },
        ],
      }),
      { id: "custom-textured-material" },
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 88);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 89);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.diagnostics).toEqual([]);
    expect(firstFrame.counts).toMatchObject({
      meshDraws: 1,
      drawCalls: 1,
    });
    expect(firstFrame.resourceReuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.diagnostics).toEqual([]);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      textureResourcesReused: 1,
      samplerResourcesReused: 1,
    });
    expect(
      events.filter((event) => event === "queue:writeTexture:16"),
    ).toHaveLength(1);
    expect(events).toContain("queue:submit:1");
    expect(
      JSON.stringify(webGpuAppRenderReportToJsonValue(secondFrame)),
    ).not.toContain("GPUTexture");
  });

  it("surfaces JSON-safe built-in app adapter registry validation diagnostics", () => {
    const invalidRegistry = createQueuedMaterialAdapterRegistry([
      { kind: "unlit" },
      { kind: "unlit" },
      { kind: "matcap" },
      { kind: "debug-normal" },
    ]);
    const diagnosticsSummary = createWebGpuAppDiagnosticsSummary({
      builtInAppResourceAdapters:
        queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(
          validateQueuedBuiltInAppResourceAdapterRegistry(invalidRegistry),
        ),
    });

    expect(diagnosticsSummary).toMatchObject({
      sectionCount: 1,
      builtInAppResourceAdapters: {
        valid: false,
        expectedFamilies: ["unlit", "matcap", "standard", "debug-normal"],
        registeredFamilies: ["unlit", "unlit", "matcap", "debug-normal"],
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "queuedMaterialAdapter.duplicateFamily",
            severity: "warning",
            family: "unlit",
          }),
          expect.objectContaining({
            code: "queuedBuiltInAppResourceAdapter.missingFamily",
            severity: "error",
            family: "standard",
          }),
        ]),
      },
    });
    expect(JSON.stringify(diagnosticsSummary)).not.toMatch(
      /prepareTextureSamplerResources|createFrameResources|GPU|descriptor/,
    );
  });

  it("diagnoses unsupported alpha-test material queue families without submitting", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "UnsupportedQueuePhaseCube" }),
    );
    const opaqueMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Queue Opaque Unlit" }),
    );
    const alphaTestMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Queue Alpha Test Unlit",
        renderState: { alphaMode: "mask" },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(opaqueMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(alphaTestMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 44);

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 0,
    });
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
          renderPhase: "alpha-test",
          materialFamily: "unlit",
        }),
      ]),
    );
    expect(JSON.parse(JSON.stringify(frame.diagnostics))).toEqual([
      expect.objectContaining({
        code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
        renderId: expect.any(Number),
        drawIndex: expect.any(Number),
        renderPhase: "alpha-test",
        materialFamily: "unlit",
        entity: expect.objectContaining({
          index: expect.any(Number),
          generation: expect.any(Number),
        }),
      }),
      expect.objectContaining({
        code: "webGpuApp.materialQueueRouteReport",
        report: expect.objectContaining({
          valid: false,
          queueItemCount: 2,
          routedItemCount: 1,
          skippedItemCount: 1,
          byFamily: expect.arrayContaining([
            expect.objectContaining({
              key: "unlit",
              queuedCount: 2,
              routedCount: 1,
              skippedCount: 1,
            }),
          ]),
          byPhase: expect.arrayContaining([
            expect.objectContaining({
              key: "opaque",
              queuedCount: 1,
              routedCount: 1,
              skippedCount: 0,
            }),
            expect.objectContaining({
              key: "alpha-test",
              queuedCount: 1,
              routedCount: 0,
              skippedCount: 1,
            }),
          ]),
          diagnosticSummary: expect.objectContaining({
            total: 1,
            bySeverity: expect.objectContaining({ error: 1 }),
          }),
          diagnostics: [
            expect.objectContaining({
              code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
              materialFamily: "unlit",
              renderPhase: "alpha-test",
            }),
          ],
        }),
      }),
    ]);
    expect(events).not.toContain("queue:submit:1");
  });

  it("routes transparent unlit and diagnoses unsupported transparent blend presets without submitting", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "UnsupportedTransparentQueueCube" }),
    );
    const transparentUnlit = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Transparent Unlit",
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      }),
    );
    const additiveStandard = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Additive Transparent Standard",
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "additive" },
        },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(transparentUnlit),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(additiveStandard),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 45);

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 0,
    });
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          renderPhase: "transparent",
          materialFamily: "standard",
          blendPreset: "additive",
        }),
      ]),
    );
    expect(JSON.parse(JSON.stringify(frame.diagnostics))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          renderId: expect.any(Number),
          drawIndex: expect.any(Number),
          renderPhase: "transparent",
          materialFamily: "standard",
          blendPreset: "additive",
          entity: expect.objectContaining({
            index: expect.any(Number),
            generation: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          code: "webGpuApp.materialQueueRouteReport",
          report: expect.objectContaining({
            valid: false,
            queueItemCount: 2,
            routedItemCount: 1,
            skippedItemCount: 1,
            byFamily: expect.arrayContaining([
              expect.objectContaining({
                key: "unlit",
                queuedCount: 1,
                routedCount: 1,
                skippedCount: 0,
              }),
              expect.objectContaining({
                key: "standard",
                queuedCount: 1,
                routedCount: 0,
                skippedCount: 1,
              }),
            ]),
            byPhase: expect.arrayContaining([
              expect.objectContaining({
                key: "transparent",
                queuedCount: 2,
                routedCount: 1,
                skippedCount: 1,
              }),
            ]),
            diagnosticSummary: expect.objectContaining({
              total: 1,
              bySeverity: expect.objectContaining({ error: 1 }),
            }),
            diagnostics: expect.arrayContaining([
              expect.objectContaining({
                code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
                materialFamily: "standard",
                renderPhase: "transparent",
                blendPreset: "additive",
              }),
            ]),
          }),
        }),
      ]),
    );
    expect(events).not.toContain("queue:submit:1");
  });

  it("includes asset mismatch details in material queue route reports", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "AssetMismatchRouteCube" }),
    );
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Asset Mismatch First Unlit" }),
    );
    const secondMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Asset Mismatch Second Unlit" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(secondMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    app.step(1 / 60, 1);
    const snapshot = app.extract(46);
    const [firstDraw, secondDraw] = snapshot.meshDraws;

    expect(firstDraw).toBeDefined();
    expect(secondDraw).toBeDefined();

    if (firstDraw === undefined || secondDraw === undefined) {
      return;
    }

    const mismatchedSnapshot = {
      ...snapshot,
      meshDraws: [
        firstDraw,
        {
          ...secondDraw,
          sortKey: {
            ...secondDraw.sortKey,
            pipelineKey: "standard|opaque|back|less|none",
          },
          batchKey: {
            ...secondDraw.batchKey,
            pipelineKey: "standard|opaque|back|less|none",
          },
        },
      ],
    };

    const frame = await app.render({ snapshot: mismatchedSnapshot });

    expect(frame.ok).toBe(false);
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.materialQueueAssetMismatch",
          materialFamily: "standard",
          materialKind: "unlit",
        }),
      ]),
    );
    expect(JSON.parse(JSON.stringify(frame.diagnostics))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.materialQueueRouteReport",
          report: expect.objectContaining({
            valid: false,
            queueItemCount: 2,
            routedItemCount: 1,
            skippedItemCount: 1,
            byFamily: expect.arrayContaining([
              expect.objectContaining({
                key: "standard",
                queuedCount: 1,
                routedCount: 0,
                skippedCount: 1,
              }),
            ]),
            diagnosticSummary: expect.objectContaining({
              total: 1,
              byCode: expect.objectContaining({
                "webGpuApp.materialQueueAssetMismatch": 1,
              }),
            }),
            diagnostics: [
              expect.objectContaining({
                code: "webGpuApp.materialQueueAssetMismatch",
                materialFamily: "standard",
                materialKind: "unlit",
              }),
            ],
          }),
        }),
      ]),
    );
    expect(JSON.stringify(frame.diagnostics)).not.toContain("sourceAsset");
    expect(JSON.stringify(frame.diagnostics)).not.toContain("gpu-resource");
    expect(events).not.toContain("queue:submit:1");
  });

  it("resets material queue route report shell state across failed frames", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "RouteShellReuseCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Route Shell Supported Unlit" }),
    );
    const debugNormalMaterial = assets.materials.debugNormal.add(
      createDebugNormalMaterialAsset({ label: "Route Shell Debug Normal" }),
    );
    const additiveStandard = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Route Shell Additive Standard",
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "additive" },
        },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.75, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(debugNormalMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.75, 0, 0] }),
      withMesh(mesh),
      withMaterial(additiveStandard),
      withRenderLayer(1),
      withVisibility(true),
    );

    app.step(1 / 60, 1);
    const snapshot = app.extract(47);
    const unregisteredDraw = drawForMaterial(snapshot, unlitMaterial);
    const unregisteredPipelineKey = "example/toon-shaded|opaque|back|less|none";
    const firstFrame = await app.render({
      snapshot: renderSnapshotWithDraws(snapshot, 47, [
        {
          ...unregisteredDraw,
          sortKey: {
            ...unregisteredDraw.sortKey,
            pipelineKey: unregisteredPipelineKey,
          },
          batchKey: {
            ...unregisteredDraw.batchKey,
            pipelineKey: unregisteredPipelineKey,
          },
        },
      ]),
    });
    const secondFrame = await app.render({
      snapshot: renderSnapshotWithDraws(snapshot, 48, [
        drawForMaterial(snapshot, additiveStandard),
      ]),
    });

    expect(firstFrame.ok).toBe(false);
    expect(secondFrame.ok).toBe(false);

    const firstReport = materialQueueRouteReport(firstFrame);
    const secondReport = materialQueueRouteReport(secondFrame);

    expect(firstReport).toMatchObject({
      valid: false,
      queueItemCount: 1,
      routedItemCount: 0,
      skippedItemCount: 1,
      byFamily: [
        {
          key: "example/toon-shaded",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      byPhase: [
        { key: "opaque", queuedCount: 1, routedCount: 0, skippedCount: 1 },
      ],
      diagnosticSummary: expect.objectContaining({
        total: 1,
        byCode: { "webGpuApp.unsupportedMaterialQueueFamily": 1 },
      }),
    });
    expect(secondReport).toMatchObject({
      valid: false,
      queueItemCount: 1,
      routedItemCount: 0,
      skippedItemCount: 1,
      byFamily: [
        {
          key: "standard",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      byPhase: [
        {
          key: "transparent",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      diagnosticSummary: expect.objectContaining({
        total: 1,
        byCode: { "webGpuApp.unsupportedMaterialQueueBlendPreset": 1 },
      }),
    });
    expect(JSON.stringify(secondReport)).not.toContain("debug-normal");
    expect(JSON.stringify(secondReport)).not.toContain("unlit");
    expect(JSON.stringify(secondReport)).not.toContain("example/toon-shaded");
    expect(events).not.toContain("queue:submit:1");
  });

  it("blocks three-family app rendering when StandardMaterial lights are missing", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "ThreeFamilyBlockedCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Three Family Ready Unlit" }),
    );
    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Three Family No Lights" }),
    );
    const texture = createTextureHandle("three-family-ready-matcap");
    const sampler = createSamplerHandle("three-family-ready-matcap-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "ThreeFamilyReadyMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(sampler, createSamplerAsset());

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Three Family Ready Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.8, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.8, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 40);
    const diagnosticCodes = frame.diagnostics.map((diagnostic) =>
      typeof diagnostic === "object" &&
      diagnostic !== null &&
      "code" in diagnostic
        ? diagnostic.code
        : null,
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 3,
      drawCalls: 0,
    });
    expect(diagnosticCodes).toContain("standardFrameResources.missingLights");
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.frameResourceRoute",
          route: expect.objectContaining({
            valid: false,
            status: "failed",
            family: "standard",
            facadeMeshResourceKey: expect.any(String),
            facadeMaterialResourceKey: expect.any(String),
            backendMeshKey: expect.stringContaining("@"),
            backendMaterialKey: expect.stringContaining("@"),
            diagnostics: expect.arrayContaining([
              expect.objectContaining({
                code: "standardFrameResources.missingLights",
              }),
            ]),
          }),
        }),
      ]),
    );
    expect(JSON.stringify(frame.diagnostics)).not.toContain("GPUBuffer");
    expect(JSON.stringify(frame.diagnostics)).not.toContain("GPUBindGroup");
    expect(events).not.toContain("queue:submit:1");
  });

  it("renders the standard material queue path with extracted lights", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Lit",
        metallicFactor: 0.1,
        roughnessFactor: 0.5,
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );
    const standardMaterialIblResources = {
      bindGroupResource: {
        ready: true,
        status: "available" as const,
        standardMaterialCount: 1,
        group: 4 as const,
        createdBindGroupCount: 0,
        reusedBindGroupCount: 1,
        sections: {
          descriptorPlan: true,
          layoutResource: true,
          textureResources: true,
          samplerResource: true,
          bindGroupResource: true,
          shaderSampling: false as const,
        },
        resource: {
          group: 4 as const,
          resourceKey: "bind-group:standard/ibl/group-4/test",
          layoutKey: "standard/ibl/group-4",
          bindGroup: { label: "standard/ibl/group-4/test" },
          entryResourceKeys: [
            "texture:test:diffuse:texture",
            "texture:test:specular:texture",
            "texture:test:diffuse:sampler",
          ],
        },
        diagnostics: [
          {
            code: "standardMaterialIblBindGroupResource.shaderSamplingDeferred",
            severity: "warning" as const,
            message: "StandardMaterial IBL shader sampling is deferred.",
          },
        ],
      },
    } as const;

    app.step(1 / 60, 1);
    const frame = await app.render({
      frame: 12,
      standardMaterialIblResources,
    });

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.lights.map((light) => light.kind)).toEqual([
      "ambient",
      "directional",
    ]);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|opaque|back|less|none",
    );
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
      dynamicBufferWrites: 0,
    });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      0,
    );
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "matcap"),
    ).toBe(0);
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(1);
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(queuedBindGroupResourceKeys(frame.resources?.resources, 4)).toEqual(
      [],
    );
    expect(
      standardIblBindGroupResource(frame.resources?.resources),
    ).toMatchObject({
      group: 4,
      resourceKey: "bind-group:standard/ibl/group-4/test",
      layoutKey: "standard/ibl/group-4",
      entryResourceKeys: [
        "texture:test:diffuse:texture",
        "texture:test:specular:texture",
        "texture:test:diffuse:sampler",
      ],
    });
    const value = webGpuAppRenderReportToJsonValue(frame);
    const json = webGpuAppRenderReportToJson(frame);

    expect(value).toMatchObject({
      ok: true,
      frame: 12,
      counts: {
        views: 1,
        meshDraws: 1,
        drawCalls: 1,
        diagnostics: 0,
      },
      diagnostics: [],
      diagnosticsSummary: {
        sectionCount: 6,
        materialQueue: {
          itemCount: 1,
          byPhase: [{ phase: "opaque", itemCount: 1 }],
          byFamily: [{ family: "standard", itemCount: 1 }],
          byPhaseAndFamily: [
            { phase: "opaque", family: "standard", itemCount: 1 },
          ],
        },
        routedResourceSet: {
          itemCount: 1,
          byFamily: [{ family: "standard", itemCount: 1 }],
          byPipeline: [
            { pipelineKey: "standard|opaque|back|less|none", itemCount: 1 },
          ],
          byFamilyAndPipeline: [
            {
              family: "standard",
              pipelineKey: "standard|opaque|back|less|none",
              itemCount: 1,
            },
          ],
        },
        directLighting: {
          ready: true,
          lightCounts: {
            total: 2,
            direct: 1,
            ambient: 1,
            directional: 1,
            point: 0,
            spot: 0,
            environment: 0,
          },
          sections: {
            lightGpuBuffers: true,
            lightBindGroupLayout: true,
            lightBindGroup: true,
            shaderMetadata: true,
          },
          resources: {
            lightGpuBufferResourceKey: "light-buffer:main",
            lightBindGroupLayoutKey: expect.stringContaining(
              "webgpu-app/standard/group-3",
            ) as string,
            lightBindGroupResourceKey:
              "bind-group:lights/group-3/light-buffer:main",
          },
          shaderMetadata: {
            valid: true,
            diagnostics: [],
          },
          diagnostics: [],
        },
        renderQueueSortPhases: [{ phase: "opaque", recordCount: 1 }],
      },
      resourceReuse: {
        pipelineMisses: 1,
        meshBuffersCreated: 1,
        preparedMeshBuffersCreated: 1,
        materialBuffersCreated: 1,
        preparedMaterialCache: {
          totalEntries: 1,
          families: {
            unlit: { entries: 0 },
            matcap: { entries: 0 },
            standard: { entries: 1 },
          },
        },
        lightBuffersCreated: 1,
      },
    });
    expect(value).not.toHaveProperty("materialDependencyReadiness");
    expect(value.diagnosticsSummary).toHaveProperty("routedResourceSet");
    expect(value.diagnosticsSummary).not.toHaveProperty("standardResourceSet");
    expect(value.diagnosticsSummary).not.toHaveProperty("unlitResourceSet");
    expect(value.diagnosticsSummary).not.toHaveProperty("matcapResourceSet");
    expect(json).toBe(JSON.stringify(value));
    expect(json).not.toContain("standardResourceSet");
    expect(json).not.toContain("unlitResourceSet");
    expect(json).not.toContain("matcapResourceSet");
    expect(json).not.toContain("snapshot");
    expect(json).not.toContain("commandBuffer");
    expect(json).not.toContain("descriptor");
    expect(events).toContain("pass:bind:3");
    expect(events).not.toContain("pass:bind:4");
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const firstEventCount = events.length;
    app.step(1 / 60, 2);
    const secondFrame = await app.render({
      frame: 13,
      standardMaterialIblResources,
    });
    const secondEvents = events.slice(firstEventCount);
    const firstResources = frame.resources?.resources;
    const secondResources = secondFrame.resources?.resources;
    const firstStandardResources =
      queuedMaterialResources(firstResources, "standard")[0] ?? firstResources;
    const secondStandardResources =
      queuedMaterialResources(secondResources, "standard")[0] ??
      secondResources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(1);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersReused: 0,
      materialBuffersReused: 1,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 0,
    });
    expect(secondResources?.mesh).toBe(firstResources?.mesh);
    expect(singleMaterialResource(secondResources)).toBe(
      singleMaterialResource(firstResources),
    );
    expect(secondResources?.viewUniform.buffer).toBe(
      firstResources?.viewUniform.buffer,
    );
    expect(secondResources?.worldTransforms.buffer).toBe(
      firstResources?.worldTransforms.buffer,
    );
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);

    if (
      hasStandardLightResources(firstStandardResources) &&
      hasStandardLightResources(secondStandardResources)
    ) {
      expect(secondStandardResources.materialBindGroup).toBe(
        firstStandardResources.materialBindGroup,
      );
      expect(secondStandardResources.lightBindGroup).toBe(
        firstStandardResources.lightBindGroup,
      );
      expect(secondStandardResources.lightGpuBuffers.resource).toBe(
        firstStandardResources.lightGpuBuffers.resource,
      );
    } else {
      expect.unreachable("Expected standard frame resources.");
    }

    expect(secondEvents).toContain("queue:submit:1");
    expect(secondEvents.some((event) => event.startsWith("pass:draw"))).toBe(
      true,
    );
    // AI-64: a static second frame issues zero world-transform bytes — the
    // version-gated upload skips the unchanged buffer entirely.
    expect(secondEvents).not.toContain(
      "queue:writeBuffer:WorldTransforms/storage",
    );
    // AI-65: ... and zero view/light bytes either — fully static frames skip
    // every dynamic uniform upload.
    expect(secondEvents).not.toContain(
      "queue:writeBuffer:ViewUniforms/uniform",
    );
    expect(secondEvents).not.toContain(
      "queue:writeBuffer:light-buffer:main/floats",
    );
    expect(secondEvents).not.toContain(
      "queue:writeBuffer:light-buffer:main/metadata",
    );
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("uploads only the changed dynamic uniform family (AI-65 selective writes)", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Lit" }),
    );

    const cameraEntity = app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    // A point light: its packed float row depends only on its own transform
    // and properties, never on the camera (unlike directional cascade data).
    const pointLight = app.spawn(
      withTransform({ translation: [2, 2, 2] }),
      withLight({ kind: LightKind.Point, intensity: 1.5, layerMask: 1 }),
    );

    await app.stepAndRender(1 / 60, 1, 1);
    await app.stepAndRender(1 / 60, 2, 2);

    // Camera-only move: the view uniform uploads; light and transform
    // buffers skip (zero bytes).
    cameraEntity.getVectorView(LocalTransform, "translation").set([0, 1, 5]);
    const cameraEventStart = events.length;
    const cameraFrame = await app.stepAndRender(1 / 60, 3, 3);
    const cameraEvents = events.slice(cameraEventStart);

    expect(cameraFrame.ok).toBe(true);
    expect(cameraEvents).toContain("queue:writeBuffer:ViewUniforms/uniform");
    expect(cameraEvents).not.toContain(
      "queue:writeBuffer:light-buffer:main/floats",
    );
    expect(cameraEvents).not.toContain(
      "queue:writeBuffer:light-buffer:main/metadata",
    );
    expect(cameraEvents).not.toContain(
      "queue:writeBuffer:WorldTransforms/storage",
    );

    // Settle one frame: the packed view uniforms include the previous frame's
    // view-projection (TAA history), which trails a camera move by one frame.
    await app.stepAndRender(1 / 60, 4, 4);

    // Light-only change: the light float buffer uploads; the view uniform and
    // the untouched light metadata skip.
    pointLight.setValue(Light, "intensity", 2.25);
    const lightEventStart = events.length;
    const lightFrame = await app.stepAndRender(1 / 60, 5, 5);
    const lightEvents = events.slice(lightEventStart);

    expect(lightFrame.ok).toBe(true);
    expect(lightEvents).toContain("queue:writeBuffer:light-buffer:main/floats");
    expect(lightEvents).not.toContain(
      "queue:writeBuffer:light-buffer:main/metadata",
    );
    expect(lightEvents).not.toContain("queue:writeBuffer:ViewUniforms/uniform");
  });

  it("auto-renders directional shadow resources for standard material frames", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "ShadowCube" }));
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Auto Shadow Lit",
        roughnessFactor: 0.7,
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
      withLightShadowSettings({
        enabled: true,
        cascadeCount: 2,
        mapSize: 512,
        casterLayerMask: 1,
        receiverLayerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 32);
    const value = webGpuAppRenderReportToJsonValue(frame);

    expect(frame.ok).toBe(true);
    expect(frame.shadow).toMatchObject({
      status: "submitted",
      shadowKind: "directional-cascaded",
      passCount: 2,
      commandBufferSubmission: {
        status: "submitted",
        submittedCommandBuffers: 1,
        sections: {
          shaderSampling: true,
        },
      },
      sections: {
        commandBufferSubmission: true,
        receiverResources: true,
      },
    });
    expect(frame.shadow?.drawCalls).toBeGreaterThan(0);
    expect(frame.snapshot.shadowRequests).toHaveLength(1);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toContain(
      "shadowMap",
    );
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toContain(
      "cascadedShadowMap",
    );
    expect(frame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
    });
    expect(value.shadow).toMatchObject({
      status: "submitted",
      commandBufferSubmission: {
        status: "submitted",
        sections: { shaderSampling: true },
      },
    });
    expect(frame.diagnostics).toEqual([]);
    expect(events.filter((event) => event === "queue:submit:1")).toHaveLength(
      2,
    );
    expect(events).toContain("pass:drawIndexed:36");

    const disabledEventStart = events.length;

    app.step(1 / 60, 2);

    const disabledFrame = await app.render({
      frame: 33,
      autoStandardMaterialShadowReceiverResources: false,
    });
    const disabledEvents = events.slice(disabledEventStart);

    expect(disabledFrame.ok).toBe(true);
    expect(disabledFrame.shadow).toBeUndefined();
    expect(disabledFrame.snapshot.shadowRequests).toHaveLength(1);
    expect(
      disabledFrame.snapshot.meshDraws[0]?.batchKey.pipelineKey,
    ).not.toContain("shadowMap");
    expect(
      disabledEvents.filter((event) => event === "queue:submit:1"),
    ).toHaveLength(1);
  });

  it("aliases ready StandardMaterial diffuse IBL resources into executable group 3", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "IblCube" }));
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "IblLit",
        metallicFactor: 0.0,
        roughnessFactor: 0.6,
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.1,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.0,
        layerMask: 1,
      }),
    );

    const standardMaterialIblResources = createReadyStandardIblFrameResources();

    app.step(1 / 60, 1);
    const frame = await app.render({
      frame: 31,
      standardMaterialIblResources,
    });

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|iblDiffuse|opaque|back|less|none",
    );
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-diffuse-ibl|tonemap:none|output-color:srgb:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:bindGroup:standard/lights-ibl");
    expect(events).toContain("pass:bind:3");
    expect(events).not.toContain("pass:bind:4");
    expect(queuedBindGroupResourceKeys(frame.resources?.resources, 4)).toEqual(
      [],
    );
    expect(queuedBindGroupResourceKeys(frame.resources?.resources, 3)).toEqual([
      expect.stringContaining(
        pipelineKeyJsonFragment("standard|iblDiffuse|opaque|back|less|none"),
      ) as string,
    ]);
    expect(standardIblBindGroupResource(frame.resources?.resources)).toBe(
      standardMaterialIblResources.bindGroupResource.resource,
    );
  });

  it("reuses prepared StandardMaterial mesh buffers across frame-resource misses", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedStandardCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedStandardCubeSecond" }),
    );
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Prepared Standard A" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 70);

    app.spawn(
      withTransform({ translation: [0.8, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const secondFrame = await app.stepAndRender(1 / 60, 2, 71);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      lightBuffersCreated: 1,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(secondFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
    });
  });

  it("reports scalar StandardMaterial prepared material source-version invalidation", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "VersionedStandardCube" }),
    );
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Versioned Standard A" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    const standardEntity = app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    const ambientLight = app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 72);

    assets.materials.standard.markReady(
      material,
      createStandardMaterialAsset({ label: "Versioned Standard B" }),
    );

    const materialVersionFrame = await app.stepAndRender(1 / 60, 2, 73);

    standardEntity
      .getVectorView(LocalTransform, "translation")
      .set([0.25, 0, 0]);
    ambientLight.setValue(Light, "intensity", 0.35);

    const cacheHitFrame = await app.stepAndRender(1 / 60, 3, 74);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      lightBuffersCreated: 1,
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(firstFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(materialVersionFrame.ok).toBe(true);
    expect(materialVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 1,
      materialBuffersReused: 0,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      bindGroupsCreated: 4,
      bindGroupsReused: 0,
      lightBuffersCreated: 1,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(materialVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 2,
    });
    expectPreparedMaterialFacadeSummary(materialVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(cacheHitFrame.ok).toBe(true);
    expect(cacheHitFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 0,
      materialBuffersCreated: 0,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 0,
      bindGroupsCreated: 0,
      bindGroupsReused: 4,
      lightBuffersCreated: 0,
      lightBuffersReused: 1,
      dynamicBufferWrites: 2,
    });
    expectPreparedMaterialCacheSummary(cacheHitFrame, {
      unlit: 0,
      matcap: 0,
      standard: 2,
    });
    expectPreparedMaterialFacadeSummary(cacheHitFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(
      webGpuAppRenderReportToJsonValue(materialVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expect(JSON.stringify(cacheHitFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("renders mixed opaque and alpha-test StandardMaterial queue items", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "AlphaTestStandardCube" }),
    );
    const opaqueMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Opaque Standard",
        baseColorFactor: new Float32Array([0.2, 0.6, 1, 1]),
      }),
    );
    const alphaTestMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Alpha Test Standard",
        baseColorFactor: new Float32Array([1, 0.4, 0.1, 0.4]),
        renderState: { alphaMode: "mask", alphaCutoff: 0.5 },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(opaqueMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(alphaTestMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.25,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 52);

    expect(frame.ok).toBe(true);
    expect(
      frame.snapshot.meshDraws.map((draw) => ({
        queue: draw.sortKey.queue,
        pipelineKey: draw.batchKey.pipelineKey,
      })),
    ).toEqual([
      { queue: "opaque", pipelineKey: "standard|opaque|back|less|none" },
      { queue: "alpha-test", pipelineKey: "standard|mask|back|less|none" },
    ]);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 2,
      materialBuffersCreated: 2,
      bindGroupsCreated: 8,
      lightBuffersCreated: 2,
    });
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(2);
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(queuedBindGroupResourceKeys(frame.resources?.resources, 3)).toEqual([
      expect.stringContaining(
        pipelineKeyJsonFragment("standard|opaque|back|less|none"),
      ) as string,
      expect.stringContaining(
        pipelineKeyJsonFragment("standard|mask|back|less|none"),
      ) as string,
    ]);
    expect(events).toContain("queue:submit:1");

    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 53);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
    });
    expect(queuedMaterialResources(secondResources, "standard").length).toBe(2);
    expect(
      queuedMaterialResources(secondResources, "standard")[0]?.material,
    ).toBe(queuedMaterialResources(firstResources, "standard")[0]?.material);
    expect(
      queuedMaterialResources(secondResources, "standard")[1]?.material,
    ).toBe(queuedMaterialResources(firstResources, "standard")[1]?.material);
  });

  it("renders transparent StandardMaterial alpha-blend queue items after opaque phases", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 10 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TransparentStandardCube" }),
    );
    const opaqueMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Transparent Route Opaque" }),
    );
    const alphaTestMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Transparent Route Mask",
        baseColorFactor: new Float32Array([1, 1, 1, 0.4]),
        renderState: { alphaMode: "mask", alphaCutoff: 0.5 },
      }),
    );
    const transparentA = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Transparent Route A",
        baseColorFactor: new Float32Array([0.1, 0.6, 1, 0.35]),
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      }),
    );
    const transparentB = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Transparent Route B",
        baseColorFactor: new Float32Array([1, 0.2, 0.1, 0.45]),
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.75, 0, 0] }),
      withMesh(mesh),
      withMaterial(opaqueMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [-0.25, 0, 0] }),
      withMesh(mesh),
      withMaterial(alphaTestMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.25, 0, 0] }),
      withMesh(mesh),
      withMaterial(transparentA),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.75, 0, 0] }),
      withMesh(mesh),
      withMaterial(transparentB),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.25,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 54);

    expect(frame.ok).toBe(true);
    expect(
      frame.snapshot.meshDraws.map((draw) => ({
        queue: draw.sortKey.queue,
        materialKey: draw.batchKey.materialKey,
        pipelineKey: draw.batchKey.pipelineKey,
      })),
    ).toEqual([
      {
        queue: "opaque",
        materialKey: assetHandleKey(opaqueMaterial),
        pipelineKey: "standard|opaque|back|less|none",
      },
      {
        queue: "alpha-test",
        materialKey: assetHandleKey(alphaTestMaterial),
        pipelineKey: "standard|mask|back|less|none",
      },
      {
        queue: "transparent",
        materialKey: assetHandleKey(transparentA),
        pipelineKey: "standard|blend|back|less|alpha",
      },
      {
        queue: "transparent",
        materialKey: assetHandleKey(transparentB),
        pipelineKey: "standard|blend|back|less|alpha",
      },
    ]);
    expect(frame.counts).toMatchObject({
      meshDraws: 4,
      drawPackages: 4,
      drawCalls: 4,
      diagnostics: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
    ).toMatchObject({
      renderQueueSortPhases: [
        { phase: "opaque", recordCount: 2 },
        { phase: "transparent", recordCount: 2 },
      ],
    });
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(4);
    expect(queuedBindGroupResourceKeys(frame.resources?.resources, 3)).toEqual([
      expect.stringContaining(
        pipelineKeyJsonFragment("standard|opaque|back|less|none"),
      ) as string,
      expect.stringContaining(
        pipelineKeyJsonFragment("standard|mask|back|less|none"),
      ) as string,
      expect.stringContaining(
        pipelineKeyJsonFragment("standard|blend|back|less|alpha"),
      ) as string,
      expect.stringContaining(
        pipelineKeyJsonFragment("standard|blend|back|less|alpha"),
      ) as string,
    ]);
    expect(events).toContain("queue:submit:1");

    const secondFrame = await app.stepAndRender(1 / 60, 2, 55);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(4);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 4,
      pipelineMisses: 0,
    });
  });

  it("renders transparent UnlitMaterial alpha-blend queue items", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 6 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TransparentUnlitCube" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Transparent Route Unlit",
        baseColorFactor: new Float32Array([0.2, 0.8, 1, 0.4]),
        renderState: {
          alphaMode: "blend",
          cullMode: "none",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 55.5);

    expect(frame.ok).toBe(true);
    expect(
      frame.snapshot.meshDraws.map((draw) => ({
        queue: draw.sortKey.queue,
        materialKey: draw.batchKey.materialKey,
        pipelineKey: draw.batchKey.pipelineKey,
      })),
    ).toEqual([
      {
        queue: "transparent",
        materialKey: assetHandleKey(material),
        pipelineKey: "unlit|blend|none|less|alpha",
      },
    ]);
    expect(frame.counts).toMatchObject({
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      1,
    );
    expect(events).toContain("queue:submit:1");

    const secondFrame = await app.stepAndRender(1 / 60, 2, 56);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(1);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
    });
  });

  it("renders and reuses StandardMaterial base-color texture resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TexturedStandardCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TexturedStandardCubeSecond" }),
    );
    const texture = createTextureHandle("standard-base-color");
    const sampler = createSamplerHandle("standard-base-color-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardBaseColor",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 64, 64, 255, 64, 255, 64, 255, 64, 64, 255, 255, 255, 255, 64,
            255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardBaseColorSampler" }),
    );

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Textured Standard",
        baseColorTexture: {
          texture,
          sampler,
          transform: {
            offset: [0.125, 0.25],
            rotation: Math.PI / 6,
            scale: [0.75, 1.25],
          },
        },
        metallicFactor: 0,
        roughnessFactor: 0.6,
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.35,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 44);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|baseColorTexture|opaque|back|less|none",
    );
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
    });
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(frame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-base-color-textured|tonemap:none|output-color:srgb:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:texture:StandardBaseColor");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:StandardBaseColorSampler");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
        expect.stringContaining(
          pipelineKeyJsonFragment(
            "standard|baseColorTexture|opaque|back|less|none",
          ),
        ) as string,
      ],
    });
    expect(
      webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
    ).toMatchObject({
      sectionCount: 6,
      routedResourceSet: {
        itemCount: 1,
        byFamily: [{ family: "standard", itemCount: 1 }],
        byPipeline: [
          {
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            itemCount: 1,
          },
        ],
      },
      directLighting: {
        ready: true,
        resources: {
          lightGpuBufferResourceKey: "light-buffer:main",
          lightBindGroupLayoutKey: expect.stringContaining(
            "webgpu-app/standard/group-3",
          ) as string,
          lightBindGroupResourceKey:
            "bind-group:lights/group-3/light-buffer:main",
        },
      },
      renderQueueSortPhases: [{ phase: "opaque", recordCount: 1 }],
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
      ),
    ).not.toContain("GPU");
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
      ),
    ).not.toContain("descriptor");

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 45);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      materialBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.spawn(
      withTransform({ translation: [0.65, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 46);

    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.counts.drawCalls).toBe(2);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(thirdFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(thirdFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse
        .preparedMeshCache.totalEntries,
    ).toBeGreaterThan(0);
    expectTextureSamplerCacheSummary(thirdFrame, {
      textureEntries: 3,
      samplerEntries: 2,
    });
    expectRetainedBackendCacheSummariesAreJsonSafe(thirdFrame, [
      "TexturedStandardCube",
      "Textured Standard",
      "StandardBaseColor",
      "StandardBaseColorSampler",
    ]);
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 2,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardBaseColorV2",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            64, 64, 255, 255, 255, 64, 64, 255, 64, 255, 64, 255, 255, 255, 64,
            255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 4, 47);

    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(textureVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(textureVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 2,
    });
    expectPreparedMeshFacadeSummary(textureVersionFrame, { totalEntries: 2 });
    expect(
      webGpuAppRenderReportToJsonValue(textureVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 2,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardBaseColorSamplerV2" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 5, 48);

    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 1,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(samplerVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(samplerVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 3,
    });
    expectPreparedMeshFacadeSummary(samplerVersionFrame, { totalEntries: 2 });
    expect(
      webGpuAppRenderReportToJsonValue(samplerVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
    });
  });

  it("renders and reuses StandardMaterial metallic-roughness texture resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MetallicRoughnessCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MetallicRoughnessCubeSecond" }),
    );
    const texture = createTextureHandle("standard-metallic-roughness");
    const sampler = createSamplerHandle("standard-metallic-roughness-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardMetallicRoughness",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "metallic-roughness",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            0, 32, 255, 255, 0, 224, 64, 255, 0, 96, 192, 255, 0, 180, 128, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardMetallicRoughnessSampler" }),
    );

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Metallic Roughness Standard",
        baseColorFactor: new Float32Array([0.92, 0.78, 0.52, 1]),
        metallicFactor: 0.8,
        roughnessFactor: 0.7,
        metallicRoughnessTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.35,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 46);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|metallicRoughnessTexture|opaque|back|less|none",
    );
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
    });
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-metallic-roughness-textured|tonemap:none|output-color:srgb:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:texture:StandardMetallicRoughness");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:StandardMetallicRoughnessSampler");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
        expect.stringContaining(
          pipelineKeyJsonFragment(
            "standard|metallicRoughnessTexture|opaque|back|less|none",
          ),
        ) as string,
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 47);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      materialBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 0,
    });
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.spawn(
      withTransform({ translation: [0.65, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 48);

    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.counts.drawCalls).toBe(2);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 2,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardMetallicRoughnessV2",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "metallic-roughness",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            0, 220, 48, 255, 0, 144, 180, 255, 0, 72, 224, 255, 0, 200, 96, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 4, 49);

    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(textureVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 2,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardMetallicRoughnessSamplerV2" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 5, 50);

    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 1,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(samplerVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
    });
    expect(JSON.stringify(samplerVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("renders and reuses StandardMaterial emissive and occlusion texture resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "EmissiveOcclusionCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "EmissiveOcclusionCubeSecond" }),
    );
    const occlusionTexture = createTextureHandle("standard-occlusion");
    const occlusionSampler = createSamplerHandle("standard-occlusion-sampler");
    const emissiveTexture = createTextureHandle("standard-emissive");
    const emissiveSampler = createSamplerHandle("standard-emissive-sampler");

    app.assets.register(occlusionTexture);
    app.assets.markReady(
      occlusionTexture,
      createTextureAsset({
        label: "StandardOcclusion",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "occlusion",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 0, 0, 255, 160, 0, 0, 255, 192, 0, 0, 255, 96, 0, 0, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(occlusionSampler);
    app.assets.markReady(
      occlusionSampler,
      createSamplerAsset({ label: "StandardOcclusionSampler" }),
    );
    app.assets.register(emissiveTexture);
    app.assets.markReady(
      emissiveTexture,
      createTextureAsset({
        label: "StandardEmissive",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "emissive",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            64, 255, 128, 255, 32, 128, 255, 255, 160, 255, 96, 255, 96, 160,
            255, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(emissiveSampler);
    app.assets.markReady(
      emissiveSampler,
      createSamplerAsset({ label: "StandardEmissiveSampler" }),
    );

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Emissive Occlusion Standard",
        baseColorFactor: new Float32Array([0.45, 0.75, 0.62, 1]),
        occlusionStrength: 0.6,
        emissiveFactor: [0.2, 0.25, 0.18],
        occlusionTexture: {
          texture: occlusionTexture,
          sampler: occlusionSampler,
        },
        emissiveTexture: { texture: emissiveTexture, sampler: emissiveSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.35,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 48);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|emissiveTexture|occlusionTexture|opaque|back|less|none",
    );
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 2,
      samplerResourcesCreated: 2,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
    });
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-occlusion-emissive-textured|tonemap:none|output-color:srgb:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:texture:StandardOcclusion");
    expect(events).toContain("device:texture:StandardEmissive");
    expect(events).toContain("device:sampler:StandardOcclusionSampler");
    expect(events).toContain("device:sampler:StandardEmissiveSampler");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(occlusionTexture),
        assetHandleKey(occlusionSampler),
        assetHandleKey(emissiveTexture),
        assetHandleKey(emissiveSampler),
        expect.stringContaining(
          pipelineKeyJsonFragment(
            "standard|emissiveTexture|occlusionTexture|opaque|back|less|none",
          ),
        ) as string,
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 49);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      materialBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 0,
    });
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.spawn(
      withTransform({ translation: [0.65, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 50);

    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.counts.drawCalls).toBe(2);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 4,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 4,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 4,
      samplerResourcesReused: 4,
    });

    app.assets.markReady(
      occlusionTexture,
      createTextureAsset({
        label: "StandardOcclusionV2",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "occlusion",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            128, 0, 0, 255, 224, 0, 0, 255, 96, 0, 0, 255, 192, 0, 0, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 4, 51);

    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 3,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 4,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });

    app.assets.markReady(
      emissiveSampler,
      createSamplerAsset({ label: "StandardEmissiveSamplerV2" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 5, 52);

    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 4,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 3,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(JSON.stringify(samplerVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("renders and reuses StandardMaterial tangent-space normal-map resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createTangentBoxMeshAsset({ label: "NormalMappedCube" }),
    );
    const secondMesh = assets.meshes.add(
      createTangentBoxMeshAsset({ label: "NormalMappedCubeSecond" }),
    );
    const texture = createTextureHandle("standard-normal");
    const sampler = createSamplerHandle("standard-normal-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardNormal",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "normal",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            128, 128, 255, 255, 128, 128, 255, 255, 128, 128, 255, 255, 128,
            128, 255, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardNormalSampler" }),
    );

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Normal Mapped Standard",
        normalScale: 0.75,
        normalTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.35,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 50);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey).toMatchObject({
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
    });
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-normal-map-textured|tonemap:none|output-color:srgb:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:texture:StandardNormal");
    expect(events).toContain("device:sampler:StandardNormalSampler");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
        expect.stringContaining(
          pipelineKeyJsonFragment(
            "standard|normalTexture|opaque|back|less|none",
          ),
        ) as string,
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 51);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      materialBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 0,
    });
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.spawn(
      withTransform({ translation: [0.65, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 52);

    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.counts.drawCalls).toBe(2);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 2,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardNormalV2",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "normal",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            128, 128, 255, 255, 96, 128, 255, 255, 160, 128, 255, 255, 128, 160,
            255, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 4, 53);

    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(textureVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 2,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardNormalSamplerV2" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 5, 54);

    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 1,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(samplerVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
    });
    expect(JSON.stringify(samplerVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("blocks StandardMaterial metallic-roughness rendering when texture dependencies are not ready", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "BlockedMetallicRoughnessCube" }),
    );
    const texture = createTextureHandle("missing-standard-mr");
    const sampler = createSamplerHandle("loading-standard-mr");

    app.assets.register(sampler);
    app.assets.markLoading(sampler);

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Blocked Metallic Roughness Standard",
        metallicRoughnessTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 48);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 0,
      drawCalls: 0,
    });
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(material),
        materialKind: "standard",
        slots: [
          {
            field: "metallicRoughnessTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "metallicRoughnessTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "loading",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("blocks StandardMaterial emissive and occlusion rendering when texture dependencies are not ready", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "BlockedEmissiveOcclusionCube" }),
    );
    const occlusionTexture = createTextureHandle("missing-standard-occlusion");
    const occlusionSampler = createSamplerHandle("loading-standard-occlusion");
    const emissiveTexture = createTextureHandle("missing-standard-emissive");
    const emissiveSampler = createSamplerHandle("loading-standard-emissive");

    app.assets.register(occlusionSampler);
    app.assets.markLoading(occlusionSampler);
    app.assets.register(emissiveSampler);
    app.assets.markLoading(emissiveSampler);

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Blocked Emissive Occlusion Standard",
        occlusionTexture: {
          texture: occlusionTexture,
          sampler: occlusionSampler,
        },
        emissiveTexture: { texture: emissiveTexture, sampler: emissiveSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 50);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 0,
      drawCalls: 0,
    });
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(material),
        materialKind: "standard",
        slots: [
          {
            field: "occlusionTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(occlusionTexture),
            status: "missing",
          },
          {
            field: "occlusionTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(occlusionSampler),
            status: "loading",
          },
          {
            field: "emissiveTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(emissiveTexture),
            status: "missing",
          },
          {
            field: "emissiveTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(emissiveSampler),
            status: "loading",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });
});

function webGpuHarness(
  events: string[],
  options: {
    readonly timestampQuery?: boolean;
    readonly features?: readonly string[];
  } = {},
) {
  let timestamp = 1_000n;
  const supportedFeatures = new Set(options.features ?? []);
  const device = {
    features: {
      has: (feature: string) =>
        (feature === "timestamp-query" && options.timestampQuery === true) ||
        supportedFeatures.has(feature),
    },
    queue: {
      writeBuffer: (buffer: unknown) => {
        events.push(`queue:writeBuffer:${bufferLabel(buffer)}`);
      },
      writeTexture: (
        destination: unknown,
        data: Uint8Array,
        layout: unknown,
        size: unknown,
      ) => {
        void destination;
        void layout;
        void size;
        events.push(`queue:writeTexture:${data.byteLength}`);
      },
      submit: (buffers: readonly unknown[]) => {
        events.push(`queue:submit:${buffers.length}`);
      },
      onSubmittedWorkDone: async () => {
        events.push("queue:done");
      },
    },
    lost: new Promise<never>(() => {}),
    createShaderModule: (descriptor: unknown) => {
      events.push("device:shader");
      return { descriptor, compilationInfo: async () => ({ messages: [] }) };
    },
    createBindGroupLayout: (descriptor: unknown) => {
      events.push("device:bindGroupLayout");
      return { descriptor };
    },
    createPipelineLayout: (descriptor: unknown) => {
      events.push("device:pipelineLayout");
      return { descriptor };
    },
    createRenderPipeline: (descriptor: { readonly label?: string }) => {
      events.push(`device:pipeline:${descriptor.label ?? "unlabeled"}`);
      return {
        descriptor,
        getBindGroupLayout: (group: number) => ({ group }),
      };
    },
    createQuerySet: (descriptor: {
      readonly label?: string;
      readonly type: "timestamp";
      readonly count: number;
    }) => {
      events.push(`device:querySet:${descriptor.label ?? "unlabeled"}`);
      return {
        descriptor,
        timestamps: Array.from({ length: descriptor.count }, () => 0n),
      };
    },
    createBuffer: (descriptor: {
      readonly label?: string;
      readonly size?: number;
    }) => {
      events.push(`device:buffer:${descriptor.label ?? "unlabeled"}`);
      const bytes = new ArrayBuffer(descriptor.size ?? 0);

      return {
        descriptor,
        bytes,
        mapAsync: async () => {},
        getMappedRange: (offset = 0, size = bytes.byteLength) =>
          bytes.slice(offset, offset + size),
        unmap: () => {},
      };
    },
    createTexture: (descriptor: { readonly label?: string }) => {
      const label = descriptor.label ?? "unlabeled";

      events.push(`device:texture:${label}`);
      return {
        descriptor,
        createView: () => {
          events.push(`textureResource:view:${label}`);
          return { descriptor, label: `view:${label}` };
        },
      };
    },
    createSampler: (descriptor: { readonly label?: string }) => {
      events.push(`device:sampler:${descriptor.label ?? "unlabeled"}`);
      return { descriptor };
    },
    createBindGroup: (descriptor: { readonly label?: string }) => {
      events.push(`device:bindGroup:${descriptor.label ?? "unlabeled"}`);
      return { descriptor };
    },
    createCommandEncoder: () => {
      events.push("device:encoder");
      return {
        writeTimestamp: (querySet: unknown, queryIndex: number) => {
          events.push(`encoder:timestamp:${queryIndex}`);
          (querySet as { readonly timestamps: bigint[] }).timestamps[
            queryIndex
          ] = timestamp += 1_000n;
        },
        beginRenderPass: () => {
          events.push("encoder:begin");
          return {
            setViewport: () => {},
            setScissorRect: () => {},
            setPipeline: () => events.push("pass:pipeline"),
            setBindGroup: (group: number) => events.push(`pass:bind:${group}`),
            setVertexBuffer: (slot: number) =>
              events.push(`pass:vertex:${slot}`),
            setIndexBuffer: () => events.push("pass:index"),
            draw: (vertexCount: number) =>
              events.push(`pass:draw:${vertexCount}`),
            drawIndexed: (indexCount: number) =>
              events.push(`pass:drawIndexed:${indexCount}`),
            drawIndirect: (_buffer: unknown, offset: number) =>
              events.push(`pass:drawIndirect:${offset}`),
            drawIndexedIndirect: (_buffer: unknown, offset: number) =>
              events.push(`pass:drawIndexedIndirect:${offset}`),
            end: () => events.push("pass:end"),
          };
        },
        finish: () => {
          events.push("encoder:finish");
          return { commandBuffer: true };
        },
        resolveQuerySet: (
          querySet: unknown,
          firstQuery: number,
          queryCount: number,
          destination: unknown,
        ) => {
          events.push(`encoder:resolve:${queryCount}`);
          const timestamps = (querySet as { readonly timestamps: bigint[] })
            .timestamps;
          const destinationValues = new BigUint64Array(
            (destination as { readonly bytes: ArrayBuffer }).bytes,
          );

          for (let index = 0; index < queryCount; index += 1) {
            destinationValues[index] = timestamps[firstQuery + index] ?? 0n;
          }
        },
        copyBufferToBuffer: (
          source: unknown,
          sourceOffset: number,
          destination: unknown,
          destinationOffset: number,
          size: number,
        ) => {
          events.push(`encoder:copyBuffer:${size}`);
          const sourceBytes = new Uint8Array(
            (source as { readonly bytes: ArrayBuffer }).bytes,
            sourceOffset,
            size,
          );
          const destinationBytes = new Uint8Array(
            (destination as { readonly bytes: ArrayBuffer }).bytes,
            destinationOffset,
            size,
          );

          destinationBytes.set(sourceBytes);
        },
      };
    },
  };
  const context = {
    configure: (configuration: { readonly format: string }) =>
      events.push(`context:configure:${configuration.format}`),
    getCurrentTexture: () => ({
      createView: () => {
        events.push("texture:view");
        return { view: true };
      },
    }),
  };
  const canvas = {
    getContext: (contextId: "webgpu") => {
      events.push(`canvas:context:${contextId}`);
      return context;
    },
  };
  const environment = {
    navigator: {
      gpu: {
        requestAdapter: async () => ({
          features: device.features,
          requestDevice: async () => device,
        }),
        getPreferredCanvasFormat: () => "bgra8unorm",
      },
    },
  };

  return { canvas, environment };
}

function createReadyStandardIblFrameResources() {
  const diffuseResource = {
    resourceKey: "texture:test:diffuse:texture",
    texture: { label: "texture:test:diffuse:texture" },
    view: { label: "view:texture:test:diffuse:texture" },
    descriptor: {
      label: "test:diffuse-ibl",
      size: [64, 64, 6] as const,
      format: "rgba8unorm",
      usage: 6,
      mipLevelCount: 1,
    },
    viewDescriptor: { dimension: "cube" },
  };
  const samplerResource = {
    resourceKey: "texture:test:diffuse:sampler",
    sampler: { label: "texture:test:diffuse:sampler" },
    descriptor: {
      label: "test:diffuse:ibl-sampler",
      addressModeU: "clamp-to-edge" as const,
      addressModeV: "clamp-to-edge" as const,
      addressModeW: "clamp-to-edge" as const,
      magFilter: "linear" as const,
      minFilter: "linear" as const,
      mipmapFilter: "linear" as const,
      lodMinClamp: 0,
      lodMaxClamp: 32,
      maxAnisotropy: 1,
    },
  };
  const group4Resource = {
    group: 4 as const,
    resourceKey: "bind-group:standard/ibl/group-4/test",
    layoutKey: "standard/ibl/group-4",
    bindGroup: { label: "standard/ibl/group-4/test" },
    entryResourceKeys: [
      diffuseResource.resourceKey,
      "texture:test:specular:texture",
      samplerResource.resourceKey,
    ],
  };

  return {
    bindGroupResource: {
      ready: true,
      status: "available" as const,
      standardMaterialCount: 1,
      group: 4 as const,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 1,
      sections: {
        descriptorPlan: true,
        layoutResource: true,
        textureResources: true,
        samplerResource: true,
        bindGroupResource: true,
        shaderSampling: false as const,
      },
      resource: group4Resource,
      diagnostics: [],
    },
    diffuseTextureResource: {
      ready: true,
      status: "available" as const,
      textureSlotCount: 1,
      diffuseSlotCount: 1,
      createdTextureCount: 0,
      reusedTextureCount: 1,
      sections: {
        texturePreparation: true,
        diffuseTextureResource: true,
        gpuAllocation: true,
        specularPrefiltering: false as const,
        shaderSampling: false as const,
      },
      resources: [
        {
          valid: true,
          resource: diffuseResource,
          diagnostics: [],
        },
      ],
      diagnostics: [],
    },
    samplerResource: {
      ready: true,
      status: "available" as const,
      samplerDescriptorCount: 1,
      createdSamplerCount: 0,
      reusedSamplerCount: 1,
      sections: {
        samplerDescriptors: true,
        gpuAllocation: true,
        bindGroupLayout: false as const,
        shaderSampling: false as const,
      },
      resources: [
        {
          valid: true,
          resource: samplerResource,
          diagnostics: [],
        },
      ],
      diagnostics: [],
    },
  };
}

function bufferLabel(buffer: unknown): string {
  return (
    (buffer as { readonly descriptor?: { readonly label?: string } }).descriptor
      ?.label ?? "unlabeled"
  );
}

function createTangentBoxMeshAsset(options: {
  readonly label: string;
}): MeshAsset {
  const mesh = createBoxMeshAsset(options);
  const stream = mesh.vertexStreams[0];

  if (stream === undefined) {
    throw new Error("Expected box mesh fixture to provide one vertex stream.");
  }

  const source = stream.data;
  const sourceStrideFloats = stream.arrayStride / 4;
  const targetStrideFloats = 12;
  const data = new Float32Array(stream.vertexCount * targetStrideFloats);

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const sourceOffset = vertex * sourceStrideFloats;
    const targetOffset = vertex * targetStrideFloats;

    data.set(source.subarray(sourceOffset, sourceOffset + 8), targetOffset);
    data.set([1, 0, 0, 1], targetOffset + 8);
  }

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: "primitive-interleaved-tangent",
        arrayStride: targetStrideFloats * 4,
        attributes: [
          ...stream.attributes,
          { semantic: "TANGENT", format: "float32x4", offset: 32 },
        ],
        data,
      },
    ],
  };
}

function resourceEventCounts(events: readonly string[]) {
  return {
    pipelines: countEvents(events, "device:pipeline:"),
    buffers: countEvents(events, "device:buffer:"),
    textures: countEvents(events, "device:texture:"),
    textureViews: countEvents(events, "textureResource:view:"),
    samplers: countEvents(events, "device:sampler:"),
    bindGroups: countEvents(events, "device:bindGroup:"),
  };
}

function countEvents(events: readonly string[], prefix: string): number {
  return events.filter((event) => event.startsWith(prefix)).length;
}

function expectNoMaterialQueueRouteReport(report: {
  readonly diagnostics: readonly unknown[];
}): void {
  expect(report.diagnostics).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "webGpuApp.materialQueueRouteReport",
      }),
    ]),
  );
}

function expectNoFrameResourceRouteDiagnostic(report: {
  readonly diagnostics: readonly unknown[];
}): void {
  expect(report.diagnostics).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "webGpuApp.frameResourceRoute",
      }),
    ]),
  );
}

function materialQueueRouteReport(report: {
  readonly diagnostics: readonly unknown[];
}) {
  const diagnostic = report.diagnostics.find(
    (
      entry,
    ): entry is {
      readonly code: "webGpuApp.materialQueueRouteReport";
      readonly report: unknown;
    } =>
      typeof entry === "object" &&
      entry !== null &&
      "code" in entry &&
      entry.code === "webGpuApp.materialQueueRouteReport" &&
      "report" in entry,
  );

  if (diagnostic === undefined) {
    throw new Error("Expected a material queue route report diagnostic.");
  }

  return diagnostic.report;
}

function renderSnapshotWithDraws(
  snapshot: RenderSnapshot,
  frame: number,
  meshDraws: readonly MeshDrawPacket[],
): RenderSnapshot {
  return {
    ...snapshot,
    frame,
    meshDraws,
    report: {
      ...snapshot.report,
      meshDraws: meshDraws.length,
    },
  };
}

function drawForMaterial(
  snapshot: RenderSnapshot,
  material: RenderSnapshot["meshDraws"][number]["material"],
): MeshDrawPacket {
  const materialKey = assetHandleKey(material);
  const draw = snapshot.meshDraws.find(
    (candidate) => assetHandleKey(candidate.material) === materialKey,
  );

  if (draw === undefined) {
    throw new Error(`Expected snapshot draw for material '${materialKey}'.`);
  }

  return draw;
}

function singleMaterialResource(resources: unknown): unknown {
  if (typeof resources !== "object" || resources === null) {
    return undefined;
  }

  if ("material" in resources) {
    return (resources as { readonly material: unknown }).material;
  }

  for (const family of [
    "unlit",
    "matcap",
    "standard",
    "debug-normal",
  ] as const) {
    const resource = queuedMaterialResources(resources, family)[0];

    if (resource !== undefined) {
      return resource.material;
    }
  }

  return undefined;
}

function expectPreparedMaterialCacheSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly unlit: number;
    readonly matcap: number;
    readonly standard: number;
    readonly debugNormal?: number;
  },
): void {
  const debugNormal = expected.debugNormal ?? 0;

  expect(webGpuAppRenderReportToJsonValue(report).resourceReuse).toMatchObject({
    preparedMaterialCache: {
      totalEntries:
        expected.unlit + expected.matcap + expected.standard + debugNormal,
      families: {
        unlit: { entries: expected.unlit },
        matcap: { entries: expected.matcap },
        standard: { entries: expected.standard },
        "debug-normal": { entries: debugNormal },
      },
    },
  });
}

function expectTextureSamplerCacheSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly textureEntries: number;
    readonly samplerEntries: number;
  },
): void {
  const summary =
    webGpuAppRenderReportToJsonValue(report).resourceReuse.textureSamplerCache;

  expect(summary).toEqual({
    textureEntries: expected.textureEntries,
    samplerEntries: expected.samplerEntries,
    totalEntries: expected.textureEntries + expected.samplerEntries,
  });

  const json = JSON.stringify(summary);

  expect(json).not.toContain("Map");
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("descriptor");
  expect(json).not.toContain("VersionedUnlitAlbedo");
  expect(json).not.toContain("VersionedUnlitSampler");
}

function expectRetainedBackendCacheSummariesAreJsonSafe(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  absentMarkers: readonly string[],
): void {
  const resourceReuse = webGpuAppRenderReportToJsonValue(report).resourceReuse;
  const retainedBackendCaches = {
    preparedMeshCache: resourceReuse.preparedMeshCache,
    preparedMaterialCache: resourceReuse.preparedMaterialCache,
    textureSamplerCache: resourceReuse.textureSamplerCache,
  };
  const json = JSON.stringify(retainedBackendCaches);

  expect(retainedBackendCaches).toMatchObject({
    preparedMeshCache: { totalEntries: expect.any(Number) },
    preparedMaterialCache: { totalEntries: expect.any(Number) },
    textureSamplerCache: { totalEntries: expect.any(Number) },
  });
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("Float32Array");
  expect(json).not.toContain("descriptor");

  for (const marker of absentMarkers) {
    expect(json).not.toContain(marker);
  }
}

function expectPreparedMeshCacheSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly totalEntries: number;
    readonly layoutEntryCounts: readonly number[];
  },
): void {
  const summary =
    webGpuAppRenderReportToJsonValue(report).resourceReuse.preparedMeshCache;

  expect(summary.totalEntries).toBe(expected.totalEntries);
  expect(summary.layouts.map((layout) => layout.entries).sort()).toEqual(
    [...expected.layoutEntryCounts].sort(),
  );

  const json = JSON.stringify(summary);

  expect(json).not.toContain("Map");
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("Float32Array");
  expect(json).not.toContain("FacadeRetainedCube");
  expect(json).not.toContain("FacadePrunedCube");
  expect(json).not.toContain("lastUsedFrame");
}

function expectPreparedMeshFacadeSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly totalEntries: number;
    readonly meshResourceKeys?: readonly string[];
  },
): void {
  const summary =
    webGpuAppRenderReportToJsonValue(report).resourceReuse.preparedMeshFacade;

  expect(summary.totalEntries).toBe(expected.totalEntries);

  if (expected.meshResourceKeys !== undefined) {
    expect(
      summary.entries.map((entry) => entry.meshResourceKey).sort(),
    ).toEqual([...expected.meshResourceKeys].sort());
  }

  const json = JSON.stringify(summary);

  expect(json).not.toContain("Map");
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("Float32Array");
  expect(json).not.toContain("data");
}

function expectPreparedMaterialFacadeSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly unlit: number;
    readonly matcap: number;
    readonly standard: number;
    readonly debugNormal?: number;
  },
): void {
  const debugNormal = expected.debugNormal ?? 0;
  const summary =
    webGpuAppRenderReportToJsonValue(report).resourceReuse
      .preparedMaterialFacade;

  expect(summary).toMatchObject({
    totalEntries:
      expected.unlit + expected.matcap + expected.standard + debugNormal,
    families: {
      unlit: { entries: expected.unlit },
      matcap: { entries: expected.matcap },
      standard: { entries: expected.standard },
      "debug-normal": { entries: debugNormal },
    },
  });

  const json = JSON.stringify(summary);

  expect(json).not.toContain("Map");
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("baseColorFactor");
}

function expectPreparedMaterialFacadeResourceKeys(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  sourceMaterialKeys: readonly string[],
): void {
  const entries =
    webGpuAppRenderReportToJsonValue(report).resourceReuse
      .preparedMaterialFacade.entries;

  expect(entries.map((entry) => entry.materialResourceKey).sort()).toEqual(
    sourceMaterialKeys.map((key) => `prepared-material:${key}@v1`).sort(),
  );
  expect(
    entries
      .map((entry) => entry.bindGroupResourceKey)
      .every((key) => key.startsWith("prepared-material-bind-group:")),
  ).toBe(true);
}

function queuedMeshResourceCount(resources: unknown): number {
  if (typeof resources !== "object" || resources === null) {
    return 0;
  }

  const meshResources = (resources as { readonly meshResources?: unknown })
    .meshResources;

  return Array.isArray(meshResources) ? meshResources.length : 0;
}

function queuedFamilyResourceCount(
  resources: unknown,
  family: "unlit" | "matcap" | "standard" | "debug-normal",
): number {
  return queuedMaterialResources(resources, family).length;
}

function queuedBindGroupResourceKeys(
  resources: unknown,
  group: number,
): readonly string[] {
  if (typeof resources !== "object" || resources === null) {
    return [];
  }

  const value = (resources as { readonly bindGroups?: unknown }).bindGroups;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((bindGroup) => {
    if (typeof bindGroup !== "object" || bindGroup === null) {
      return [];
    }

    const candidate = bindGroup as {
      readonly group?: unknown;
      readonly resourceKey?: unknown;
    };

    return candidate.group === group &&
      typeof candidate.resourceKey === "string"
      ? [candidate.resourceKey]
      : [];
  });
}

function pipelineKeyJsonFragment(pipelineKey: string): string {
  return `"pipelineKey":"${pipelineKey}"`;
}

function standardIblBindGroupResource(resources: unknown): unknown {
  for (const resource of queuedMaterialResources(resources, "standard")) {
    const candidate = resource as {
      readonly standardMaterialIblBindGroup?: unknown;
    };

    if (candidate.standardMaterialIblBindGroup !== undefined) {
      return candidate.standardMaterialIblBindGroup;
    }
  }

  if (
    typeof resources === "object" &&
    resources !== null &&
    "standardMaterialIblBindGroup" in resources
  ) {
    return (resources as { readonly standardMaterialIblBindGroup: unknown })
      .standardMaterialIblBindGroup;
  }

  return undefined;
}

function queuedMaterialResources(
  resources: unknown,
  family: "unlit" | "matcap" | "standard" | "debug-normal",
): readonly {
  readonly material?: unknown;
  readonly bindGroups?: readonly { readonly group?: unknown }[];
}[] {
  if (typeof resources !== "object" || resources === null) {
    return [];
  }

  const resourceKey = family === "debug-normal" ? "debugNormal" : family;
  const value = (resources as Record<string, unknown>)[resourceKey];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      resource,
    ): resource is {
      readonly material?: unknown;
      readonly bindGroups?: readonly { readonly group?: unknown }[];
    } => typeof resource === "object" && resource !== null,
  );
}

function hasStandardLightResources(resource: unknown): resource is {
  readonly materialBindGroup: unknown;
  readonly lightBindGroup: unknown;
  readonly lightGpuBuffers: { readonly resource: unknown };
} {
  if (typeof resource !== "object" || resource === null) {
    return false;
  }

  const candidate = resource as {
    readonly materialBindGroup?: unknown;
    readonly lightBindGroup?: unknown;
    readonly lightGpuBuffers?: unknown;
  };

  return (
    candidate.materialBindGroup !== undefined &&
    candidate.lightBindGroup !== undefined &&
    typeof candidate.lightGpuBuffers === "object" &&
    candidate.lightGpuBuffers !== null &&
    "resource" in candidate.lightGpuBuffers
  );
}
