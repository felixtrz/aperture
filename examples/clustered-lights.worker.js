const clearColor = [0.012, 0.016, 0.022, 1];
const localLightGrid = { columns: 8, rows: 8 };

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
          meshKey: aperture.assetHandleKey(scene.panelMesh),
          materialKey: aperture.assetHandleKey(scene.panelMaterial),
          secondaryMaterialKey: aperture.assetHandleKey(
            scene.secondaryPanelMaterial,
          ),
          localLights: scene.localLightCount,
          routeLocalLights: scene.routeLocalLightCount,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const frame = finiteInteger(data.frame, 0);
      const cameraX = updateClusterCamera(aperture, scene, frame);
      const snapshot = scene.app.stepAndExtract(0, frame / 60, frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            transforms: snapshot.transforms.length / 16,
            meshDraws: snapshot.meshDraws.length,
            lights: snapshot.lights.length,
            localLights: scene.localLightCount,
            routeLocalLights: scene.routeLocalLightCount,
            cameraX,
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
    worldOptions: { entityCapacity: 180 },
  });
  const assets = registerClusteredLightAssets(aperture, app.assets);

  const primaryCamera = app.spawn(
    aperture.withTransform({ translation: [-0.4, 0, 4.8] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
      viewport: [0, 0, 0.5, 1],
      scissor: [0, 0, 0.5, 1],
    }),
  );
  const secondaryCamera = app.spawn(
    aperture.withTransform({ translation: [0.4, 0, 4.8] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 2,
      viewport: [0.5, 0, 0.5, 1],
      scissor: [0.5, 0, 0.5, 1],
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-1.1, 0, 0] }),
    aperture.withMesh(assets.panelMesh),
    aperture.withMaterial(assets.primaryPanelMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.1, 0, 0] }),
    aperture.withMesh(assets.panelMesh),
    aperture.withMaterial(assets.secondaryPanelMaterial),
    aperture.withRenderLayer(2),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.35, 0.39, 0.46, 1],
      intensity: 0.08,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.35, 0.39, 0.46, 1],
      intensity: 0.08,
      layerMask: 2,
    }),
  );

  spawnPointLightGrid(aperture, app, { layerMask: 1, xOffset: -1.1 });
  spawnPointLightGrid(aperture, app, { layerMask: 2, xOffset: 1.1 });

  return {
    app,
    primaryCamera,
    secondaryCamera,
    panelMesh: assets.panelMesh,
    panelMaterial: assets.primaryPanelMaterial,
    secondaryPanelMaterial: assets.secondaryPanelMaterial,
    localLightCount: localLightGrid.columns * localLightGrid.rows * 2,
    routeLocalLightCount: localLightGrid.columns * localLightGrid.rows,
  };
}

function updateClusterCamera(aperture, scene, frame) {
  const cameraX = frame % 2 === 0 ? 0.52 : -0.52;

  scene.primaryCamera
    .getVectorView(aperture.LocalTransform, "translation")
    .set([-0.4 + cameraX, 0, 4.8]);
  scene.secondaryCamera
    .getVectorView(aperture.LocalTransform, "translation")
    .set([0.4 - cameraX, 0, 4.8]);

  return cameraX;
}

function registerClusteredLightAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const panelMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "ClusteredLightsPanel",
      width: 5.2,
      height: 2.8,
    }),
    { id: "clustered-lights-panel" },
  );
  const primaryPanelMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredLightsStandard",
      baseColorFactor: new Float32Array([0.78, 0.8, 0.72, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.84,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-standard" },
  );
  const secondaryPanelMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredLightsStandardSecondary",
      baseColorFactor: new Float32Array([0.68, 0.76, 0.88, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.84,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-standard-secondary" },
  );

  return { panelMesh, primaryPanelMaterial, secondaryPanelMaterial };
}

function spawnPointLightGrid(aperture, app, options) {
  const palette = [
    [1, 0.3, 0.22, 1],
    [0.2, 0.65, 1, 1],
    [0.24, 1, 0.48, 1],
    [1, 0.86, 0.22, 1],
  ];

  for (let y = 0; y < localLightGrid.rows; y += 1) {
    for (let x = 0; x < localLightGrid.columns; x += 1) {
      const index = y * localLightGrid.columns + x;
      const color = palette[index % palette.length] ?? [1, 1, 1, 1];
      const u =
        localLightGrid.columns <= 1 ? 0 : x / (localLightGrid.columns - 1);
      const v = localLightGrid.rows <= 1 ? 0 : y / (localLightGrid.rows - 1);

      app.spawn(
        aperture.withTransform({
          translation: [
            options.xOffset - 2.25 + u * 4.5,
            -1.15 + v * 2.3,
            1.15 + ((x + y) % 2) * 0.18,
          ],
        }),
        aperture.withLight({
          kind: aperture.LightKind.Point,
          color,
          intensity: 16,
          range: 1.08,
          layerMask: options.layerMask,
        }),
      );
    }
  }
}

function finiteInteger(value, fallback) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
