import {
  atmosphereFogSettings,
  clearColor,
  registerAtmosphereScene,
} from "./atmosphere-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The atmosphere worker raised an error.",
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
        data.canvas ?? { width: 960, height: 960 },
      );
      self.postMessage({
        type: "ready",
        scene: {
          skyboxTextureKey: scene.skyboxTextureKey,
          skyboxSamplerKey: scene.skyboxSamplerKey,
          spriteTextureKey: scene.spriteTextureKey,
          spriteSamplerKey: scene.spriteSamplerKey,
          markerMeshKey: scene.markerMeshKey,
          markerMaterialKey: scene.markerMaterialKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Atmosphere worker scene is not initialized.");
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
    worldOptions: { entityCapacity: 10 },
  });
  const registered = registerAtmosphereScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 7] }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      orthographicHeight: 3.6,
      aspect,
      near: 0.1,
      far: 40,
      clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withSkybox({
      texture: registered.skyboxTexture,
      sampler: registered.skyboxSampler,
      intensity: 1,
    }),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withFog(atmosphereFogSettings()),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 1.3,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      rotation: quaternionFromForward([0.32, -0.45, -0.83]),
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 1.05,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.94, -0.58, 1] }),
    aperture.withMesh(registered.markerMesh),
    aperture.withMaterial(registered.markerMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.94, -0.58, -8] }),
    aperture.withMesh(registered.markerMesh),
    aperture.withMaterial(registered.markerMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0.78, 0.5] }),
    aperture.withSprite({
      texture: registered.spriteTexture,
      sampler: registered.spriteSampler,
      size: [0.72, 0.72],
      color: [1, 1, 1, 1],
    }),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    ...registered,
    app,
    canvasSize,
  };
}

function createSnapshotMessage(workerScene, data) {
  const frame = Number.isInteger(data.frame) ? data.frame : 1;

  workerScene.app.step(0, frame / 60);
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      spriteDraws: snapshot.spriteDraws?.length ?? 0,
      skyboxes: snapshot.skyboxes?.length ?? 0,
      fogs: snapshot.fogs?.length ?? 0,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function quaternionFromForward(forward) {
  const zAxis = normalize([-forward[0], -forward[1], -forward[2]]);
  const xAxis = normalize(cross([0, 1, 0], zAxis));
  const yAxis = cross(zAxis, xAxis);

  return quaternionFromBasis(xAxis, yAxis, zAxis);
}

function quaternionFromBasis(xAxis, yAxis, zAxis) {
  const m00 = xAxis[0];
  const m01 = yAxis[0];
  const m02 = zAxis[0];
  const m10 = xAxis[1];
  const m11 = yAxis[1];
  const m12 = zAxis[1];
  const m20 = xAxis[2];
  const m21 = yAxis[2];
  const m22 = zAxis[2];
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    return [
      (m21 - m12) / scale,
      (m02 - m20) / scale,
      (m10 - m01) / scale,
      0.25 * scale,
    ];
  }

  if (m00 > m11 && m00 > m22) {
    const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [
      0.25 * scale,
      (m01 + m10) / scale,
      (m02 + m20) / scale,
      (m21 - m12) / scale,
    ];
  }

  if (m11 > m22) {
    const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [
      (m01 + m10) / scale,
      0.25 * scale,
      (m12 + m21) / scale,
      (m02 - m20) / scale,
    ];
  }

  const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [
    (m02 + m20) / scale,
    (m12 + m21) / scale,
    0.25 * scale,
    (m10 - m01) / scale,
  ];
}

function normalize(value) {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= 0.0001) {
    return [0, 0, 1];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
