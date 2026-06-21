import { configureApertureExampleControl } from "./example-control.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.012, 0.016, 0.022, 1];
const rendererInstanceId = createRendererInstanceId();
const shellReadbackSamples = [
  { id: "left-bank", x: 0.26, y: 0.5 },
  { id: "center", x: 0.5, y: 0.5 },
  { id: "right-bank", x: 0.74, y: 0.5 },
];
const clusterPressureHistoryFrameCount = 12;
const clusterPressureStableFrameStart = 4;
const transparentPressureMinimumFrame = 4;
// Scenario budgets assume the repo's GPU-less e2e baseline: SwiftShader
// rasterizes these scenes in seconds per frame (not milliseconds), and shared
// runners can roughly double that under load. Budget the frames a scenario
// REQUIRES at a generous software-rendering rate instead of deriving the
// budget from the caller's maxFrames cap alone.
const scenarioFrameBudgetMs = 10000;
const scenarioBudgetSlackMs = 30000;
const scenarioDefinitions = new Set([
  "transparent-pressure",
  "clustered-pressure-history",
]);

let apertureApi = null;
let webGpuApp = null;
let readbackSupported = false;
let appCreatedCount = 0;
let scenarioRunCounter = 0;
let workerCreatedCount = 0;
let activeScenario = null;
let deviceLostFailure = null;
let shellDisposed = false;
const completedRuns = [];
let currentStatus = createBaseStatus({
  ok: false,
  phase: "loading",
  reason: "initializing",
  message: "Persistent render shell is initializing.",
});

const shellApi = {
  ready: null,
  getStatus() {
    return currentStatus;
  },
  async runScenario(id, options = {}) {
    return runScenario(id, options);
  },
  dispose() {
    return disposeShell();
  },
};

globalThis.__APERTURE_RENDER_PROOF_SHELL__ = shellApi;
configureApertureExampleControl({
  capabilities: {
    scenario: true,
    readback: true,
  },
  getStatus() {
    return currentStatus;
  },
  setScenario(id, options = {}) {
    return runScenario(id, options);
  },
  getFrameState() {
    return {
      status: currentStatus,
      scenario: currentStatus.scenario,
      renderer: currentStatus.renderer,
      completedRuns: currentStatus.completedRuns,
    };
  },
});
publishStatus(currentStatus);

shellApi.ready = initializeShell();

async function initializeShell() {
  try {
    const [core, webgpu] = await Promise.all([
      Promise.all([
        import("/aperture/worker-modules/packages/simulation/dist/index.js"),
        import("/aperture/worker-modules/packages/render/dist/index.js"),
        import("/aperture/worker-modules/packages/runtime/dist/index.js"),
      ]).then(([simulation, render, runtime]) => ({
        ...simulation,
        ...render,
        ...runtime,
      })),
      import("/aperture/worker-modules/packages/webgpu/dist/index.js"),
    ]);
    const aperture = { ...core, ...webgpu };

    apertureApi = aperture;

    if (canvas === null) {
      publishStatus(
        createBaseStatus({
          ok: false,
          phase: "failed",
          reason: "canvas-unavailable",
          message: "Canvas missing.",
        }),
      );
      return currentStatus;
    }

    const sourceAssets = new aperture.AssetRegistry();
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(
        createBaseStatus({
          ok: false,
          phase: "failed",
          reason: created.reason,
          message: created.message,
        }),
      );
      return currentStatus;
    }

    readbackSupported = readbackUsage.ok;
    webGpuApp = created.app;
    appCreatedCount += 1;

    trackDeviceLoss(created.app);
    registerQueuePhaseAssets(aperture, sourceAssets);
    registerClusteredLightAssets(aperture, sourceAssets);

    publishStatus(
      createBaseStatus({
        ok: true,
        phase: "ready",
        message: "Persistent render shell is ready.",
      }),
    );
    return currentStatus;
  } catch (error) {
    publishStatus(
      createBaseStatus({
        ok: false,
        phase: "failed",
        reason: "persistent-render-shell-failed",
        message: messageFromError(error),
      }),
    );
    return currentStatus;
  }
}

async function runScenario(id, options) {
  await shellApi.ready;

  if (activeScenario !== null) {
    return createBaseStatus({
      ok: false,
      phase: "scenario-rejected",
      reason: "scenario-already-running",
      message: `Scenario '${activeScenario}' is already running.`,
    });
  }

  if (webGpuApp === null || apertureApi === null) {
    return createBaseStatus({
      ok: false,
      phase: "scenario-rejected",
      reason: currentStatus.reason ?? "renderer-unavailable",
      message: currentStatus.message ?? "Persistent renderer is unavailable.",
    });
  }

  if (deviceLostFailure !== null) {
    return createBaseStatus({
      ok: false,
      phase: "scenario-rejected",
      reason: "device-lost",
      message: deviceLostDiagnosticMessage(
        `Scenario '${id}' cannot run because the persistent renderer lost its WebGPU device.`,
      ),
    });
  }

  if (!scenarioDefinitions.has(id)) {
    return createBaseStatus({
      ok: false,
      phase: "scenario-rejected",
      reason: "unknown-scenario",
      message: `Unknown persistent render shell scenario '${id}'.`,
    });
  }

  activeScenario = id;
  scenarioRunCounter += 1;

  const run = {
    id,
    runId: `shell-run-${scenarioRunCounter}`,
    runIndex: scenarioRunCounter,
    startedAt: performance.now(),
  };

  publishStatus(
    createBaseStatus({
      ok: true,
      phase: "scenario-running",
      scenario: createScenarioPendingStatus(run),
    }),
  );

  try {
    const status =
      id === "clustered-pressure-history"
        ? await runClusteredPressureHistoryScenario(
            apertureApi,
            webGpuApp,
            run,
            options,
          )
        : await runTransparentPressureScenario(
            apertureApi,
            webGpuApp,
            run,
            options,
          );

    completedRuns.push(summarizeScenarioRun(status.scenario));
    publishStatus(status);
    return status;
  } catch (error) {
    const status = createBaseStatus({
      ok: false,
      phase: "scenario-failed",
      reason: scenarioFailureReason(),
      message: scenarioFailureMessage(error),
      scenario: {
        ...createScenarioPendingStatus(run),
        ok: false,
        phase: "failed",
        reason: scenarioFailureReason(),
        message: scenarioFailureMessage(error),
        elapsedMs: Math.round(performance.now() - run.startedAt),
      },
    });

    publishStatus(status);
    return status;
  } finally {
    activeScenario = null;
  }
}

function trackDeviceLoss(app) {
  void app.initialization.deviceLost?.then((failure) => {
    if (shellDisposed) {
      // disposeShell() destroys the device on purpose; that loss is expected
      // and the "stopped" status must remain authoritative.
      return;
    }

    deviceLostFailure = failure;

    // A scenario that is mid-flight reports the loss through its own failure
    // path (with the scenario context attached). Only an idle shell publishes
    // the structured failure directly.
    if (activeScenario === null) {
      publishStatus(
        createBaseStatus({
          ok: false,
          phase: "failed",
          reason: "device-lost",
          message: deviceLostDiagnosticMessage(
            "The persistent render shell can no longer render scenarios.",
          ),
        }),
      );
    }
  });
}

function scenarioFailureReason() {
  return deviceLostFailure === null ? "scenario-runtime-error" : "device-lost";
}

function scenarioFailureMessage(error) {
  const base = messageFromError(error);

  if (deviceLostFailure === null) {
    return base;
  }

  return deviceLostDiagnosticMessage(base);
}

function deviceLostDiagnosticMessage(context) {
  const lostMessage = deviceLostFailure?.message ?? "no loss message";

  return (
    `${context} The persistent WebGPU device was lost (${lostMessage}). ` +
    "Suggested fix: reload the shell to recreate the renderer; on machines " +
    "without a usable GPU, launch the browser with the SwiftShader Vulkan " +
    "flags the repo's WebGPU test configs use (--enable-unsafe-webgpu " +
    "--use-vulkan=swiftshader --enable-features=Vulkan " +
    "--enable-unsafe-swiftshader)."
  );
}

function scenarioTimeoutBudget(maxFrames, requiredFrames) {
  return Math.max(
    30000,
    maxFrames * 1000,
    requiredFrames * scenarioFrameBudgetMs + scenarioBudgetSlackMs,
  );
}

function disposeShell() {
  const app = webGpuApp;

  webGpuApp = null;
  activeScenario = null;
  shellDisposed = true;

  if (app !== null) {
    app.stop();
    app.initialization.context?.unconfigure?.();
    app.initialization.device?.destroy?.();
  }

  publishStatus(
    createBaseStatus({
      ok: true,
      phase: "stopped",
      message: "Persistent render shell has been stopped.",
    }),
  );

  return currentStatus;
}

async function runTransparentPressureScenario(aperture, app, run, options) {
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
  };
  const worker = createScenarioWorker(
    "/aperture/worker-modules/examples/standard-queue-phases.worker.js",
    "aperture-persistent-shell-transparent-pressure",
  );
  const maxFrames = finiteInteger(options.maxFrames, 18);
  const timeoutMs = finiteInteger(
    options.timeoutMs,
    scenarioTimeoutBudget(maxFrames, transparentPressureMinimumFrame),
  );
  const requireReadback = options.requireReadback !== false;

  return runWorkerScenario({
    aperture,
    app,
    run,
    loop,
    worker,
    initMessage: {
      type: "init",
      transparentPressure: true,
      canvas: canvasSize(),
    },
    label: "persistent-render-shell:transparent-pressure",
    maxFrames,
    timeoutMs,
    createStatus({ report, reportJson, message, typedSnapshot }) {
      return createTransparentPressureStatus({
        aperture,
        report,
        reportJson,
        message,
        typedSnapshot,
        run,
        loop,
        requireReadback,
      });
    },
    isComplete(status) {
      return (
        status.scenario.ok === true &&
        status.scenario.frameCount >= transparentPressureMinimumFrame &&
        status.scenario.proof.transparentPressure?.cameraMoved === true
      );
    },
  });
}

async function runClusteredPressureHistoryScenario(
  aperture,
  app,
  run,
  options,
) {
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    clusterPressureHistoryStatus: null,
  };
  const worker = createScenarioWorker(
    "/aperture/worker-modules/examples/clustered-lights.worker.js",
    "aperture-persistent-shell-clustered-pressure",
  );
  const maxFrames = finiteInteger(options.maxFrames, 50);
  // The cluster pressure history needs 12 OBSERVED frames before it can report
  // ready; under software rasterization each of those frames takes seconds.
  const timeoutMs = finiteInteger(
    options.timeoutMs,
    scenarioTimeoutBudget(maxFrames, clusterPressureHistoryFrameCount),
  );
  const requireReadback = options.requireReadback !== false;

  return runWorkerScenario({
    aperture,
    app,
    run,
    loop,
    worker,
    initMessage: {
      type: "init",
      canvas: canvasSize(),
      cameraFrameOffset: 0,
      clusteredCookieEnabled: true,
      clusteredSpotCookieEnabled: true,
      clusteredPointCookieEnabled: false,
      clusteredMultiCookieEnabled: false,
      clusteredAtlasCookieEnabled: true,
      clusteredShadowCookieEnabled: true,
      clusteredShadowCookieAtlasEnabled: true,
      clusteredDynamicShadowCookieAtlasEnabled: false,
      clusteredGpuCookieAtlasUpdateEnabled: false,
      clusteredShadowCacheEnabled: true,
      clusteredBufferCacheEnabled: true,
      clusteredPressureHistoryEnabled: true,
      clusteredShadowCookiePointArrayEnabled: false,
      clusteredCookieOnlyEnabled: false,
      clusteredSpotShadowAtlasEnabled: true,
      clusteredMultiSpotShadowEnabled: true,
      clusteredPackedSpotShadowArrayEnabled: false,
      clusteredPackedSpotShadowAtlasEnabled: true,
      clusteredMultiPointShadowEnabled: false,
    },
    label: "persistent-render-shell:clustered-pressure-history",
    maxFrames,
    timeoutMs,
    createStatus({ report, reportJson, message, typedSnapshot }) {
      return createClusteredPressureHistoryStatus({
        aperture,
        report,
        reportJson,
        message,
        typedSnapshot,
        run,
        loop,
        requireReadback,
      });
    },
    isComplete(status) {
      return status.scenario.ok === true;
    },
  });
}

function runWorkerScenario({
  aperture,
  app,
  run,
  loop,
  worker,
  initMessage,
  label,
  maxFrames,
  timeoutMs,
  createStatus,
  isComplete,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      finish(
        createBaseStatus({
          ok: false,
          phase: "scenario-failed",
          reason: "scenario-timeout",
          message: `Scenario '${run.id}' did not settle within ${timeoutMs} ms.`,
          scenario: {
            ...createScenarioPendingStatus(run),
            ok: false,
            phase: "timeout",
            reason: "scenario-timeout",
            message: `Scenario '${run.id}' did not settle within ${timeoutMs} ms.`,
            elapsedMs: Math.round(performance.now() - run.startedAt),
            frameCount: loop.frame,
          },
        }),
      );
    }, timeoutMs);

    const finish = (status) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      worker.terminate();
      resolve(status);
    };

    worker.addEventListener("message", (event) => {
      void handleWorkerMessage(event.data).catch((error) => {
        finish(
          createBaseStatus({
            ok: false,
            phase: "scenario-failed",
            reason: scenarioFailureReason(),
            message: scenarioFailureMessage(error),
            scenario: {
              ...createScenarioPendingStatus(run),
              ok: false,
              phase: "failed",
              reason: scenarioFailureReason(),
              message: scenarioFailureMessage(error),
              elapsedMs: Math.round(performance.now() - run.startedAt),
              frameCount: loop.frame,
            },
          }),
        );
      });
    });
    worker.addEventListener("error", (event) => {
      finish(
        createBaseStatus({
          ok: false,
          phase: "scenario-failed",
          reason: "worker-error",
          message: event.message || "The scenario worker reported an error.",
          scenario: {
            ...createScenarioPendingStatus(run),
            ok: false,
            phase: "failed",
            reason: "worker-error",
            message: event.message || "The scenario worker reported an error.",
            elapsedMs: Math.round(performance.now() - run.startedAt),
            frameCount: loop.frame,
          },
        }),
      );
    });
    worker.postMessage(initMessage);

    async function handleWorkerMessage(message) {
      if (message?.type === "ready") {
        loop.workerReady = true;
        loop.workerScene = message.scene ?? null;
        requestWorkerFrame(worker, loop);
        return;
      }

      if (message?.type === "error") {
        finish(
          createBaseStatus({
            ok: false,
            phase: "scenario-failed",
            reason: message.reason ?? "worker-error",
            message: message.message ?? "The scenario worker failed.",
            scenario: {
              ...createScenarioPendingStatus(run),
              ok: false,
              phase: "failed",
              reason: message.reason ?? "worker-error",
              message: message.message ?? "The scenario worker failed.",
              elapsedMs: Math.round(performance.now() - run.startedAt),
              frameCount: loop.frame,
            },
          }),
        );
        return;
      }

      if (message?.type !== "snapshot") {
        return;
      }

      loop.receivedSnapshots += 1;

      const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
      const frame = finiteInteger(message.frame, loop.frame);
      const report = await app.renderSnapshot(message.snapshot, {
        frame,
        clearColor,
        label,
        ...(readbackSupported ? { readbackSamples: shellReadbackSamples } : {}),
      });
      const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
      const status = createStatus({
        report,
        reportJson,
        message,
        typedSnapshot,
      });

      publishStatus(status);

      if (isComplete(status)) {
        finish(status);
        return;
      }

      if (loop.frame >= maxFrames) {
        finish(
          createBaseStatus({
            ok: false,
            phase: "scenario-failed",
            reason: "scenario-max-frames",
            message: `Scenario '${run.id}' did not become ready within ${maxFrames} frames.`,
            scenario: {
              ...status.scenario,
              ok: false,
              phase: "max-frames",
              reason: "scenario-max-frames",
              message: `Scenario '${run.id}' did not become ready within ${maxFrames} frames.`,
            },
          }),
        );
        return;
      }

      requestWorkerFrame(worker, loop);
    }
  });
}

function requestWorkerFrame(worker, loop) {
  setTimeout(() => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp: performance.now(),
    });
  }, 0);
}

function createTransparentPressureStatus({
  report,
  reportJson,
  message,
  typedSnapshot,
  run,
  loop,
  requireReadback,
}) {
  const transparentSort = report.snapshot.meshDraws
    .filter((draw) => draw.sortKey.queue === "transparent")
    .map((draw) => ({
      renderId: draw.renderId,
      materialKey: draw.sortKey.materialKey,
      viewId: draw.sortKey.viewId,
      layer: draw.sortKey.layer,
      order: draw.sortKey.order,
      depth: draw.sortKey.depth,
      stableId: draw.sortKey.stableId,
    }));
  const transparentPressure = createTransparentPressureReport({
    transparentSort,
    transparentRecordCount:
      reportJson.diagnosticsSummary?.renderQueueSortPhases?.find(
        (phase) => phase.phase === "transparent",
      )?.recordCount ?? transparentSort.length,
    expectedRecordCount: 32,
    workerStep: message.workerStep?.transparentPressure ?? null,
  });
  const readbackStatus = createReadbackStatus(reportJson.readback);
  const counts = reportJson.counts ?? {};
  const ok =
    report.ok === true &&
    (counts.diagnostics ?? 0) === 0 &&
    (requireReadback ? readbackStatus.ok === true : true) &&
    transparentPressure.ready === true &&
    transparentPressure.cameraMoved === true;
  const scenario = createScenarioStatus({
    run,
    ok,
    phase: ok ? "ready" : "running",
    frameCount: loop.frame,
    report,
    reportJson,
    readbackStatus,
    typedSnapshot,
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    proof: {
      kind: "transparent-pressure",
      transparentPressure,
      transparentSort,
      transparentSortPolicy:
        reportJson.diagnosticsSummary?.renderQueueSortPhases?.find(
          (phase) => phase.phase === "transparent",
        )?.sortPolicy ?? null,
      commandPressure: reportJson.commandPressure ?? null,
      queueStateSort:
        reportJson.diagnosticsSummary?.renderFrameQueue?.stateSort ?? null,
      renderBundles: reportJson.renderBundles ?? null,
      queuedBindGroups: {
        created: reportJson.resourceReuse?.queuedBindGroupsCreated ?? 0,
        reused: reportJson.resourceReuse?.queuedBindGroupsReused ?? 0,
        cacheSize: reportJson.resourceReuse?.queuedBindGroupCacheSize ?? 0,
      },
    },
  });

  return createBaseStatus({
    ok,
    phase: ok ? "scenario-complete" : "scenario-running",
    scenario,
    renderingBackend: "webgpu-explicit",
  });
}

function createClusteredPressureHistoryStatus({
  report,
  reportJson,
  message,
  typedSnapshot,
  run,
  loop,
  requireReadback,
}) {
  const readbackStatus = createReadbackStatus(reportJson.readback);
  const pressureHistory = updateClusterPressureHistory({
    loop,
    frame: report.snapshot.frame,
    resourceReuse: reportJson.resourceReuse,
    localLightCookies: reportJson.localLightCookies ?? null,
    readbackStatus,
    requireReadback,
  });
  // AI-18: the clustered pressure scene requests shadows/cookies on variants
  // that defer clustered sampling, which now (truthfully) reports per-frame
  // warning diagnostics instead of staying silent. Those exact codes are the
  // scene's expected steady state; anything else still blocks readiness.
  const expectedDeferredSamplingCodes = new Set([
    "webGpuApp.clusteredLocalShadowSamplingDeferred",
    "webGpuApp.clusteredLocalCookieSamplingDeferred",
  ]);
  const unexpectedDiagnostics = (reportJson.diagnostics ?? []).filter(
    (diagnostic) => !expectedDeferredSamplingCodes.has(diagnostic.code),
  );
  const ok =
    report.ok === true &&
    unexpectedDiagnostics.length === 0 &&
    (requireReadback ? readbackStatus.ok === true : true) &&
    pressureHistory.ready === true;
  const scenario = createScenarioStatus({
    run,
    ok,
    phase: ok ? "ready" : "running",
    frameCount: loop.frame,
    report,
    reportJson,
    readbackStatus,
    typedSnapshot,
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    proof: {
      kind: "clustered-pressure-history",
      clusterPressureHistoryStatus: pressureHistory,
      localLightClusters: reportJson.localLightClusters ?? null,
      localLightCookies: reportJson.localLightCookies ?? null,
      resourceReuse: {
        localLightClusterBufferWrites:
          reportJson.resourceReuse?.localLightClusterBufferWrites ?? 0,
        localLightClusterBufferWritesSkipped:
          reportJson.resourceReuse?.localLightClusterBufferWritesSkipped ?? 0,
        localLightClusterBuffersCreated:
          reportJson.resourceReuse?.localLightClusterBuffersCreated ?? 0,
        localLightClusterBuffersReused:
          reportJson.resourceReuse?.localLightClusterBuffersReused ?? 0,
        dynamicBufferWrites: reportJson.resourceReuse?.dynamicBufferWrites ?? 0,
      },
    },
  });

  return createBaseStatus({
    ok,
    phase: ok ? "scenario-complete" : "scenario-running",
    scenario,
    renderingBackend: "webgpu-explicit",
  });
}

function createScenarioStatus({
  run,
  ok,
  phase,
  frameCount,
  report,
  reportJson,
  readbackStatus,
  typedSnapshot,
  worker,
  proof,
}) {
  return {
    id: run.id,
    runId: run.runId,
    runIndex: run.runIndex,
    ok,
    phase,
    frameCount,
    elapsedMs: Math.round(performance.now() - run.startedAt),
    readbackStatus,
    webGpuWarnings: [],
    renderer: rendererStatus(),
    logicLayer: {
      producer: "fresh-ecs-extraction-worker",
      workerCreatedCount,
      workerScene: worker.scene,
      workerStep: worker.step,
      receivedSnapshots: worker.receivedSnapshots,
      transport: typedSnapshot,
    },
    proof,
    counts: reportJson.counts ?? null,
    diagnostics: reportJson.diagnostics ?? [],
    report: {
      ok: report.ok,
      frame: report.frame,
      counts: reportJson.counts ?? null,
    },
  };
}

function createScenarioPendingStatus(run) {
  return {
    id: run.id,
    runId: run.runId,
    runIndex: run.runIndex,
    ok: false,
    phase: "pending",
    frameCount: 0,
    elapsedMs: Math.round(performance.now() - run.startedAt),
    readbackStatus: { ok: false, reason: "scenario-pending" },
    webGpuWarnings: [],
    renderer: rendererStatus(),
    logicLayer: {
      producer: "fresh-ecs-extraction-worker",
      workerCreatedCount,
      receivedSnapshots: 0,
      transport: null,
    },
    proof: null,
    counts: null,
    diagnostics: [],
  };
}

function createBaseStatus({
  ok,
  phase,
  reason,
  message,
  scenario = null,
  renderingBackend = "webgpu-explicit",
}) {
  return {
    example: "persistent-render-shell",
    ok,
    phase,
    ...(reason === undefined ? {} : { reason }),
    ...(message === undefined ? {} : { message }),
    ...(renderingBackend === undefined ? {} : { renderingBackend }),
    renderer: rendererStatus(),
    scenario,
    scenarios: [...scenarioDefinitions],
    completedRuns: [...completedRuns],
  };
}

function rendererStatus() {
  return {
    instanceId: rendererInstanceId,
    appCreatedCount,
    canvasId: canvas?.id ?? null,
    canvasWidth: canvas?.width ?? 0,
    canvasHeight: canvas?.height ?? 0,
    canvasConnected: canvas?.isConnected ?? false,
    readbackSupported,
  };
}

function summarizeScenarioRun(scenario) {
  return {
    id: scenario.id,
    runId: scenario.runId,
    ok: scenario.ok,
    frameCount: scenario.frameCount,
    elapsedMs: scenario.elapsedMs,
    readbackOk: scenario.readbackStatus?.ok === true,
  };
}

function createScenarioWorker(url, name) {
  workerCreatedCount += 1;
  return new Worker(url, { name, type: "module" });
}

function createTransparentPressureReport(input) {
  const records = input.transparentSort;
  const depthEpsilon = 0.0001;
  let depthOrderInversions = 0;
  let renderOrderTieBreakCount = 0;
  let stableIdTieBreakCount = 0;

  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    const left = records[leftIndex];

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < records.length;
      rightIndex += 1
    ) {
      const right = records[rightIndex];

      if (left.viewId !== right.viewId || left.layer !== right.layer) {
        continue;
      }

      const sameDepth = Math.abs(left.depth - right.depth) <= depthEpsilon;
      const sameOrder = left.order === right.order;

      if (sameDepth && left.order !== right.order) {
        renderOrderTieBreakCount += 1;
      }

      if (sameDepth && sameOrder && left.stableId !== right.stableId) {
        stableIdTieBreakCount += 1;
      }

      if (sameOrder && left.depth + depthEpsilon < right.depth) {
        depthOrderInversions += 1;
      }
    }
  }

  const orderSignature = records
    .map(
      (record) =>
        `${record.order}:${record.depth.toFixed(4)}:${record.stableId}`,
    )
    .join("|");

  return {
    enabled: true,
    ready:
      input.transparentRecordCount >= input.expectedRecordCount &&
      depthOrderInversions === 0,
    recordCount: input.transparentRecordCount,
    expectedRecordCount: input.expectedRecordCount,
    depthOrderInversions,
    renderOrderTieBreakCount,
    stableIdTieBreakCount,
    cameraPhase: input.workerStep?.cameraPhase ?? "unknown",
    cameraX: input.workerStep?.cameraX ?? 0,
    cameraMoved: input.workerStep?.cameraMoved ?? false,
    orderSignature,
  };
}

function updateClusterPressureHistory({
  loop,
  frame,
  resourceReuse,
  localLightCookies,
  readbackStatus,
  requireReadback,
}) {
  const previous = loop.clusterPressureHistoryStatus ?? null;
  const atlasUpdate = localLightCookies?.atlasUpdate ?? null;
  const actualClusterBufferWrites =
    resourceReuse?.localLightClusterBufferWrites ?? 0;
  const avoidedClusterBufferWrites =
    resourceReuse?.localLightClusterBufferWritesSkipped ?? 0;
  const actualCookieAtlasTileUpdates = atlasUpdate?.updatedTileCount ?? 0;
  const avoidedCookieAtlasTileUpdates = atlasUpdate?.cachedTileCount ?? 0;
  const sample = {
    frame,
    cachedPath: {
      clusterBufferWrites: actualClusterBufferWrites,
      cookieAtlasTileUpdates: actualCookieAtlasTileUpdates,
    },
    noCacheBaseline: {
      clusterBufferWrites:
        actualClusterBufferWrites + avoidedClusterBufferWrites,
      cookieAtlasTileUpdates:
        actualCookieAtlasTileUpdates + avoidedCookieAtlasTileUpdates,
    },
    avoided: {
      clusterBufferWrites: avoidedClusterBufferWrites,
      cookieAtlasTileUpdates: avoidedCookieAtlasTileUpdates,
    },
  };
  const samples = [...(previous?.samples ?? []), sample].slice(
    -clusterPressureHistoryFrameCount,
  );
  const cachedPath = sumClusterPressureWork(samples, "cachedPath");
  const noCacheBaseline = sumClusterPressureWork(samples, "noCacheBaseline");
  const avoided = sumClusterPressureWork(samples, "avoided");
  const latestLuminance = averageReadbackLuminance(readbackStatus, [
    "left-bank",
    "center",
    "right-bank",
  ]);
  const previousStable = previous?.stablePixels ?? null;
  const baselineLuminance =
    previousStable?.baselineLuminance ??
    (frame >= clusterPressureStableFrameStart ? latestLuminance : null);
  const baselineFrame =
    previousStable?.baselineFrame ??
    (baselineLuminance === null ? null : frame);
  const currentDelta =
    baselineLuminance === null || latestLuminance === null
      ? 0
      : Math.abs(latestLuminance - baselineLuminance);
  const stableSampleCount =
    (previousStable?.sampleCount ?? 0) +
    (frame >= clusterPressureStableFrameStart && latestLuminance !== null
      ? 1
      : 0);
  const maxLuminanceDelta = Math.max(
    previousStable?.maxLuminanceDelta ?? 0,
    currentDelta,
  );
  const stablePixels = {
    ready:
      requireReadback === false ||
      (stableSampleCount >=
        clusterPressureHistoryFrameCount - clusterPressureStableFrameStart &&
        baselineLuminance !== null &&
        latestLuminance !== null &&
        maxLuminanceDelta <= 8),
    baselineFrame,
    baselineLuminance,
    latestLuminance,
    maxLuminanceDelta,
    sampleCount: stableSampleCount,
  };
  const cachedWork = totalClusterPressureWork(cachedPath);
  const baselineWork = totalClusterPressureWork(noCacheBaseline);
  const avoidedWork = totalClusterPressureWork(avoided);
  const status = {
    enabled: true,
    ready:
      samples.length >= clusterPressureHistoryFrameCount &&
      avoided.clusterBufferWrites > 0 &&
      baselineWork > cachedWork &&
      (requireReadback === false || stablePixels.ready),
    requiredFrames: clusterPressureHistoryFrameCount,
    observedFrames: samples.length,
    rollingWindowSize: clusterPressureHistoryFrameCount,
    baselineMode: "derived-no-cache",
    firstFrame: samples[0]?.frame ?? frame,
    lastFrame: samples[samples.length - 1]?.frame ?? frame,
    cachedPath,
    noCacheBaseline,
    avoided,
    reduction: {
      cachedWork,
      baselineWork,
      avoidedWork,
    },
    latest: sample,
    stablePixels,
    samples,
  };

  loop.clusterPressureHistoryStatus = status;

  return status;
}

function sumClusterPressureWork(samples, key) {
  return samples.reduce(
    (sum, sample) => ({
      clusterBufferWrites:
        sum.clusterBufferWrites + (sample[key]?.clusterBufferWrites ?? 0),
      cookieAtlasTileUpdates:
        sum.cookieAtlasTileUpdates + (sample[key]?.cookieAtlasTileUpdates ?? 0),
    }),
    {
      clusterBufferWrites: 0,
      cookieAtlasTileUpdates: 0,
    },
  );
}

function totalClusterPressureWork(work) {
  return work.clusterBufferWrites + work.cookieAtlasTileUpdates;
}

function createReadbackStatus(readback) {
  if (readback?.ok !== true || !Array.isArray(readback.samples)) {
    return { ok: false, reason: readback?.reason ?? "readback-unavailable" };
  }

  const clearPixel = {
    r: Math.round((clearColor[0] ?? 0) * 255),
    g: Math.round((clearColor[1] ?? 0) * 255),
    b: Math.round((clearColor[2] ?? 0) * 255),
    a: Math.round((clearColor[3] ?? 1) * 255),
  };
  const allTransparentZero = readback.samples.every(
    (sample) =>
      sample.pixel.r === 0 &&
      sample.pixel.g === 0 &&
      sample.pixel.b === 0 &&
      sample.pixel.a === 0,
  );

  if (allTransparentZero) {
    return {
      ok: false,
      reason: "transparent-zero-readback",
      samples: readback.samples.map((sample) => ({
        id: sample.id,
        pixel: sample.pixel,
      })),
    };
  }

  const distances = readback.samples.map((sample) =>
    pixelDistance(sample.pixel, clearPixel),
  );
  const maxClearDistance = Math.max(...distances, 0);
  const sampleLuminance = readback.samples.map((sample) =>
    luminance(sample.pixel),
  );

  return {
    ok: maxClearDistance > 24,
    maxClearDistance,
    luminanceRange: Math.max(...sampleLuminance) - Math.min(...sampleLuminance),
    samples: readback.samples.map((sample) => ({
      id: sample.id,
      pixel: sample.pixel,
    })),
  };
}

function averageReadbackLuminance(readbackStatus, sampleIds) {
  if (readbackStatus?.ok !== true || !Array.isArray(readbackStatus.samples)) {
    return null;
  }

  const samplesById = new Map(
    readbackStatus.samples.map((sample) => [sample.id, sample]),
  );
  const values = sampleIds
    .map((id) => samplesById.get(id))
    .filter((sample) => sample !== undefined)
    .map((sample) => luminance(sample.pixel));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pixelDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b, a.a - b.a);
}

function luminance(pixel) {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}

function registerQueuePhaseAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({
    registry,
  });
  assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "StandardQueuePhasePlane",
      width: 0.48,
      height: 0.9,
    }),
    { id: "standard-queue-phase-plane" },
  );
  assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueRed", [0.95, 0.08, 0.04, 1]),
    { id: "phase-opaque-red" },
  );
  assets.materials.standard.add(
    standardMaterial(aperture, "PhaseAlphaCutout", [0.08, 1, 0.1, 0], {
      alphaMode: "mask",
      alphaCutoff: 0.5,
    }),
    { id: "phase-alpha-cutout" },
  );
  assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueBlue", [0.08, 0.16, 0.95, 1]),
    { id: "phase-opaque-blue" },
  );
  assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentDepthBack",
      [0.02, 0.95, 0.16, 0.55],
    ),
    { id: "phase-transparent-depth-back" },
  );
  assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentDepthFront",
      [1, 0.08, 0.04, 0.55],
    ),
    { id: "phase-transparent-depth-front" },
  );
  assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentStableFirst",
      [0.02, 0.95, 0.16, 0.55],
    ),
    { id: "phase-transparent-stable-first" },
  );
  assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentStableLast",
      [1, 0.08, 0.04, 0.55],
    ),
    { id: "phase-transparent-stable-last" },
  );
  assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "StandardQueueTransparentPressurePlane",
      width: 0.68,
      height: 0.82,
    }),
    { id: "standard-queue-transparent-pressure-plane" },
  );

  for (const spec of createTransparentPressureSpecs()) {
    assets.materials.standard.add(
      transparentMaterial(aperture, spec.label, spec.color),
      { id: spec.materialId },
    );
  }
}

function registerClusteredLightAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "ClusteredLightsPanel",
      width: 5.2,
      height: 2.8,
    }),
    { id: "clustered-lights-panel" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredLightsStandard",
      baseColorFactor: new Float32Array([0.78, 0.8, 0.72, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.84,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-standard" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredLightsStandardSecondary",
      baseColorFactor: new Float32Array([0.68, 0.76, 0.88, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.84,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-standard-secondary" },
  );
  assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ClusteredPointShadowCaster",
      width: 0.52,
      height: 0.52,
      depth: 0.52,
    }),
    { id: "clustered-lights-point-shadow-caster" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredPointShadowCasterStandard",
      baseColorFactor: new Float32Array([0.95, 0.58, 0.24, 1]),
      metallicFactor: 0.04,
      roughnessFactor: 0.58,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-point-shadow-caster-standard" },
  );
  assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ClusteredSpotShadowCaster",
      width: 0.48,
      height: 0.48,
      depth: 0.48,
    }),
    { id: "clustered-lights-spot-shadow-caster" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredSpotShadowCasterStandard",
      baseColorFactor: new Float32Array([0.36, 0.86, 0.92, 1]),
      metallicFactor: 0.04,
      roughnessFactor: 0.56,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-spot-shadow-caster-standard" },
  );

  const cookieTexture = aperture.createTextureHandle(
    "clustered-lights-spot-cookie",
  );
  const secondCookieTexture = aperture.createTextureHandle(
    "clustered-lights-spot-cookie-alt",
  );
  const atlasCookieTexture = aperture.createTextureHandle(
    "clustered-lights-spot-cookie-atlas-wide",
  );
  const cookieSampler = aperture.createSamplerHandle(
    "clustered-lights-spot-cookie-linear",
  );
  const pointCookieTexture = aperture.createTextureHandle(
    "clustered-lights-point-cookie-cube",
  );
  const pointCookieSampler = aperture.createSamplerHandle(
    "clustered-lights-point-cookie-linear",
  );

  registry.register(cookieTexture);
  registry.register(secondCookieTexture);
  registry.register(atlasCookieTexture);
  registry.register(cookieSampler);
  registry.register(pointCookieTexture);
  registry.register(pointCookieSampler);
  registry.markReady(cookieTexture, createSpotCookieTextureAsset(aperture));
  registry.markReady(
    secondCookieTexture,
    createSecondSpotCookieTextureAsset(aperture),
  );
  registry.markReady(
    atlasCookieTexture,
    createAtlasSpotCookieTextureAsset(aperture),
  );
  registry.markReady(cookieSampler, createSpotCookieSamplerAsset(aperture));
  registry.markReady(
    pointCookieTexture,
    createPointCookieTextureAsset(aperture),
  );
  registry.markReady(
    pointCookieSampler,
    createSpotCookieSamplerAsset(aperture),
  );
}

function standardMaterial(aperture, label, color, renderState = {}) {
  return aperture.createStandardMaterialAsset({
    label,
    baseColorFactor: new Float32Array(color),
    emissiveFactor: [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0],
    metallicFactor: 0,
    roughnessFactor: 1,
    renderState: { cullMode: "none", ...renderState },
  });
}

function transparentMaterial(aperture, label, color) {
  return standardMaterial(aperture, label, color, {
    alphaMode: "blend",
    depth: { test: true, write: false, compare: "less" },
    blend: { preset: "alpha" },
  });
}

function createTransparentPressureSpecs() {
  const specs = [];
  const columns = [
    {
      x: -0.56,
      y: 0,
      nearColor: [1, 0.08, 0.04],
      farColor: [0.04, 0.22, 1],
    },
    {
      x: 0,
      y: 0,
      nearColor: [0.08, 1, 0.16],
      farColor: [1, 0.1, 0.75],
    },
    {
      x: 0.56,
      y: 0,
      nearColor: [0.1, 0.24, 1],
      farColor: [1, 0.78, 0.06],
    },
  ];

  for (let column = 0; column < columns.length; column += 1) {
    const columnSpec = columns[column];

    for (let layer = 0; layer < 8; layer += 1) {
      const t = layer / 7;

      specs.push({
        label: `PressureDepth${column}${layer}`,
        materialId: `pressure-depth-${column}-${layer}`,
        color: [
          mix(columnSpec.farColor[0], columnSpec.nearColor[0], t),
          mix(columnSpec.farColor[1], columnSpec.nearColor[1], t),
          mix(columnSpec.farColor[2], columnSpec.nearColor[2], t),
          0.38,
        ],
      });
    }
  }

  const renderOrderTieColors = [
    [0.04, 0.95, 0.95, 0.42],
    [1, 0.08, 0.04, 0.42],
    [0.95, 0.92, 0.08, 0.42],
    [0.92, 0.12, 1, 0.42],
  ];
  const stableTieColors = [
    [0.06, 1, 0.2, 0.42],
    [0.08, 0.3, 1, 0.42],
    [1, 0.78, 0.05, 0.42],
    [1, 0.08, 0.04, 0.42],
  ];

  for (let index = 0; index < renderOrderTieColors.length; index += 1) {
    specs.push({
      label: `PressureRenderOrderTie${index}`,
      materialId: `pressure-render-order-tie-${index}`,
      color: renderOrderTieColors[index],
    });
  }

  for (let index = 0; index < stableTieColors.length; index += 1) {
    specs.push({
      label: `PressureStableTie${index}`,
      materialId: `pressure-stable-tie-${index}`,
      color: stableTieColors[index],
    });
  }

  return specs;
}

function createSpotCookieTextureAsset(aperture) {
  const width = 8;
  const height = 8;
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const checker = (Math.floor(x / 2) + Math.floor(y / 2)) % 2;
      const stripe = x === y || x + y === width - 1;
      const value = stripe ? 255 : checker === 0 ? 24 : 230;

      bytes[index + 0] = value;
      bytes[index + 1] = value;
      bytes[index + 2] = value;
      bytes[index + 3] = 255;
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredSpotCookie",
    dimension: "2d",
    width,
    height,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes,
      bytesPerRow: width * 4,
      rowsPerImage: height,
    },
  });
}

function createSecondSpotCookieTextureAsset(aperture) {
  const width = 8;
  const height = 8;
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const ring = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const verticalStripe = x === 2 || x === 5;
      const value = ring ? 255 : verticalStripe ? 42 : 210;

      bytes[index + 0] = value;
      bytes[index + 1] = Math.max(24, Math.round(value * 0.86));
      bytes[index + 2] = Math.max(24, Math.round(value * 0.62));
      bytes[index + 3] = 255;
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredSpotCookieAlt",
    dimension: "2d",
    width,
    height,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes,
      bytesPerRow: width * 4,
      rowsPerImage: height,
    },
  });
}

function createAtlasSpotCookieTextureAsset(aperture) {
  const width = 12;
  const height = 4;
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const brightBand = x >= 3 && x <= 8;
      const edge = y === 0 || y === height - 1;
      const value = edge ? 255 : brightBand ? 44 : 220;

      bytes[index + 0] = Math.max(24, Math.round(value * 0.74));
      bytes[index + 1] = value;
      bytes[index + 2] = Math.max(24, Math.round(value * 0.9));
      bytes[index + 3] = 255;
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredSpotCookieAtlasWide",
    dimension: "2d",
    width,
    height,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes,
      bytesPerRow: width * 4,
      rowsPerImage: height,
    },
  });
}

function createPointCookieTextureAsset(aperture) {
  const faceSize = 8;
  const faceBytes = faceSize * faceSize * 4;
  const bytes = new Uint8Array(faceBytes * 6);

  for (let face = 0; face < 6; face += 1) {
    for (let y = 0; y < faceSize; y += 1) {
      for (let x = 0; x < faceSize; x += 1) {
        const index = face * faceBytes + (y * faceSize + x) * 4;
        const checker = (Math.floor(x / 2) + Math.floor(y / 2) + face) % 2;
        const negativeZFace = face === 5;
        const value = negativeZFace
          ? checker === 0
            ? 18
            : 255
          : checker === 0
            ? 160
            : 230;

        bytes[index + 0] = value;
        bytes[index + 1] = negativeZFace ? value : Math.round(value * 0.82);
        bytes[index + 2] = negativeZFace ? value : 255;
        bytes[index + 3] = 255;
      }
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredPointCookieCube",
    dimension: "cube",
    width: faceSize,
    height: faceSize,
    depthOrLayers: 6,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes,
      bytesPerRow: faceSize * 4,
      rowsPerImage: faceSize,
    },
  });
}

function createSpotCookieSamplerAsset(aperture) {
  return aperture.createSamplerAsset({
    label: "ClusteredSpotCookieLinearClamp",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  });
}

function publishStatus(status) {
  currentStatus = status;
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.phase;
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function canvasSize() {
  return {
    width: canvas?.width ?? 960,
    height: canvas?.height ?? 540,
  };
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function finiteInteger(value, fallback) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

function createRendererInstanceId() {
  if (globalThis.crypto?.randomUUID !== undefined) {
    return `renderer-${globalThis.crypto.randomUUID()}`;
  }

  return `renderer-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}
