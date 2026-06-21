import {
  clearColor,
  registerStandardTextureControlScene,
} from "./standard-texture-control-scene.js";

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
        typeof data.scenario === "string" ? data.scenario : "ready",
      );
      self.postMessage({
        type: "ready",
        scene: {
          meshKey: aperture.assetHandleKey(scene.mesh),
          scalarMaterialKey: aperture.assetHandleKey(scene.scalar),
          texturedMaterialKey: aperture.assetHandleKey(scene.textured),
          textureKey: scene.textureKey,
          samplerKey: scene.samplerKey,
          expectedFailure: scene.expectedFailure,
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

function createWorkerScene(aperture, canvasSize, scenario) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 12 },
  });
  const registered = registerStandardTextureControlScene(
    aperture,
    app.assets,
    scenario,
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.5] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: registered.lighting.ambientIntensity,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(registered.lighting.directionalTransform),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 1, 1, 1],
      intensity: registered.lighting.directionalIntensity,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.52, 0, 0] }),
    aperture.withMesh(registered.mesh),
    aperture.withMaterial(registered.scalar),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.52, 0, 0] }),
    aperture.withMesh(registered.mesh),
    aperture.withMaterial(registered.textured),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    ...registered,
    app,
  };
}

function createSnapshotMessage(workerScene, data) {
  const frame = finiteInteger(data.frame, 1);

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
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
