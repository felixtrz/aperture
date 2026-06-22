const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const redLayerMask = 1;
const blueLayerMask = 2;
const redColor = [0.95, 0.12, 0.08, 1];
const blueColor = [0.08, 0.32, 1, 1];

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message ||
      "The camera render-layer simulation worker raised an error.",
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
    if (data?.type !== "snapshot") {
      return;
    }

    const aperture = await loadAperture();
    const canvasSize = data.canvas ?? { width: 960, height: 540 };
    const scene = createCameraRenderLayerWorld(aperture, canvasSize);
    const frame = finiteInteger(data.frame, 1);
    const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
      frame,
    });
    const redMaterialKey = aperture.assetHandleKey(scene.redMaterialHandle);
    const blueMaterialKey = aperture.assetHandleKey(scene.blueMaterialHandle);

    self.postMessage(
      {
        type: "snapshot",
        frame,
        snapshot,
        scene: {
          meshKey: aperture.assetHandleKey(scene.meshHandle),
          mesh: scene.mesh,
          materials: scene.materials.map((entry) => ({
            key: aperture.assetHandleKey(entry.handle),
            asset: entry.asset,
            label: entry.label,
          })),
          expectedViewCount: 2,
          expectedExtractedDrawCount: 2,
          expectedViewDrawCount: 1,
          filterDrawsByViewLayer: true,
          samplePoints: [
            { id: "red-layer-camera", x: 0.25, y: 0.5 },
            { id: "blue-layer-camera", x: 0.75, y: 0.5 },
          ],
          layerIsolation: {
            mode: "camera-layer-mask",
            cameras: [
              {
                viewId: 0,
                layerMask: redLayerMask,
                includedMaterialKey: redMaterialKey,
                skippedMaterialKey: blueMaterialKey,
              },
              {
                viewId: 1,
                layerMask: blueLayerMask,
                includedMaterialKey: blueMaterialKey,
                skippedMaterialKey: redMaterialKey,
              },
            ],
            objects: [
              {
                id: "red-plane",
                layerMask: redLayerMask,
                materialKey: redMaterialKey,
              },
              {
                id: "blue-plane",
                layerMask: blueLayerMask,
                materialKey: blueMaterialKey,
              },
            ],
            expectedPerCamera: {
              includedDraws: 1,
              skippedDraws: 1,
            },
          },
          proof: {
            expectedMaterialSamples: [
              {
                sampleId: "red-layer-camera",
                material: "red-layer",
                expectedColor: redColor,
              },
              {
                sampleId: "blue-layer-camera",
                material: "blue-layer",
                expectedColor: blueColor,
              },
            ],
          },
        },
      },
      aperture.renderSnapshotTransferList(snapshot),
    );
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

function createCameraRenderLayerWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("camera-render-layer-plane");
  const redMaterialHandle = aperture.createMaterialHandle(
    "camera-render-layer-red",
  );
  const blueMaterialHandle = aperture.createMaterialHandle(
    "camera-render-layer-blue",
  );
  const mesh = aperture.createPlaneMeshAsset({
    label: "CameraRenderLayerPlane",
    width: 1.15,
    height: 1.15,
  });
  const redMaterial = aperture.createUnlitMaterialAsset({
    label: "CameraRenderLayerRed",
    baseColorFactor: new Float32Array(redColor),
  });
  const blueMaterial = aperture.createUnlitMaterialAsset({
    label: "CameraRenderLayerBlue",
    baseColorFactor: new Float32Array(blueColor),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(redMaterialHandle);
  assets.register(blueMaterialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(redMaterialHandle, redMaterial);
  assets.markReady(blueMaterialHandle, blueMaterial);

  const splitAspect = (canvasSize.width * 0.5) / canvasSize.height;

  createCameraEntity(aperture, world, {
    layerMask: redLayerMask,
    viewport: [0, 0, 0.5, 1],
    scissor: [0, 0, 0.5, 1],
    aspect: splitAspect,
    priority: 0,
  });
  createCameraEntity(aperture, world, {
    layerMask: blueLayerMask,
    viewport: [0.5, 0, 0.5, 1],
    scissor: [0.5, 0, 0.5, 1],
    aspect: splitAspect,
    priority: 1,
  });
  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle: redMaterialHandle,
    layerMask: redLayerMask,
  });
  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle: blueMaterialHandle,
    layerMask: blueLayerMask,
  });

  return {
    world,
    assets,
    mesh,
    meshHandle,
    redMaterialHandle,
    blueMaterialHandle,
    materials: [
      { handle: redMaterialHandle, asset: redMaterial, label: "red-layer" },
      { handle: blueMaterialHandle, asset: blueMaterial, label: "blue-layer" },
    ],
  };
}

function createCameraEntity(aperture, world, options) {
  const camera = world.createEntity();
  const transform = aperture.createRootTransform({
    translation: [0, 0, 2.4],
  });

  camera.addComponent(aperture.WorldTransform, transform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: options.aspect,
      near: 0.1,
      far: 100,
      viewport: options.viewport,
      scissor: options.scissor,
      priority: options.priority,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: options.layerMask,
    }),
  );

  return camera;
}

function createPlaneEntity(aperture, world, options) {
  const entity = world.createEntity();
  const transform = aperture.createRootTransform();

  entity.addComponent(aperture.WorldTransform, transform.world);
  entity.addComponent(aperture.Mesh, {
    meshId: aperture.assetHandleKey(options.meshHandle),
  });
  entity.addComponent(aperture.Material, {
    materialId: aperture.assetHandleKey(options.materialHandle),
  });
  entity.addComponent(aperture.RenderLayer, { mask: options.layerMask });
  entity.addComponent(aperture.Visibility);

  return entity;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
