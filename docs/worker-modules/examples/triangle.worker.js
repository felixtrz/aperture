const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The triangle simulation worker raised an error.",
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
    const scene = createTriangleWorld(aperture, canvasSize);
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
  apertureModulePromise ??= Promise.all([
    import("/aperture/worker-modules/packages/simulation/dist/index.js"),
    import("/aperture/worker-modules/packages/render/dist/index.js"),
    import("/aperture/worker-modules/packages/runtime/dist/index.js"),
  ]).then(([simulation, render, runtime]) => ({
    ...simulation,
    ...render,
    ...runtime,
  }));
  return apertureModulePromise;
}

function createTriangleWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("triangle");
  const materialHandle = aperture.createMaterialHandle("triangle");
  const mesh = createTriangleMesh();
  const material = aperture.createUnlitMaterialAsset({
    label: "TriangleMaterial",
    baseColorFactor: new Float32Array([1, 0.18, 0.09, 1]),
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
    translation: [0, 0, 2.5],
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

  const triangle = world.createEntity();
  const triangleTransform = aperture.createRootTransform();

  triangle.addComponent(aperture.WorldTransform, triangleTransform.world);
  triangle.addComponent(aperture.Mesh, {
    meshId: aperture.assetHandleKey(meshHandle),
  });
  triangle.addComponent(aperture.Material, {
    materialId: aperture.assetHandleKey(materialHandle),
  });
  triangle.addComponent(aperture.RenderLayer, { mask: 1 });
  triangle.addComponent(aperture.Visibility);

  return { world, assets, mesh, meshHandle, material, materialHandle };
}

function createTriangleMesh() {
  return {
    kind: "mesh",
    label: "Triangle",
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount: 3,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: new Float32Array([
          0, 0.72, 0, 0, 0, 1, 0.5, 0, -0.72, -0.55, 0, 0, 0, 1, 0, 1, 0.72,
          -0.55, 0, 0, 0, 1, 1, 1,
        ]),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2]),
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 3,
        indexStart: 0,
        indexCount: 3,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [-0.72, -0.55, 0], max: [0.72, 0.72, 0] },
    localSphere: { center: [0, 0, 0], radius: 0.9 },
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
