const clearColor = [0.015, 0.02, 0.03, 1];
const nearColor = [0.16, 0.9, 0.32, 1];
const farColor = [1, 0.08, 0.04, 1];

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
          nearMaterialKey: aperture.assetHandleKey(scene.near),
          farMaterialKey: aperture.assetHandleKey(scene.far),
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
    worldOptions: { entityCapacity: 10 },
  });
  const assets = registerDepthOverlapAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 0.35,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 1, 1, 1],
      intensity: 1.3,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0.35] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.near),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(0),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0, -0.35] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.far),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(10),
    aperture.withVisibility(true),
  );

  return {
    app,
    mesh: assets.mesh,
    near: assets.near,
    far: assets.far,
  };
}

function registerDepthOverlapAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({
    registry,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DepthOverlapCube",
      width: 1.2,
      height: 1.2,
      depth: 1.2,
    }),
    { id: "depth-overlap-cube" },
  );
  const near = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "DepthNearUnlitGreen",
      baseColorFactor: new Float32Array(nearColor),
    }),
    { id: "depth-near-unlit-green" },
  );
  const far = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "DepthFarStandardRed",
      baseColorFactor: new Float32Array(farColor),
      emissiveFactor: [farColor[0], farColor[1], farColor[2]],
      metallicFactor: 0,
      roughnessFactor: 1,
    }),
    { id: "depth-far-standard-red" },
  );

  return { mesh, near, far };
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
