import { createFpsCameraController } from "@aperture-engine/app";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/worker-modules/packages/app/dist/asset-mirror.js";

// H1 render-control route (pointer-lock FPS camera): an unlit box sits ahead of
// the camera with a distinct side marker offset from it. The simulation runs the
// proven low-level extraction app + drives the reusable createFpsCameraController
// over the camera entity (the controller only writes LocalTransform via the ECS
// component path). The main thread forwards a scripted pointer-lock look delta
// (turn) and a scripted WASD move (walk forward along the LEVEL forward); the
// rendered image changes (turning sweeps the marker across the view; walking
// forward grows the box) — proven by the main-thread pixel readbacks + the
// published yaw/pitch/position.

const clearColor = [0.02, 0.03, 0.05, 1];
const SENSITIVITY = 0.0022;

let apertureModulePromise = null;
let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The fps-camera simulation worker errored.",
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
      scene = createScene(aperture, data.canvas ?? { width: 960, height: 540 });
      self.postMessage({ type: "ready", scene: sceneSummary(scene) });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }
      const frame = finiteInteger(data.frame, 1);
      applyInput(scene, data);
      scene.controller.applyTo(scene.app.world);
      const snapshot = scene.app.stepAndExtract(
        finiteNumber(data.delta, 0),
        finiteNumber(data.time, 0),
        frame,
      );
      self.postMessage(
        {
          type: "snapshot",
          frame,
          phase: typeof data.phase === "string" ? data.phase : "idle",
          snapshot,
          sourceAssets: serializeSourceAssetRegistry(scene.app.assets, {
            state: sourceAssetState,
          }),
          fps: {
            yaw: scene.controller.yaw,
            pitch: scene.controller.pitch,
            position: [...scene.controller.position],
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

function createScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 16 },
  });
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "FpsBox",
      width: 1.8,
      height: 1.8,
      depth: 1.8,
    }),
    { id: "fps-box" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "FpsBoxUnlit",
      baseColorFactor: [0.9, 0.45, 0.2, 1],
    }),
    { id: "fps-box-unlit" },
  );
  const markerMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "FpsMarkerUnlit",
      baseColorFactor: [0.2, 0.75, 0.95, 1],
    }),
    { id: "fps-marker-unlit" },
  );

  const camera = app.spawn(
    aperture.withTransform({ translation: [0, 0, 8] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  // A box straight ahead (down -Z) plus a distinct marker off to the right: a
  // forward walk grows the box (it starts small at distance 8), then a look-turn
  // sweeps them across the view.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [2.1, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(markerMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  const controller = createFpsCameraController({
    camera: { index: camera.index, generation: camera.generation },
    position: [0, 0, 8],
    yaw: 0,
    pitch: 0,
    sensitivity: SENSITIVITY,
  });
  controller.applyTo(app.world);

  return { app, controller, mesh, material };
}

function applyInput(scene, data) {
  const look = data.look;
  if (look) {
    scene.controller.lookFromPointerLock(
      finiteNumber(look.dx, 0),
      finiteNumber(look.dy, 0),
    );
  }
  const move = data.move;
  if (move) {
    scene.controller.move(
      finiteNumber(move.forward, 0),
      finiteNumber(move.right, 0),
      finiteNumber(move.up, 0),
    );
  }
}

function sceneSummary(scene) {
  return {
    yaw: scene.controller.yaw,
    pitch: scene.controller.pitch,
    position: [...scene.controller.position],
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
