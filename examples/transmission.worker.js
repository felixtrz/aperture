import {
  clearColor,
  registerTransmissionScene,
  transmissionStripeCount,
  transmissionStripeSpan,
} from "./transmission-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The transmission worker raised an error.",
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
        data.canvas ?? { width: 960, height: 960 },
      );
      self.postMessage({
        type: "ready",
        scene: {
          sphereMeshKey: scene.sphereMeshKey,
          panelMeshKey: scene.panelMeshKey,
          glassMaterialKey: scene.glassMaterialKey,
          roughGlassMaterialKey: scene.roughGlassMaterialKey,
          brightBackgroundMaterialKey: scene.brightBackgroundMaterialKey,
          darkBackgroundMaterialKey: scene.darkBackgroundMaterialKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Transmission worker scene is not initialized.");
      }

      const snapshotMessage = createSnapshotMessage(scene, data);
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
    worldOptions: { entityCapacity: 32 },
  });
  const registered = registerTransmissionScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4.2] }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      orthographicHeight: 2.4,
      aspect,
      near: 0.1,
      far: 20,
      clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 0.18,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.2, 0.35, 3] }),
    aperture.withLight({
      kind: aperture.LightKind.Point,
      color: [0.82, 0.94, 1, 1],
      intensity: 10,
      range: 8,
      layerMask: 1,
    }),
  );
  spawnBackgroundStripes(aperture, app, registered);
  app.spawn(
    aperture.withTransform({ translation: [-0.48, 0, 0] }),
    aperture.withMesh(registered.sphereMesh),
    aperture.withMaterial(registered.glassMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.48, 0, 0] }),
    aperture.withMesh(registered.sphereMesh),
    aperture.withMaterial(registered.roughGlassMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    ...registered,
    app,
    canvasSize,
  };
}

function spawnBackgroundStripes(aperture, app, registered) {
  const stripeWidth = transmissionStripeSpan / transmissionStripeCount;
  const leftEdge = -transmissionStripeSpan * 0.5;

  for (let index = 0; index < transmissionStripeCount; index += 1) {
    const centerX = leftEdge + stripeWidth * (index + 0.5);
    const material =
      index % 2 === 0
        ? registered.brightBackgroundMaterial
        : registered.darkBackgroundMaterial;

    app.spawn(
      aperture.withTransform({
        translation: [centerX, 0, -0.35],
        scale: [stripeWidth * 0.98, 1.28, 0.04],
      }),
      aperture.withMesh(registered.panelMesh),
      aperture.withMaterial(material),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
    );
  }
}

function createSnapshotMessage(workerScene, data) {
  const frame = Number.isInteger(data.frame) ? data.frame : 1;

  workerScene.app.step(0, frame / 60);
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
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
