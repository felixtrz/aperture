import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  DECAL_CAPACITY,
  DECAL_SHOTS,
  clearColor,
  decalsCanvasSize,
  decalsSamplePoints,
  registerDecalsScene,
} from "./decals-scene.js";

// D4 example (advanced-audit scenario #17): FPS-style bullet-hole decals
// accumulating on a wall, capped at DECAL_CAPACITY with oldest-first eviction.
// The decal subsystem depth-biases each projected quad onto the opaque wall
// (no z-fighting) and draws them in the post-opaque transparent phase. The live
// count grows to the cap then plateaus while `evicted` climbs — the cap +
// eviction policy is asserted straight from the per-frame report.

const canvas = document.querySelector("#decals-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "decals",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_DECALS_STOP__ = disposeActiveRuntime;

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
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    await run(aperture, canvas);
  }
} catch (error) {
  publishStatus(
    failure(
      "decals-failed",
      error instanceof Error ? error.message : "Example failed.",
    ),
  );
}

async function run(aperture, targetCanvas) {
  const sourceAssets = new aperture.AssetRegistry();
  registerDecalsScene(aperture, sourceAssets);

  const created = await aperture.createWebGpuApp({
    canvas: targetCanvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    useFrameGraph: true,
  });

  if (!created.ok) {
    publishStatus(failure(created.reason, created.message));
    return;
  }

  activeRuntime = { app: created.app, worker: null };
  startWorkerLoop(aperture, created.app);
}

function startWorkerLoop(aperture, app) {
  const worker = new Worker("/worker-modules/examples/decals.worker.js", {
    name: "aperture-decals",
    type: "module",
  });
  activeRuntime.worker = worker;

  const loop = {
    received: 0,
    report: null,
    liveHistory: [],
    evictedHistory: [],
  };

  worker.addEventListener("message", (event) => {
    void onMessage(event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(failure("worker-error", event.message || "Worker error."));
    worker.terminate();
  });
  worker.postMessage({ type: "init", canvas: decalsCanvasSize });

  async function onMessage(message) {
    if (message?.type === "ready") {
      worker.postMessage({ type: "frame", frame: 1 });
      return;
    }
    if (message?.type === "error") {
      publishStatus(failure(message.reason ?? "worker-error", message.message));
      worker.terminate();
      return;
    }
    if (message?.type !== "snapshot") {
      return;
    }

    loop.received += 1;
    const frame = message.frame ?? 1;
    try {
      loop.report = await app.renderSnapshot(message.snapshot, {
        frame,
        clearColor,
        label: baseStatus.example,
      });
    } catch (error) {
      publishStatus(
        failure(
          "render-failed",
          error instanceof Error ? error.message : String(error),
        ),
      );
      worker.terminate();
      return;
    }

    const decals = loop.report?.features?.decals ?? null;
    loop.liveHistory.push(decals?.live ?? 0);
    loop.evictedHistory.push(decals?.evicted ?? 0);

    if (frame < DECAL_SHOTS) {
      worker.postMessage({ type: "frame", frame: frame + 1 });
      return;
    }

    publishStatus(createStatus(aperture, loop));
    worker.terminate();
  }
}

function createStatus(aperture, loop) {
  const report = loop.report;
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const decals = report?.features?.decals ?? null;
  const errorDiagnostics = (report?.diagnostics ?? []).filter(
    (diagnostic) =>
      typeof diagnostic?.code === "string" &&
      diagnostic.code.startsWith("decal"),
  );

  const cappedLive = decals?.live === DECAL_CAPACITY;
  const evicted = decals?.evicted ?? 0;
  const submitted = decals?.submitted ?? 0;

  return {
    ...baseStatus,
    ok:
      report?.ok === true &&
      cappedLive &&
      evicted > 0 &&
      submitted === DECAL_SHOTS &&
      errorDiagnostics.length === 0,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    decalReport: decals,
    capacity: DECAL_CAPACITY,
    shots: DECAL_SHOTS,
    liveHistory: loop.liveHistory,
    evictedHistory: loop.evictedHistory,
    counts: reportJson.counts ?? null,
    frames: loop.received,
    samplePoints: decalsSamplePoints,
    decalDiagnostics: errorDiagnostics.map((diagnostic) => diagnostic.code),
    diagnostics: report?.diagnostics?.length ?? 0,
  };
}

function disposeActiveRuntime() {
  activeRuntime?.app?.stop?.();
  activeRuntime?.worker?.terminate?.();
  activeRuntime = null;
}

function failure(reason, message) {
  return { ...baseStatus, ok: false, phase: "failed", reason, message };
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
