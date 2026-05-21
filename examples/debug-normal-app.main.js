import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.02, 0.025, 0.035, 1];
const expectedNormalColor = [0.5, 0.5, 1, 1];
const samplePoint = { id: "front-face-normal", x: 0.5, y: 0.5 };

const baseStatus = {
  example: "debug-normal-app",
  materialModel: "debug-normal-app-route",
  workerModel: "ecs-extraction-worker-postmessage-snapshot",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
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
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = registerDebugNormalAssets(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "debug-normal-app-failed",
      error instanceof Error
        ? error.message
        : "DebugNormal app example failed.",
    ),
  );
}

function registerDebugNormalAssets(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DebugNormalCube",
      width: 1.4,
      height: 1.4,
      depth: 1.4,
    }),
    { id: "debug-normal-cube" },
  );
  const materialAsset = aperture.createDebugNormalMaterialAsset({
    label: "DebugNormalFrontFace",
  });
  const material = assets.materials.debugNormal.add(materialAsset, {
    id: "debug-normal-material",
  });

  return { mesh, material, materialAsset };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/debug-normal-app.worker.js",
    {
      name: "aperture-debug-normal-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, scene, worker, loop, event.data);
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

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
) {
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
    label: "debug-normal-app-route",
    readbackSamples: [samplePoint],
  });

  publishStatus(
    createStatus(aperture, scene, loop, message, report, typedSnapshot),
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

function createStatus(aperture, scene, loop, message, report, typedSnapshot) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const firstDraw = report.snapshot.meshDraws[0];
  const routedResourceSet = reportJson.diagnosticsSummary?.routedResourceSet;
  const materialQueue = reportJson.diagnosticsSummary?.materialQueue;

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    clearColor: colorStatus(clearColor),
    debugNormal: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      materialLabel: scene.materialAsset.label,
      materialFamily: firstDraw?.batchKey.pipelineKey.split("|")[0] ?? null,
      pipelineKey: firstDraw?.batchKey.pipelineKey ?? null,
      expectedNormalColor: colorStatus(expectedNormalColor),
      sample: samplePoint,
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    diagnosticsSummary: reportJson.diagnosticsSummary,
    resources: {
      drawCalls: report.counts.drawCalls,
      bindGroups:
        report.resources?.resources === null ||
        report.resources?.resources === undefined
          ? 0
          : report.resources.resources.bindGroups.length,
      materialQueueFamilies: materialQueue?.byFamily ?? [],
      routedResourceFamilies: routedResourceSet?.byFamily ?? [],
      routedResourceFamilyPipelines:
        routedResourceSet?.byFamilyAndPipeline ?? [],
    },
    readback:
      report.readback === undefined
        ? { ok: false, reason: "readback-unavailable" }
        : report.readback,
    counts: report.counts,
    diagnostics: reportJson.diagnostics,
    resourceReuse: reportJson.resourceReuse,
  };
}

function colorStatus(color) {
  return { r: color[0], g: color[1], b: color[2], a: color[3] };
}

function failure(reason, message, extra = {}) {
  return {
    ...baseStatus,
    ok: false,
    reason,
    message,
    ...extra,
  };
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
