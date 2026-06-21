import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  physicsJointsClearColor,
  physicsJointsFixedSteps,
  physicsJointsReadbackSamples,
  createPhysicsJointsDebugLineMesh,
  registerPhysicsJointsScene,
} from "./physics-joints-scene.js";

const canvas = document.querySelector("#aperture-canvas");

const baseStatus = {
  example: "physics-joints",
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
      const scene = registerPhysicsJointsScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, sourceAssets, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "physics-joints-failed",
      error instanceof Error ? error.message : "Physics joints example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, sourceAssets, scene) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/physics-joints.worker.js",
    {
      name: "aperture-physics-joints-simulation",
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
      steps: physicsJointsFixedSteps,
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
    createPhysicsJointsDebugLineMesh(
      aperture,
      message.debugGeometry?.lines ?? [],
    ),
  );

  const { report, reportJson } = await renderPhysicsJointsSnapshot(
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

  publishStatus(createPhysicsJointsStatus(scene, loop, message.physics));
  worker.terminate();
}

async function renderPhysicsJointsSnapshot(aperture, app, message) {
  const options = {
    frame: message.frame ?? 1,
    clearColor: physicsJointsClearColor,
    label: "physics-joints",
    readbackSamples: physicsJointsReadbackSamples,
  };
  const firstReport = await app.renderSnapshot(message.snapshot, options);
  const firstJson = aperture.webGpuAppRenderReportToJsonValue(firstReport);

  if (!isTransparentBlackReadback(firstJson.readback)) {
    return { report: firstReport, reportJson: firstJson };
  }

  await nextAnimationFrame();

  const retryReport = await app.renderSnapshot(message.snapshot, options);

  return {
    report: retryReport,
    reportJson: aperture.webGpuAppRenderReportToJsonValue(retryReport),
  };
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

function createPhysicsJointsStatus(scene, loop, physics) {
  const frame = loop.frame;
  const meshDraws = frame?.counts?.meshDraws ?? 0;

  return {
    ...baseStatus,
    ok:
      physics?.hinge?.passed === true &&
      physics?.prismatic?.passed === true &&
      physics?.jointCount >= 2 &&
      physics?.fixedStepsRun >= physicsJointsFixedSteps &&
      physics?.debug?.rendered === true &&
      physics?.debug?.jointFrameLineCount >= 4 &&
      meshDraws >= 8 &&
      frame?.counts?.diagnostics === 0,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    physics,
    assets: {
      meshKey: scene.meshKey,
      materialKeys: scene.materialKeys,
      readbackSamples: physicsJointsReadbackSamples,
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
