import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  morphReadbackSamples as readbackSamples,
  registerMorphTargetScene,
} from "./morph-targets-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const morphTargetWeight = parseWeight(
  new URLSearchParams(globalThis.location?.search ?? "").get("w2"),
);

const baseStatus = {
  example: "morph-targets",
  morphTargetWeight,
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
      // The renderer resolves the morphed draw's mesh + material from
      // sourceAssets, so register the same scene the worker builds.
      registerMorphTargetScene(aperture, sourceAssets);
      startWorkerSnapshotLoop(aperture, created.app);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "morph-targets-failed",
      error instanceof Error ? error.message : "Morph-targets example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/morph-targets.worker.js",
    {
      name: "aperture-morph-targets-simulation",
      type: "module",
    },
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
    morphTargetWeight,
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
    label: "morph-targets",
    readbackSamples,
  });
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  loop.frame = {
    workerStep: message.workerStep,
    counts: reportJson.counts,
    renderOk: reportJson.ok,
    readback: reportJson.readback,
    pipelineKeys: report.snapshot.meshDraws.map(
      (draw) => draw.batchKey.pipelineKey,
    ),
    diagnosticCodes: reportJson.diagnostics.map(
      (diagnostic) => diagnostic.code,
    ),
  };

  publishStatus(createMorphStatus(loop, reportJson.diagnostics));
  worker.terminate();
}

function createMorphStatus(loop, diagnostics) {
  const counts = loop.frame?.counts;
  const pipelineKeys = loop.frame?.pipelineKeys ?? [];

  return {
    ...baseStatus,
    ok:
      counts?.meshDraws === 1 &&
      counts?.diagnostics === 0 &&
      (loop.frame?.workerStep?.morphedDraws ?? 0) === 1 &&
      (loop.frame?.workerStep?.morphTargetCount ?? 0) === 3 &&
      pipelineKeys.some((key) => key.split("|").includes("morphed")),
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      meshDraws: loop.frame?.workerStep?.meshDraws ?? 0,
      morphedDraws: loop.frame?.workerStep?.morphedDraws ?? 0,
      morphTargetCount: loop.frame?.workerStep?.morphTargetCount ?? 0,
    },
    clearColor: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: 1 },
    readback: loop.frame?.readback,
    worker: { running: loop.workerReady, scene: loop.workerScene },
    diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function parseWeight(raw) {
  const value = Number.parseFloat(raw ?? "");
  return Number.isFinite(value) ? value : 0;
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
