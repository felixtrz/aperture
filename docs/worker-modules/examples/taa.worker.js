import {
  cameraPanForFrame,
  clearColor,
  objectMotionForFrame,
  registerTaaScene,
  taaCanvasSize,
  temporalJitterForFrame,
} from "./taa-scene.js";

const edgeRotation = [0, 0, 0.258819, 0.965926];

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The TAA worker raised an error.",
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
      scene = createWorkerScene(aperture, data.canvas ?? taaCanvasSize);
      self.postMessage({
        type: "ready",
        scene: {
          meshKey: scene.meshKey,
          materialKey: scene.materialKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("TAA worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      updateCameraForFrame(aperture, scene, frame);
      updateObjectForFrame(aperture, scene, frame);
      scene.app.step(0, frame / 60);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            jitter: scene.jitter,
            pan: scene.pan,
            objectOffset: scene.objectOffset,
            transforms: snapshot.transforms.length / 16,
            viewMatrices: snapshot.viewMatrices.length / 16,
            meshDraws: snapshot.meshDraws.length,
            diagnostics: snapshot.diagnostics.length,
          },
        },
        aperture.renderSnapshotTransferList(snapshot),
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

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 4 },
  });
  const registered = registerTaaScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);
  const camera = app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.6] }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      orthographicHeight: 2.15,
      aspect,
      near: 0.1,
      far: 20,
      clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );

  const edge = app.spawn(
    aperture.withTransform({
      translation: [-0.08, 0, 0],
      rotation: edgeRotation,
    }),
    aperture.withMesh(registered.edgeMesh),
    aperture.withMaterial(registered.whiteMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    ...registered,
    app,
    camera,
    edge,
    jitter: [0, 0],
    pan: 0,
    objectOffset: 0,
    canvasSize,
  };
}

function updateCameraForFrame(aperture, currentScene, frame) {
  const jitter = temporalJitterForFrame(
    frame,
    currentScene.canvasSize.width,
    currentScene.canvasSize.height,
  );
  const pan = cameraPanForFrame(frame);

  currentScene.camera.setValue(aperture.Camera, "temporalJitterX", jitter[0]);
  currentScene.camera.setValue(aperture.Camera, "temporalJitterY", jitter[1]);
  currentScene.camera
    .getVectorView(aperture.LocalTransform, "translation")
    .set([pan, 0, 2.6]);
  currentScene.jitter = jitter;
  currentScene.pan = pan;
}

function updateObjectForFrame(aperture, currentScene, frame) {
  const objectOffset = objectMotionForFrame(frame);

  currentScene.edge
    .getVectorView(aperture.LocalTransform, "translation")
    .set([-0.08 + objectOffset, 0, 0]);
  currentScene.objectOffset = objectOffset;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
