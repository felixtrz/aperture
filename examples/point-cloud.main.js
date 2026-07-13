import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  FRAMES,
  clearColor,
  pointCloudCanvasSize,
  pointCloudSamplePoints,
  probeSize,
} from "./point-cloud-scene.js";

// E1 example: a point-cloud viewer. The point subsystem draws each point as a
// camera-facing quad sized in world units with perspective size attenuation, so
// the NEAR white probe is a large disc and the FAR white probe is a small one.
// The e2e proves size attenuation (near point covers more pixels than far) and
// that points render at a multi-pixel size (not a 1px point).

const canvas = document.querySelector("#point-cloud-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "point-cloud",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_POINT_CLOUD_STOP__ = disposeActiveRuntime;

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
      "point-cloud-failed",
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
  const worker = new Worker("/worker-modules/examples/point-cloud.worker.js", {
    name: "aperture-point-cloud",
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
  worker.postMessage({ type: "init", canvas: pointCloudCanvasSize });

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
  const points = report?.features?.points ?? null;
  const errorDiagnostics = (report?.diagnostics ?? []).filter(
    (diagnostic) =>
      typeof diagnostic?.code === "string" &&
      diagnostic.code.startsWith("point"),
  );

  return {
    ...baseStatus,
    ok:
      report?.ok === true &&
      points?.clouds === 2 &&
      points?.drawnPoints === 7 &&
      errorDiagnostics.length === 0,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    pointReport: points,
    probeSize,
    samplePoints: pointCloudSamplePoints,
    counts: reportJson.counts ?? null,
    frames: loop.received,
    pointDiagnostics: errorDiagnostics.map((diagnostic) => diagnostic.code),
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
