const clearColor = [0.015, 0.018, 0.025, 1];
const edgeRotation = [0, 0, 0.258819, 0.965926];

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
          meshIds: ["post-effects-edge-plane", "post-effects-glow-plane"],
          materialIds: ["post-effects-white"],
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Post effects worker scene has not been initialized.");
      }

      const frame = finiteInteger(data.frame, 0);
      const snapshot = scene.app.stepAndExtract(1 / 60, frame / 60, frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            transforms: snapshot.transforms.length / 16,
            viewMatrices: snapshot.viewMatrices.length / 16,
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

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const assets = createPostEffectSceneAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.6] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [-0.55, 0.02, 0],
      rotation: edgeRotation,
    }),
    aperture.withMesh(assets.edgeMesh),
    aperture.withMaterial(assets.whiteMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0.7, 0.02, 0.03],
    }),
    aperture.withMesh(assets.glowMesh),
    aperture.withMaterial(assets.whiteMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return { app };
}

function createPostEffectSceneAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const edgeMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "PostEffectsEdgePlane",
      width: 1.5,
      height: 1.75,
    }),
    { id: "post-effects-edge-plane" },
  );
  const glowMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "PostEffectsGlowPlane",
      width: 0.34,
      height: 0.34,
    }),
    { id: "post-effects-glow-plane" },
  );
  const whiteMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "PostEffectsWhite",
      baseColorFactor: new Float32Array([1, 1, 1, 1]),
      renderState: { cullMode: "none" },
    }),
    { id: "post-effects-white" },
  );

  return { edgeMesh, glowMesh, whiteMaterial };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
