import { createMapCameraController } from "@aperture-engine/app";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/worker-modules/packages/app/dist/asset-mirror.js";

// H1 render-control route (pan/map camera): an oblique map camera looks down at
// an unlit box on the ground with a distinct side marker beside it. The
// simulation runs the proven low-level extraction app + drives the reusable
// createMapCameraController over the camera entity (the controller only writes
// LocalTransform via the ECS component path). The main thread forwards a scripted
// pan drag (target slides across the ground XZ plane, eye follows) and a scripted
// wheel zoom (dolly in, box grows) — proven by the main-thread pixel readbacks +
// the published target/distance/eye.

const clearColor = [0.02, 0.03, 0.05, 1];

let apertureModulePromise = null;
let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The map-camera simulation worker errored.",
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
          map: {
            target: [...scene.controller.target],
            distance: scene.controller.distance,
            heading: scene.controller.heading,
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
      label: "MapBox",
      width: 1.8,
      height: 1.8,
      depth: 1.8,
    }),
    { id: "map-box" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "MapBoxUnlit",
      baseColorFactor: [0.9, 0.45, 0.2, 1],
    }),
    { id: "map-box-unlit" },
  );
  const markerMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "MapMarkerUnlit",
      baseColorFactor: [0.2, 0.75, 0.95, 1],
    }),
    { id: "map-marker-unlit" },
  );

  const camera = app.spawn(
    aperture.withTransform({ translation: [0, 6, 6] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  // A box at the map origin plus a distinct marker beside it on the ground: a
  // pan slides both across the view; a zoom-in grows them.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [2.2, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(markerMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  const controller = createMapCameraController({
    camera: { index: camera.index, generation: camera.generation },
    target: [0, 0, 0],
    distance: 8,
    pitch: Math.PI / 4,
    heading: 0,
    minDistance: 3,
    maxDistance: 24,
    panSpeed: 1,
    zoomSpeed: 1,
  });
  controller.applyTo(app.world);

  return { app, controller, mesh, material };
}

function applyInput(scene, data) {
  const pan = data.pan;
  if (pan) {
    scene.controller.panFromDrag(
      finiteNumber(pan.dx, 0),
      finiteNumber(pan.dy, 0),
    );
  }
  const wheel = finiteNumber(data.wheel, 0);
  if (wheel !== 0) {
    scene.controller.zoomFromWheel(wheel);
  }
}

function sceneSummary(scene) {
  return {
    target: [...scene.controller.target],
    distance: scene.controller.distance,
    heading: scene.controller.heading,
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
