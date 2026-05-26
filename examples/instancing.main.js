import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.012, 0.016, 0.024, 1];
const instanceCount = 1000;
const columns = 40;
const rows = 25;

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
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      registerInstancingAssets(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "instancing-failed",
      error instanceof Error ? error.message : "Instancing example failed.",
    ),
  );
}

function registerInstancingAssets(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "InstancedBox" }),
    { id: "instanced-box" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "InstancedCyan",
      baseColorFactor: new Float32Array([0.08, 0.72, 1, 1]),
    }),
    { id: "instanced-cyan" },
  );

  return { mesh, material };
}

function startWorkerSnapshotLoop(aperture, app) {
  const worker = new Worker("/worker-modules/examples/instancing.worker.js", {
    name: "aperture-instancing-simulation",
    type: "module",
  });
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(aperture, app, worker, loop, message) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        message.reason ?? "worker-error",
        message.message ?? "The simulation worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "instancing",
  });

  publishStatus(
    statusFromReport(aperture, report, loop, message, typedSnapshot),
  );
  worker.terminate();
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
    });
  });
}

function statusFromReport(aperture, report, loop, message, typedSnapshot) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  return {
    example: "instancing",
    ok: report.ok,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: "webgpu-explicit",
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    instanceCount,
    grid: { columns, rows },
    clearColor: toRgbaObject(clearColor),
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    counts: reportJson.counts,
    indirectDraws: reportJson.indirectDraws ?? null,
    report: reportJson,
    diagnostics: reportJson.diagnostics,
  };
}

function failure(reason, message) {
  return {
    example: "instancing",
    ok: false,
    phase: "failed",
    reason,
    message,
    clearColor: toRgbaObject(clearColor),
  };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function toRgbaObject(color) {
  return {
    r: color[0] ?? 0,
    g: color[1] ?? 0,
    b: color[2] ?? 0,
    a: color[3] ?? 1,
  };
}
