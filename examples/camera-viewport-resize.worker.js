const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const layerMask = 1;
const resizeColor = [0.86, 0.2, 0.95, 1];
const frameSpecs = [
  {
    frame: 1,
    role: "before",
    viewport: [0.125, 0.125, 0.25, 0.25],
    scissor: [0.125, 0.125, 0.25, 0.25],
  },
  {
    frame: 2,
    role: "after",
    viewport: [0.5, 0.375, 0.5, 0.5],
    scissor: [0.5, 0.375, 0.5, 0.5],
  },
];
const samplePoints = [
  { id: "old-viewport-center", x: 0.25, y: 0.25 },
  { id: "new-viewport-center", x: 0.75, y: 0.625 },
];

let apertureModulePromise = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message || "The camera viewport resize worker raised an error.",
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
    const scene = createCameraViewportResizeWorld(aperture, canvasSize);
    const extractedFrames = frameSpecs.map((spec) => {
      applyCameraFrame(aperture, scene.camera, canvasSize, spec);

      return {
        frame: spec.frame,
        role: spec.role,
        snapshot: aperture.extractRenderSnapshot(scene.world, scene.assets, {
          frame: spec.frame,
        }),
      };
    });
    const materialKey = aperture.assetHandleKey(scene.materialHandle);
    const meshKey = aperture.assetHandleKey(scene.meshHandle);
    const frameStatuses = extractedFrames.map((entry) => {
      const view = entry.snapshot.views[0];
      const spec =
        frameSpecs.find((candidate) => candidate.frame === entry.frame) ??
        frameSpecs[0];

      return {
        frame: entry.frame,
        role: entry.role,
        cameraHandle: {
          kind: "ecs-entity-index",
          index: scene.camera.index,
        },
        viewId: view?.viewId ?? null,
        viewport: view === undefined ? spec.viewport : Array.from(view.viewport),
        scissor: view === undefined ? spec.scissor : Array.from(view.scissor),
        viewportPixels: resolveViewportPixels(canvasSize, spec.viewport),
        scissorPixels: resolveViewportPixels(canvasSize, spec.scissor),
      };
    });

    self.postMessage(
      {
        type: "snapshots",
        frames: extractedFrames,
        scene: {
          meshKey,
          mesh: scene.mesh,
          materials: [
            {
              key: materialKey,
              handle: scene.materialHandle,
              asset: scene.material,
              label: "resize-layer",
            },
          ],
          expectedFrameCount: 2,
          expectedViewCount: 1,
          expectedDrawCount: 1,
          samplePoints,
          samplePointsByFrame: {
            1: samplePoints,
            2: samplePoints,
          },
          viewportResizeMatrix: {
            mode: "same-ecs-camera-viewport-scissor-resize",
            source: "Camera.viewport+Camera.scissor",
            target: "current-texture",
            cameraHandle: {
              kind: "ecs-entity-index",
              index: scene.camera.index,
            },
            meshAuthoring: {
              entityHandle: {
                kind: "ecs-entity-index",
                index: scene.meshEntity.index,
              },
              meshKey,
              materialKey,
              stableAcrossFrames: true,
            },
            expectedSamples: {
              before: {
                material: "old-viewport-center",
                clear: "new-viewport-center",
              },
              after: {
                material: "new-viewport-center",
                clear: "old-viewport-center",
              },
            },
            framesRequested: frameSpecs.map((spec) => spec.frame),
            frames: frameStatuses,
          },
          proof: {
            expectedFrameSamples: [
              {
                frame: 1,
                materialSample: "old-viewport-center",
                clearSample: "new-viewport-center",
                expectedColor: resizeColor,
              },
              {
                frame: 2,
                materialSample: "new-viewport-center",
                clearSample: "old-viewport-center",
                expectedColor: resizeColor,
              },
            ],
          },
        },
      },
      extractedFrames.flatMap((entry) =>
        aperture.renderSnapshotTransferList(entry.snapshot),
      ),
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

function createCameraViewportResizeWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("camera-viewport-resize-plane");
  const materialHandle = aperture.createMaterialHandle(
    "camera-viewport-resize-material",
  );
  const mesh = aperture.createPlaneMeshAsset({
    label: "CameraViewportResizePlane",
    width: 1.35,
    height: 1.35,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "CameraViewportResizeMaterial",
    baseColorFactor: new Float32Array(resizeColor),
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
  const initialFrame = frameSpecs[0];

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: aspectForViewport(canvasSize, initialFrame.viewport),
      near: 0.1,
      far: 100,
      viewport: initialFrame.viewport,
      scissor: initialFrame.scissor,
      priority: 0,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask,
    }),
  );

  const meshEntity = world.createEntity();
  const meshTransform = aperture.createRootTransform();

  meshEntity.addComponent(aperture.WorldTransform, meshTransform.world);
  meshEntity.addComponent(aperture.Mesh, {
    meshId: aperture.assetHandleKey(meshHandle),
  });
  meshEntity.addComponent(aperture.Material, {
    materialId: aperture.assetHandleKey(materialHandle),
  });
  meshEntity.addComponent(aperture.RenderLayer, { mask: layerMask });
  meshEntity.addComponent(aperture.Visibility);

  return {
    world,
    assets,
    camera,
    meshEntity,
    mesh,
    meshHandle,
    material,
    materialHandle,
  };
}

function applyCameraFrame(aperture, camera, canvasSize, spec) {
  camera.getVectorView(aperture.Camera, "viewport").set(spec.viewport);
  camera.getVectorView(aperture.Camera, "scissor").set(spec.scissor);
  camera.setValue(
    aperture.Camera,
    "aspect",
    aspectForViewport(canvasSize, spec.viewport),
  );
}

function aspectForViewport(canvasSize, viewport) {
  return (canvasSize.width * viewport[2]) / (canvasSize.height * viewport[3]);
}

function resolveViewportPixels(canvasSize, viewport) {
  const left = Math.round(canvasSize.width * viewport[0]);
  const top = Math.round(canvasSize.height * viewport[1]);
  const right = Math.round(canvasSize.width * (viewport[0] + viewport[2]));
  const bottom = Math.round(canvasSize.height * (viewport[1] + viewport[3]));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
