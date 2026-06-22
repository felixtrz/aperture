const clearColor = [0.012, 0.018, 0.03, 1];
const columns = 24;
const rows = 24;
const instanceCount = columns * rows;
const spacing = 0.28;
const bladeScale = 0.18;
const orthographicHeight = 7.2;
const materialFamily = "example/wind";

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message ||
      "The instance-attributes simulation worker raised an error.",
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
    if (data?.type !== "snapshot") {
      return;
    }

    const aperture = await loadAperture();
    const canvasSize = data.canvas ?? { width: 960, height: 540 };
    const scene = createWindWorld(aperture, canvasSize);
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
          instanceCount,
          grid: { columns, rows },
          materialFamily,
          meshKey: aperture.assetHandleKey(scene.meshHandle),
          materialKey: aperture.assetHandleKey(scene.materialHandle),
          meshLabel: scene.mesh.label,
          materialLabel: scene.material.label,
          samples: scene.samples,
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

function createWindWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: instanceCount + 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("instance-attributes-blade");
  const materialHandle = aperture.createMaterialHandle(
    "instance-attributes-wind-material",
  );
  const mesh = createBladeMesh();
  const material = aperture.createUnlitMaterialAsset({
    label: "InstanceAttributesExtractionPlaceholder",
    baseColorFactor: new Float32Array([0.2, 0.78, 0.95, 1]),
    renderState: { cullMode: "none" },
  });
  const aspect = canvasSize.width / canvasSize.height;
  const samples = createSamplePoints(aspect);

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 8],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      projection: aperture.CameraProjection.Orthographic,
      aspect,
      orthographicHeight,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const translation = translationForCell(column, row);
      const phase = phaseForCell(column, row);
      const swayAmount = 0.14 + ((column * 7 + row * 11) % 9) * 0.026;
      const entity = world.createEntity();
      const transform = aperture.createRootTransform({
        translation: [translation[0], translation[1], 0],
        scale: [bladeScale, bladeScale, bladeScale],
      });

      entity.addComponent(aperture.WorldTransform, transform.world);
      entity.addComponent(aperture.Mesh, {
        meshId: aperture.assetHandleKey(meshHandle),
      });
      entity.addComponent(aperture.Material, {
        materialId: aperture.assetHandleKey(materialHandle),
      });
      entity.addComponent(aperture.RenderLayer, { mask: 1 });
      entity.addComponent(aperture.Visibility);
      entity.addComponent(
        aperture.InstanceData,
        aperture.createInstanceData({
          materialKind: materialFamily,
          values: { phase, swayAmount },
        }),
      );
    }
  }

  return { world, assets, mesh, meshHandle, material, materialHandle, samples };
}

function createBladeMesh() {
  return {
    kind: "mesh",
    label: "InstanceAttributeBlade",
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
          -0.5, -0.5, 0, 0, 0, 1, 0, 1, 0.5, -0.5, 0, 0, 0, 1, 1, 1, 0.5, 0.5,
          0, 0, 0, 1, 1, 0, -0.5, 0.5, 0, 0, 0, 1, 0, 0,
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
    localAabb: { min: [-0.82, -0.5, -0.02], max: [0.82, 0.5, 0.02] },
    localSphere: { center: [0, 0, 0], radius: 0.96 },
  };
}

function createSamplePoints(aspect) {
  return [
    sampleForCell("left-wave", 5, 12, aspect),
    sampleForCell("center-wave", 12, 11, aspect),
    sampleForCell("right-wave", 18, 13, aspect),
  ];
}

function sampleForCell(id, column, row, aspect) {
  const translation = translationForCell(column, row);
  const viewWidth = orthographicHeight * aspect;

  return {
    id,
    column,
    row,
    phase: phaseForCell(column, row),
    x: 0.5 + translation[0] / viewWidth,
    y: 0.5 - translation[1] / orthographicHeight,
  };
}

function translationForCell(column, row) {
  return [
    (column - (columns - 1) / 2) * spacing,
    ((rows - 1) / 2 - row) * spacing,
  ];
}

function phaseForCell(column, row) {
  return ((column * 19 + row * 31) % 97) * 0.37;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
