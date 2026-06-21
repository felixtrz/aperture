import {
  clearColor,
  createShadowBiasLightRotation,
  registerShadowBiasScene,
  shadowBiasIntent,
} from "./shadow-bias-scene.js";

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
        depthBias: data.depthBias,
        shadowType: data.shadowType,
        caster: data.caster === true,
      });
      self.postMessage({ type: "ready" });
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
            meshDraws: snapshot.meshDraws.length,
            lights: snapshot.lights.length,
            shadowRequests: snapshot.shadowRequests.length,
            depthBias: scene.depthBias,
            normalBias: scene.normalBias,
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
    worldOptions: { entityCapacity: 8 },
  });
  const assets = registerShadowBiasScene(aperture, app.assets);

  const hasOverride =
    typeof options.depthBias === "number" && Number.isFinite(options.depthBias);
  const depthBias = hasOverride
    ? Math.max(0, options.depthBias)
    : shadowBiasIntent.depthBias;
  // Normal-offset bias scales with depth bias so bias=0 fully exposes acne and
  // a large bias detaches the self-shadow (peter-panning).
  const normalBias = hasOverride
    ? options.depthBias <= 0
      ? 0
      : shadowBiasIntent.normalBias
    : shadowBiasIntent.normalBias;
  const shadowType =
    typeof options.shadowType === "number" &&
    Number.isFinite(options.shadowType)
      ? Math.min(2, Math.max(0, Math.round(options.shadowType)))
      : 1;

  app.spawn(
    aperture.withTransform({ translation: [0, 1.1, 12] }),
    aperture.withCamera({
      aspect: options.canvas.width / options.canvas.height,
      near: 0.1,
      far: 90,
      clearColor,
      layerMask: 1,
    }),
  );
  // Grazing floor: caster + receiver, so it self-shadows at the shallow light
  // angle. bias=0 -> acne; authored bias -> clean; huge bias -> detached/bright.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(assets.floorMesh),
    aperture.withMaterial(assets.floorMaterial),
    aperture.withRenderLayer(1),
    aperture.withShadowCaster(true),
    aperture.withShadowReceiver(true),
    aperture.withVisibility(true),
  );
  if (options.caster === true) {
    // Pillar resting on the floor: its cast shadow hardens at the base contact
    // and softens with distance under PCSS (M4-T7 contact-hardening proof).
    app.spawn(
      aperture.withTransform({ translation: [0, 2.5, 1] }),
      aperture.withMesh(assets.pillarMesh),
      aperture.withMaterial(assets.pillarMaterial),
      aperture.withRenderLayer(1),
      aperture.withShadowCaster(true),
      aperture.withShadowReceiver(false),
      aperture.withVisibility(true),
    );
  }
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.4, 0.44, 0.5, 1],
      intensity: 0.8,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: createShadowBiasLightRotation() }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.96, 0.88, 1],
      intensity: 1.4,
      range: shadowBiasIntent.shadowDistance,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowBiasIntent.mapSize,
      bias: depthBias,
      normalBias,
      cascadeCount: shadowBiasIntent.cascadeCount,
      strength: 0.85,
      shadowType,
      filterRadius: 3,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  return { app, assets, depthBias, normalBias };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
