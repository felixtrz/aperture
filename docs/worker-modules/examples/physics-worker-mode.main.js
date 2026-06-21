import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  physicsSettlingClearColor,
  physicsSettlingFixedSteps,
  physicsSettlingReadbackSamples,
  createPhysicsSettlingDebugLineMesh,
  registerPhysicsSettlingScene,
} from "./physics-settling-scene.js";

const canvas = document.querySelector("#aperture-canvas");

const baseStatus = {
  example: "physics-worker-mode",
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
      const scene = registerPhysicsSettlingScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, sourceAssets, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "physics-worker-mode-failed",
      error instanceof Error
        ? error.message
        : "Physics worker-mode example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, sourceAssets, scene) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/physics-settling.worker.js",
    {
      name: "aperture-physics-worker-mode-simulation",
      type: "module",
    },
  );
  const loop = {
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    frame: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      sourceAssets,
      scene,
      worker,
      loop,
      event.data,
    );
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
    physicsExecution: "physics-worker-transferable",
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  sourceAssets,
  scene,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    worker.postMessage({
      type: "frame",
      frame: 1,
      steps: physicsSettlingFixedSteps,
    });
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
  sourceAssets.markReady(
    scene.debugMesh,
    createPhysicsSettlingDebugLineMesh(
      aperture,
      message.debugGeometry?.lines ?? [],
    ),
  );

  const { report, reportJson } = await renderPhysicsWorkerModeSnapshot(
    aperture,
    app,
    message,
  );

  loop.frame = {
    snapshot: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      spriteDraws: report.snapshot.spriteDraws?.length ?? 0,
      bounds: report.snapshot.bounds.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    counts: reportJson.counts,
    readback: reportJson.readback,
    diagnosticCodes: reportJson.diagnostics.map(
      (diagnostic) => diagnostic.code,
    ),
    transport: {
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
  };

  publishStatus(createPhysicsWorkerModeStatus(scene, loop, message.physics));
  worker.terminate();
}

async function renderPhysicsWorkerModeSnapshot(aperture, app, message) {
  const options = {
    frame: message.frame ?? 1,
    clearColor: physicsSettlingClearColor,
    label: "physics-worker-mode",
    readbackSamples: physicsSettlingReadbackSamples,
  };
  let latestReport = await app.renderSnapshot(message.snapshot, options);
  let latestJson = aperture.webGpuAppRenderReportToJsonValue(latestReport);

  for (let attempt = 1; attempt < 4; attempt += 1) {
    if (!isTransparentBlackReadback(latestJson.readback)) {
      break;
    }

    await nextAnimationFrame();
    latestReport = await app.renderSnapshot(message.snapshot, options);
    latestJson = aperture.webGpuAppRenderReportToJsonValue(latestReport);
  }

  return { report: latestReport, reportJson: latestJson };
}

function isTransparentBlackReadback(readback) {
  return (
    readback?.ok === true &&
    Array.isArray(readback.samples) &&
    readback.samples.length > 0 &&
    readback.samples.every((sample) => {
      const pixel = sample.pixel ?? {};

      return pixel.r === 0 && pixel.g === 0 && pixel.b === 0 && pixel.a === 0;
    })
  );
}

function nextAnimationFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function createPhysicsWorkerModeStatus(scene, loop, physics) {
  const frame = loop.frame;
  const meshDraws = frame?.counts?.meshDraws ?? 0;
  const transport = physics?.transport ?? null;

  return {
    ...baseStatus,
    ok:
      physics?.settled === true &&
      physics?.execution === "physics-worker-transferable" &&
      physics?.fixedStepsRun >= physicsSettlingFixedSteps &&
      physics?.bodyCount >= 5 &&
      physics?.transformWrites >= 5 &&
      physics?.velocityWrites >= 4 &&
      transport?.mode === "physics-worker-transferable" &&
      transport?.transferBytes > 0 &&
      transport?.totalResultBytes >= transport?.transferBytes &&
      meshDraws >= 5 &&
      frame?.counts?.diagnostics === 0,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    physics,
    assets: {
      meshKey: scene.meshKey,
      materialKeys: scene.materialKeys,
      readbackSamples: physicsSettlingReadbackSamples,
    },
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
    },
    frame,
  };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;

  const stateElement = document.querySelector("#example-state");
  const jsonElement = document.querySelector("#example-json");

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "rendered" : "failed";
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
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
