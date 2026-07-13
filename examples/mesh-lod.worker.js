import {
  FRAME_PLAN,
  meshLodCanvasSize,
  moveCameraZ,
  registerMeshLodScene,
  spawnMeshLodSceneEntities,
} from "./mesh-lod-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The mesh-lod worker raised an error.",
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
      scene = createWorkerScene(aperture, data.canvas ?? meshLodCanvasSize);
      self.postMessage({
        type: "ready",
        scene: { materialKey: scene.registered.materialKey },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("mesh-lod worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;
      const plan = FRAME_PLAN[(frame - 1) % FRAME_PLAN.length];

      moveCameraZ(aperture, scene.camera, plan.z);
      scene.app.step(0, frame / 60);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            label: plan.label,
            cameraZ: plan.z,
            meshDraws: snapshot.meshDraws.length,
            lodReport: snapshot.report.lod ?? null,
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
    worldOptions: { entityCapacity: 32 },
  });
  const registered = registerMeshLodScene(aperture, app.assets);
  const camera = spawnMeshLodSceneEntities(
    aperture,
    app,
    registered,
    canvasSize,
  );

  return { app, camera, registered };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
