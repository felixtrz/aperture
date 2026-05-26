import {
  renderToTextureScreenClearColor as screenClearColor,
  renderToTextureCropRect as targetCropRect,
  renderToTextureOffscreenClearColor as offscreenClearColor,
  registerRenderToTextureAssets,
} from "./render-to-texture-assets.js";

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
        data.reuseStress === true,
        data.mixedTargets === true,
        data.multiRenderTargets === true,
        data.mixedMultiRenderTargets === true,
        data.targetCrop === true,
        data.targetClearLoad === true,
      );
      self.postMessage({
        type: "ready",
        scene: {
          meshKey: aperture.assetHandleKey(scene.mesh),
          materialKey: aperture.assetHandleKey(scene.material),
          canvasMaterialKey: aperture.assetHandleKey(scene.canvasMaterial),
          currentMaterialKey: aperture.assetHandleKey(scene.currentMaterial),
          renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
          ...(scene.multiRenderTargets || scene.mixedMultiRenderTargets
            ? {
                secondaryRenderTargetKey: aperture.assetHandleKey(
                  scene.secondaryRenderTarget,
                ),
              }
            : {}),
          mixedTargets: scene.mixedTargets,
          multiRenderTargets: scene.multiRenderTargets,
          mixedMultiRenderTargets: scene.mixedMultiRenderTargets,
          targetCrop: scene.targetCrop,
          targetClearLoad: scene.targetClearLoad,
          ...(scene.targetCrop
            ? {
                cropRect: targetCropRect,
              }
            : {}),
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(
  aperture,
  canvasSize,
  reuseStress,
  mixedTargets,
  multiRenderTargets,
  mixedMultiRenderTargets,
  targetCrop,
  targetClearLoad,
) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const assets = registerRenderToTextureAssets(aperture, app.assets);
  const usesSecondaryRenderTarget =
    multiRenderTargets || mixedMultiRenderTargets;
  const usesCurrentTextureTarget = mixedTargets || mixedMultiRenderTargets;

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3] }),
    aperture.withCamera({
      aspect: 1,
      near: 0.1,
      far: 100,
      priority: 0,
      layerMask: 1,
      clearColor: offscreenClearColor,
      renderTargetId: aperture.assetHandleKey(assets.renderTarget),
      ...(targetCrop
        ? {
            viewport: targetCropRect,
            scissor: targetCropRect,
          }
        : {}),
    }),
  );

  if (targetClearLoad) {
    app.spawn(
      aperture.withTransform({ translation: [0, 0, 3] }),
      aperture.withCamera({
        aspect: 1,
        near: 0.1,
        far: 100,
        priority: 1,
        layerMask: 2,
        clearColor: offscreenClearColor,
        renderTargetId: aperture.assetHandleKey(assets.renderTarget),
      }),
    );
  }

  if (usesSecondaryRenderTarget) {
    app.spawn(
      aperture.withTransform({ translation: [0, 0, 3] }),
      aperture.withCamera({
        aspect: 1,
        near: 0.1,
        far: 100,
        priority: 1,
        layerMask: 2,
        clearColor: offscreenClearColor,
        renderTargetId: aperture.assetHandleKey(assets.secondaryRenderTarget),
      }),
    );
  }

  if (usesCurrentTextureTarget) {
    app.spawn(
      aperture.withTransform({ translation: [0, 0, 3] }),
      aperture.withCamera({
        aspect: canvasSize.width / canvasSize.height,
        near: 0.1,
        far: 100,
        priority: mixedMultiRenderTargets ? 2 : 1,
        layerMask: mixedMultiRenderTargets ? 4 : 2,
        clearColor: [
          screenClearColor.r,
          screenClearColor.g,
          screenClearColor.b,
          screenClearColor.a,
        ],
      }),
    );
  }

  const meshEntity = app.spawn(
    aperture.withTransform(
      targetClearLoad ? { scale: [0.9, 0.65, 1] } : {},
    ),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  const canvasMeshEntity = usesSecondaryRenderTarget || targetClearLoad
    ? app.spawn(
        aperture.withTransform(
          targetClearLoad
            ? { translation: [0, 0, 0.05], scale: [0.28, 0.28, 1] }
            : {},
        ),
        aperture.withMesh(assets.mesh),
        aperture.withMaterial(assets.canvasMaterial),
        aperture.withRenderLayer(2),
        aperture.withVisibility(true),
      )
    : null;
  const currentMeshEntity = usesCurrentTextureTarget
    ? app.spawn(
        aperture.withTransform({}),
        aperture.withMesh(assets.mesh),
        aperture.withMaterial(
          mixedMultiRenderTargets
            ? assets.currentMaterial
            : assets.canvasMaterial,
        ),
        aperture.withRenderLayer(mixedMultiRenderTargets ? 4 : 2),
        aperture.withVisibility(true),
      )
    : null;

  return {
    app,
    mesh: assets.mesh,
    material: assets.material,
    canvasMaterial: assets.canvasMaterial,
    currentMaterial: assets.currentMaterial,
    renderTarget: assets.renderTarget,
    secondaryRenderTarget: assets.secondaryRenderTarget,
    canvas: canvasSize,
    meshEntity,
    canvasMeshEntity,
    currentMeshEntity,
    reuseStress,
    mixedTargets,
    multiRenderTargets,
    mixedMultiRenderTargets,
    targetCrop,
    targetClearLoad,
    localTransformComponent: aperture.LocalTransform,
  };
}

function createSnapshotMessage(workerScene, data) {
  const frame = finiteInteger(data.frame, 1);

  applyReuseStressFrame(workerScene, frame);
  workerScene.app.step(0, 0);
  const snapshot = workerScene.app.extract(frame);
  const frameVariant = frame <= 1 ? "left-clear-center" : "center-plane";

  return {
    type: "snapshot",
    frame,
    snapshot,
    workerStep: {
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      diagnostics: snapshot.diagnostics.length,
      frameVariant: workerScene.mixedTargets
        ? "mixed-current-and-offscreen-targets"
        : workerScene.mixedMultiRenderTargets
          ? "current-texture-plus-two-offscreen-targets"
        : workerScene.multiRenderTargets
          ? "two-offscreen-render-targets"
        : workerScene.targetClearLoad
          ? "same-offscreen-target-clear-load"
        : workerScene.targetCrop
          ? "offscreen-render-target-crop"
        : workerScene.reuseStress
          ? frameVariant
          : "single-frame",
      centerExpectation:
        workerScene.mixedTargets
          ? "canvas-plane-plus-offscreen-preview"
          : workerScene.mixedMultiRenderTargets
            ? "current-texture-plus-two-offscreen-previews"
          : workerScene.multiRenderTargets
            ? "two-offscreen-previews"
          : workerScene.targetClearLoad
            ? "base-preserved-plus-overlay"
          : workerScene.targetCrop
            ? "cropped-offscreen-target"
          : workerScene.reuseStress && frame <= 1
            ? "offscreen-clear"
            : "plane",
    },
  };
}

function applyReuseStressFrame(workerScene, frame) {
  if (!workerScene.reuseStress) {
    return;
  }

  const translation = workerScene.meshEntity.getVectorView(
    workerScene.localTransformComponent,
    "translation",
  );

  translation.set(frame <= 1 ? [-1.35, 0, 0] : [0, 0, 0]);
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
