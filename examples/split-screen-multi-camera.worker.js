const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message ||
      "The split-screen multi-camera simulation worker raised an error.",
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
    const scene = createSplitScreenWorld(aperture, canvasSize);
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
          })),
          expectedDrawCount: 2,
          samplePoints: [
            { id: "left-center", x: 0.25, y: 0.5 },
            { id: "right-center", x: 0.75, y: 0.5 },
          ],
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

function createSplitScreenWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("split-screen-plane");
  const leftMaterialHandle = aperture.createMaterialHandle(
    "split-screen-left-red",
  );
  const rightMaterialHandle = aperture.createMaterialHandle(
    "split-screen-right-blue",
  );
  const mesh = aperture.createPlaneMeshAsset({
    label: "SplitScreenPlane",
    width: 0.9,
    height: 1.1,
  });
  const leftMaterial = aperture.createUnlitMaterialAsset({
    label: "LeftCameraRed",
    baseColorFactor: new Float32Array([0.96, 0.16, 0.08, 1]),
  });
  const rightMaterial = aperture.createUnlitMaterialAsset({
    label: "RightCameraBlue",
    baseColorFactor: new Float32Array([0.05, 0.38, 1, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(leftMaterialHandle);
  assets.register(rightMaterialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(leftMaterialHandle, leftMaterial);
  assets.markReady(rightMaterialHandle, rightMaterial);

  const splitAspect = (canvasSize.width * 0.5) / canvasSize.height;

  createCameraEntity(aperture, world, {
    translation: [-0.55, 0, 2.4],
    viewport: [0, 0, 0.5, 1],
    scissor: [0, 0, 0.5, 1],
    aspect: splitAspect,
    priority: 0,
  });
  createCameraEntity(aperture, world, {
    translation: [0.55, 0, 2.4],
    viewport: [0.5, 0, 0.5, 1],
    scissor: [0.5, 0, 0.5, 1],
    aspect: splitAspect,
    priority: 1,
  });
  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle: leftMaterialHandle,
    translation: [-0.55, 0, 0],
  });
  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle: rightMaterialHandle,
    translation: [0.55, 0, 0],
  });

  return {
    world,
    assets,
    mesh,
    meshHandle,
    materials: [
      { handle: leftMaterialHandle, asset: leftMaterial },
      { handle: rightMaterialHandle, asset: rightMaterial },
    ],
  };
}

function createCameraEntity(aperture, world, options) {
  const camera = world.createEntity();
  const transform = aperture.createRootTransform({
    translation: options.translation,
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
      layerMask: 1,
    }),
  );

  return camera;
}

function createPlaneEntity(aperture, world, options) {
  const entity = world.createEntity();
  const transform = aperture.createRootTransform({
    translation: options.translation,
  });

  entity.addComponent(aperture.WorldTransform, transform.world);
  entity.addComponent(aperture.Mesh, {
    meshId: aperture.assetHandleKey(options.meshHandle),
  });
  entity.addComponent(aperture.Material, {
    materialId: aperture.assetHandleKey(options.materialHandle),
  });
  entity.addComponent(aperture.RenderLayer, { mask: 1 });
  entity.addComponent(aperture.Visibility);

  return entity;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
