const clearColor = [0.014, 0.018, 0.025, 1];

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
          hiddenRenderId: scene.hiddenRenderId,
          visibleRenderId: scene.visibleRenderId,
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
            meshDraws: snapshot.meshDraws.length,
            queryDraws: snapshot.meshDraws.filter(
              (draw) => draw.occlusionQuery === true,
            ).length,
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
    worldOptions: { entityCapacity: 12 },
  });
  const assets = registerOcclusionAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 6] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 50,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0, 0, 0],
      scale: [1.9, 1.9, 0.18],
    }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.occluderMaterial),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(0),
    aperture.withVisibility(true),
  );
  const hidden = app.spawn(
    aperture.withTransform({
      translation: [0, 0, -0.9],
      scale: [0.72, 0.72, 0.72],
    }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.hiddenMaterial),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(1),
    aperture.withVisibility(true),
    aperture.withOcclusionQuery(),
  );
  const visible = app.spawn(
    aperture.withTransform({
      translation: [2.05, 0, -0.9],
      scale: [0.72, 0.72, 0.72],
    }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.visibleMaterial),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(1),
    aperture.withVisibility(true),
    aperture.withOcclusionQuery(),
  );

  return {
    app,
    mesh: assets.mesh,
    hiddenRenderId: aperture.createStableRenderId({
      index: hidden.index,
      generation: hidden.generation,
    }),
    visibleRenderId: aperture.createStableRenderId({
      index: visible.index,
      generation: visible.generation,
    }),
  };
}

function registerOcclusionAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OcclusionFeedbackCube",
      width: 1,
      height: 1,
      depth: 1,
    }),
    { id: "occlusion-feedback-cube" },
  );
  const occluderMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OcclusionFeedbackOccluder",
      baseColorFactor: new Float32Array([0.045, 0.052, 0.064, 1]),
    }),
    { id: "occlusion-feedback-occluder" },
  );
  const hiddenMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OcclusionFeedbackHidden",
      baseColorFactor: new Float32Array([1, 0.12, 0.36, 1]),
    }),
    { id: "occlusion-feedback-hidden" },
  );
  const visibleMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OcclusionFeedbackVisible",
      baseColorFactor: new Float32Array([0.24, 0.95, 0.46, 1]),
    }),
    { id: "occlusion-feedback-visible" },
  );

  return { mesh, occluderMaterial, hiddenMaterial, visibleMaterial };
}

function finiteInteger(value, fallback) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
