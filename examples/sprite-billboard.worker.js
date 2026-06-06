import {
  cameraStates,
  clearColor,
  registerSpriteBillboardScene,
  spriteProofs,
} from "./sprite-billboard-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The sprite billboard worker raised an error.",
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
          textureKey: scene.textureKey,
          samplerKey: scene.samplerKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Sprite billboard worker scene is not initialized.");
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
    worldOptions: { entityCapacity: 8 },
  });
  const registered = registerSpriteBillboardScene(aperture, app.assets);
  const cameraEntity = app.spawn(
    aperture.withTransform({
      translation: [0, 0, cameraStates.front.distance],
    }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  const spriteEntities = spriteProofs.map((proof, index) =>
    app.spawn(
      aperture.withTransform({ translation: proof.translation }),
      aperture.withSprite({
        texture: registered.texture,
        sampler: registered.sampler,
        size: proof.size,
        color: [1, 1, 1, 1],
        uvRect: proof.uvRect,
        pivot: proof.pivot,
        rotation: proof.rotation,
        billboardMode: proof.billboardMode,
        sizeMode: proof.sizeMode,
      }),
      aperture.withRenderLayer(1),
      aperture.withRenderOrder(index),
      aperture.withVisibility(true),
    ),
  );

  return {
    ...registered,
    app,
    cameraEntity,
    spriteEntities,
    canvasSize,
  };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const frame = Number.isInteger(data.frame) ? data.frame : 1;
  const cameraState =
    data.camera === "orbit" ? cameraStates.orbit : cameraStates.front;

  updateOrbitCamera(aperture, workerScene.cameraEntity, cameraState);
  workerScene.app.step(0, frame / 60);
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    camera: data.camera === "orbit" ? "orbit" : "front",
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      spriteDraws: snapshot.spriteDraws?.length ?? 0,
      quadInstances:
        (snapshot.quads?.instanceFloats.length ?? 0) /
        (snapshot.quads?.instanceFloatStride ?? 1),
      quadBatches: snapshot.quadBatches?.length ?? 0,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function updateOrbitCamera(aperture, cameraEntity, state) {
  const elevation = state.elevation ?? 0;
  const elevationDistance = Math.cos(elevation) * state.distance;
  const x = state.target[0] + Math.sin(state.yaw) * elevationDistance;
  const y = state.target[1] + Math.sin(elevation) * state.distance;
  const z = state.target[2] + Math.cos(state.yaw) * elevationDistance;
  const halfYaw = state.yaw * 0.5;
  const halfPitch = -elevation * 0.5;
  const yawSin = Math.sin(halfYaw);
  const yawCos = Math.cos(halfYaw);
  const pitchSin = Math.sin(halfPitch);
  const pitchCos = Math.cos(halfPitch);

  cameraEntity
    .getVectorView(aperture.LocalTransform, "translation")
    .set([x, y, z]);
  cameraEntity
    .getVectorView(aperture.LocalTransform, "rotation")
    .set([
      yawCos * pitchSin,
      yawSin * pitchCos,
      -yawSin * pitchSin,
      yawCos * pitchCos,
    ]);
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
