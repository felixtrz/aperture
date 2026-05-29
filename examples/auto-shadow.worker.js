import {
  clearColor,
  createDirectionalLightRotation,
  registerCsmDirectionalShadowScene,
  shadowIntent,
} from "./csm-directional-shadow-scene.js";

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
      scene = createWorkerScene(aperture, {
        canvas: data.canvas ?? { width: 960, height: 540 },
        controls: data.controls ?? {},
      });
      self.postMessage({
        type: "ready",
        scene: {
          receiverMeshKeys: scene.assets.receiverMeshKeys,
          casterMeshKeys: scene.assets.casterMeshKeys,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const frame = finiteInteger(data.frame, 0);
      const snapshot = scene.app.stepAndExtract(0, frame / 60, frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            transforms: snapshot.transforms.length / 16,
            viewMatrices: snapshot.viewMatrices.length / 16,
            meshDraws: snapshot.meshDraws.length,
            lights: snapshot.lights.length,
            shadowRequests: snapshot.shadowRequests.length,
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

function createWorkerScene(aperture, options) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 16 },
  });
  const assets = registerCsmDirectionalShadowScene(aperture, app.assets);
  const receiverEnabled = options.controls.receiverEnabled !== false;

  app.spawn(
    aperture.withTransform({ translation: [0, 0.18, 5.4] }),
    aperture.withCamera({
      aspect: options.canvas.width / options.canvas.height,
      near: 0.1,
      far: 60,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.9, 0.02, -1.3] }),
    aperture.withMesh(assets.nearReceiverMesh),
    aperture.withMaterial(assets.nearReceiverMaterial),
    aperture.withRenderLayer(1),
    aperture.withShadowCaster(false),
    aperture.withShadowReceiver(receiverEnabled),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.15, 0.06, -6.2] }),
    aperture.withMesh(assets.farReceiverMesh),
    aperture.withMaterial(assets.farReceiverMaterial),
    aperture.withRenderLayer(1),
    aperture.withShadowCaster(false),
    aperture.withShadowReceiver(receiverEnabled),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.54, 0.26, -0.42] }),
    aperture.withMesh(assets.nearCasterMesh),
    aperture.withMaterial(assets.nearCasterMaterial),
    aperture.withRenderLayer(1),
    aperture.withShadowCaster(true),
    aperture.withShadowReceiver(false),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.6, 0.34, -5.18] }),
    aperture.withMesh(assets.farCasterMesh),
    aperture.withMaterial(assets.farCasterMaterial),
    aperture.withRenderLayer(1),
    aperture.withShadowCaster(true),
    aperture.withShadowReceiver(false),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.48, 0.52, 0.58, 1],
      intensity: 1.2,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: createDirectionalLightRotation() }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.95, 0.82, 1],
      intensity: 1.25,
      range: shadowIntent.shadowDistance,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.depthBias,
      normalBias: shadowIntent.normalBias,
      cascadeCount: shadowIntent.cascadeCount,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  return { app, assets };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
