import {
  clearColor,
  fogSettingsForMode,
  normalizeFogMode,
  registerFogScene,
} from "./fog-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The fog worker raised an error.",
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
      scene = createWorkerScene(aperture, {
        canvas: data.canvas ?? { width: 960, height: 960 },
        mode: normalizeFogMode(data.mode),
      });
      self.postMessage({
        type: "ready",
        scene: {
          mode: scene.mode,
          meshKey: scene.meshKey,
          materialKey: scene.materialKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Fog worker scene is not initialized.");
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

function createWorkerScene(aperture, options) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const registered = registerFogScene(aperture, app.assets);
  const aspect = options.canvas.width / Math.max(1, options.canvas.height);
  const mode = normalizeFogMode(options.mode);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 7] }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      orthographicHeight: 3.2,
      aspect,
      near: 0.1,
      far: 40,
      clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withFog(fogSettingsForMode(mode)),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 1.35,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      rotation: quaternionFromForward([0.3, -0.45, -0.84]),
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 1.15,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.72, 0, 1] }),
    aperture.withMesh(registered.mesh),
    aperture.withMaterial(registered.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.72, 0, -8] }),
    aperture.withMesh(registered.mesh),
    aperture.withMaterial(registered.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    ...registered,
    app,
    mode,
  };
}

function createSnapshotMessage(workerScene, data) {
  const frame = Number.isInteger(data.frame) ? data.frame : 1;

  workerScene.app.step(0, 0);
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
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
