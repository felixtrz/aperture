import {
  areaLightShapes,
  clearColor,
  registerAreaLightShapesScene,
} from "./area-light-shapes-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The simulation worker raised an error.",
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
    const aperture = await loadAperture();

    if (data?.type === "init") {
      scene = createWorkerScene(
        aperture,
        data.canvas ?? { width: 960, height: 540 },
      );
      self.postMessage({
        type: "ready",
        scene: {
          meshKey: aperture.assetHandleKey(scene.mesh),
          materialKey: aperture.assetHandleKey(scene.material),
          shapes: areaLightShapes,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const shape = areaLightShapes.find(
        (candidate) => candidate.shape === data.shape,
      );

      if (shape === undefined) {
        throw new Error(`Unknown area light shape '${String(data.shape)}'.`);
      }

      const snapshotMessage = createSnapshotMessage(aperture, scene, shape);
      self.postMessage(
        snapshotMessage,
        aperture.renderSnapshotTransferList(snapshotMessage.snapshot),
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      reason: "worker-frame-failed",
      message: messageFromError(error),
    });
  }
}

function loadAperture() {
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const registered = registerAreaLightShapesScene(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.3] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(registered.mesh),
    aperture.withMaterial(registered.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.08, 0.1, 0.14, 1],
      intensity: 0.2,
      layerMask: 1,
    }),
  );
  const areaLightEntity = app.spawn(
    aperture.withTransform({ translation: [0, 0.12, 1.18] }),
    aperture.withLight({
      kind: aperture.LightKind.RectArea,
      shape: aperture.AreaLightShape.Rect,
      color: [1, 0.93, 0.78, 1],
      intensity: areaLightShapes[0].intensity,
      width: areaLightShapes[0].width,
      height: areaLightShapes[0].height,
      layerMask: 1,
    }),
  );

  return {
    ...registered,
    app,
    areaLightEntity,
  };
}

function createSnapshotMessage(aperture, workerScene, shape) {
  workerScene.areaLightEntity.setValue(aperture.Light, "shape", shape.shape);
  workerScene.areaLightEntity.setValue(
    aperture.Light,
    "intensity",
    shape.intensity,
  );
  workerScene.areaLightEntity.setValue(aperture.Light, "width", shape.width);
  workerScene.areaLightEntity.setValue(aperture.Light, "height", shape.height);

  workerScene.app.step(0, 0);
  const frame =
    areaLightShapes.findIndex((candidate) => candidate.shape === shape.shape) +
    1;
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    shape,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
