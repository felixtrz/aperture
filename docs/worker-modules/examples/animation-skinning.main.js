import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  animationReadbackSamples as readbackSamples,
  clearColor,
  registerAnimationSkinningRenderAssets,
} from "./animation-skinning-scene.js";

const params = new URLSearchParams(globalThis.location?.search ?? "");
const animationTime = parseNumber(params.get("t"), 0);
const morph = parseNumber(params.get("morph"), 1);

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "animation-skinning",
  animationTime,
  morph,
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

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
      // The renderer resolves the imported mesh + material from sourceAssets;
      // import the same GLB bytes the worker loads, under the same key prefix.
      registerAnimationSkinningRenderAssets(aperture, sourceAssets);
      startWorkerSnapshotLoop(aperture, created.app);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "animation-skinning-failed",
      error instanceof Error ? error.message : "Animation-skinning failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/animation-skinning.worker.js",
    { name: "aperture-animation-skinning-simulation", type: "module" },
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
    animationTime,
    morph,
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
    label: "animation-skinning",
    readbackSamples,
  });
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  loop.frame = {
    workerStep: message.workerStep,
    engineStatus: message.status,
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

  publishStatus(createStatus(loop, reportJson.diagnostics));
  worker.terminate();
}

function createStatus(loop, diagnostics) {
  const counts = loop.frame?.counts;
  const engine = loop.frame?.engineStatus;
  const workerStep = loop.frame?.workerStep;
  const pipelineKeys = loop.frame?.pipelineKeys ?? [];

  return {
    ...baseStatus,
    ok:
      (counts?.diagnostics ?? 1) === 0 &&
      (counts?.drawCalls ?? 0) >= 1 &&
      engine?.activeClip === "Bend" &&
      engine?.jointCount === 2 &&
      engine?.morphTargetCount === 3 &&
      (workerStep?.morphedDraws ?? 0) >= 1 &&
      (workerStep?.skinnedDraws ?? 0) >= 1 &&
      pipelineKeys.some((key) => key.split("|").includes("morphed")) &&
      pipelineKeys.some((key) => key.split("|").includes("skinned")),
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    // Engine-owned animation state (from spawn.animation, not a hand-rolled sampler).
    animation: engine,
    extraction: {
      meshDraws: workerStep?.meshDraws ?? 0,
      morphedDraws: workerStep?.morphedDraws ?? 0,
      skinnedDraws: workerStep?.skinnedDraws ?? 0,
      bones: workerStep?.bones ?? 0,
      morphTargetCount: workerStep?.morphTargetCount ?? 0,
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
