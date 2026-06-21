import {
  renderToTextureScreenClearColor as screenClearColor,
  renderToTextureCropRect as targetCropRect,
  renderToTextureDualSizeSecondarySize as dualSizeSecondarySize,
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
        data.dualSizeRenderTargets === true,
        data.mixedDualSizeRenderTargets === true,
        data.mixedCroppedSecondaryRenderTargets === true,
        data.mixedMsaaMultiRenderTargets === true,
        data.mixedMsaaCroppedSecondaryRenderTargets === true,
        data.mixedMsaaClearLoadTarget === true,
        data.croppedSecondaryRenderTargets === true,
        data.targetCrop === true,
        data.targetClearLoad === true,
        data.targetMsaa === true,
      );
      self.postMessage({
        type: "ready",
        scene: {
          meshKey: aperture.assetHandleKey(scene.mesh),
          materialKey: aperture.assetHandleKey(scene.material),
          clearMaterialKey: aperture.assetHandleKey(scene.clearMaterial),
          canvasMaterialKey: aperture.assetHandleKey(scene.canvasMaterial),
          currentMaterialKey: aperture.assetHandleKey(scene.currentMaterial),
          renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
          ...(scene.multiRenderTargets ||
          scene.mixedMultiRenderTargets ||
          scene.dualSizeRenderTargets ||
          scene.mixedDualSizeRenderTargets ||
          scene.mixedCroppedSecondaryRenderTargets ||
          scene.mixedMsaaMultiRenderTargets ||
          scene.mixedMsaaCroppedSecondaryRenderTargets ||
          scene.croppedSecondaryRenderTargets
            ? {
                secondaryRenderTargetKey: aperture.assetHandleKey(
                  scene.secondaryRenderTarget,
                ),
              }
            : {}),
          mixedTargets: scene.mixedTargets,
          multiRenderTargets: scene.multiRenderTargets,
          msaaMultiRenderTargets: scene.targetMsaa && scene.multiRenderTargets,
          msaaCroppedSecondaryRenderTargets:
            scene.targetMsaa && scene.croppedSecondaryRenderTargets,
          mixedMultiRenderTargets: scene.mixedMultiRenderTargets,
          dualSizeRenderTargets: scene.dualSizeRenderTargets,
          mixedDualSizeRenderTargets: scene.mixedDualSizeRenderTargets,
          mixedCroppedSecondaryRenderTargets:
            scene.mixedCroppedSecondaryRenderTargets,
          mixedMsaaMultiRenderTargets: scene.mixedMsaaMultiRenderTargets,
          mixedMsaaCroppedSecondaryRenderTargets:
            scene.mixedMsaaCroppedSecondaryRenderTargets,
          mixedMsaaClearLoadTarget: scene.mixedMsaaClearLoadTarget,
          croppedSecondaryRenderTargets: scene.croppedSecondaryRenderTargets,
          targetCrop: scene.targetCrop,
          targetClearLoad: scene.targetClearLoad,
          targetMsaa: scene.targetMsaa,
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

function createWorkerScene(
  aperture,
  canvasSize,
  reuseStress,
  mixedTargets,
  multiRenderTargets,
  mixedMultiRenderTargets,
  dualSizeRenderTargets,
  mixedDualSizeRenderTargets,
  mixedCroppedSecondaryRenderTargets,
  mixedMsaaMultiRenderTargets,
  mixedMsaaCroppedSecondaryRenderTargets,
  mixedMsaaClearLoadTarget,
  croppedSecondaryRenderTargets,
  targetCrop,
  targetClearLoad,
  targetMsaa,
) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 8 },
  });
  const assets = registerRenderToTextureAssets(aperture, app.assets);
  const usesSecondaryRenderTarget =
    multiRenderTargets ||
    mixedMultiRenderTargets ||
    dualSizeRenderTargets ||
    mixedDualSizeRenderTargets ||
    mixedCroppedSecondaryRenderTargets ||
    mixedMsaaMultiRenderTargets ||
    mixedMsaaCroppedSecondaryRenderTargets;
  const usesCroppedSecondaryRenderTarget =
    croppedSecondaryRenderTargets ||
    mixedCroppedSecondaryRenderTargets ||
    mixedMsaaCroppedSecondaryRenderTargets;
  const usesAnySecondaryRenderTarget =
    usesSecondaryRenderTarget || usesCroppedSecondaryRenderTarget;
  const usesCurrentTextureTarget =
    mixedTargets ||
    mixedMultiRenderTargets ||
    mixedDualSizeRenderTargets ||
    mixedCroppedSecondaryRenderTargets ||
    mixedMsaaMultiRenderTargets ||
    mixedMsaaCroppedSecondaryRenderTargets ||
    mixedMsaaClearLoadTarget;
  const usesDedicatedCurrentTextureLayer =
    mixedMultiRenderTargets ||
    mixedDualSizeRenderTargets ||
    mixedCroppedSecondaryRenderTargets ||
    mixedMsaaMultiRenderTargets ||
    mixedMsaaCroppedSecondaryRenderTargets ||
    mixedMsaaClearLoadTarget;

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

  if (usesAnySecondaryRenderTarget) {
    app.spawn(
      aperture.withTransform({ translation: [0, 0, 3] }),
      aperture.withCamera({
        aspect:
          dualSizeRenderTargets || mixedDualSizeRenderTargets
            ? dualSizeSecondarySize.width / dualSizeSecondarySize.height
            : 1,
        near: 0.1,
        far: 100,
        priority: 1,
        layerMask: 2,
        clearColor: offscreenClearColor,
        renderTargetId: aperture.assetHandleKey(assets.secondaryRenderTarget),
        ...(usesCroppedSecondaryRenderTarget
          ? {
              viewport: targetCropRect,
              scissor: targetCropRect,
            }
          : {}),
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
        priority: usesDedicatedCurrentTextureLayer ? 2 : 1,
        layerMask: usesDedicatedCurrentTextureLayer ? 4 : 2,
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
    aperture.withTransform(targetClearLoad ? { scale: [0.9, 0.65, 1] } : {}),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  const canvasMeshEntity =
    usesAnySecondaryRenderTarget || targetClearLoad
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
          usesDedicatedCurrentTextureLayer
            ? assets.currentMaterial
            : assets.canvasMaterial,
        ),
        aperture.withRenderLayer(usesDedicatedCurrentTextureLayer ? 4 : 2),
        aperture.withVisibility(true),
      )
    : null;

  return {
    app,
    mesh: assets.mesh,
    material: assets.material,
    clearMaterial: assets.clearMaterial,
    canvasMaterial: assets.canvasMaterial,
    currentMaterial: assets.currentMaterial,
    renderTarget: assets.renderTarget,
    secondaryRenderTarget: assets.secondaryRenderTarget,
    materialId: aperture.assetHandleKey(assets.material),
    clearMaterialId: aperture.assetHandleKey(assets.clearMaterial),
    canvas: canvasSize,
    meshEntity,
    canvasMeshEntity,
    currentMeshEntity,
    reuseStress,
    mixedTargets,
    multiRenderTargets,
    mixedMultiRenderTargets,
    dualSizeRenderTargets,
    mixedDualSizeRenderTargets,
    mixedCroppedSecondaryRenderTargets,
    mixedMsaaMultiRenderTargets,
    mixedMsaaCroppedSecondaryRenderTargets,
    mixedMsaaClearLoadTarget,
    croppedSecondaryRenderTargets,
    targetCrop,
    targetClearLoad,
    targetMsaa,
    localTransformComponent: aperture.LocalTransform,
    materialComponent: aperture.Material,
  };
}

function createSnapshotMessage(workerScene, data) {
  const frame = finiteInteger(data.frame, 1);

  applyReuseStressFrame(workerScene, frame);
  workerScene.app.step(0, 0);
  const snapshot = workerScene.app.extract(frame);
  const frameVariant = frame <= 1 ? "clear-material-center" : "center-plane";

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
        : workerScene.mixedCroppedSecondaryRenderTargets
          ? "current-texture-plus-cropped-secondary-offscreen-target"
          : workerScene.mixedMsaaClearLoadTarget
            ? "current-texture-plus-msaa-same-offscreen-target-clear-load"
            : workerScene.mixedMsaaCroppedSecondaryRenderTargets
              ? "current-texture-plus-msaa-cropped-secondary-offscreen-target"
              : workerScene.mixedMsaaMultiRenderTargets
                ? "current-texture-plus-msaa-two-offscreen-targets"
                : workerScene.mixedMultiRenderTargets
                  ? "current-texture-plus-two-offscreen-targets"
                  : workerScene.mixedDualSizeRenderTargets
                    ? "current-texture-plus-dual-size-offscreen-targets"
                    : workerScene.dualSizeRenderTargets
                      ? "dual-size-offscreen-render-targets"
                      : workerScene.reuseStress && workerScene.targetMsaa
                        ? `msaa-${frameVariant}`
                        : workerScene.targetMsaa &&
                            workerScene.multiRenderTargets
                          ? "msaa-two-offscreen-render-targets"
                          : workerScene.targetMsaa &&
                              workerScene.croppedSecondaryRenderTargets
                            ? "msaa-cropped-secondary-offscreen-render-target"
                            : workerScene.targetMsaa
                              ? "msaa-offscreen-render-target"
                              : workerScene.croppedSecondaryRenderTargets
                                ? "cropped-secondary-offscreen-render-target"
                                : workerScene.multiRenderTargets
                                  ? "two-offscreen-render-targets"
                                  : workerScene.targetClearLoad
                                    ? "same-offscreen-target-clear-load"
                                    : workerScene.targetCrop
                                      ? "offscreen-render-target-crop"
                                      : workerScene.reuseStress
                                        ? frameVariant
                                        : "single-frame",
      centerExpectation: workerScene.mixedTargets
        ? "canvas-plane-plus-offscreen-preview"
        : workerScene.mixedCroppedSecondaryRenderTargets
          ? "current-texture-plus-primary-preview-secondary-crop"
          : workerScene.mixedMsaaClearLoadTarget
            ? "current-texture-plus-msaa-clear-base-overlay"
            : workerScene.mixedMsaaCroppedSecondaryRenderTargets
              ? "current-texture-plus-msaa-primary-preview-secondary-crop"
              : workerScene.mixedMsaaMultiRenderTargets
                ? "current-texture-plus-msaa-resolved-two-offscreen-previews"
                : workerScene.mixedMultiRenderTargets
                  ? "current-texture-plus-two-offscreen-previews"
                  : workerScene.mixedDualSizeRenderTargets
                    ? "current-texture-plus-dual-size-offscreen-previews"
                    : workerScene.dualSizeRenderTargets
                      ? "dual-size-offscreen-previews"
                      : workerScene.reuseStress && workerScene.targetMsaa
                        ? frame <= 1
                          ? "msaa-resolved-offscreen-clear"
                          : "msaa-resolved-plane"
                        : workerScene.targetMsaa &&
                            workerScene.multiRenderTargets
                          ? "msaa-resolved-two-offscreen-previews"
                          : workerScene.targetMsaa &&
                              workerScene.croppedSecondaryRenderTargets
                            ? "msaa-primary-preview-plus-secondary-crop"
                            : workerScene.targetMsaa
                              ? "msaa-resolved-offscreen-preview"
                              : workerScene.croppedSecondaryRenderTargets
                                ? "primary-preview-plus-secondary-crop"
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

  translation.set([0, 0, 0]);
  workerScene.meshEntity.setValue(
    workerScene.materialComponent,
    "materialId",
    frame <= 1 ? workerScene.clearMaterialId : workerScene.materialId,
  );
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
