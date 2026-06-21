const clearColor = [0.012, 0.016, 0.024, 1];
const columns = 16;
const rows = 16;
const instanceCount = columns * rows;
const spacing = 0.44;
const cubeScale = 0.15;
const orthographicHeight = 7.2;

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
  const assets = registerInstanceTintAssets(aperture, app.assets);
  const aspect = canvasSize.width / canvasSize.height;

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 8] }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      aspect,
      orthographicHeight,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tint = tintForCell(column, row);
      const translation = translationForCell(column, row);

      app.spawn(
        aperture.withTransform({
          translation: [translation[0], translation[1], 0],
          scale: [cubeScale, cubeScale, cubeScale],
        }),
        aperture.withMesh(assets.mesh),
        aperture.withMaterial(assets.material),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
        aperture.withInstanceTint(tint),
      );
    }
  }

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 0.55,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.96, 0.88, 1],
      intensity: 2.4,
      layerMask: 1,
    }),
  );

  return {
    app,
    mesh: assets.mesh,
    material: assets.material,
  };
}

function registerInstanceTintAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({
    registry,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "InstanceTintBox",
      width: 1,
      height: 1,
      depth: 1,
    }),
    { id: "instance-tint-box" },
  );
  const material = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "InstanceTintSharedStandard",
      baseColorFactor: new Float32Array([1, 1, 1, 1]),
      metallicFactor: 0,
      roughnessFactor: 1,
      renderState: { cullMode: "none" },
    }),
    { id: "instance-tint-standard" },
  );

  return { mesh, material };
}

function translationForCell(column, row) {
  return [
    (column - (columns - 1) / 2) * spacing,
    ((rows - 1) / 2 - row) * spacing,
  ];
}

function tintForCell(column, row) {
  const hue = (column / Math.max(1, columns - 1)) * (2 / 3);
  const value = 0.86 + (1 - row / Math.max(1, rows - 1)) * 0.14;
  const rgb = hsvToRgb(hue, 0.92, value);

  return [rgb[0], rgb[1], rgb[2], 1];
}

function hsvToRgb(hue, saturation, value) {
  const scaled = hue * 6;
  const sector = Math.floor(scaled);
  const fraction = scaled - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);

  switch (sector % 6) {
    case 0:
      return [value, t, p];
    case 1:
      return [q, value, p];
    case 2:
      return [p, value, t];
    case 3:
      return [p, q, value];
    case 4:
      return [t, p, value];
    default:
      return [value, p, q];
  }
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
