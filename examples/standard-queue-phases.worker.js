const clearColor = [0.02, 0.025, 0.03, 1];

let apertureModulePromise = null;
let scene = null;
let firstTimestamp = null;
let previousTimestamp = null;

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
          materialKeys: scene.materialKeys,
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
    worldOptions: { entityCapacity: 16 },
  });
  const assets = registerQueuePhaseAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0.16, 4.9] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.72, 0, 0] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.leftOpaque),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.72, 0, 0.02] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.alphaCutout),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.blueOpaque),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0.02] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.transparentDepthBack),
    aperture.withRenderOrder(2),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0.06] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.transparentDepthFront),
    aperture.withRenderOrder(2),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.72, 0, 0] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.blueOpaque),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.72, 0, 0.04] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.transparentStableFirst),
    aperture.withRenderOrder(5),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.72, 0, 0.04] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.transparentStableLast),
    aperture.withRenderOrder(5),
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

  return {
    app,
    mesh: assets.mesh,
    materialKeys: {
      leftOpaque: aperture.assetHandleKey(assets.leftOpaque),
      alphaCutout: aperture.assetHandleKey(assets.alphaCutout),
      blueOpaque: aperture.assetHandleKey(assets.blueOpaque),
      transparentDepthBack: aperture.assetHandleKey(
        assets.transparentDepthBack,
      ),
      transparentDepthFront: aperture.assetHandleKey(
        assets.transparentDepthFront,
      ),
      transparentStableFirst: aperture.assetHandleKey(
        assets.transparentStableFirst,
      ),
      transparentStableLast: aperture.assetHandleKey(
        assets.transparentStableLast,
      ),
    },
  };
}

function registerQueuePhaseAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({
    registry,
  });
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "StandardQueuePhasePlane",
      width: 0.48,
      height: 0.9,
    }),
    { id: "standard-queue-phase-plane" },
  );
  const leftOpaque = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueRed", [0.95, 0.08, 0.04, 1]),
    { id: "phase-opaque-red" },
  );
  const alphaCutout = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseAlphaCutout", [0.08, 1, 0.1, 0], {
      alphaMode: "mask",
      alphaCutoff: 0.5,
    }),
    { id: "phase-alpha-cutout" },
  );
  const blueOpaque = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueBlue", [0.08, 0.16, 0.95, 1]),
    { id: "phase-opaque-blue" },
  );
  const transparentDepthBack = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentDepthBack",
      [0.02, 0.95, 0.16, 0.55],
    ),
    { id: "phase-transparent-depth-back" },
  );
  const transparentDepthFront = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentDepthFront",
      [1, 0.08, 0.04, 0.55],
    ),
    { id: "phase-transparent-depth-front" },
  );
  const transparentStableFirst = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentStableFirst",
      [0.02, 0.95, 0.16, 0.55],
    ),
    { id: "phase-transparent-stable-first" },
  );
  const transparentStableLast = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentStableLast",
      [1, 0.08, 0.04, 0.55],
    ),
    { id: "phase-transparent-stable-last" },
  );

  return {
    mesh,
    leftOpaque,
    alphaCutout,
    blueOpaque,
    transparentDepthBack,
    transparentDepthFront,
    transparentStableFirst,
    transparentStableLast,
  };
}

function standardMaterial(aperture, label, color, renderState = {}) {
  return aperture.createStandardMaterialAsset({
    label,
    baseColorFactor: new Float32Array(color),
    emissiveFactor: [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0],
    metallicFactor: 0,
    roughnessFactor: 1,
    renderState: { cullMode: "none", ...renderState },
  });
}

function transparentMaterial(aperture, label, color) {
  return standardMaterial(aperture, label, color, {
    alphaMode: "blend",
    depth: { test: true, write: false, compare: "less" },
    blend: { preset: "alpha" },
  });
}

function createSnapshotMessage(workerScene, data) {
  const timestamp = finiteNumber(data.timestamp, 0);

  if (firstTimestamp === null) {
    firstTimestamp = timestamp;
    previousTimestamp = timestamp;
  }

  const previous = previousTimestamp ?? timestamp;
  const elapsedSeconds = (timestamp - firstTimestamp) / 1000;
  const deltaSeconds = Math.max(0, (timestamp - previous) / 1000);
  const frame = finiteInteger(data.frame, 1);

  previousTimestamp = timestamp;

  const snapshot = workerScene.app.stepAndExtract(
    deltaSeconds,
    elapsedSeconds,
    frame,
  );

  return {
    type: "snapshot",
    frame,
    snapshot,
    workerStep: {
      elapsedSeconds,
      deltaSeconds,
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      diagnostics: snapshot.diagnostics.length,
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
