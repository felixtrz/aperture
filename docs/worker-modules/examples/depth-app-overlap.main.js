import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.015, 0.02, 0.03, 1];
const nearColor = [0.16, 0.9, 0.32, 1];
const farColor = [1, 0.08, 0.04, 1];
const centerSample = { id: "center", x: 0.5, y: 0.5 };

const baseStatus = {
  example: "depth-app-overlap",
  materialModel: "app-depth-inter-family",
  workerModel: "ecs-extraction-worker-postmessage-snapshot",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("/aperture/worker-modules/packages/simulation/dist/index.js"),
      import("/aperture/worker-modules/packages/render/dist/index.js"),
      import("/aperture/worker-modules/packages/runtime/dist/index.js"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("/aperture/worker-modules/packages/webgpu/dist/index.js"),
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
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = registerDepthOverlapAssets(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "depth-app-overlap-failed",
      error instanceof Error
        ? error.message
        : "Depth overlap app example failed.",
    ),
  );
}

function registerDepthOverlapAssets(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DepthOverlapCube",
      width: 1.2,
      height: 1.2,
      depth: 1.2,
    }),
    { id: "depth-overlap-cube" },
  );
  const near = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "DepthNearUnlitGreen",
      baseColorFactor: new Float32Array(nearColor),
    }),
    { id: "depth-near-unlit-green" },
  );
  const far = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "DepthFarStandardRed",
      baseColorFactor: new Float32Array(farColor),
      emissiveFactor: [farColor[0], farColor[1], farColor[2]],
      metallicFactor: 0,
      roughnessFactor: 1,
    }),
    { id: "depth-far-standard-red" },
  );

  return {
    mesh,
    near,
    far,
    expectedTopMaterial: "depth-near-unlit-green",
    expectedRejectedMaterial: "depth-far-standard-red",
    expectedTopColor: nearColor,
    expectedRejectedColor: farColor,
    sample: centerSample,
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/depth-app-overlap.worker.js",
    {
      name: "aperture-depth-overlap-simulation",
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
    label: "depth-app-overlap",
    readbackSamples: [centerSample],
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

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    clearColor: colorStatus(clearColor),
    overlap: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      nearMaterialKey: aperture.assetHandleKey(scene.near),
      farMaterialKey: aperture.assetHandleKey(scene.far),
      expectedTopMaterial: scene.expectedTopMaterial,
      expectedRejectedMaterial: scene.expectedRejectedMaterial,
      expectedTopColor: colorStatus(scene.expectedTopColor),
      expectedRejectedColor: colorStatus(scene.expectedRejectedColor),
      sample: scene.sample,
      renderOrders: { near: 0, far: 10 },
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    pipelineKeys: report.snapshot.meshDraws.map(
      (draw) => draw.batchKey.pipelineKey,
    ),
    queues: report.snapshot.meshDraws.map((draw) => draw.sortKey.queue),
    webGpuApp: {
      depthAttachment: reportJson.depthAttachment,
    },
    report: reportJson,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
    readback:
      report.readback === undefined
        ? { ok: false, reason: "readback-unavailable" }
        : report.readback,
  };
}

function colorStatus(color) {
  return { r: color[0], g: color[1], b: color[2], a: color[3] };
}

function failure(reason, message) {
  return {
    ...baseStatus,
    ok: false,
    phase: "failed",
    reason,
    message,
    renderingBackend: "webgpu-explicit",
    clearColor: colorStatus(clearColor),
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
