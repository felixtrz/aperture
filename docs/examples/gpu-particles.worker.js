import {
  gpuParticlesCapacity,
  gpuParticlesClearColor,
  registerGpuParticlesScene,
} from "./gpu-particles-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The GPU particles worker raised an error.",
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
      scene = createWorkerScene(
        aperture,
        data.canvas ?? { width: 960, height: 540 },
      );
      self.postMessage({
        type: "ready",
        scene: {
          effectKey: scene.effectKey,
          capacity: gpuParticlesCapacity,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("GPU particles worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      scene.app.step(1 / 60, frame / 60);

      const snapshot = scene.app.extract(frame);
      const message = {
        type: "snapshot",
        frame,
        clearColor: gpuParticlesClearColor,
        snapshot,
        workerStep: {
          views: snapshot.views.length,
          meshDraws: snapshot.meshDraws.length,
          particleEmitters: snapshot.particleEmitters?.length ?? 0,
          diagnostics: snapshot.diagnostics.length,
        },
      };

      self.postMessage(
        message,
        aperture.renderSnapshotTransferList(message.snapshot),
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
    worldOptions: { entityCapacity: 8 },
  });
  const registered = registerGpuParticlesScene(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 5.25] }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      fovYDegrees: 55,
      near: 0.1,
      far: 100,
      clearColor: gpuParticlesClearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withParticleEmitter({
      effect: registered.effect,
      capacity: gpuParticlesCapacity,
      seed: 1337,
      resetEpoch: 0,
      timeScale: 1,
      simulationSpace: aperture.ParticleSimulationSpace.World,
      boundsRadius: 2.2,
    }),
  );

  return {
    ...registered,
    app,
    canvasSize,
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
