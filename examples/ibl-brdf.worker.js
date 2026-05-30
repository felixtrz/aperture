// Static metal sphere lit by the Pisa HDR environment. The sphere does not spin
// so the grazing-vs-facing GPU-readback probes land on stable surface points
// across frames, isolating the split-sum environment-BRDF (DFG) horizon term.

const clearColor = [0.015, 0.025, 0.035, 1];

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
          environmentMapKey: aperture.assetHandleKey(scene.environmentMap),
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
        {
          type: "snapshot",
          frame,
          snapshot,
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
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "IblBrdfSphere",
      radius: 1.3,
      widthSegments: 96,
      heightSegments: 64,
    }),
    { id: "ibl-brdf-sphere" },
  );
  const materialAsset = aperture.createStandardMaterialAsset({
    label: "IblBrdfMetal",
    baseColorFactor: new Float32Array([0.95, 0.78, 0.42, 1]),
    metallicFactor: 1,
    roughnessFactor: 0.22,
    emissiveFactor: [0, 0, 0],
  });
  const material = assets.materials.standard.add(materialAsset, {
    id: "ibl-brdf-metal",
  });
  const environmentMap = aperture.createEnvironmentMapHandle(
    "spinning-cube-pisa-studio",
  );

  app.assets.register(environmentMap, { label: "IBL BRDF Pisa HDR studio" });
  app.assets.markReady(environmentMap, {
    label: "IBL BRDF Pisa HDR studio",
    diffuseResourceKey: "spinning-cube-pisa-studio/diffuse",
    specularResourceKey: "spinning-cube-pisa-studio/specular-prefilter",
  });

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.45] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
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
      color: [0.5, 0.56, 0.68, 1],
      intensity: 0.2,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 1.6,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Environment,
      color: [1, 1, 1, 1],
      intensity: 1,
      layerMask: 1,
      environmentMap,
    }),
  );

  return { app, mesh, material, materialAsset, environmentMap };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
