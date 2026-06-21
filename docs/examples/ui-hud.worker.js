import {
  uiHudClearColor,
  uiHudFontId,
  uiHudSamplerId,
  uiHudTextureId,
} from "./ui-hud-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The UI HUD worker raised an error.",
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
          textureKey: aperture.assetHandleKey(scene.texture),
          samplerKey: aperture.assetHandleKey(scene.sampler),
          fontKey: aperture.assetHandleKey(scene.font),
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("UI HUD worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      scene.app.step(0, frame / 60);

      const snapshot = scene.app.extract(frame);
      const message = {
        type: "snapshot",
        frame,
        snapshot,
        workerStep: {
          views: snapshot.views.length,
          uiNodes: snapshot.uiNodes?.length ?? 0,
          uiHitRegions: snapshot.uiHitRegions?.length ?? 0,
          diagnostics: snapshot.diagnostics.length,
        },
      };

      self.postMessage(
        message,
        aperture.renderSnapshotTransferList(message.snapshot),
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
  const texture = aperture.createTextureHandle(uiHudTextureId);
  const sampler = aperture.createSamplerHandle(uiHudSamplerId);
  const font = aperture.createFontAtlasHandle(uiHudFontId);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4] }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      near: 0.1,
      far: 100,
      clearColor: uiHudClearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );

  const screen = app.spawn(
    aperture.withUiScreen({
      width: canvasSize.width,
      height: canvasSize.height,
      layerMask: 1,
    }),
  );
  const panel = app.spawn(
    aperture.withTransform({ parent: screen }),
    aperture.withUiNode({
      x: 100,
      y: 100,
      width: 360,
      height: 220,
      layoutMode: "absolute",
      zIndex: 1,
      clip: true,
    }),
    aperture.withUiPanel({ color: [0.05, 0.08, 0.14, 0.94] }),
    aperture.withUiHitTarget({ cursor: "pointer", priority: 2 }),
  );

  app.spawn(
    aperture.withTransform({ parent: panel }),
    aperture.withUiNode({ x: 40, y: 45, width: 90, height: 90 }),
    aperture.withUiImage({
      texture,
      sampler,
      color: [1, 1, 1, 1],
      uvRect: [0, 0, 1, 1],
    }),
  );
  app.spawn(
    aperture.withTransform({ parent: panel }),
    aperture.withUiNode({ x: 330, y: 120, width: 120, height: 80 }),
    aperture.withUiImage({
      texture,
      sampler,
      color: [1, 1, 1, 1],
      uvRect: [0, 0, 1, 1],
    }),
  );
  app.spawn(
    aperture.withTransform({ parent: panel }),
    aperture.withUiNode({ x: 190, y: 65, width: 150, height: 90 }),
    aperture.withUiText({
      text: "AV",
      fontAtlas: font,
      fontSize: 64,
      maxWidth: 150,
      color: [0.94, 0.98, 1, 1],
    }),
  );
  app.spawn(
    aperture.withTransform({ parent: screen }),
    aperture.withUiNode({
      x: 130,
      y: 130,
      width: 130,
      height: 70,
      zIndex: 2,
    }),
    aperture.withUiPanel({ color: [1, 0.08, 0.22, 0.95] }),
  );

  return {
    app,
    texture,
    sampler,
    font,
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
