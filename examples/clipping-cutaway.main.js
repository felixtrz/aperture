import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  registerClippingCutawayScene,
  clippingCutawayCanvasSize,
  clippingCutawayFrameCount,
  clippingCutawaySamplePoints,
} from "./clipping-cutaway-scene.js";

// D2 example: an orthographic camera carries a world-space clip plane
// `(1, 0, 0, 0)` (keep x >= 0). The symmetric box is cut in half by the plane —
// the kept half stays opaque, the clipped half discards in the fragment shader
// and reveals the dark background. WebGPU core has no `clip_distances`, so the
// clip is a per-fragment discard driven by the per-view clip-plane uniform.

const canvas = document.querySelector("#clipping-cutaway-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "clipping-cutaway",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_CLIPPING_CUTAWAY_STOP__ = disposeActiveRuntime;

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
      "clipping-cutaway-failed",
      error instanceof Error ? error.message : "Example failed.",
    ),
  );
}

async function run(aperture, targetCanvas) {
  const sourceAssets = new aperture.AssetRegistry();
  registerClippingCutawayScene(aperture, sourceAssets);

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
    "/worker-modules/examples/clipping-cutaway.worker.js",
    { name: "aperture-clipping-cutaway", type: "module" },
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
  worker.postMessage({ type: "init", canvas: clippingCutawayCanvasSize });

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

    if (frame < clippingCutawayFrameCount) {
      worker.postMessage({ type: "frame", frame: frame + 1 });
      return;
    }

    publishStatus(createStatus(loop.report, loop.received));
    worker.terminate();
  }
}

function createStatus(report, received) {
  const meshDraws = report?.snapshot?.meshDraws ?? [];
  const pipelineKeys = meshDraws.map(
    (draw) => draw.batchKey?.pipelineKey ?? null,
  );
  // The frame loop appends the `clip` feature token to every mesh-draw pipeline
  // key when any view carries clip planes, so this proves the discard path was
  // compiled.
  const clipPipelineKey =
    pipelineKeys.find(
      (key) => typeof key === "string" && key.split("|").includes("clip"),
    ) ?? null;
  const views = report?.snapshot?.views ?? [];
  const viewClipPlaneCount = views[0]?.clipPlanes?.length ?? 0;

  return {
    ...baseStatus,
    ok: report?.ok === true && clipPipelineKey !== null,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    clipPipelineKey,
    viewClipPlaneCount,
    frames: received,
    samplePoints: clippingCutawaySamplePoints,
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
