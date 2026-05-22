import {
  clearColor,
  createOutdoorDirectionalLightRotation,
  outdoorAreaLight,
  outdoorShadowIntent,
  registerOutdoorSceneAssets,
} from "./outdoor-scene-scene.js";

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
        canvas: data.canvas ?? { width: 1280, height: 720 },
        areaLightEnabled: data.areaLightEnabled !== false,
      });
      self.postMessage({
        type: "ready",
        scene: {
          receiverMeshKeys: scene.assets.receiverMeshKeys,
          casterMeshKeys: scene.assets.casterMeshKeys,
          areaLight: scene.areaLight,
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(aperture, options) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 16 },
  });
  const assets = registerOutdoorSceneAssets(aperture, app.assets);
  const aspect = options.canvas.width / options.canvas.height;

  app.spawn(
    aperture.withTransform({ translation: [0, 0.22, 5.9] }),
    aperture.withCamera({
      aspect,
      near: 0.1,
      far: 70,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.82, 0.0, -1.15] }),
    aperture.withMesh(assets.nearReceiverMesh),
    aperture.withMaterial(assets.nearReceiverMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.32, 0.03, -6.15] }),
    aperture.withMesh(assets.farReceiverMesh),
    aperture.withMaterial(assets.farReceiverMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [-2.12, 0.08, -2.05] }),
    aperture.withMesh(assets.windowReceiverMesh),
    aperture.withMaterial(assets.windowReceiverMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.48, 0.34, -0.28] }),
    aperture.withMesh(assets.nearCasterMesh),
    aperture.withMaterial(assets.nearCasterMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.64, 0.46, -5.12] }),
    aperture.withMesh(assets.farCasterMesh),
    aperture.withMaterial(assets.farCasterMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.42, 0.48, 0.56, 1],
      intensity: 0.72,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      rotation: createOutdoorDirectionalLightRotation(),
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.78, 1],
      intensity: 1.18,
      range: outdoorShadowIntent.shadowDistance,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: outdoorShadowIntent.mapSize,
      bias: outdoorShadowIntent.depthBias,
      normalBias: outdoorShadowIntent.normalBias,
      cascadeCount: outdoorShadowIntent.cascadeCount,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  if (options.areaLightEnabled) {
    app.spawn(
      aperture.withTransform({ translation: [-2.12, 0.18, -0.86] }),
      aperture.withLight({
        kind: aperture.LightKind.RectArea,
        color: [1, 0.78, 0.42, 1],
        intensity: outdoorAreaLight.intensity,
        width: outdoorAreaLight.width,
        height: outdoorAreaLight.height,
        layerMask: 1,
      }),
    );
  }

  return {
    app,
    assets,
    areaLight: {
      enabled: options.areaLightEnabled,
      kind: aperture.LightKind.RectArea,
      width: outdoorAreaLight.width,
      height: outdoorAreaLight.height,
      intensity: outdoorAreaLight.intensity,
    },
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
