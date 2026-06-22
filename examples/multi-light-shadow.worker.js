const clearColor = [0.014, 0.019, 0.026, 1];
const shadowIntent = {
  mapSize: 512,
  directional: { depthBias: 0.002 },
  spot: { depthBias: 0.002 },
  point: { depthBias: 0.0001 },
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
          wallMeshKey: aperture.assetHandleKey(scene.wallMesh),
          casterMeshKeys: scene.casterMeshKeys,
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
            transformDiagnostics: snapshot.diagnostics.length,
            transforms: snapshot.transforms.length / 16,
            viewMatrices: snapshot.viewMatrices.length / 16,
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

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 24 },
  });
  const assets = registerSceneAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0.08, 5.6] }),
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
    aperture.withTransform({ translation: [-1.45, -0.1, 0.05] }),
    aperture.withMesh(assets.directionalCubeMesh),
    aperture.withMaterial(assets.directionalMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, -0.02, 0.1] }),
    aperture.withMesh(assets.spotCubeMesh),
    aperture.withMaterial(assets.spotMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.45, -0.08, 0.05] }),
    aperture.withMesh(assets.pointCubeMesh),
    aperture.withMaterial(assets.pointMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.46, 0.5, 0.56, 1],
      intensity: 0.2,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: [0, -0.258819, 0, 0.965926] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 1.45,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.directional.depthBias,
      normalBias: shadowIntent.normalBias,
      strength: 0.55,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 1.18, 2.15] }),
    aperture.withLight({
      kind: aperture.LightKind.Spot,
      color: [0.76, 0.9, 1, 1],
      intensity: 36,
      range: 7,
      innerConeAngle: 0.22,
      outerConeAngle: 0.5,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.spot.depthBias,
      normalBias: shadowIntent.normalBias,
      strength: 0.55,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.0, 1.05, 2.2] }),
    aperture.withLight({
      kind: aperture.LightKind.Point,
      color: [1, 0.9, 0.7, 1],
      intensity: 40,
      range: 7,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.point.depthBias,
      normalBias: shadowIntent.normalBias,
      strength: 0.5,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  return {
    app,
    wallMesh: assets.wallMesh,
    casterMeshKeys: {
      directional: aperture.assetHandleKey(assets.directionalCubeMesh),
      spot: aperture.assetHandleKey(assets.spotCubeMesh),
      point: aperture.assetHandleKey(assets.pointCubeMesh),
    },
  };
}

function registerSceneAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const wallMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "MultiShadowReceiverWall",
      width: 5.8,
      height: 2.8,
      depth: 0.06,
    }),
    { id: "multi-shadow-wall" },
  );
  const directionalCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DirectionalShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-directional-cube" },
  );
  const spotCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SpotShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-spot-cube" },
  );
  const pointCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PointShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-point-cube" },
  );
  const wallMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "MultiShadowReceiverStandard",
      baseColorFactor: new Float32Array([0.9, 0.94, 0.86, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.76,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-wall-standard" },
  );
  const directionalMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "DirectionalShadowCasterStandard",
      baseColorFactor: new Float32Array([0.95, 0.55, 0.34, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.45,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-directional-standard" },
  );
  const spotMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SpotShadowCasterStandard",
      baseColorFactor: new Float32Array([0.35, 0.74, 1.0, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.48,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-spot-standard" },
  );
  const pointMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PointShadowCasterStandard",
      baseColorFactor: new Float32Array([1.0, 0.8, 0.32, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.42,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-point-standard" },
  );

  return {
    wallMesh,
    directionalCubeMesh,
    spotCubeMesh,
    pointCubeMesh,
    wallMaterial,
    directionalMaterial,
    spotMaterial,
    pointMaterial,
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
