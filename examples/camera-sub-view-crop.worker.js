const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const cropLayerMask = 1;
const cropColor = [0.12, 0.88, 0.36, 1];
const cropViewport = [0.25, 0.25, 0.5, 0.5];

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message || "The camera sub-view crop worker raised an error.",
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
    const scene = createCameraSubViewCropWorld(aperture, canvasSize);
    const frame = finiteInteger(data.frame, 1);
    const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
      frame,
    });

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
          expectedViewCount: 1,
          expectedDrawCount: 1,
          samplePoints: [
            { id: "crop-center", x: 0.5, y: 0.5 },
            { id: "outside-top-left", x: 0.12, y: 0.12 },
            { id: "outside-bottom-right", x: 0.88, y: 0.88 },
          ],
          subViewCrop: {
            mode: "normalized-viewport-scissor-crop",
            source: "Camera.viewport+Camera.scissor",
            fullCanvas: canvasSize,
            viewport: cropViewport,
            scissor: cropViewport,
            expectedViewportPixels: {
              x: Math.round(canvasSize.width * cropViewport[0]),
              y: Math.round(canvasSize.height * cropViewport[1]),
              width: Math.round(canvasSize.width * cropViewport[2]),
              height: Math.round(canvasSize.height * cropViewport[3]),
            },
            expectedSamples: {
              inside: "crop-center",
              outside: ["outside-top-left", "outside-bottom-right"],
            },
          },
          proof: {
            expectedMaterialSamples: [
              {
                sampleId: "crop-center",
                material: "crop-layer",
                expectedColor: cropColor,
              },
            ],
            expectedClearSamples: ["outside-top-left", "outside-bottom-right"],
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createCameraSubViewCropWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("camera-sub-view-crop-plane");
  const materialHandle = aperture.createMaterialHandle(
    "camera-sub-view-crop-material",
  );
  const mesh = aperture.createPlaneMeshAsset({
    label: "CameraSubViewCropPlane",
    width: 1.35,
    height: 1.35,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "CameraSubViewCropMaterial",
    baseColorFactor: new Float32Array(cropColor),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.4],
  });
  const aspect = canvasSize.width / canvasSize.height;

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect,
      near: 0.1,
      far: 100,
      viewport: cropViewport,
      scissor: cropViewport,
      priority: 0,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: cropLayerMask,
    }),
  );

  const plane = world.createEntity();
  const planeTransform = aperture.createRootTransform();

  plane.addComponent(aperture.WorldTransform, planeTransform.world);
  plane.addComponent(aperture.Mesh, {
    meshId: aperture.assetHandleKey(meshHandle),
  });
  plane.addComponent(aperture.Material, {
    materialId: aperture.assetHandleKey(materialHandle),
  });
  plane.addComponent(aperture.RenderLayer, { mask: cropLayerMask });
  plane.addComponent(aperture.Visibility);

  return {
    world,
    assets,
    mesh,
    meshHandle,
    materials: [
      { handle: materialHandle, asset: material, label: "crop-layer" },
    ],
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
