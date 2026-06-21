import {
  clearColor,
  rectAreaLight,
  registerRectAreaLightScene,
} from "./rect-area-light-scene.js";

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
          areaLight: scene.areaLight,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const snapshotMessage = createSnapshotMessage(scene, data);
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

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const registered = registerRectAreaLightScene(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.3] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
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
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.08, 0.1, 0.14, 1],
      intensity: 0.2,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0.12, 1.18] }),
    aperture.withLight({
      kind: aperture.LightKind.RectArea,
      color: [1, 0.93, 0.78, 1],
      intensity: rectAreaLight.intensity,
      width: rectAreaLight.width,
      height: rectAreaLight.height,
      layerMask: 1,
    }),
  );

  return {
    ...registered,
    app,
    areaLight: {
      kind: aperture.LightKind.RectArea,
      width: rectAreaLight.width,
      height: rectAreaLight.height,
      intensity: rectAreaLight.intensity,
    },
  };
}

function createSnapshotMessage(workerScene, data) {
  const frame = Number.isInteger(data.frame) ? data.frame : 1;

  workerScene.app.step(0, 0);
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
