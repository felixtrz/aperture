import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  debugDrawCanvasSize,
  debugDrawSamplePoints,
  EXPECTED,
  FRAMES,
} from "./debug-draw-scene.js";

// E3 example: an immediate-mode debug-draw overlay. A single system draws an
// AABB, wireframe sphere, axes, grid, and a physics collider wireframe every
// frame via `this.debugDraw`; each primitive tessellates into world-space line
// segments rendered through the shared E1 fat-line pipeline as an overlay. The
// e2e asserts, from the frame report, that the debug-primitive counts match
// what the system drew — and (via ?debug=off) that disabling debug draw drops
// them to zero.

const canvas = document.querySelector("#debug-draw-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const debugDrawEnabled =
  new URLSearchParams(globalThis.location?.search ?? "").get("debug") !== "off";

const baseStatus = {
  example: "debug-draw",
  debugDrawEnabled,
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_DEBUG_DRAW_STOP__ = disposeActiveRuntime;

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
      "debug-draw-failed",
      error instanceof Error ? error.message : "Example failed.",
    ),
  );
}

async function run(aperture, targetCanvas) {
  const created = await aperture.createWebGpuApp({
    canvas: targetCanvas,
    simulationWorker: createNoopSimulationWorker(),
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
  const worker = new Worker("/worker-modules/examples/debug-draw.worker.js", {
    name: "aperture-debug-draw",
    type: "module",
  });
  activeRuntime.worker = worker;

  const loop = { received: 0, report: null, workerStep: null };

  worker.addEventListener("message", (event) => {
    void onMessage(event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(failure("worker-error", event.message || "Worker error."));
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: debugDrawCanvasSize,
    debugDraw: debugDrawEnabled,
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
    loop.workerStep = message.workerStep ?? null;
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

    if (frame < FRAMES) {
      worker.postMessage({ type: "frame", frame: frame + 1 });
      return;
    }

    publishStatus(createStatus(aperture, loop));
    worker.terminate();
  }
}

function createStatus(aperture, loop) {
  const report = loop.report;
  const overlay = report?.features?.["debug-draw"] ?? null;
  const workerDebug = loop.workerStep?.debugDraw ?? null;
  const errorDiagnostics = (report?.diagnostics ?? []).filter(
    (diagnostic) =>
      typeof diagnostic?.code === "string" &&
      (diagnostic.code.startsWith("debugLine") ||
        diagnostic.code.startsWith("render.debugDraw")),
  );

  const expectedSegments = debugDrawEnabled ? EXPECTED.segments : 0;
  const overlaySegments = overlay?.drawnSegments ?? 0;
  const workerSegments = workerDebug?.segments ?? 0;
  // When enabled the overlay makes the frame renderable; when disabled the scene
  // is legitimately empty (an empty snapshot renders nothing), so only require a
  // returned report — the debug-count assertions carry the proof.
  const renderOk = debugDrawEnabled ? report?.ok === true : report !== null;

  return {
    ...baseStatus,
    ok:
      renderOk &&
      overlaySegments === expectedSegments &&
      workerSegments === expectedSegments &&
      errorDiagnostics.length === 0,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    overlayReport: overlay,
    workerDebugReport: workerDebug,
    expected: {
      primitives: debugDrawEnabled ? EXPECTED.primitives : 0,
      segments: expectedSegments,
      aabb: EXPECTED.aabb,
      sphere: EXPECTED.sphere,
      axes: EXPECTED.axes,
      grid: EXPECTED.grid,
      physics: EXPECTED.physics,
    },
    samplePoints: debugDrawSamplePoints,
    frames: loop.received,
    debugDiagnostics: errorDiagnostics.map((diagnostic) => diagnostic.code),
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
