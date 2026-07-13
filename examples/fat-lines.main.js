import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  FRAMES,
  amberWidthPx,
  clearColor,
  cyanWidthPx,
  fatLinesCanvasSize,
  fatLinesSamplePoints,
} from "./fat-lines-scene.js";

// E1 example: a fat-line debug-path visualization. The line subsystem expands
// each polyline segment into a screen-space-width quad (Line2-style) with round
// caps/joins, so the cyan "staple" path is a thick pixel-width band and the
// amber line renders world-continuous dashes. The e2e proves the screen-space
// width band (a column of line pixels far wider than 1px) and a dash gap.

const canvas = document.querySelector("#fat-lines-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "fat-lines",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_FAT_LINES_STOP__ = disposeActiveRuntime;

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
      "fat-lines-failed",
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
  const worker = new Worker("/worker-modules/examples/fat-lines.worker.js", {
    name: "aperture-fat-lines",
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
  worker.postMessage({ type: "init", canvas: fatLinesCanvasSize });

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
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const lines = report?.features?.lines ?? null;
  const errorDiagnostics = (report?.diagnostics ?? []).filter(
    (diagnostic) =>
      typeof diagnostic?.code === "string" &&
      diagnostic.code.startsWith("line"),
  );

  return {
    ...baseStatus,
    ok:
      report?.ok === true &&
      lines?.lines === 2 &&
      lines?.drawnSegments === 4 &&
      errorDiagnostics.length === 0,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    lineReport: lines,
    cyanWidthPx,
    amberWidthPx,
    samplePoints: fatLinesSamplePoints,
    counts: reportJson.counts ?? null,
    frames: loop.received,
    lineDiagnostics: errorDiagnostics.map((diagnostic) => diagnostic.code),
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
