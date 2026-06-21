import { clearColor, registerSkyboxScene } from "./skybox-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The skybox worker raised an error.",
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
        data.canvas ?? { width: 960, height: 960 },
      );
      self.postMessage({
        type: "ready",
        scene: {
          textureKey: scene.textureKey,
          samplerKey: scene.samplerKey,
          cubeMeshKey: scene.cubeMeshKey,
          cubeMaterialKey: scene.cubeMaterialKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Skybox worker scene is not initialized.");
      }

      const snapshotMessage = createSnapshotMessage(aperture, scene, data);
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
    worldOptions: { entityCapacity: 6 },
  });
  const registered = registerSkyboxScene(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4.25] }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withSkybox({
      texture: registered.skyboxTexture,
      sampler: registered.skyboxSampler,
      intensity: 1,
    }),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ scale: [1.35, 1.35, 1.35] }),
    aperture.withMesh(registered.cubeMesh),
    aperture.withMaterial(registered.cubeMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return { ...registered, app, canvasSize };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const frame = Number.isInteger(data.frame) ? data.frame : 1;

  workerScene.app.step(0, frame / 60);
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      skyboxes: snapshot.skyboxes?.length ?? 0,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
