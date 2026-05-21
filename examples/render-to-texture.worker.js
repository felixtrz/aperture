import {
  renderToTextureOffscreenClearColor as offscreenClearColor,
  registerRenderToTextureAssets,
} from "./render-to-texture-assets.js";

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
          renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const assets = registerRenderToTextureAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3] }),
    aperture.withCamera({
      aspect: 1,
      near: 0.1,
      far: 100,
      priority: 0,
      layerMask: 1,
      clearColor: offscreenClearColor,
      renderTargetId: aperture.assetHandleKey(assets.renderTarget),
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    app,
    mesh: assets.mesh,
    material: assets.material,
    renderTarget: assets.renderTarget,
    canvas: canvasSize,
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
