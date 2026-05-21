const clearColor = { r: 0.01, g: 0.018, b: 0.028, a: 1 };

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message || "The custom material simulation worker raised an error.",
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

    if (data?.type !== "snapshot") {
      return;
    }

    const canvasSize = data.canvas ?? { width: 960, height: 540 };
    const scene = createWaterWorld(aperture, canvasSize);
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
          materialKey: aperture.assetHandleKey(scene.materialHandle),
          meshLabel: scene.mesh.label,
          materialLabel: scene.material.label,
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

function createWaterWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("custom-water-plane");
  const materialHandle = aperture.createMaterialHandle("custom-water-material");
  const mesh = createWaterPlaneMesh();
  const material = aperture.createUnlitMaterialAsset({
    label: "WaterMaterialExtractionPlaceholder",
    baseColorFactor: new Float32Array([0.02, 0.46, 0.9, 1]),
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
    translation: [0, 0, 2.45],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
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
  plane.addComponent(aperture.RenderLayer, { mask: 1 });
  plane.addComponent(aperture.Visibility);

  return { world, assets, mesh, meshHandle, material, materialHandle };
}

function createWaterPlaneMesh() {
  return {
    kind: "mesh",
    label: "CustomWaterPlane",
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount: 4,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: new Float32Array([
          -1.35, -0.75, 0, 0, 0, 1, 0, 1, 1.35, -0.75, 0, 0, 0, 1, 1, 1, 1.35,
          0.75, 0, 0, 0, 1, 1, 0, -1.35, 0.75, 0, 0, 0, 1, 0, 0,
        ]),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2, 0, 2, 3]),
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 4,
        indexStart: 0,
        indexCount: 6,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [-1.35, -0.75, 0], max: [1.35, 0.75, 0] },
    localSphere: { center: [0, 0, 0], radius: 1.55 },
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
