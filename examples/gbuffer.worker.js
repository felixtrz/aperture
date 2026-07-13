import {
  clearColor,
  gbufferCanvasSize,
  registerGBufferScene,
} from "./gbuffer-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The gbuffer worker raised an error.",
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
      scene = createWorkerScene(aperture, data.canvas ?? gbufferCanvasSize);
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
        throw new Error("gbuffer worker scene is not initialized.");
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
            views: snapshot.views.length,
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
    worldOptions: { entityCapacity: 16 },
  });
  const registered = registerGBufferScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  // G-buffer camera: renders the three boxes (layer 1) into the paired
  // albedo facade target; the material's colorTargets declaration attaches
  // normal + id at @location(1..2). Priority 0 orders it before the main
  // camera, so the resolve user pass samples same-frame content.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4.5] }),
    aperture.withCamera({
      aspect: 1,
      fovYDegrees: 50,
      near: 0.1,
      far: 100,
      priority: 0,
      layerMask: 1,
      clearColor: [0, 0, 0, 1],
      renderTargetId: aperture.assetHandleKey(registered.albedoTarget),
    }),
  );

  // Main camera: swapchain view seeing NOTHING (layer 2) — the resolve user
  // pass composites the G-buffer over its clear color.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4.5] }),
    aperture.withCamera({
      aspect,
      fovYDegrees: 50,
      near: 0.1,
      far: 100,
      priority: 1,
      layerMask: 2,
      clearColor,
    }),
  );

  // Three boxes on layer 1, identified by their world x band (red|green|blue).
  for (const x of [-1.4, 0, 1.4]) {
    app.spawn(
      aperture.withTransform({ translation: [x, 0, 0] }),
      aperture.withMesh(registered.mesh),
      aperture.withMaterial(registered.material),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
    );
  }

  return { ...registered, app };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
