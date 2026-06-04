import {
  cubeRotation,
  customGraphPassCanvasSize,
  registerCustomGraphPassScene,
} from "./custom-graph-pass-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The custom-graph-pass worker raised an error.",
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
        data.canvas ?? customGraphPassCanvasSize,
      );
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
        throw new Error("custom-graph-pass worker scene is not initialized.");
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
    worldOptions: { entityCapacity: 8 },
  });
  const registered = registerCustomGraphPassScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera({
      aspect,
      near: 0.1,
      far: 100,
      clearColor: [0.02, 0.03, 0.05, 1],
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: cubeRotation }),
    aperture.withMesh(registered.mesh),
    aperture.withMaterial(registered.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return { ...registered, app };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
