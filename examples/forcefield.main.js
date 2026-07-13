import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  forcefieldCanvasSize,
  forcefieldFrameCount,
  forcefieldSamplePoints,
  registerForcefieldScene,
} from "./forcefield-scene.js";

// B4 example: a transparent custom WGSL material that samples the scene depth
// (renderer-owned "scene-depth" binding, read-only, post-opaque) to fade a
// soft-edge intersection "forcefield" against nearby opaque geometry. The
// opaque wall and the forcefield render through two swapchain cameras so the
// forcefield's submission attaches the depth READ-ONLY and samples the depth
// the wall wrote. The MSAA variant (forcefield-msaa.html) samples the depth as
// a multisampled attachment through the same read-only-depth submission.

const canvas = document.querySelector("#forcefield-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

// Variant: forcefield.html -> single-sample; forcefield-msaa.html -> MSAA.
const msaaVariant = window.location.pathname.includes("msaa");
const requestedMsaa = msaaVariant ? 8 : 1;

const baseStatus = {
  example: msaaVariant ? "forcefield-msaa" : "forcefield",
  msaaVariant,
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_FORCEFIELD_STOP__ = disposeActiveRuntime;

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
      "forcefield-failed",
      error instanceof Error ? error.message : "Example failed.",
    ),
  );
}

async function run(aperture, targetCanvas) {
  const sourceAssets = new aperture.AssetRegistry();
  registerForcefieldScene(aperture, sourceAssets, {
    multisampled: msaaVariant,
  });

  const created = await aperture.createWebGpuApp({
    canvas: targetCanvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    useFrameGraph: true,
    ...(requestedMsaa > 1 ? { msaa: requestedMsaa } : {}),
  });

  if (!created.ok) {
    publishStatus(failure(created.reason, created.message));
    return;
  }

  activeRuntime = { app: created.app, worker: null };
  startWorkerLoop(aperture, created.app);
}

function startWorkerLoop(aperture, app) {
  const worker = new Worker("/worker-modules/examples/forcefield.worker.js", {
    name: "aperture-forcefield",
    type: "module",
  });
  activeRuntime.worker = worker;

  const loop = { received: 0, report: null };

  worker.addEventListener("message", (event) => {
    void onMessage(event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(failure("worker-error", event.message || "Worker error."));
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: forcefieldCanvasSize,
    multisampled: msaaVariant,
  });

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

    if (frame < forcefieldFrameCount) {
      worker.postMessage({ type: "frame", frame: frame + 1 });
      return;
    }

    publishStatus(createStatus(aperture, loop.report, loop.received));
    worker.terminate();
  }
}

function createStatus(aperture, report, received) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const pipelineKeys = (report?.snapshot?.meshDraws ?? []).map(
    (draw) => draw.batchKey?.pipelineKey ?? null,
  );
  const forcefieldPipelineKey =
    pipelineKeys.find(
      (key) => typeof key === "string" && key.includes("example/forcefield"),
    ) ?? null;
  // The scene-depth custom draw renders in a post-opaque read-only-depth
  // boundary; the report counts how many ran this frame.
  const sceneDepthOverlays = report?.counts?.sceneDepthOverlays ?? 0;
  const overlayRan = sceneDepthOverlays > 0;
  const sceneDepthDiagnostics = (report?.diagnostics ?? []).filter(
    (diagnostic) =>
      typeof diagnostic?.code === "string" &&
      (diagnostic.code.includes("SceneDepth") ||
        diagnostic.code.includes("sceneDepth")),
  );

  return {
    ...baseStatus,
    ok:
      report?.ok === true &&
      forcefieldPipelineKey !== null &&
      overlayRan &&
      sceneDepthDiagnostics.length === 0,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    forcefieldPipelineKey,
    overlayRan,
    sceneDepthOverlays,
    msaa: reportJson.msaa ?? null,
    frames: received,
    samplePoints: forcefieldSamplePoints,
    sceneDepthDiagnostics: sceneDepthDiagnostics.map(
      (diagnostic) => diagnostic.code,
    ),
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
