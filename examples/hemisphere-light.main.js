import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  hemisphere,
  readbackSamples,
  registerHemisphereLightScene,
} from "./hemisphere-light-scene.js";

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
      const scene = registerHemisphereLightScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "hemisphere-light-failed",
      error instanceof Error
        ? error.message
        : "Hemisphere light example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/hemisphere-light.worker.js",
    {
      name: "aperture-hemisphere-light-simulation",
      type: "module",
    },
  );
  const loop = {
    receivedSnapshots: 0,
    requestedFrames: 0,
    workerReady: false,
    workerScene: null,
    lastReport: null,
    lastMessage: null,
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
    requestNextFrame(worker, loop);
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
    frame: message.frame ?? loop.receivedSnapshots,
    clearColor,
    label: "hemisphere-light",
    readbackSamples,
  });

  loop.lastReport = report;
  loop.lastMessage = message;

  // Warm up a few frames so the swapchain readback settles before publishing.
  if (
    (report.ok !== true || report.readback?.ok !== true) &&
    loop.requestedFrames < 30
  ) {
    requestNextFrame(worker, loop);
    return;
  }

  publishStatus(createStatus(aperture, app, scene, loop));
  worker.terminate();
}

function requestNextFrame(worker, loop) {
  loop.requestedFrames += 1;
  worker.postMessage({ type: "frame", frame: loop.requestedFrames });
}

function createStatus(aperture, app, scene, loop) {
  const report = loop.lastReport;
  const samples = report?.readback?.samples ?? [];
  const readbackOk = report?.readback?.ok === true;

  return {
    example: "hemisphere-light",
    ok: report?.ok === true && report.diagnostics.length === 0 && readbackOk,
    phase: report?.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    frame: report?.frame ?? 0,
    hemisphere: {
      kind: "hemisphere",
      skyColor: hemisphere.skyColor,
      groundColor: hemisphere.groundColor,
      intensity: hemisphere.intensity,
    },
    counts: {
      meshDraws: report?.snapshot.meshDraws.length ?? 0,
      lights: report?.snapshot.lights.length ?? 0,
      diagnostics: report?.diagnostics.length ?? 0,
      drawCalls: report?.counts?.drawCalls ?? report?.draw?.drawCalls ?? 0,
    },
    readback: {
      ok: readbackOk,
      samples: samples.map((sample) => ({
        id: sample.id,
        pixel: sample.pixel,
      })),
    },
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: loop.lastMessage?.workerStep ?? null,
    },
    meshKey: aperture.assetHandleKey(scene.mesh),
    materialKey: aperture.assetHandleKey(scene.material),
    diagnostics: (report?.diagnostics ?? []).map((diagnostic) =>
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
    example: "hemisphere-light",
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
