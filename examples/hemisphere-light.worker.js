import {
  hemisphere,
  registerHemisphereLightScene,
} from "./hemisphere-light-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The simulation worker raised an error.",
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
          meshKey: aperture.assetHandleKey(scene.mesh),
          materialKey: aperture.assetHandleKey(scene.material),
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      scene.app.step(0, 0);
      const frame = data.frame ?? 1;
      const snapshot = scene.app.extract(frame);
      const snapshotMessage = {
        type: "snapshot",
        frame,
        snapshot,
        workerStep: {
          transforms: snapshot.transforms.length / 16,
          meshDraws: snapshot.meshDraws.length,
          lights: snapshot.lights.length,
          diagnostics: snapshot.diagnostics.length,
        },
      };
      self.postMessage(
        snapshotMessage,
        aperture.renderSnapshotTransferList(snapshotMessage.snapshot),
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
  const registered = registerHemisphereLightScene(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.9] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [0.02, 0.025, 0.035, 1],
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(registered.mesh),
    aperture.withMaterial(registered.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  // The hemisphere light: sky color up, ground color down. Needs no transform.
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Hemisphere,
      color: hemisphere.skyColor,
      groundColor: hemisphere.groundColor,
      intensity: hemisphere.intensity,
      layerMask: 1,
    }),
  );

  return { ...registered, app };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
