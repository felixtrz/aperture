import { registerSingleLightShadowAssets } from "./single-light-shadow-assets.js";

const clearColor = [0.014, 0.019, 0.026, 1];
const shadowIntent = {
  mapSize: 512,
  depthBias: 0.0001,
  normalBias: 0.01,
};

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
          cubeMeshKey: scene.assets.cubeMeshKey,
          wallMeshKey: scene.assets.wallMeshKey,
          cubeMaterialKey: scene.assets.cubeMaterialKey,
          wallMaterialKey: scene.assets.wallMaterialKey,
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
  const assets = registerSingleLightShadowAssets(aperture, app.assets, "point");

  app.spawn(
    aperture.withTransform({ translation: [0, 0.05, 5.4] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, -0.95] }),
    aperture.withMesh(assets.wallMesh),
    aperture.withMaterial(assets.wallMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, -0.02, 0.03] }),
    aperture.withMesh(assets.cubeMesh),
    aperture.withMaterial(assets.cubeMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.46, 0.5, 0.56, 1],
      intensity: 0.32,
      layerMask: 1,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [-1.35, 1.05, 2.15] }),
    aperture.withLight({
      kind: aperture.LightKind.Point,
      color: [1, 0.94, 0.82, 1],
      intensity: 48,
      range: 7,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.depthBias,
      normalBias: shadowIntent.normalBias,
      // Authored shadow strength (M4-T4): keep the demo shadow visible-but-dark
      // (the removed 0.5 MIN_VISIBILITY floor was equivalent to strength 0.5).
      strength: 0.5,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  return {
    app,
    assets,
  };
}

function createSnapshotMessage(workerScene, data) {
  const frame = finiteInteger(data.frame, 0);
  const snapshot = workerScene.app.stepAndExtract(0, frame / 60, frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      diagnostics: snapshot.diagnostics.length,
      transformDiagnostics: snapshot.diagnostics.length,
    },
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
