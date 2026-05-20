const meshId = "worker-cube";
const materialId = "worker-cube-debug-normal";
const clearColor = [0.018, 0.024, 0.034, 1];
const spinAxis = [0.45, 1, 0.15];
const spinRadiansPerSecond = 2.7;

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
  void handleMessage(message);
};

async function handleMessage(message) {
  const data = message.data;

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
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      self.postMessage(createSnapshotMessage(scene, data));
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
  const assets = registerWorkerCubeAssets(aperture, app.assets);

  app.registerSystem(aperture.SpinSystem);
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.2] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  const cube = app.spawn(
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

  return {
    app,
    cube,
    mesh: assets.mesh,
    material: assets.material,
    materialAsset: assets.materialAsset,
    firstTimestamp: null,
    previousTimestamp: null,
  };
}

function registerWorkerCubeAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "WorkerSnapshotCube",
      width: 1.55,
      height: 1.55,
      depth: 1.55,
    }),
    { id: meshId },
  );
  const materialAsset = aperture.createDebugNormalMaterialAsset({
    label: "WorkerSnapshotNormals",
  });
  const material = assets.materials.debugNormal.add(materialAsset, {
    id: materialId,
  });

  return { mesh, material, materialAsset };
}

function createSnapshotMessage(workerScene, data) {
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
      elapsedSeconds,
      deltaSeconds,
      rotationRadians: elapsedSeconds * spinRadiansPerSecond,
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
