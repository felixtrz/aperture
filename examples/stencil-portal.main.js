import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  registerStencilPortalScene,
  stencilPortalCanvasSize,
  stencilPortalFrameCount,
  stencilPortalSamplePoints,
} from "./stencil-portal-scene.js";

// D1 example: a stencil MASK stamps a small centered portal region into the
// stencil buffer, then a full-view content quad is revealed ONLY where the
// stencil equals the mask reference (three.js stencilFunc "equal" recipe). The
// frame's depth attachment is automatically selected as depth24plus-stencil8
// because a material uses `renderState.stencil`.

const canvas = document.querySelector("#stencil-portal-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "stencil-portal",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_STENCIL_PORTAL_STOP__ = disposeActiveRuntime;

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
      "stencil-portal-failed",
      error instanceof Error ? error.message : "Example failed.",
    ),
  );
}

async function run(aperture, targetCanvas) {
  const sourceAssets = new aperture.AssetRegistry();
  registerStencilPortalScene(aperture, sourceAssets);

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
  startWorkerLoop(created.app);
}

function startWorkerLoop(app) {
  const worker = new Worker(
    "/worker-modules/examples/stencil-portal.worker.js",
    { name: "aperture-stencil-portal", type: "module" },
  );
  activeRuntime.worker = worker;

  const loop = { received: 0, report: null };

  worker.addEventListener("message", (event) => {
    void onMessage(event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(failure("worker-error", event.message || "Worker error."));
    worker.terminate();
  });
  worker.postMessage({ type: "init", canvas: stencilPortalCanvasSize });

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

    if (frame < stencilPortalFrameCount) {
      worker.postMessage({ type: "frame", frame: frame + 1 });
      return;
    }

    publishStatus(createStatus(loop.report, loop.received));
    worker.terminate();
  }
}

function createStatus(report, received) {
  const pipelineKeys = (report?.snapshot?.meshDraws ?? []).map(
    (draw) => draw.batchKey?.pipelineKey ?? null,
  );
  const stencilPipelineKey =
    pipelineKeys.find(
      (key) => typeof key === "string" && key.includes("stencil:"),
    ) ?? null;
  const depthAttachmentFormat = report?.depthAttachment?.format ?? null;

  return {
    ...baseStatus,
    ok: report?.ok === true && stencilPipelineKey !== null,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    stencilPipelineKey,
    depthAttachmentFormat,
    frames: received,
    samplePoints: stencilPortalSamplePoints,
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
