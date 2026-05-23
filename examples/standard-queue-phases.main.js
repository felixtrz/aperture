import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.02, 0.025, 0.03, 1];

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
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
      const scene = registerQueuePhaseAssets(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "standard-queue-phases-failed",
      error instanceof Error
        ? error.message
        : "Standard queue phase example failed.",
    ),
  );
}

function registerQueuePhaseAssets(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "StandardQueuePhasePlane",
      width: 0.48,
      height: 0.9,
    }),
    { id: "standard-queue-phase-plane" },
  );
  const leftOpaque = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueRed", [0.95, 0.08, 0.04, 1]),
    { id: "phase-opaque-red" },
  );
  const alphaCutout = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseAlphaCutout", [0.08, 1, 0.1, 0], {
      alphaMode: "mask",
      alphaCutoff: 0.5,
    }),
    { id: "phase-alpha-cutout" },
  );
  const blueOpaque = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueBlue", [0.08, 0.16, 0.95, 1]),
    { id: "phase-opaque-blue" },
  );
  const transparentDepthBack = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentDepthBack",
      [0.02, 0.95, 0.16, 0.55],
    ),
    { id: "phase-transparent-depth-back" },
  );
  const transparentDepthFront = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentDepthFront",
      [1, 0.08, 0.04, 0.55],
    ),
    { id: "phase-transparent-depth-front" },
  );
  const transparentStableFirst = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentStableFirst",
      [0.02, 0.95, 0.16, 0.55],
    ),
    { id: "phase-transparent-stable-first" },
  );
  const transparentStableLast = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentStableLast",
      [1, 0.08, 0.04, 0.55],
    ),
    { id: "phase-transparent-stable-last" },
  );

  return {
    mesh,
    materialKeys: {
      leftOpaque: aperture.assetHandleKey(leftOpaque),
      alphaCutout: aperture.assetHandleKey(alphaCutout),
      blueOpaque: aperture.assetHandleKey(blueOpaque),
      transparentDepthBack: aperture.assetHandleKey(transparentDepthBack),
      transparentDepthFront: aperture.assetHandleKey(transparentDepthFront),
      transparentStableFirst: aperture.assetHandleKey(transparentStableFirst),
      transparentStableLast: aperture.assetHandleKey(transparentStableLast),
    },
    expectedSamples: {
      alphaCutout: [0.95, 0.08, 0.04, 1],
      transparentDepthTieBreak: [0.56, 0.28, 0.2, 1],
      transparentStableTieBreak: [0.56, 0.28, 0.2, 1],
    },
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/standard-queue-phases.worker.js",
    {
      name: "aperture-standard-queue-phases-simulation",
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
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "standard-queue-phases",
  });
  const status = statusFromReport(
    aperture,
    report,
    scene,
    loop,
    message,
    typedSnapshot,
  );

  publishStatus(status);

  if (status.ok) {
    requestWorkerFrame(worker, loop);
  } else {
    worker.terminate();
  }
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

function standardMaterial(aperture, label, color, renderState = {}) {
  return aperture.createStandardMaterialAsset({
    label,
    baseColorFactor: new Float32Array(color),
    emissiveFactor: [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0],
    metallicFactor: 0,
    roughnessFactor: 1,
    renderState: { cullMode: "none", ...renderState },
  });
}

function transparentMaterial(aperture, label, color) {
  return standardMaterial(aperture, label, color, {
    alphaMode: "blend",
    depth: { test: true, write: false, compare: "less" },
    blend: { preset: "alpha" },
  });
}

function statusFromReport(
  aperture,
  report,
  scene,
  loop,
  message,
  typedSnapshot,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const transparentSort = report.snapshot.meshDraws
    .filter((draw) => draw.sortKey.queue === "transparent")
    .map((draw) => ({
      renderId: draw.renderId,
      materialKey: draw.sortKey.materialKey,
      order: draw.sortKey.order,
      depth: draw.sortKey.depth,
      stableId: draw.sortKey.stableId,
    }));

  return {
    example: "standard-queue-phases",
    ok: report.ok,
    frame: report.frame,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    clearColor: toRgbaObject(clearColor),
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    materialKeys: scene.materialKeys,
    expectedSamples: scene.expectedSamples,
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    queues: report.snapshot.meshDraws.map((draw) => draw.sortKey.queue),
    pipelineKeys: report.snapshot.meshDraws.map(
      (draw) => draw.batchKey.pipelineKey,
    ),
    transparentSort,
    transparentSortPolicy:
      reportJson.diagnosticsSummary?.renderQueueSortPhases?.find(
        (phase) => phase.phase === "transparent",
      )?.sortPolicy ?? null,
    report: reportJson,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
  };
}

function failure(reason, message) {
  return {
    example: "standard-queue-phases",
    ok: false,
    phase: "failed",
    reason,
    message,
    clearColor: toRgbaObject(clearColor),
  };
}

function toRgbaObject(color) {
  return {
    r: color[0] ?? 0,
    g: color[1] ?? 0,
    b: color[2] ?? 0,
    a: color[3] ?? 1,
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
