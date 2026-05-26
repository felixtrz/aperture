const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const clearOnlyLayerMask = 4;
const baseLayerMask = 1;
const overlayLayerMask = 2;
const baseColor = [0.9, 0.18, 0.08, 1];
const overlayColor = [0.08, 0.72, 1, 1];

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message || "The camera clear/load matrix worker raised an error.",
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
    const scene = createCameraClearLoadMatrixWorld(aperture, canvasSize);
    const frame = finiteInteger(data.frame, 1);
    const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
      frame,
    });
    const baseMaterialKey = aperture.assetHandleKey(scene.baseMaterialHandle);
    const overlayMaterialKey = aperture.assetHandleKey(
      scene.overlayMaterialHandle,
    );

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
          expectedViewCount: 3,
          expectedExtractedDrawCount: 2,
          expectedDrawCountsByViewId: {
            0: 0,
            1: 1,
            2: 1,
          },
          filterDrawsByViewLayer: true,
          samplePoints: [
            { id: "clear-only", x: 0.1, y: 0.1 },
            { id: "base-preserved", x: 0.28, y: 0.5 },
            { id: "overlay-center", x: 0.5, y: 0.5 },
          ],
          clearLoadMatrix: {
            mode: "clear-first-load-after",
            target: "current-texture",
            expectedSamples: {
              clearOnly: "clear-only",
              basePreserved: "base-preserved",
              overlay: "overlay-center",
            },
            passes: [
              {
                role: "clear-only",
                viewId: 0,
                priority: 0,
                layerMask: clearOnlyLayerMask,
                expectedDraws: 0,
                clearBehavior: "target-cleared-before-view",
                materialKey: null,
              },
              {
                role: "base",
                viewId: 1,
                priority: 1,
                layerMask: baseLayerMask,
                expectedDraws: 1,
                clearBehavior: "load-existing-target",
                materialKey: baseMaterialKey,
              },
              {
                role: "overlay",
                viewId: 2,
                priority: 2,
                layerMask: overlayLayerMask,
                expectedDraws: 1,
                clearBehavior: "load-existing-target",
                materialKey: overlayMaterialKey,
              },
            ],
          },
          proof: {
            expectedMaterialSamples: [
              {
                sampleId: "base-preserved",
                material: "base-layer",
                expectedColor: baseColor,
              },
              {
                sampleId: "overlay-center",
                material: "overlay-layer",
                expectedColor: overlayColor,
              },
            ],
            expectedClearSamples: ["clear-only"],
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

function createCameraClearLoadMatrixWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("camera-clear-load-plane");
  const baseMaterialHandle = aperture.createMaterialHandle(
    "camera-clear-load-base",
  );
  const overlayMaterialHandle = aperture.createMaterialHandle(
    "camera-clear-load-overlay",
  );
  const mesh = aperture.createPlaneMeshAsset({
    label: "CameraClearLoadPlane",
    width: 1,
    height: 1,
  });
  const baseMaterial = aperture.createUnlitMaterialAsset({
    label: "CameraClearLoadBase",
    baseColorFactor: new Float32Array(baseColor),
  });
  const overlayMaterial = aperture.createUnlitMaterialAsset({
    label: "CameraClearLoadOverlay",
    baseColorFactor: new Float32Array(overlayColor),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(baseMaterialHandle);
  assets.register(overlayMaterialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(baseMaterialHandle, baseMaterial);
  assets.markReady(overlayMaterialHandle, overlayMaterial);

  const aspect = canvasSize.width / canvasSize.height;

  createCameraEntity(aperture, world, {
    layerMask: clearOnlyLayerMask,
    aspect,
    priority: 0,
  });
  createCameraEntity(aperture, world, {
    layerMask: baseLayerMask,
    aspect,
    priority: 1,
  });
  createCameraEntity(aperture, world, {
    layerMask: overlayLayerMask,
    aspect,
    priority: 2,
  });
  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle: baseMaterialHandle,
    layerMask: baseLayerMask,
    scale: [2.4, 1.5, 1],
    translation: [0, 0, 0],
  });
  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle: overlayMaterialHandle,
    layerMask: overlayLayerMask,
    scale: [0.72, 0.72, 1],
    translation: [0, 0, 0.05],
  });

  return {
    world,
    assets,
    mesh,
    meshHandle,
    baseMaterialHandle,
    overlayMaterialHandle,
    materials: [
      { handle: baseMaterialHandle, asset: baseMaterial, label: "base-layer" },
      {
        handle: overlayMaterialHandle,
        asset: overlayMaterial,
        label: "overlay-layer",
      },
    ],
  };
}

function createCameraEntity(aperture, world, options) {
  const camera = world.createEntity();
  const transform = aperture.createRootTransform({
    translation: [0, 0, 2.6],
  });

  camera.addComponent(aperture.WorldTransform, transform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: options.aspect,
      near: 0.1,
      far: 100,
      viewport: [0, 0, 1, 1],
      scissor: [0, 0, 1, 1],
      priority: options.priority,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: options.layerMask,
    }),
  );

  return camera;
}

function createPlaneEntity(aperture, world, options) {
  const entity = world.createEntity();
  const transform = aperture.createRootTransform({
    translation: options.translation,
    scale: options.scale,
  });

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
