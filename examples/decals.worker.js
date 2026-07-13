import {
  DECAL_SHOTS,
  decalsCanvasSize,
  registerDecalsScene,
  spawnDecalShot,
  spawnDecalsSceneEntities,
} from "./decals-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The decals worker raised an error.",
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
      scene = createWorkerScene(aperture, data.canvas ?? decalsCanvasSize);
      self.postMessage({
        type: "ready",
        scene: { materialKey: scene.materialKey },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("decals worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      // Fire one bullet-hole shot per frame until every shot has been fired.
      if (frame <= DECAL_SHOTS) {
        spawnDecalShot(aperture, scene.app, scene.registered, frame - 1);
      }

      scene.app.step(0, frame / 60);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            meshDraws: snapshot.meshDraws.length,
            decals: snapshot.decals?.length ?? 0,
            decalReport: snapshot.report.decals ?? null,
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
    worldOptions: { entityCapacity: 64 },
  });
  const registered = registerDecalsScene(aperture, app.assets);
  spawnDecalsSceneEntities(aperture, app, registered, canvasSize);

  return { app, registered, materialKey: registered.wallMaterialKey };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
