import {
  matcapClearColor as clearColor,
  matcapSpinAxis as spinAxis,
  matcapSpinRadiansPerSecond as spinRadiansPerSecond,
  registerMatcapAppAssets,
} from "./matcap-app-assets.js";

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
          materialKind: scene.materialAsset.kind,
          textureKey: aperture.assetHandleKey(scene.texture),
          samplerKey: aperture.assetHandleKey(scene.sampler),
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
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

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 12 },
  });
  const assets = registerMatcapAppAssets(aperture, app.assets);

  app.registerSystem(aperture.SpinSystem);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  const cube = app.spawn(
    aperture.withTransform(),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withSpin({
      radiansPerSecond: spinRadiansPerSecond,
      axis: spinAxis,
    }),
  );

  return {
    app,
    cube,
    mesh: assets.mesh,
    material: assets.material,
    materialAsset: assets.materialAsset,
    texture: assets.texture,
    sampler: assets.sampler,
    firstTimestamp: null,
    previousTimestamp: null,
  };
}

function createSnapshotMessage(workerScene, data) {
  const timestamp = finiteNumber(data.timestamp, 0);

  if (workerScene.firstTimestamp === null) {
    workerScene.firstTimestamp = timestamp;
    workerScene.previousTimestamp = timestamp;
  }

  if (data.resetDelta === true) {
    workerScene.previousTimestamp = timestamp;
  }

  const previousTimestamp = workerScene.previousTimestamp ?? timestamp;
  const elapsedSeconds = (timestamp - workerScene.firstTimestamp) / 1000;
  const deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
  const frame = finiteInteger(data.frame, 0);

  workerScene.previousTimestamp = timestamp;

  const step = workerScene.app.step(deltaSeconds, elapsedSeconds);
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    animation: {
      frames: frame,
      elapsedSeconds,
      deltaSeconds,
      rotationRadians: elapsedSeconds * spinRadiansPerSecond,
      radiansPerSecond: spinRadiansPerSecond,
      spinAxis,
    },
    workerStep: {
      transformDiagnostics: step.transform.diagnostics.length,
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
