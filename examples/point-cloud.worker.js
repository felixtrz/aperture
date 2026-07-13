import {
  pointCloudCanvasSize,
  spawnPointCloudScene,
} from "./point-cloud-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The point-cloud worker raised an error.",
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
  try {
    const aperture = await loadAperture();

    if (data?.type === "init") {
      scene = createWorkerScene(aperture, data.canvas ?? pointCloudCanvasSize);
      self.postMessage({ type: "ready" });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("point-cloud worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      scene.app.step(0, frame / 60);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            points: snapshot.points?.length ?? 0,
            pointReport: snapshot.report.points ?? null,
            diagnostics: snapshot.diagnostics.length,
          },
        },
        aperture.renderSnapshotTransferList(snapshot),
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      reason: "worker-frame-failed",
      message: messageFromError(error),
    });
  }
}

function loadAperture() {
  apertureModulePromise ??= Promise.all([
    import("@aperture-engine/simulation"),
    import("@aperture-engine/render"),
    import("@aperture-engine/runtime"),
  ]).then(([simulation, render, runtime]) => ({
    ...simulation,
    ...render,
    ...runtime,
  }));
  return apertureModulePromise;
}

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 16 },
  });
  spawnPointCloudScene(aperture, app, canvasSize);
  return { app };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
