import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/worker-modules/packages/app/dist/asset-mirror.js";
import { createMaterialAccess } from "/worker-modules/packages/app/dist/systems.js";

// M7-T6 render-control route: an unlit quad starts green, and at MUTATE_FRAME a
// route calls materials.set(handle, { baseColorFactor: red }). The mutation flows
// through the versioned asset registry (markReady) + the source-asset mirror, so
// the rendered center pixel transitions green -> red with no new mesh/material.

const clearColor = [0.01, 0.018, 0.028, 1];
const greenColor = [0.05, 0.8, 0.1, 1];
const redColor = [1, 0, 0, 1];
const MUTATE_FRAME = 8;

let apertureModulePromise = null;
let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message:
      event.message ||
      "The material mutation simulation worker raised an error.",
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
      scene = createScene(aperture, data.canvas ?? { width: 256, height: 256 });
      self.postMessage({ type: "ready", scene: sceneSummary(aperture, scene) });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const frame = finiteInteger(data.frame, 1);
      let mutationVersion = scene.mutationVersion;

      if (frame >= MUTATE_FRAME && !scene.mutated) {
        const result = scene.materials.set(scene.material, {
          baseColorFactor: redColor,
        });
        scene.mutated = true;
        mutationVersion = result.ok ? result.version : null;
        scene.mutationVersion = mutationVersion;
      }

      scene.app.step(finiteNumber(data.delta, 0), finiteNumber(data.time, 0));
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          time: finiteNumber(data.time, 0),
          delta: finiteNumber(data.delta, 0),
          mutated: scene.mutated,
          mutationVersion,
          snapshot,
          sourceAssets: serializeSourceAssetRegistry(scene.app.assets, {
            state: sourceAssetState,
          }),
          scene: sceneSummary(aperture, scene),
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
    worldOptions: { entityCapacity: 8 },
  });
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(createQuadMesh(), { id: "mutation-quad" });
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "Mutable Unlit",
      baseColorFactor: greenColor,
    }),
    { id: "mutable-material" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.4] }),
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

  return {
    app,
    mesh,
    material,
    materials: createMaterialAccess(app.assets),
    mutated: false,
    mutationVersion: null,
  };
}

function sceneSummary(aperture, scene) {
  return {
    meshKey: aperture.assetHandleKey(scene.mesh),
    materialKey: aperture.assetHandleKey(scene.material),
    mutated: scene.mutated,
    mutationVersion: scene.mutationVersion,
  };
}

function createQuadMesh() {
  return {
    kind: "mesh",
    label: "MutationQuad",
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount: 4,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: new Float32Array([
          -1.1, -1.1, 0, 0, 0, 1, 0, 1, 1.1, -1.1, 0, 0, 0, 1, 1, 1, 1.1, 1.1,
          0, 0, 0, 1, 1, 0, -1.1, 1.1, 0, 0, 0, 1, 0, 0,
        ]),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2, 0, 2, 3]),
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 4,
        indexStart: 0,
        indexCount: 6,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [-1.1, -1.1, 0], max: [1.1, 1.1, 0] },
    localSphere: { center: [0, 0, 0], radius: 1.56 },
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
