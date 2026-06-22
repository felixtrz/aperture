const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const baseLayerMask = 1;
const insetLayerMask = 2;
const baseColor = [0.9, 0.18, 0.08, 1];
const insetColor = [0.08, 0.72, 1, 1];
const insetViewport = [0.625, 0.125, 0.25, 0.25];

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message || "The camera picture-in-picture worker raised an error.",
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
    const scene = createCameraPictureInPictureWorld(aperture, canvasSize);
    const frame = finiteInteger(data.frame, 1);
    const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
      frame,
    });
    const baseMaterialKey = aperture.assetHandleKey(scene.baseMaterialHandle);
    const insetMaterialKey = aperture.assetHandleKey(scene.insetMaterialHandle);

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
            { id: "base-left", x: 0.25, y: 0.5 },
            { id: "base-under-inset", x: 0.75, y: 0.5 },
            { id: "inset-center", x: 0.75, y: 0.25 },
          ],
          pictureInPicture: {
            mode: "same-target-inset-camera",
            target: "current-texture",
            base: {
              viewId: 0,
              priority: 0,
              layerMask: baseLayerMask,
              materialKey: baseMaterialKey,
              viewport: [0, 0, 1, 1],
              scissor: [0, 0, 1, 1],
              clearBehavior: "target-cleared-before-view",
            },
            inset: {
              viewId: 1,
              priority: 1,
              layerMask: insetLayerMask,
              materialKey: insetMaterialKey,
              viewport: insetViewport,
              scissor: insetViewport,
              viewportPixels: resolveViewportPixels(canvasSize, insetViewport),
              clearBehavior: "load-existing-target",
            },
            expectedSamples: {
              base: ["base-left", "base-under-inset"],
              inset: "inset-center",
            },
          },
          proof: {
            expectedMaterialSamples: [
              {
                sampleId: "base-left",
                material: "base-layer",
                expectedColor: baseColor,
              },
              {
                sampleId: "base-under-inset",
                material: "base-layer",
                expectedColor: baseColor,
              },
              {
                sampleId: "inset-center",
                material: "inset-layer",
                expectedColor: insetColor,
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

function createCameraPictureInPictureWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle(
    "camera-picture-in-picture-plane",
  );
  const baseMaterialHandle = aperture.createMaterialHandle(
    "camera-picture-in-picture-base",
  );
  const insetMaterialHandle = aperture.createMaterialHandle(
    "camera-picture-in-picture-inset",
  );
  const mesh = aperture.createPlaneMeshAsset({
    label: "CameraPictureInPicturePlane",
    width: 1,
    height: 1,
  });
  const baseMaterial = aperture.createUnlitMaterialAsset({
    label: "CameraPictureInPictureBase",
    baseColorFactor: new Float32Array(baseColor),
  });
  const insetMaterial = aperture.createUnlitMaterialAsset({
    label: "CameraPictureInPictureInset",
    baseColorFactor: new Float32Array(insetColor),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(baseMaterialHandle);
  assets.register(insetMaterialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(baseMaterialHandle, baseMaterial);
  assets.markReady(insetMaterialHandle, insetMaterial);

  const aspect = canvasSize.width / canvasSize.height;
  const insetAspect =
    (canvasSize.width * insetViewport[2]) /
    (canvasSize.height * insetViewport[3]);

  createCameraEntity(aperture, world, {
    layerMask: baseLayerMask,
    viewport: [0, 0, 1, 1],
    scissor: [0, 0, 1, 1],
    aspect,
    priority: 0,
  });
  createCameraEntity(aperture, world, {
    layerMask: insetLayerMask,
    viewport: insetViewport,
    scissor: insetViewport,
    aspect: insetAspect,
    priority: 1,
  });
  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle: baseMaterialHandle,
    layerMask: baseLayerMask,
    scale: [6, 3.4, 1],
    translation: [0, 0, 0],
  });
  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle: insetMaterialHandle,
    layerMask: insetLayerMask,
    scale: [0.95, 0.95, 1],
    translation: [0, 0, 0.05],
  });

  return {
    world,
    assets,
    mesh,
    meshHandle,
    baseMaterialHandle,
    insetMaterialHandle,
    materials: [
      { handle: baseMaterialHandle, asset: baseMaterial, label: "base-layer" },
      {
        handle: insetMaterialHandle,
        asset: insetMaterial,
        label: "inset-layer",
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

function resolveViewportPixels(canvasSize, viewport) {
  return {
    x: Math.round(canvasSize.width * viewport[0]),
    y: Math.round(canvasSize.height * viewport[1]),
    width: Math.round(canvasSize.width * viewport[2]),
    height: Math.round(canvasSize.height * viewport[3]),
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
