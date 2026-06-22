import {
  gpuProfilerClearColor as clearColor,
  gpuProfilerGridSize as gridSize,
  gpuProfilerOffscreenSize as offscreenSize,
  gpuProfilerSceneLayerMask as sceneLayerMask,
  registerGpuProfilerAssets,
} from "./gpu-profiler-assets.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const overlayFrameElement = document.querySelector("#gpu-profiler-frame");
const overlayPassListElement = document.querySelector(
  "#gpu-profiler-pass-list",
);
const overlayPhaseFrameElement = document.querySelector(
  "#gpu-profiler-phase-frame",
);
const overlayPhaseListElement = document.querySelector(
  "#gpu-profiler-phase-list",
);
const routeParams = new URLSearchParams(location.search);
const phaseHistoryEnabled = routeParams.has("phase-history");

const timingHistory = new Map();
const phaseTimingHistory = new Map();
const expectedPhaseNames = [
  "extract",
  "collect",
  "prepare",
  "queue",
  "sort",
  "submit",
];

const baseStatus = {
  example: "gpu-profiler",
  workerModel: "ecs-extraction-worker-postmessage-snapshot",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
  profiler: {
    source: "WebGpuAppRenderReport.gpuTimings",
    requiredPassCount: 2,
    phaseHistoryEnabled,
    requiredPhaseNames: expectedPhaseNames,
  },
};

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("@aperture-engine/simulation"),
      import("@aperture-engine/render"),
      import("@aperture-engine/runtime"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      timestampQuery: true,
    });

    if (!created.ok) {
      publishStatus(
        failure("initialize-webgpu", created.reason, created.message, {
          apertureVersion: "0.0.0",
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createMainScene(aperture, created.app, sourceAssets);

      startProfilerLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "gpu-profiler",
      "gpu-profiler-failed",
      error instanceof Error ? error.message : "GPU profiler example failed.",
    ),
  );
}

function createMainScene(aperture, app, sourceAssets) {
  const scene = registerGpuProfilerAssets(aperture, sourceAssets);
  const device = app.initialization.device;
  const textureUsage = resolveTextureUsage(aperture);
  const offscreenTexture = device.createTexture({
    label: "aperture-gpu-profiler-offscreen-target",
    size: { width: offscreenSize, height: offscreenSize },
    format: app.initialization.format,
    usage:
      textureUsage.RENDER_ATTACHMENT |
      textureUsage.TEXTURE_BINDING |
      textureUsage.COPY_SRC,
  });

  sourceAssets.register(scene.renderTarget, {
    label: "GPU profiler offscreen target",
  });
  sourceAssets.markReady(
    scene.renderTarget,
    aperture.createWebGpuAppRenderTargetAsset({
      label: "GPU profiler offscreen target",
      texture: offscreenTexture,
      width: offscreenSize,
      height: offscreenSize,
      format: app.initialization.format,
    }),
  );

  return {
    ...scene,
    offscreenTexture,
    cubeCount: gridSize * gridSize,
  };
}

function startProfilerLoop(aperture, app, scene) {
  const worker = new Worker("/worker-modules/examples/gpu-profiler.worker.js", {
    name: "aperture-gpu-profiler-simulation",
    type: "module",
  });
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, scene, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker",
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        "worker",
        message.reason ?? "worker-error",
        message.message ?? "The simulation worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "gpu-profiler",
    phaseTimingSamples: message.phaseTimingSamples,
  });
  const status = createProfilerStatus({
    aperture,
    scene,
    loop,
    message,
    report,
    typedSnapshot,
  });

  publishStatus(status);
  requestWorkerFrame(worker, loop);
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
    });
  });
}

function createProfilerStatus({
  aperture,
  scene,
  loop,
  message,
  report,
  typedSnapshot,
}) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const overlay = updateTimingOverlay(
    reportJson.gpuTimings,
    message.frame ?? 0,
  );
  const phaseOverlay = updatePhaseTimingOverlay(
    reportJson.phaseTimings,
    message.frame ?? 0,
  );
  const routePhaseHistoryReady =
    !phaseHistoryEnabled ||
    (phaseOverlay.ready && phaseOverlay.changedPhaseValueCount > 0);

  return {
    ...baseStatus,
    ok: report.ok && overlay.ready && routePhaseHistoryReady,
    phase:
      overlay.ready && routePhaseHistoryReady
        ? "profiling"
        : phaseHistoryEnabled && !phaseOverlay.ready
          ? "phase-history-unavailable"
          : "timing-unavailable",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    frame: message.frame ?? 0,
    elapsedSeconds: message.animation?.elapsedSeconds ?? 0,
    scene: {
      cubeCount: scene.cubeCount,
      materialCount: scene.materials.length,
      meshKey: aperture.assetHandleKey(scene.mesh),
      renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
      layerMask: sceneLayerMask,
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    counts: {
      views: report.counts.views,
      meshDraws: report.counts.meshDraws,
      drawCalls: report.counts.drawCalls,
      diagnostics: report.counts.diagnostics,
      transformDiagnostics: message.workerStep?.transformDiagnostics ?? 0,
    },
    renderTargets: reportJson.renderTargets ?? [],
    gpuTimings: reportJson.gpuTimings ?? null,
    phaseTimings: reportJson.phaseTimings ?? null,
    overlay,
    phaseOverlay,
    routePhaseHistoryReady,
    report: reportJson,
  };
}

function updateTimingOverlay(gpuTimings, frame) {
  if (overlayFrameElement !== null) {
    overlayFrameElement.textContent = `frame ${frame}`;
  }

  const passes = Array.isArray(gpuTimings?.passes) ? gpuTimings.passes : [];
  const rows = passes.map((pass) => {
    const previous = timingHistory.get(pass.pass);
    const changed =
      previous !== undefined && previous.microseconds !== pass.microseconds;
    const sampleCount = (previous?.sampleCount ?? 0) + 1;
    const changeCount = (previous?.changeCount ?? 0) + (changed ? 1 : 0);
    const row = {
      pass: pass.pass,
      microseconds: pass.microseconds,
      formattedMicroseconds: formatMicroseconds(pass.microseconds),
      previousMicroseconds: previous?.microseconds ?? null,
      sampleCount,
      changeCount,
      changed,
    };

    timingHistory.set(pass.pass, row);
    return row;
  });

  if (overlayPassListElement !== null) {
    overlayPassListElement.replaceChildren(
      ...rows.map((row) => createTimingRowElement(row)),
    );
  }

  return {
    ready:
      gpuTimings?.ready === true &&
      gpuTimings.supported === true &&
      rows.length >= baseStatus.profiler.requiredPassCount &&
      rows.every((row) => row.microseconds > 0),
    supported: gpuTimings?.supported === true,
    passCount: rows.length,
    changedPassValueCount: rows.filter((row) => row.changeCount > 0).length,
    rows,
  };
}

function updatePhaseTimingOverlay(phaseTimings, frame) {
  if (overlayPhaseFrameElement !== null) {
    overlayPhaseFrameElement.textContent = `frame ${frame}`;
  }

  const phases = Array.isArray(phaseTimings?.phases) ? phaseTimings.phases : [];
  const rows = phases.map((phase) => {
    const previous = phaseTimingHistory.get(phase.phase);
    const latestMilliseconds = finiteNumber(phase.latestMilliseconds, 0);
    const averageMilliseconds = finiteNumber(phase.averageMilliseconds, 0);
    const sampleCount = finiteInteger(phase.sampleCount, 0);
    const changed =
      previous !== undefined &&
      previous.latestMilliseconds !== latestMilliseconds;
    const changeCount = (previous?.changeCount ?? 0) + (changed ? 1 : 0);
    const row = {
      phase: phase.phase,
      latestMilliseconds,
      averageMilliseconds,
      formattedLatestMilliseconds: formatMilliseconds(latestMilliseconds),
      formattedAverageMilliseconds: formatMilliseconds(averageMilliseconds),
      sampleCount,
      changeCount,
      changed,
    };

    phaseTimingHistory.set(phase.phase, row);
    return row;
  });

  if (overlayPhaseListElement !== null) {
    overlayPhaseListElement.replaceChildren(
      ...rows.map((row) => createPhaseTimingRowElement(row)),
    );
  }

  const phaseNames = new Set(rows.map((row) => row.phase));

  return {
    ready:
      phaseTimings?.ready === true &&
      expectedPhaseNames.every((phase) => phaseNames.has(phase)) &&
      rows.length >= expectedPhaseNames.length &&
      rows.every((row) => row.sampleCount > 0),
    phaseCount: rows.length,
    changedPhaseValueCount: rows.filter((row) => row.changeCount > 0).length,
    rows,
  };
}

function createTimingRowElement(row) {
  const item = document.createElement("li");
  const name = document.createElement("span");
  const value = document.createElement("strong");

  item.dataset.pass = row.pass;
  item.dataset.microseconds = String(row.microseconds);
  item.dataset.sampleCount = String(row.sampleCount);
  item.dataset.changeCount = String(row.changeCount);
  name.textContent = row.pass;
  value.textContent = row.formattedMicroseconds;
  item.append(name, value);

  return item;
}

function createPhaseTimingRowElement(row) {
  const item = document.createElement("li");
  const name = document.createElement("span");
  const value = document.createElement("strong");

  item.dataset.phase = row.phase;
  item.dataset.latestMilliseconds = String(row.latestMilliseconds);
  item.dataset.averageMilliseconds = String(row.averageMilliseconds);
  item.dataset.sampleCount = String(row.sampleCount);
  item.dataset.changeCount = String(row.changeCount);
  name.textContent = row.phase;
  value.textContent = `${row.formattedLatestMilliseconds} avg ${row.formattedAverageMilliseconds}`;
  item.append(name, value);

  return item;
}

function formatMicroseconds(value) {
  if (!Number.isFinite(value)) {
    return "0.000 us";
  }

  if (value < 10) {
    return `${value.toFixed(3)} us`;
  }

  if (value < 100) {
    return `${value.toFixed(2)} us`;
  }

  return `${Math.round(value)} us`;
}

function formatMilliseconds(value) {
  if (!Number.isFinite(value)) {
    return "0.000 ms";
  }

  if (value < 1) {
    return `${value.toFixed(3)} ms`;
  }

  if (value < 10) {
    return `${value.toFixed(2)} ms`;
  }

  return `${Math.round(value)} ms`;
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
}

function failure(phase, reason, message, extra = {}) {
  return {
    ...baseStatus,
    ...extra,
    ok: false,
    phase,
    reason,
    message,
  };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
