import {
  defaultTransmissionIorConfig,
  registerTransmissionIorAssets,
  spawnTransmissionIorEntities,
} from "./transmission-ior-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The transmission-ior worker raised an error.",
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
      const config = {
        ...defaultTransmissionIorConfig(),
        ...(data.config ?? {}),
      };

      scene = createWorkerScene(
        aperture,
        data.canvas ?? { width: 960, height: 960 },
        config,
      );
      self.postMessage({
        type: "ready",
        scene: {
          sphereMeshKey: scene.registered.sphereMeshKey,
          glassMaterialKey: scene.registered.glassMaterialKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Transmission-ior worker scene is not initialized.");
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
            meshDraws: snapshot.meshDraws.length,
            lights: snapshot.lights.length,
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
    import("/aperture/worker-modules/packages/simulation/dist/index.js"),
    import("/aperture/worker-modules/packages/render/dist/index.js"),
    import("/aperture/worker-modules/packages/runtime/dist/index.js"),
  ]).then(([simulation, render, runtime]) => ({
    ...simulation,
    ...render,
    ...runtime,
  }));
  return apertureModulePromise;
}

function createWorkerScene(aperture, canvasSize, config) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 64 },
  });
  const registered = registerTransmissionIorAssets(
    aperture,
    app.assets,
    config,
  );

  spawnTransmissionIorEntities(aperture, app, registered, canvasSize, config);

  return { app, registered, config };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
