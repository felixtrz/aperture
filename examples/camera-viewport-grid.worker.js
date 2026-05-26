const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const gridCells = [
  {
    id: "top-left",
    sampleId: "grid-top-left",
    layerMask: 1,
    materialName: "camera-viewport-grid-red",
    label: "red-cell",
    color: [0.95, 0.16, 0.08, 1],
    viewport: [0, 0, 0.5, 0.5],
    sample: { x: 0.25, y: 0.25 },
  },
  {
    id: "top-right",
    sampleId: "grid-top-right",
    layerMask: 2,
    materialName: "camera-viewport-grid-green",
    label: "green-cell",
    color: [0.12, 0.82, 0.28, 1],
    viewport: [0.5, 0, 0.5, 0.5],
    sample: { x: 0.75, y: 0.25 },
  },
  {
    id: "bottom-left",
    sampleId: "grid-bottom-left",
    layerMask: 4,
    materialName: "camera-viewport-grid-blue",
    label: "blue-cell",
    color: [0.08, 0.32, 1, 1],
    viewport: [0, 0.5, 0.5, 0.5],
    sample: { x: 0.25, y: 0.75 },
  },
  {
    id: "bottom-right",
    sampleId: "grid-bottom-right",
    layerMask: 8,
    materialName: "camera-viewport-grid-yellow",
    label: "yellow-cell",
    color: [0.95, 0.78, 0.08, 1],
    viewport: [0.5, 0.5, 0.5, 0.5],
    sample: { x: 0.75, y: 0.75 },
  },
];

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message || "The camera viewport grid worker raised an error.",
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
    const scene = createCameraViewportGridWorld(aperture, canvasSize);
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
          expectedViewCount: 4,
          expectedExtractedDrawCount: 4,
          expectedViewDrawCount: 1,
          filterDrawsByViewLayer: true,
          samplePoints: gridCells.map((cell) => ({
            id: cell.sampleId,
            x: cell.sample.x,
            y: cell.sample.y,
          })),
          viewportGrid: {
            mode: "four-camera-normalized-viewport-grid",
            rows: 2,
            columns: 2,
            sharedMeshKey: aperture.assetHandleKey(scene.meshHandle),
            expectedPerCamera: {
              includedDraws: 1,
              skippedDraws: 3,
            },
            cells: gridCells.map((cell, index) => {
              const materialHandle = scene.materialHandles.get(cell.id);
              const materialKey =
                materialHandle === undefined
                  ? null
                  : aperture.assetHandleKey(materialHandle);

              return {
                id: cell.id,
                viewId: index,
                priority: index,
                layerMask: cell.layerMask,
                viewport: cell.viewport,
                scissor: cell.viewport,
                viewportPixels: resolveViewportPixels(
                  canvasSize,
                  cell.viewport,
                ),
                materialKey,
                sampleId: cell.sampleId,
                expectedColor: cell.color,
              };
            }),
          },
          proof: {
            expectedMaterialSamples: gridCells.map((cell) => ({
              sampleId: cell.sampleId,
              material: cell.label,
              expectedColor: cell.color,
            })),
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

function createCameraViewportGridWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 12 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("camera-viewport-grid-plane");
  const mesh = aperture.createPlaneMeshAsset({
    label: "CameraViewportGridPlane",
    width: 1.2,
    height: 1.2,
  });
  const materialHandles = new Map();
  const materials = [];

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.markReady(meshHandle, mesh);

  for (const cell of gridCells) {
    const materialHandle = aperture.createMaterialHandle(cell.materialName);
    const material = aperture.createUnlitMaterialAsset({
      label: `CameraViewportGrid${cell.id}`,
      baseColorFactor: new Float32Array(cell.color),
    });

    materialHandles.set(cell.id, materialHandle);
    materials.push({
      handle: materialHandle,
      asset: material,
      label: cell.label,
    });
    assets.register(materialHandle);
    assets.markReady(materialHandle, material);
  }

  const cellAspect = (canvasSize.width * 0.5) / (canvasSize.height * 0.5);

  gridCells.forEach((cell, index) => {
    createCameraEntity(aperture, world, {
      layerMask: cell.layerMask,
      viewport: cell.viewport,
      scissor: cell.viewport,
      aspect: cellAspect,
      priority: index,
    });
  });

  for (const cell of gridCells) {
    const materialHandle = materialHandles.get(cell.id);

    if (materialHandle !== undefined) {
      createPlaneEntity(aperture, world, {
        meshHandle,
        materialHandle,
        layerMask: cell.layerMask,
      });
    }
  }

  return {
    world,
    assets,
    mesh,
    meshHandle,
    materialHandles,
    materials,
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
