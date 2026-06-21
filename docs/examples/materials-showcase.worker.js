import {
  materialsShowcaseClearColor as clearColor,
  materialsShowcaseCubeSpecs as cubeSpecs,
  materialsShowcaseSpinAxis as spinAxis,
  registerMaterialsShowcaseAssets,
} from "./materials-showcase-assets.js";

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
          environmentMapKey: aperture.assetHandleKey(scene.environmentMap),
          environmentMapKeys: scene.environmentMaps.map((handle) =>
            aperture.assetHandleKey(handle),
          ),
          cubeCount: scene.cubes.length,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
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
    worldOptions: { entityCapacity: 16 },
  });
  const assets = registerMaterialsShowcaseAssets(aperture, app.assets);

  app.registerSystem(aperture.SpinSystem);
  app.spawn(
    aperture.withTransform({ translation: [0, 0.16, 4.9] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  const cubes = cubeSpecs.map((spec) =>
    app.spawn(
      aperture.withTransform({ translation: spec.translation }),
      aperture.withMesh(assets.mesh),
      aperture.withMaterial(assets.materials[spec.key]),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
      aperture.withSpin({
        radiansPerSecond: spec.speed,
        axis: spinAxis,
      }),
    ),
  );

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.5, 0.56, 0.68, 1],
      intensity: 0.42,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 2.8,
      layerMask: 1,
    }),
  );
  const environmentEntity = app.spawn(
    aperture.withEnvironmentMap(assets.environmentMap, {
      color: [1, 1, 1, 1],
      intensity: 1,
      layerMask: 1,
    }),
  );

  return {
    app,
    cubes,
    mesh: assets.mesh,
    environmentMap: assets.environmentMap,
    environmentMaps: [assets.environmentMaps.warm, assets.environmentMaps.cool],
    environmentEntity,
    firstTimestamp: null,
    previousTimestamp: null,
    activeEnvironmentIndex: 0,
  };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const timestamp = finiteNumber(data.timestamp, 0);

  if (workerScene.firstTimestamp === null) {
    workerScene.firstTimestamp = timestamp;
    workerScene.previousTimestamp = timestamp;
  }

  const previousTimestamp = workerScene.previousTimestamp ?? timestamp;
  const elapsedSeconds = (timestamp - workerScene.firstTimestamp) / 1000;
  const deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
  const frame = finiteInteger(data.frame, 0);
  const activeEnvironmentIndex = Math.floor(elapsedSeconds / 1.4) % 2;
  const activeEnvironmentMap =
    workerScene.environmentMaps[activeEnvironmentIndex] ??
    workerScene.environmentMap;
  const activeEnvironmentMapKey = activeEnvironmentMap.id;

  workerScene.previousTimestamp = timestamp;
  workerScene.activeEnvironmentIndex = activeEnvironmentIndex;
  workerScene.environmentEntity.setValue(
    aperture.Light,
    "environmentMapId",
    aperture.assetHandleKey(activeEnvironmentMap),
  );

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
    },
    environment: {
      activeIndex: activeEnvironmentIndex,
      activeEnvironmentMapKey: aperture.assetHandleKey(activeEnvironmentMap),
      activeEnvironmentMapId: activeEnvironmentMapKey,
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
