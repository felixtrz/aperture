import { registerSsaoIndirectScene } from "./ssao-indirect-scene.js";

const clearColor = [0.05, 0.06, 0.075, 1];
const floorRotation = [-0.70710678, 0, 0, 0.70710678];
const sideWallRotation = [0, 0.70710678, 0, 0.70710678];

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The SSAO-indirect worker raised an error.",
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
        data.canvas ?? { width: 512, height: 512 },
      );
      self.postMessage({
        type: "ready",
        scene: {
          floorMaterialKey: scene.registered.floorMaterialKey,
          cubeMaterialKey: scene.registered.cubeMaterialKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("SSAO-indirect worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      scene.app.step(0, frame / 60);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            meshDraws: snapshot.meshDraws.length,
            diagnostics: snapshot.diagnostics.length,
          },
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
  const registered = registerSsaoIndirectScene(aperture, app.assets);
  const cameraPosition = [2.15, 1.18, 3.45];
  const cameraTarget = [-0.38, -0.36, -0.62];
  const cameraForward = normalize([
    cameraTarget[0] - cameraPosition[0],
    cameraTarget[1] - cameraPosition[1],
    cameraTarget[2] - cameraPosition[2],
  ]);

  app.spawn(
    aperture.withTransform({
      translation: cameraPosition,
      rotation: quaternionFromForward(cameraForward),
    }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      near: 0.1,
      far: 40,
      clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      // Ambient-dominant so AO has a large indirect term to remove in creases.
      intensity: 0.95,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      rotation: quaternionFromForward([-0.36, -0.58, -0.73]),
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.96, 0.9, 1],
      intensity: 0.45,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0, -0.9, 0.65],
      rotation: floorRotation,
    }),
    aperture.withMesh(registered.floorMesh),
    aperture.withMaterial(registered.floorMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0.5, -1.56] }),
    aperture.withMesh(registered.wallMesh),
    aperture.withMaterial(registered.wallMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({
      translation: [-1.56, 0.5, 0.65],
      rotation: sideWallRotation,
    }),
    aperture.withMesh(registered.wallMesh),
    aperture.withMaterial(registered.wallMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({
      translation: [-0.42, -0.51, -0.72],
      rotation: [0.05, -0.2, 0.02, 0.978],
    }),
    aperture.withMesh(registered.cubeMesh),
    aperture.withMaterial(registered.cubeMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return { app, registered };
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

  if (length <= 0.00001) {
    return [0, 0, -1];
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
