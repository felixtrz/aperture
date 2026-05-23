import { dofCanvasSize, dofClearColor, registerDofScene } from "./dof-scene.js";

const stripeCount = 31;
const stripeStartX = -2.7;
const stripeStep = 0.18;
const focusBoxRotation = [0.071, 0.191, -0.018, 0.979];

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The DOF worker raised an error.",
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
      scene = createWorkerScene(aperture, data.canvas ?? dofCanvasSize);
      self.postMessage({
        type: "ready",
        scene: {
          meshKeys: scene.registered.meshKeys,
          materialKeys: scene.registered.materialKeys,
          stripeCount,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("DOF worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      scene.app.step(0, frame / 60);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 48 },
  });
  const registered = registerDofScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4] }),
    aperture.withCamera({
      aspect,
      fovYRadians: Math.PI / 4,
      near: 0.1,
      far: 20,
      clearColor: dofClearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );

  for (let index = 0; index < stripeCount; index += 1) {
    app.spawn(
      aperture.withTransform({
        translation: [stripeStartX + index * stripeStep, 0, -2.2],
      }),
      aperture.withMesh(registered.stripeMesh),
      aperture.withMaterial(
        index % 2 === 0
          ? registered.brightStripeMaterial
          : registered.darkStripeMaterial,
      ),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
    );
  }

  app.spawn(
    aperture.withTransform({
      translation: [0, 0, 0.8],
      rotation: focusBoxRotation,
    }),
    aperture.withMesh(registered.focusBoxMesh),
    aperture.withMaterial(registered.focusBoxMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    app,
    registered,
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
