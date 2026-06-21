// M2-T7 #3 proof route: a box rendered through the N-target storage-buffer
// morph path. Target 2 (the 3rd) translates the whole mesh out of the camera
// center, so the target-2 weight (from `init.morphTargetWeight`) decides whether
// the center readback pixel is the lit box or the clear color — isolating a
// 3rd-target contribution that the legacy 2-target cap could not express.
import { clearColor, registerMorphTargetScene } from "./morph-targets-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The morph-targets worker raised an error.",
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
        finiteNumber(data.morphTargetWeight, 0),
      );
      self.postMessage({
        type: "ready",
        scene: {
          meshKey: scene.meshKey,
          materialKey: scene.materialKey,
          targetCount: scene.targetCount,
          morphTargetWeight: scene.morphTargetWeight,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Morph-targets worker scene is not initialized.");
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

function createWorkerScene(aperture, canvasSize, morphTargetWeight) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const registered = registerMorphTargetScene(aperture, app.assets);
  const { mesh, material } = registered;

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.2] }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 0.6,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withMorphTargetWeights({ weights: [0, 0, morphTargetWeight] }),
  );

  return { app, ...registered, morphTargetWeight };
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
      meshDraws: snapshot.meshDraws.length,
      morphedDraws: snapshot.meshDraws.filter((draw) => draw.batchKey.morphed)
        .length,
      morphTargetCount: snapshot.meshDraws[0]?.morphTargetCount ?? 0,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
