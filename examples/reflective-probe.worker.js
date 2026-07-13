// Reflective probe (B2): a mirror sphere reflects three bright unlit boxes
// orbiting it. A cube-capture camera at the sphere centre re-captures the
// probe every N frames into a cube render target; the main thread prefilters
// the captured cube into the IBL environment the sphere's standard material
// samples. Layer masks keep the sphere out of its own capture (no feedback).

const CAPTURE_EVERY = 4;
const PROBE_TARGET_ID = "reflective-probe.env";
const SCENE_LAYER = 2; // orbiting boxes: captured by the probe.
const MIRROR_LAYER = 1; // mirror sphere: main camera only.

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
          probeTargetKey: aperture.assetHandleKey(scene.probeTarget),
          environmentMapKey: aperture.assetHandleKey(scene.environmentMap),
          captureEvery: CAPTURE_EVERY,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const frame = finiteInteger(data.frame, 0);
      // Fixed per-frame delta keeps the orbit (and therefore the captured
      // reflections) deterministic for the e2e pixel assertions.
      const delta = 1 / 60;
      const snapshot = scene.app.stepAndExtract(delta, frame * delta, frame);

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
    worldOptions: { entityCapacity: 32 },
  });

  app.registerSystem(aperture.SpinSystem);

  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const sphereMesh = assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "ReflectiveProbeSphere",
      radius: 1,
      widthSegments: 64,
      heightSegments: 48,
    }),
    { id: "reflective-probe-sphere" },
  );
  const mirrorMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ReflectiveProbeMirror",
      baseColorFactor: new Float32Array([0.95, 0.95, 0.95, 1]),
      metallicFactor: 1,
      roughnessFactor: 0,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "reflective-probe-mirror" },
  );
  const boxMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ReflectiveProbeBox",
      width: 1.1,
      height: 1.1,
      depth: 1.1,
    }),
    { id: "reflective-probe-box" },
  );
  const boxColors = [
    ["reflective-probe-box-red", [1, 0.12, 0.1, 1]],
    ["reflective-probe-box-green", [0.1, 1, 0.2, 1]],
    ["reflective-probe-box-blue", [0.15, 0.35, 1, 1]],
  ];
  const boxMaterials = boxColors.map(([id, color]) =>
    assets.materials.unlit.add(
      aperture.createUnlitMaterialAsset({
        label: id,
        baseColorFactor: new Float32Array(color),
      }),
      { id },
    ),
  );

  // The cube render target the capture camera renders into (worker-side copy
  // so extraction recognizes the capture camera; the renderer realizes the
  // main-side registration).
  const probeTarget = aperture.createRenderTargetHandle(PROBE_TARGET_ID);

  app.assets.register(probeTarget, { label: "Reflective probe target" });
  app.assets.markReady(
    probeTarget,
    aperture.createRenderTargetAsset({
      label: "Reflective probe target",
      dimension: "cube",
      size: 32,
    }),
  );

  // The environment-map descriptor the mirror's environment light references;
  // the main thread prepares its IBL resources from the captured cube.
  const environmentMap = aperture.createEnvironmentMapHandle(
    "reflective-probe-env",
  );

  app.assets.register(environmentMap, { label: "Reflective probe IBL" });
  app.assets.markReady(environmentMap, {
    label: "Reflective probe IBL",
    diffuseResourceKey: "reflective-probe/diffuse",
    specularResourceKey: "reflective-probe/specular",
  });

  // Cube-capture camera at the sphere centre: sees the orbiting boxes only.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withCamera({
      near: 0.1,
      far: 50,
      layerMask: SCENE_LAYER,
      priority: 0,
      clearColor: [0.01, 0.012, 0.02, 1],
      renderTargetId: `render-target:${PROBE_TARGET_ID}`,
      captureEvery: CAPTURE_EVERY,
    }),
  );

  // Main camera: sees the mirror sphere only — the orbiting boxes exist for
  // it exclusively through the captured probe's reflection (and can never
  // occlude the readback pixels).
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.4] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      layerMask: MIRROR_LAYER,
      priority: 1,
      clearColor: [0.01, 0.012, 0.02, 1],
    }),
  );

  // Mirror sphere lit by the captured environment.
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(sphereMesh),
    aperture.withMaterial(mirrorMaterial),
    aperture.withRenderLayer(MIRROR_LAYER),
    aperture.withVisibility(true),
  );

  // Orbiting unlit boxes: children of a spinning pivot so the probe content
  // changes between captures.
  const pivot = app.spawn(
    aperture.withTransform(),
    aperture.withSpin({ radiansPerSecond: 2.2, axis: [0, 1, 0] }),
  );

  boxMaterials.forEach((material, index) => {
    // Start the red box on world +Z: the sphere-centre reflection (and the
    // e2e readback) sees it right after the first capture.
    const angle = Math.PI / 2 + (index / boxMaterials.length) * Math.PI * 2;

    app.spawn(
      aperture.withTransform({
        translation: [Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2],
        parent: pivot,
      }),
      aperture.withMesh(boxMesh),
      aperture.withMaterial(material),
      aperture.withRenderLayer(SCENE_LAYER),
      aperture.withVisibility(true),
    );
  });

  // Low ambient so the mirror never renders pure black before the first
  // prefiltered capture arrives.
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.35, 0.4, 0.5, 1],
      intensity: 0.05,
      layerMask: SCENE_LAYER | MIRROR_LAYER,
    }),
  );

  // Environment light: the captured probe as IBL for the mirror layer.
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Environment,
      color: [1, 1, 1, 1],
      intensity: 1,
      layerMask: MIRROR_LAYER,
      environmentMap,
    }),
  );

  return { app, probeTarget, environmentMap };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
