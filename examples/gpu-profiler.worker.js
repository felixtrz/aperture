import {
  gpuProfilerClearColor as clearColor,
  gpuProfilerGridSize as gridSize,
  gpuProfilerOffscreenClearColor as offscreenClearColor,
  gpuProfilerSceneLayerMask as sceneLayerMask,
  gpuProfilerSpacing as spacing,
  registerGpuProfilerAssets,
} from "./gpu-profiler-assets.js";

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
          renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
          materialCount: scene.materials.length,
          cubeCount: scene.cubeCount,
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
    worldOptions: { entityCapacity: 48 },
  });
  const assets = registerGpuProfilerAssets(aperture, app.assets);

  app.registerSystem(aperture.SpinSystem);

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.46, 0.52, 0.62, 1],
      intensity: 0.38,
      layerMask: sceneLayerMask,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: [0.12, -0.32, 0.08, 0.94] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.92, 0.76, 1],
      intensity: 2.2,
      layerMask: sceneLayerMask,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 5.2] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
      priority: 0,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0, 0.2, 5.6],
      rotation: [0, -0.258819, 0, 0.965926],
    }),
    aperture.withCamera({
      aspect: 1,
      near: 0.1,
      far: 100,
      clearColor: offscreenClearColor,
      layerMask: 2,
      priority: 1,
      renderTargetId: aperture.assetHandleKey(assets.renderTarget),
    }),
  );

  let cubeCount = 0;
  const start = -((gridSize - 1) * spacing) / 2;

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const index = y * gridSize + x;
      const material = assets.materials[index % assets.materials.length];

      app.spawn(
        aperture.withTransform({
          translation: [start + x * spacing, start + y * spacing, 0],
          scale: [0.88, 0.88, 0.88],
        }),
        aperture.withMesh(assets.mesh),
        aperture.withMaterial(material),
        aperture.withRenderLayer(sceneLayerMask),
        aperture.withVisibility(true),
        aperture.withSpin({
          radiansPerSecond: 0.35 + index * 0.015,
          axis: [0.25 + (index % 3) * 0.12, 1, 0.2],
        }),
      );
      cubeCount += 1;
    }
  }

  return {
    app,
    mesh: assets.mesh,
    materials: assets.materials,
    renderTarget: assets.renderTarget,
    cubeCount,
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

  const previousTimestamp = workerScene.previousTimestamp ?? timestamp;
  const elapsedSeconds = (timestamp - workerScene.firstTimestamp) / 1000;
  const deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
  const frame = finiteInteger(data.frame, 0);

  workerScene.previousTimestamp = timestamp;

  const step = workerScene.app.step(deltaSeconds, elapsedSeconds);
  const extractStartedAt = performance.now();
  const snapshot = workerScene.app.extract(frame);
  const extractMilliseconds = performance.now() - extractStartedAt;

  return {
    type: "snapshot",
    frame,
    snapshot,
    phaseTimingSamples: {
      extract: extractMilliseconds,
    },
    animation: {
      frames: frame,
      elapsedSeconds,
      deltaSeconds,
    },
    workerStep: {
      transformDiagnostics: step.transform.diagnostics.length,
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      diagnostics: snapshot.diagnostics.length,
      extractMilliseconds,
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
