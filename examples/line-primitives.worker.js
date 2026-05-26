const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message || "The line primitives simulation worker raised an error.",
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
    const scene = createLinePrimitiveWorld(aperture, canvasSize);
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
          expectedDrawCount: 2,
          samplePoints: linePrimitiveSamplePoints(),
          linePrimitives: {
            topology: "line-list",
            sets: 2,
            materialSlots: 2,
            lineSegments: 10,
            indexed: true,
            indexCount: scene.mesh.indexBuffer?.data.length ?? 0,
            drawOrder: ["cyan-lines", "amber-lines"],
          },
          proof: {
            expectedMaterialSamples: [
              {
                sampleId: "cyan-line",
                material: "cyan",
                expectedColor: [0.05, 0.85, 1, 1],
              },
              {
                sampleId: "amber-line",
                material: "amber",
                expectedColor: [1, 0.62, 0.08, 1],
              },
            ],
            expectedClearSamples: ["center-clear"],
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

function createLinePrimitiveWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 6 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("line-primitives");
  const cyanMaterialHandle = aperture.createMaterialHandle("line-a-cyan");
  const amberMaterialHandle = aperture.createMaterialHandle("line-b-amber");
  const mesh = createLinePrimitiveMesh(aperture);
  const cyanMaterial = aperture.createUnlitMaterialAsset({
    label: "LinePrimitiveACyan",
    baseColorFactor: new Float32Array([0.05, 0.85, 1, 1]),
  });
  const amberMaterial = aperture.createUnlitMaterialAsset({
    label: "LinePrimitiveBAmber",
    baseColorFactor: new Float32Array([1, 0.62, 0.08, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(cyanMaterialHandle);
  assets.register(amberMaterialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(cyanMaterialHandle, cyanMaterial);
  assets.markReady(amberMaterialHandle, amberMaterial);

  createCameraEntity(aperture, world, canvasSize);
  createLineEntity(aperture, world, {
    meshHandle,
    cyanMaterialHandle,
    amberMaterialHandle,
  });

  return {
    world,
    assets,
    mesh,
    meshHandle,
    materials: [
      { handle: cyanMaterialHandle, asset: cyanMaterial, label: "cyan" },
      { handle: amberMaterialHandle, asset: amberMaterial, label: "amber" },
    ],
  };
}

function createLinePrimitiveMesh(aperture) {
  const positions = [
    [-1.28, 0.4425926, 0],
    [-0.2, 0.4425926, 0],
    [-1.28, 0.4675926, 0],
    [-0.2, 0.4675926, 0],
    [-1.28, 0.4175926, 0],
    [-0.2, 0.4175926, 0],
    [-1.28, 0.2925926, 0],
    [-1.28, 0.5925926, 0],
    [-0.2, 0.2925926, 0],
    [-0.2, 0.5925926, 0],
    [0.2, -0.4462963, 0],
    [1.28, -0.4462963, 0],
    [0.2, -0.4212963, 0],
    [1.28, -0.4212963, 0],
    [0.2, -0.4712963, 0],
    [1.28, -0.4712963, 0],
    [0.2, -0.5962963, 0],
    [0.2, -0.2962963, 0],
    [1.28, -0.5962963, 0],
    [1.28, -0.2962963, 0],
  ];

  return aperture.createLineListMeshAsset({
    label: "LinePrimitives",
    positions,
    indices: positions.map((_, index) => index),
    materialSlots: ["cyan", "amber"],
    submeshes: [
      {
        label: "cyan-lines",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: positions.length,
        indexStart: 0,
        indexCount: 10,
      },
      {
        label: "amber-lines",
        materialSlot: 1,
        vertexStart: 0,
        vertexCount: positions.length,
        indexStart: 10,
        indexCount: 10,
      },
    ],
  });
}

function createCameraEntity(aperture, world, canvasSize) {
  const camera = world.createEntity();
  const transform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, transform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      projection: aperture.CameraProjection.Orthographic,
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 20,
      orthographicHeight: 2,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  return camera;
}

function createLineEntity(aperture, world, options) {
  const entity = world.createEntity();
  const transform = aperture.createRootTransform();

  entity.addComponent(aperture.WorldTransform, transform.world);
  entity.addComponent(aperture.Mesh, {
    meshId: aperture.assetHandleKey(options.meshHandle),
  });
  entity.addComponent(aperture.Material, {
    materialId: aperture.assetHandleKey(options.cyanMaterialHandle),
  });
  entity.addComponent(
    aperture.MaterialSlots,
    aperture.createMaterialSlots({
      slots: [{ slot: 1, material: options.amberMaterialHandle }],
    }),
  );
  entity.addComponent(aperture.RenderLayer, { mask: 1 });
  entity.addComponent(aperture.Visibility);

  return entity;
}

function linePrimitiveSamplePoints() {
  return [
    { id: "cyan-line", x: 280.5 / 960, y: 150.5 / 540 },
    { id: "amber-line", x: 680.5 / 960, y: 390.5 / 540 },
    { id: "center-clear", x: 0.5, y: 0.5 },
  ];
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
