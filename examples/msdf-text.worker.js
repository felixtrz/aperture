import {
  backgrounds,
  createMsdfTextSnapshot,
  registerMsdfTextScene,
} from "./msdf-text-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The MSDF text worker raised an error.",
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
          textureKey: scene.textureKey,
          samplerKey: scene.samplerKey,
          font: scene.font.label,
          glyphCount: scene.glyphCount,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("MSDF text worker scene is not initialized.");
      }

      const snapshotMessage = createSnapshotMessage(aperture, scene, data);
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

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 4 },
  });
  const registered = registerMsdfTextScene(aperture, app.assets);

  app.spawn(
    aperture.withTransform({
      translation: [0, 0, 4],
    }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      near: 0.1,
      far: 100,
      clearColor: backgrounds.dark.clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );

  return {
    ...registered,
    app,
    canvasSize,
  };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const frame = Number.isInteger(data.frame) ? data.frame : 1;
  const theme = data.background === "light" ? "light" : "dark";

  workerScene.app.step(0, frame / 60);
  const baseSnapshot = workerScene.app.extract(frame);
  const snapshot = createMsdfTextSnapshot(
    aperture,
    workerScene,
    baseSnapshot,
    theme,
  );

  return {
    type: "snapshot",
    frame,
    background: theme,
    clearColor: backgrounds[theme].clearColor,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      glyphQuadInstances:
        (snapshot.quads?.instanceFloats.length ?? 0) /
        (snapshot.quads?.instanceFloatStride ?? 1),
      quadBatches: snapshot.quadBatches?.length ?? 0,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
