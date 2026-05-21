const clearColor = [0.015, 0.025, 0.035, 1];
const spinAxis = [0.35, 1, 0.2];
const spinRadiansPerSecond = 3;

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
          materialKind: scene.materialAsset.kind,
          environmentMapKey: aperture.assetHandleKey(scene.environmentMap),
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 16 },
  });
  const assets = registerSceneAssets(aperture, app.assets);
  const environmentMap = aperture.createEnvironmentMapHandle(
    "spinning-cube-pisa-studio",
  );

  app.assets.register(environmentMap, {
    label: "Spinning cube Pisa HDR studio IBL",
  });
  app.assets.markReady(environmentMap, {
    label: "Spinning cube Pisa HDR studio IBL",
    diffuseResourceKey: "spinning-cube-pisa-studio/diffuse",
    specularResourceKey: "spinning-cube-pisa-studio/specular-proof",
  });
  app.registerSystem(aperture.SpinSystem);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withSpin({
      radiansPerSecond: spinRadiansPerSecond,
      axis: spinAxis,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [-1.15, -0.95, 0],
      scale: [0.42, 0.42, 0.42],
    }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.glossyMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({
      translation: [1.15, -0.95, 0],
      scale: [0.42, 0.42, 0.42],
    }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.roughMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.5, 0.56, 0.68, 1],
      intensity: 0.42,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 2.8,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Environment,
      color: [1, 1, 1, 1],
      intensity: 1,
      layerMask: 1,
      environmentMap,
    }),
  );

  return {
    app,
    mesh: assets.mesh,
    material: assets.material,
    materialAsset: assets.materialAsset,
    environmentMap,
    firstTimestamp: null,
    previousTimestamp: null,
  };
}

function registerSceneAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SpinningCube",
      width: 1.45,
      height: 1.45,
      depth: 1.45,
    }),
    { id: "spinning-cube" },
  );
  const materialAsset = aperture.createStandardMaterialAsset({
    label: "SpinningCubeStandard",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.82,
    roughnessFactor: 0.18,
    emissiveFactor: [0.12, 0.06, 0.025],
  });
  const material = assets.materials.standard.add(materialAsset, {
    id: "spinning-cube-standard",
  });
  const glossyMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SpinningCubeGlossyProbe",
      baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
      metallicFactor: 0.92,
      roughnessFactor: 0,
      emissiveFactor: [0.04, 0.035, 0.03],
    }),
    { id: "spinning-cube-glossy-probe" },
  );
  const roughMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SpinningCubeRoughProbe",
      baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
      metallicFactor: 0.92,
      roughnessFactor: 1,
      emissiveFactor: [0.04, 0.035, 0.03],
    }),
    { id: "spinning-cube-rough-probe" },
  );

  return { mesh, material, materialAsset, glossyMaterial, roughMaterial };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const timestamp = finiteNumber(data.timestamp, 0);

  if (workerScene.firstTimestamp === null) {
    workerScene.firstTimestamp = timestamp;
    workerScene.previousTimestamp = timestamp;
  }

  const previousTimestamp = workerScene.previousTimestamp ?? timestamp;
  const elapsedSeconds = (timestamp - workerScene.firstTimestamp) / 1000;
  const deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
  const frame = finiteInteger(data.frame, 0);

  workerScene.previousTimestamp = timestamp;

  const snapshot = workerScene.app.stepAndExtract(
    deltaSeconds,
    elapsedSeconds,
    frame,
  );

  return {
    type: "snapshot",
    frame,
    snapshot,
    animation: {
      frames: frame,
      elapsedSeconds: Number(elapsedSeconds.toFixed(4)),
      deltaSeconds: Number(deltaSeconds.toFixed(4)),
      rotationRadians: Number(
        (elapsedSeconds * spinRadiansPerSecond).toFixed(4),
      ),
      radiansPerSecond: spinRadiansPerSecond,
      spinAxis,
    },
    workerStep: {
      transformDiagnostics: snapshot.diagnostics.length,
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
    },
  };
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
