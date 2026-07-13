import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  FRAME_PLAN,
  LOD_FAR_DISTANCE,
  LOD_HYSTERESIS,
  ROCK_COUNT,
  clearColor,
  meshLodCanvasSize,
  registerMeshLodScene,
} from "./mesh-lod-scene.js";

// E2 example (three.js THREE.LOD analog): a small field of LOD'd rocks. The
// worker dollies the camera along a fixed schedule (near → inside the
// hysteresis band → far) and extracts a snapshot each frame; the LOD subsystem
// selects a level per rock in extraction and overrides the drawn mesh handle.
// The per-level draw distribution rides `report.lod.levels`. The e2e asserts it
// shifts from all-high-detail (near) to all-low-detail (far), AND that the two
// band frames — which straddle the raw threshold — report the identical
// distribution (no popping inside the hysteresis band).

const canvas = document.querySelector("#mesh-lod-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "mesh-lod",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_MESH_LOD_STOP__ = disposeActiveRuntime;

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
      "mesh-lod-failed",
      error instanceof Error ? error.message : "Example failed.",
    ),
  );
}

async function run(aperture, targetCanvas) {
  const sourceAssets = new aperture.AssetRegistry();
  registerMeshLodScene(aperture, sourceAssets);

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
  const worker = new Worker("/worker-modules/examples/mesh-lod.worker.js", {
    name: "aperture-mesh-lod",
    type: "module",
  });
  activeRuntime.worker = worker;

  const loop = { received: 0, report: null, lodByLabel: {}, labels: [] };

  worker.addEventListener("message", (event) => {
    void onMessage(event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(failure("worker-error", event.message || "Worker error."));
    worker.terminate();
  });
  worker.postMessage({ type: "init", canvas: meshLodCanvasSize });

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
    const step = message.workerStep ?? {};

    if (typeof step.label === "string") {
      loop.lodByLabel[step.label] = step.lodReport?.levels ?? null;
      loop.labels.push(step.label);
    }

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

    if (frame < FRAME_PLAN.length) {
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
  const lodDiagnostics = (report?.diagnostics ?? []).filter(
    (diagnostic) =>
      typeof diagnostic?.code === "string" && diagnostic.code.includes("lod"),
  );

  const near = loop.lodByLabel["near"] ?? null;
  const far = loop.lodByLabel["far"] ?? null;
  const bandA = loop.lodByLabel["band-a"] ?? null;
  const bandB = loop.lodByLabel["band-b"] ?? null;

  const distributionShifts =
    Array.isArray(near) &&
    Array.isArray(far) &&
    (near[0] ?? 0) > (far[0] ?? 0) &&
    (far[1] ?? 0) > (near[1] ?? 0);
  const noPopping =
    Array.isArray(bandA) &&
    Array.isArray(bandB) &&
    JSON.stringify(bandA) === JSON.stringify(bandB);

  return {
    ...baseStatus,
    ok:
      report?.ok === true &&
      distributionShifts &&
      noPopping &&
      lodDiagnostics.length === 0,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    rockCount: ROCK_COUNT,
    farDistance: LOD_FAR_DISTANCE,
    hysteresis: LOD_HYSTERESIS,
    lodByLabel: loop.lodByLabel,
    labels: loop.labels,
    distributionShifts,
    noPopping,
    counts: reportJson.counts ?? null,
    frames: loop.received,
    lodDiagnostics: lodDiagnostics.map((diagnostic) => diagnostic.code),
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
