import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  clearColor,
  readbackSamples,
  registerRectAreaLightScene,
} from "./rect-area-light-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

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
      const scene = registerRectAreaLightScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "rect-area-light-failed",
      error instanceof Error
        ? error.message
        : "Rect area light example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/rect-area-light.worker.js",
    {
      name: "aperture-rect-area-light-simulation",
      type: "module",
    },
  );
  const loop = {
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
    worker.postMessage({ type: "frame", frame: 1 });
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

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "rect-area-light-app",
    readbackSamples,
  });

  publishStatus(createStatus(aperture, app, scene, report, loop, message));
  worker.terminate();
}

function createStatus(aperture, app, scene, report, loop, message) {
  const standardResources = report.resources?.resources?.standard?.[0] ?? null;

  return {
    example: "rect-area-light",
    ok: report.ok,
    phase: report.ok ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    frame: report.frame,
    areaLight: {
      kind: "rect-area",
      width: scene.rectAreaLight.width,
      height: scene.rectAreaLight.height,
      intensity: scene.rectAreaLight.intensity,
    },
    counts: {
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      diagnostics: report.diagnostics.length,
      drawCalls: report.counts?.drawCalls ?? report.draw?.drawCalls ?? 0,
    },
    resources: {
      lightBindGroup: standardResources?.lightBindGroup === undefined ? 0 : 1,
      lightGpuBuffers:
        standardResources?.lightGpuBuffers?.lightBuffer.count ?? 0,
    },
    readback: report.readback,
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep,
    },
    transport: {
      mode: "transferable-postMessage",
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
    meshKey: aperture.assetHandleKey(scene.mesh),
    materialKey: aperture.assetHandleKey(scene.material),
    diagnostics: report.diagnostics.map((diagnostic) =>
      diagnosticToJsonValue(diagnostic),
    ),
    appDiagnostics: app.getDiagnostics(),
  };
}

function diagnosticToJsonValue(diagnostic) {
  if (diagnostic === null || typeof diagnostic !== "object") {
    return diagnostic;
  }

  return Object.fromEntries(
    Object.entries(diagnostic).filter(
      ([, value]) => typeof value !== "function",
    ),
  );
}

function failure(reason, message) {
  return {
    example: "rect-area-light",
    ok: false,
    reason,
    message,
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
