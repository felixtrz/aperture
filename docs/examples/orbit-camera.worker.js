import { createOrbitCameraController } from "@aperture-engine/app";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/aperture/worker-modules/packages/app/dist/asset-mirror.js";

// M7-T9 render-control route (orbit camera): an unlit box sits at the orbit
// target, with a distinct unlit side marker offset from it. The simulation runs the
// proven low-level extraction app + drives the reusable createOrbitCameraController
// over the camera entity (the controller only writes LocalTransform via the ECS
// component path, so it works with any world). The main thread forwards a scripted
// pointer drag (orbit) and wheel (zoom) per frame; the rendered image changes (orbit
// sweeps the side marker across the view; zoom scales the box on screen) — proven by
// the main-thread pixel readbacks + the published azimuth/distance.

const clearColor = [0.02, 0.03, 0.05, 1];
const ROTATE_SPEED = Math.PI;

let apertureModulePromise = null;
let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The orbit-camera simulation worker errored.",
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
          orbit: {
            azimuth: scene.controller.azimuth,
            elevation: scene.controller.elevation,
            distance: scene.controller.distance,
            eye: scene.controller.eyePosition(),
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
      label: "OrbitBox",
      width: 1.8,
      height: 1.8,
      depth: 1.8,
    }),
    { id: "orbit-box" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OrbitBoxUnlit",
      baseColorFactor: [0.9, 0.45, 0.2, 1],
    }),
    { id: "orbit-box-unlit" },
  );
  // A distinct side marker offset from the orbit target: horizontal orbit sweeps
  // it across the view, so the rendered image (and side readback samples) change.
  const markerMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OrbitMarkerUnlit",
      baseColorFactor: [0.2, 0.75, 0.95, 1],
    }),
    { id: "orbit-marker-unlit" },
  );

  const camera = app.spawn(
    aperture.withTransform({ translation: [0, 0, 6] }),
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
    aperture.withTransform({ translation: [1.9, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(markerMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  const controller = createOrbitCameraController({
    camera: { index: camera.index, generation: camera.generation },
    target: [0, 0, 0],
    distance: 6,
    azimuth: 0,
    elevation: 0.18,
    rotateSpeed: ROTATE_SPEED,
    minDistance: 2,
    maxDistance: 20,
  });
  controller.applyTo(app.world);

  return { app, controller, mesh, material, lastPointer: null };
}

function applyInput(scene, data) {
  const pointer = data.pointer;
  if (pointer && pointer.pressed === true) {
    if (scene.lastPointer !== null) {
      scene.controller.orbitFromDrag(
        finiteNumber(pointer.x, 0) - scene.lastPointer.x,
        finiteNumber(pointer.y, 0) - scene.lastPointer.y,
      );
    }
    scene.lastPointer = {
      x: finiteNumber(pointer.x, 0),
      y: finiteNumber(pointer.y, 0),
    };
  } else {
    scene.lastPointer = null;
  }

  const wheel = finiteNumber(data.wheel, 0);
  if (wheel !== 0) {
    scene.controller.zoomFromWheel(wheel);
  }
}

function sceneSummary(scene) {
  return {
    target: [0, 0, 0],
    distance: scene.controller.distance,
    azimuth: scene.controller.azimuth,
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
