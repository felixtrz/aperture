const meshId = "render-packet-inspector-cube";
const materialId = "render-packet-inspector-unlit";
const environmentMapId = "render-packet-inspector-studio";
const clearColor = [0.018, 0.026, 0.035, 1];

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message ||
      "The render packet inspector simulation worker raised an error.",
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
        scene: sceneStatus(aperture, scene),
      });
      return;
    }

    if (data?.type === "snapshot") {
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
      reason: "worker-snapshot-failed",
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
    worldOptions: { entityCapacity: 160 },
  });
  const assets = registerWorkerAssets(aperture, app.assets);

  const camera = app.spawn(
    aperture.withTransform({ translation: [0, 0, 4.2] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
      priority: 0,
    }),
  );
  const visible = app.spawn(
    aperture.withTransform({
      translation: [0, 0, 0],
      rotation: [0.16, -0.22, 0.04, 0.962],
    }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.material),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(4),
    aperture.withVisibility(true),
  );
  const disabled = app.spawn(
    aperture.withTransform({ translation: [0.85, 0, 0] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.material),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(9),
    aperture.withVisibility(true),
    aperture.withEnabled(false),
  );
  const culled = [];

  for (let index = 0; index < 120; index += 1) {
    culled.push(
      app.spawn(
        aperture.withTransform({
          translation: [80 + index * 1.5, (index % 12) - 6, 0],
        }),
        aperture.withMesh(assets.mesh),
        aperture.withMaterial(assets.material),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
      ),
    );
  }

  const ambient = app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.45, 0.52, 0.64, 1],
      intensity: 0.42,
      layerMask: 1,
    }),
  );
  const environment = app.spawn(
    aperture.withEnvironmentMap(assets.environmentMap, {
      color: [1, 1, 1, 1],
      intensity: 0.35,
      layerMask: 1,
    }),
  );

  return {
    app,
    mesh: assets.mesh,
    material: assets.material,
    materialAsset: assets.materialAsset,
    environmentMap: assets.environmentMap,
    camera,
    visible,
    disabled,
    culled,
    ambient,
    environment,
  };
}

function registerWorkerAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "RenderPacketInspectorCube",
      width: 1.45,
      height: 1.45,
      depth: 1.45,
    }),
    { id: meshId },
  );
  const materialAsset = aperture.createUnlitMaterialAsset({
    label: "RenderPacketInspectorUnlit",
    baseColorFactor: new Float32Array([0.18, 0.78, 1, 1]),
  });
  const material = assets.materials.unlit.add(materialAsset, {
    id: materialId,
  });
  const environmentMap = aperture.createEnvironmentMapHandle(environmentMapId);

  registry.register(environmentMap, {
    label: "Render packet inspector studio IBL",
  });
  registry.markReady(environmentMap, {
    label: "Render packet inspector studio IBL",
    diffuseResourceKey: "render-packet-inspector/studio/diffuse",
  });

  return { mesh, material, materialAsset, environmentMap };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const frame = finiteInteger(data.frame, 1);

  workerScene.app.step(0, finiteNumber(data.timestamp, 0) / 1000);
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    scene: sceneStatus(aperture, workerScene),
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function sceneStatus(aperture, workerScene) {
  return {
    meshKey: aperture.assetHandleKey(workerScene.mesh),
    materialKey: aperture.assetHandleKey(workerScene.material),
    materialKind: workerScene.materialAsset.kind,
    environmentMapKey: aperture.assetHandleKey(workerScene.environmentMap),
    cameraEntity: entityRef(workerScene.camera),
    visibleEntity: entityRef(workerScene.visible),
    disabledEntity: entityRef(workerScene.disabled),
    authoredRenderableCount: 2 + workerScene.culled.length,
    cullProbeCount: workerScene.culled.length,
    ambientLightEntity: entityRef(workerScene.ambient),
    environmentEntity: entityRef(workerScene.environment),
  };
}

function entityRef(entity) {
  return { index: entity.index, generation: entity.generation };
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
