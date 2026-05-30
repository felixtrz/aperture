// Static sphere with a bright (HDR > 1.0) emissive material. With the HDR scene
// buffer active the lit pass writes linear HDR (no in-material tonemap), so the
// >1.0 emissive survives into the rgba16float buffer and the final tonemap post
// stage applies exposure over it.

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The simulation worker raised an error.",
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
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const frame = finiteInteger(data.frame, 0);
      const snapshot = scene.app.stepAndExtract(0, 0, frame);

      self.postMessage(
        { type: "snapshot", frame, snapshot },
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
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "HdrExposureSphere",
      radius: 1.3,
      widthSegments: 64,
      heightSegments: 48,
    }),
    { id: "hdr-exposure-sphere" },
  );
  const materialAsset = aperture.createStandardMaterialAsset({
    label: "HdrExposureEmissive",
    baseColorFactor: new Float32Array([0.05, 0.05, 0.05, 1]),
    metallicFactor: 0,
    roughnessFactor: 1,
    // Bright HDR emissive highlight (red/green > 1.0) — only preserved in an
    // rgba16float buffer; exposure scales it before tonemapping. Magnitudes match
    // the main-thread scene asset (same id) that drives shading.
    emissiveFactor: [1.5, 1.0, 0.6],
  });
  const material = assets.materials.standard.add(materialAsset, {
    id: "hdr-exposure-emissive",
  });

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.6] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [0.01, 0.01, 0.015, 1],
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.3, 0.3, 0.35, 1],
      intensity: 0.05,
      layerMask: 1,
    }),
  );

  return { app, mesh, material, materialAsset };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
