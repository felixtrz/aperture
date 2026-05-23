import {
  MULTI_MATERIAL_GROUPS_CLEAR_COLOR,
  registerMultiMaterialGroupAssets,
} from "./multi-material-groups.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The simulation worker raised an error.",
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
          meshKey: scene.meshKey,
          materialKeys: scene.materialKeys,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const frame = finiteInteger(data.frame, 0);
      const snapshot = scene.app.stepAndExtract(0, frame / 60, frame);
      const groups = snapshot.meshDraws
        .map((draw) => ({
          renderId: draw.renderId,
          submesh: draw.submesh,
          materialSlot: draw.materialSlot,
          meshKey: aperture.assetHandleKey(draw.mesh),
          materialKey: aperture.assetHandleKey(draw.material),
          vertexStart: draw.vertexStart ?? null,
          vertexCount: draw.vertexCount ?? null,
          indexStart: draw.indexStart ?? null,
          indexCount: draw.indexCount ?? null,
        }))
        .sort((a, b) => a.submesh - b.submesh);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            meshDraws: snapshot.meshDraws.length,
            sameMesh: groups.every((group) => group.meshKey === scene.meshKey),
            groups,
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const assets = registerMultiMaterialGroupAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 30,
      clearColor: MULTI_MATERIAL_GROUPS_CLEAR_COLOR,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.leftMaterial),
    aperture.withMaterialSlots([assets.leftMaterial, assets.rightMaterial]),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    app,
    meshKey: assets.meshKey,
    materialKeys: assets.materialKeys,
  };
}

function finiteInteger(value, fallback) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
