import {
  registerAppDiagnosticScene,
  spawnAppDiagnosticScene,
} from "./app-diagnostics-scene.js";

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The app diagnostics worker raised an error.",
    location: {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    },
  });
  event.preventDefault();
});

self.addEventListener("unhandledrejection", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-unhandled-rejection",
    message: messageFromError(event.reason),
  });
  event.preventDefault();
});

self.onmessage = (message) => {
  void handleMessage(message.data);
};

async function handleMessage(data) {
  if (data?.type !== "run-scenario") {
    return;
  }

  try {
    const aperture = await loadAperture();
    const scene = createWorkerScene(
      aperture,
      typeof data.scenario === "string" ? data.scenario : "mixed-materials",
      data.canvas ?? { width: 960, height: 540 },
    );

    scene.app.step(0, 0);

    const snapshot = scene.app.extract(scene.frame);
    const snapshotMessage = {
      type: "snapshot",
      frame: scene.frame,
      snapshot,
      workerStep: {
        transforms: snapshot.transforms.length / 16,
        viewMatrices: snapshot.viewMatrices.length / 16,
        meshDraws: snapshot.meshDraws.length,
        diagnostics: snapshot.diagnostics.length,
      },
    };

    self.postMessage(
      snapshotMessage,
      aperture.renderSnapshotTransferList(snapshotMessage.snapshot),
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      reason: "worker-frame-failed",
      message: messageFromError(error),
    });
  }
}

function loadAperture() {
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(aperture, scenario, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 10 },
  });
  const registered = registerAppDiagnosticScene(aperture, app.assets, scenario);

  spawnAppDiagnosticScene(aperture, app, registered, canvasSize);

  return {
    ...registered,
    app,
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
