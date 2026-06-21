const clearColor = [0.012, 0.016, 0.024, 1];
const instanceCount = 1000;
const columns = 40;
const rows = 25;

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
          instanceCount,
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
    worldOptions: { entityCapacity: instanceCount + 8 },
  });
  const assets = registerInstancingAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 16] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  for (let index = 0; index < instanceCount; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = (column - (columns - 1) / 2) * 0.42;
    const y = ((rows - 1) / 2 - row) * 0.42;

    app.spawn(
      aperture.withTransform({
        translation: [x, y, 0],
        scale: [0.14, 0.14, 0.14],
      }),
      aperture.withMesh(assets.mesh),
      aperture.withMaterial(assets.material),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
    );
  }

  return {
    app,
    mesh: assets.mesh,
    material: assets.material,
  };
}

function registerInstancingAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({
    registry,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "InstancedBox" }),
    { id: "instanced-box" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "InstancedCyan",
      baseColorFactor: new Float32Array([0.08, 0.72, 1, 1]),
    }),
    { id: "instanced-cyan" },
  );

  return { mesh, material };
}

function createSnapshotMessage(workerScene, data) {
  const frame = finiteInteger(data.frame, 1);

  const snapshot = workerScene.app.stepAndExtract(1 / 60, 1, frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
