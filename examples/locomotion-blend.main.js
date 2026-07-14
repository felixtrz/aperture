import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  animationReadbackSamples as readbackSamples,
  clearColor,
  registerLocomotionMarkerAssets,
} from "./locomotion-blend-scene.js";

const params = new URLSearchParams(globalThis.location?.search ?? "");
const speed = parseNumber(params.get("speed"), 0);
const look = parseNumber(params.get("look"), 0);

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "locomotion-blend",
  speed,
  look,
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
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
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      // The renderer resolves the marker mesh + materials from sourceAssets, so
      // register the exact same assets (ids) the worker's ExtractionApp used.
      registerLocomotionMarkerAssets(aperture, sourceAssets);
      startWorkerSnapshotLoop(aperture, created.app);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "locomotion-blend-failed",
      error instanceof Error ? error.message : "Locomotion-blend failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app) {
  const worker = new Worker(
    "/worker-modules/examples/locomotion-blend.worker.js",
    { name: "aperture-locomotion-blend-simulation", type: "module" },
  );
  const loop = { workerReady: false, workerScene: null, frame: null };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure("worker-error", event.message || "Simulation worker error."),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: { width: canvas?.width ?? 960, height: canvas?.height ?? 960 },
    speed,
    look,
  });
}

async function handleWorkerMessage(aperture, app, worker, loop, message) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    worker.postMessage({ type: "frame", frame: 1 });
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(message.reason ?? "worker-error", message.message ?? "failed"),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "locomotion-blend",
    readbackSamples,
  });
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  loop.frame = {
    engineStatus: message.status,
    counts: reportJson.counts,
    renderOk: reportJson.ok,
    readback: reportJson.readback,
    diagnosticCodes: reportJson.diagnostics.map(
      (diagnostic) => diagnostic.code,
    ),
  };

  publishStatus(createStatus(loop, reportJson.diagnostics));
  worker.terminate();
}

function createStatus(loop, diagnostics) {
  const counts = loop.frame?.counts;
  const engine = loop.frame?.engineStatus;

  return {
    ...baseStatus,
    ok:
      (counts?.diagnostics ?? 1) === 0 &&
      (counts?.drawCalls ?? 0) >= 2 &&
      loop.frame?.renderOk === true &&
      engine?.pose !== undefined,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    // Engine-owned mixer state: locomotion blend weights + sampled bone pose +
    // per-lane effective weights (from the AnimationMixer N-lane API).
    animation: engine,
    extraction: {
      meshDraws: counts?.drawCalls ?? 0,
    },
    clearColor: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: 1 },
    readback: loop.frame?.readback,
    worker: { running: loop.workerReady },
    diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function parseNumber(raw, fallback) {
  const value = Number.parseFloat(raw ?? "");
  return Number.isFinite(value) ? value : fallback;
}

function failure(reason, message) {
  return { ...baseStatus, ok: false, reason, message };
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
