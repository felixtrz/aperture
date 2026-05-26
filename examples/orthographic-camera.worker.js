const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message ||
      "The orthographic camera simulation worker raised an error.",
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
    const scene = createOrthographicCameraWorld(aperture, canvasSize);
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
          expectedViewCount: 3,
          expectedDrawCount: 1,
          samplePoints: orthographicSamplePoints(),
          camera: {
            projections: scene.cameras,
            orthographicHeight: scene.orthographicHeight,
            proof: "orthographic-size-stability",
          },
          proof: {
            expectedStableSamplePairs: [
              ["ortho-near-left-inside", "ortho-far-left-inside"],
              ["ortho-near-right-inside", "ortho-far-right-inside"],
              ["ortho-near-left-outside", "ortho-far-left-outside"],
              ["ortho-near-right-outside", "ortho-far-right-outside"],
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createOrthographicCameraWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("orthographic-proof-plane");
  const materialHandle = aperture.createMaterialHandle("orthographic-proof");
  const mesh = aperture.createPlaneMeshAsset({
    label: "OrthographicProofPlane",
    width: 1,
    height: 1,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "OrthographicProofMaterial",
    baseColorFactor: new Float32Array([0.2, 0.95, 0.75, 1]),
  });
  const orthographicHeight = 2.2;
  const panelAspect = canvasSize.width / 3 / canvasSize.height;

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const cameras = [
    {
      label: "perspective-reference",
      projection: "perspective",
      translation: [0, 0, 2.4],
      viewport: [0, 0, 1 / 3, 1],
      scissor: [0, 0, 1 / 3, 1],
      distance: 2.4,
      priority: 0,
    },
    {
      label: "orthographic-near",
      projection: "orthographic",
      translation: [0, 0, 2.4],
      viewport: [1 / 3, 0, 1 / 3, 1],
      scissor: [1 / 3, 0, 1 / 3, 1],
      distance: 2.4,
      priority: 1,
      orthographicHeight,
    },
    {
      label: "orthographic-far",
      projection: "orthographic",
      translation: [0, 0, 6],
      viewport: [2 / 3, 0, 1 / 3, 1],
      scissor: [2 / 3, 0, 1 / 3, 1],
      distance: 6,
      priority: 2,
      orthographicHeight,
    },
  ];

  for (const camera of cameras) {
    createCameraEntity(aperture, world, {
      ...camera,
      aspect: panelAspect,
    });
  }

  createPlaneEntity(aperture, world, {
    meshHandle,
    materialHandle,
    translation: [0, 0, 0],
  });

  return {
    world,
    assets,
    mesh,
    meshHandle,
    materials: [{ handle: materialHandle, asset: material }],
    orthographicHeight,
    cameras: cameras.map((camera) => ({
      label: camera.label,
      projection: camera.projection,
      viewport: camera.viewport,
      distance: camera.distance,
      ...(camera.orthographicHeight === undefined
        ? {}
        : { orthographicHeight: camera.orthographicHeight }),
    })),
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
      projection:
        options.projection === "orthographic"
          ? aperture.CameraProjection.Orthographic
          : aperture.CameraProjection.Perspective,
      aspect: options.aspect,
      near: 0.1,
      far: 100,
      orthographicHeight: options.orthographicHeight ?? 10,
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

function orthographicSamplePoints() {
  return [
    { id: "perspective-center", x: 1 / 6, y: 0.5 },
    { id: "ortho-near-center", x: 0.5, y: 0.5 },
    { id: "ortho-far-center", x: 5 / 6, y: 0.5 },
    { id: "ortho-near-left-inside", x: 0.4, y: 0.5 },
    { id: "ortho-near-left-outside", x: 0.355, y: 0.5 },
    { id: "ortho-near-right-inside", x: 0.6, y: 0.5 },
    { id: "ortho-near-right-outside", x: 0.645, y: 0.5 },
    { id: "ortho-far-left-inside", x: 0.733, y: 0.5 },
    { id: "ortho-far-left-outside", x: 0.688, y: 0.5 },
    { id: "ortho-far-right-inside", x: 0.933, y: 0.5 },
    { id: "ortho-far-right-outside", x: 0.978, y: 0.5 },
  ];
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
