import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  renderToTextureCanvasPlaneColor as canvasPlaneColor,
  renderToTextureCanvasSample as canvasSample,
  renderToTextureClearMaterialColor as clearMaterialColor,
  renderToTextureCenterSample as centerSample,
  renderToTextureClearLoadBaseSample as clearLoadBaseSample,
  renderToTextureClearLoadClearSample as clearLoadClearSample,
  renderToTextureClearLoadOverlaySample as clearLoadOverlaySample,
  renderToTextureCropInsideSample as cropInsideSample,
  renderToTextureCropOutsideSample as cropOutsideSample,
  renderToTextureCropRect as targetCropRect,
  renderToTextureCurrentPlaneColor as currentPlaneColor,
  renderToTextureDualSizeSecondarySize as dualSizeSecondarySize,
  renderToTextureLeftPreviewSample as leftPreviewSample,
  renderToTextureMixedMultiCurrentSample as mixedMultiCurrentSample,
  renderToTextureOffscreenClearColor as offscreenClearColor,
  renderToTextureOffscreenSize as defaultOffscreenSize,
  renderToTexturePlaneColor as planeColor,
  renderToTexturePreviewSample as previewSample,
  renderToTextureRightPreviewSample as rightPreviewSample,
  renderToTextureScreenClearColor as screenClearColor,
  renderToTextureScreenClearSample as screenClearSample,
  renderToTextureSecondaryCropInsideSample as secondaryCropInsideSample,
  renderToTextureSecondaryCropOutsideSample as secondaryCropOutsideSample,
  registerRenderToTextureAssets,
} from "./render-to-texture-assets.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  copyCurrentTextureReadbackSamples,
  createCurrentTextureColorTargetWithTexture,
  mapCurrentTextureReadbackSamples,
} from "./webgpu-readback.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const routeConfig = routeConfigForPath(window.location.pathname);

const baseStatus = {
  example: routeConfig.example,
  workerModel: "ecs-extraction-worker-postmessage-snapshot",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
  renderTarget: {
    width: routeConfig.offscreenSize,
    height: routeConfig.offscreenSize,
    source: "ViewPacket.renderTarget",
  },
};

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      ...(routeConfig.targetMsaa ? { msaa: 8 } : {}),
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(
        failure("initialize-webgpu", created.reason, created.message, {
          apertureVersion: aperture.APERTURE_VERSION,
          renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
        }),
      );
    } else {
      const scene = createMainScene(aperture, created.app, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene, readbackUsage);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "render-to-texture",
      "render-to-texture-failed",
      error instanceof Error
        ? error.message
        : "Render-to-texture example failed.",
    ),
  );
}

function createMainScene(aperture, app, sourceAssets) {
  const scene = registerRenderToTextureAssets(aperture, sourceAssets);
  const device = app.initialization.device;
  const format = app.initialization.format;
  const textureUsage = resolveTextureUsage(aperture);
  const initialTarget = createOffscreenTarget({
    aperture,
    device,
    format,
    textureUsage,
    size: routeConfig.initialOffscreenSize,
    label: "aperture-render-to-texture-target/initial",
  });

  sourceAssets.register(scene.renderTarget, {
    label: "Render-to-texture target",
  });
  sourceAssets.markReady(scene.renderTarget, initialTarget.asset);

  let offscreenTexture = initialTarget.texture;
  let secondaryOffscreenTexture = null;
  let renderTargetResize = null;

  if (routeConfig.resizeTarget) {
    const resizedTarget = createOffscreenTarget({
      aperture,
      device,
      format,
      textureUsage,
      size: routeConfig.offscreenSize,
      label: "aperture-render-to-texture-target/resized",
    });
    const previousTextureDestroyed = destroyTexture(offscreenTexture);

    sourceAssets.markReady(scene.renderTarget, resizedTarget.asset);
    offscreenTexture = resizedTarget.texture;
    renderTargetResize = {
      mode: "renderer-owned-render-target-resize",
      reason: "route-config-canvas-resize-simulation",
      renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
      before: {
        width: routeConfig.initialOffscreenSize,
        height: routeConfig.initialOffscreenSize,
      },
      after: {
        width: routeConfig.offscreenSize,
        height: routeConfig.offscreenSize,
      },
      reusedHandle: true,
      textureRecreated: true,
      previousTextureDestroyed,
      staleSizeGuard: "source-assets-markReady-before-render",
    };
  }

  if (
    routeConfig.multiRenderTargets ||
    routeConfig.mixedMultiRenderTargets ||
    routeConfig.dualSizeRenderTargets ||
    routeConfig.mixedDualSizeRenderTargets ||
    routeConfig.mixedCroppedSecondaryRenderTargets ||
    routeConfig.mixedMsaaMultiRenderTargets ||
    routeConfig.mixedMsaaCroppedSecondaryRenderTargets ||
    routeConfig.msaaMultiRenderTargets ||
    routeConfig.msaaCroppedSecondaryRenderTargets ||
    routeConfig.croppedSecondaryRenderTargets
  ) {
    const secondaryTarget = createOffscreenTarget({
      aperture,
      device,
      format,
      textureUsage,
      size:
        routeConfig.dualSizeRenderTargets ||
        routeConfig.mixedDualSizeRenderTargets
          ? dualSizeSecondarySize
          : routeConfig.offscreenSize,
      label: "aperture-render-to-texture-target/secondary",
    });

    sourceAssets.register(scene.secondaryRenderTarget, {
      label: "Secondary render-to-texture target",
    });
    sourceAssets.markReady(scene.secondaryRenderTarget, secondaryTarget.asset);
    secondaryOffscreenTexture = secondaryTarget.texture;
  }

  return {
    ...scene,
    format,
    offscreenTexture,
    secondaryOffscreenTexture,
    renderTargetResize,
    textureUsage: {
      renderAttachment: true,
      textureBinding: true,
      copySource: true,
    },
  };
}

function startWorkerSnapshotLoop(aperture, app, scene, readbackUsage) {
  const worker = new Worker(
    "/worker-modules/examples/render-to-texture.worker.js",
    {
      name: "aperture-render-to-texture-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    offscreenFrames: [],
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      scene,
      readbackUsage,
      worker,
      loop,
      event.data,
    );
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker",
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    reuseStress: routeConfig.reuseStress,
    mixedTargets: routeConfig.mixedTargets,
    multiRenderTargets: routeConfig.multiRenderTargets,
    mixedMultiRenderTargets: routeConfig.mixedMultiRenderTargets,
    dualSizeRenderTargets: routeConfig.dualSizeRenderTargets,
    mixedDualSizeRenderTargets: routeConfig.mixedDualSizeRenderTargets,
    mixedCroppedSecondaryRenderTargets:
      routeConfig.mixedCroppedSecondaryRenderTargets,
    mixedMsaaMultiRenderTargets: routeConfig.mixedMsaaMultiRenderTargets,
    mixedMsaaCroppedSecondaryRenderTargets:
      routeConfig.mixedMsaaCroppedSecondaryRenderTargets,
    mixedMsaaClearLoadTarget: routeConfig.mixedMsaaClearLoadTarget === true,
    croppedSecondaryRenderTargets: routeConfig.croppedSecondaryRenderTargets,
    targetCrop: routeConfig.targetCrop,
    targetClearLoad: routeConfig.targetClearLoad,
    targetMsaa: routeConfig.targetMsaa,
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  readbackUsage,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        "worker",
        message.reason ?? "worker-error",
        message.message ?? "The simulation worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const offscreenReport = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    ...(routeConfig.mixedTargets ||
    routeConfig.mixedMultiRenderTargets ||
    routeConfig.mixedDualSizeRenderTargets ||
    routeConfig.mixedCroppedSecondaryRenderTargets ||
    routeConfig.mixedMsaaMultiRenderTargets ||
    routeConfig.mixedMsaaCroppedSecondaryRenderTargets ||
    routeConfig.mixedMsaaClearLoadTarget
      ? {}
      : { clearColor: offscreenClearColor }),
    ...(routeConfig.mixedTargets && readbackUsage.ok
      ? { readbackSamples: [canvasSample] }
      : {}),
    ...((routeConfig.mixedMultiRenderTargets ||
      routeConfig.mixedDualSizeRenderTargets ||
      routeConfig.mixedCroppedSecondaryRenderTargets ||
      routeConfig.mixedMsaaMultiRenderTargets ||
      routeConfig.mixedMsaaCroppedSecondaryRenderTargets ||
      routeConfig.mixedMsaaClearLoadTarget) &&
    readbackUsage.ok
      ? { readbackSamples: [mixedMultiCurrentSample] }
      : {}),
    label: routeConfig.mixedCroppedSecondaryRenderTargets
      ? "render-to-texture/mixed-secondary-crop-targets"
      : routeConfig.mixedMsaaCroppedSecondaryRenderTargets
        ? "render-to-texture/mixed-msaa-secondary-crop-targets"
        : routeConfig.mixedMsaaMultiRenderTargets
          ? "render-to-texture/mixed-msaa-two-targets"
          : isMixedMsaaReusedDualSizeRoute()
            ? "render-to-texture/mixed-msaa-reused-dual-size-targets"
            : isMixedMsaaResizedDualSizeRoute()
              ? "render-to-texture/mixed-msaa-resized-dual-size-targets"
              : isMixedMsaaDualSizeRoute()
                ? "render-to-texture/mixed-msaa-dual-size-targets"
                : routeConfig.mixedDualSizeRenderTargets
                  ? "render-to-texture/mixed-dual-size-targets"
                  : isMixedMsaaResizedClearLoadRoute()
                    ? "render-to-texture/mixed-msaa-resized-clear-load-target"
                    : routeConfig.mixedMsaaClearLoadTarget
                      ? "render-to-texture/mixed-msaa-clear-load-target"
                      : isMixedMsaaResizedTargetCropRoute()
                        ? "render-to-texture/mixed-msaa-resized-cropped-target"
                        : isMixedMsaaTargetCropRoute()
                          ? "render-to-texture/mixed-msaa-cropped-target"
                          : isMixedMsaaReuseTargetCropRoute()
                            ? "render-to-texture/mixed-msaa-reused-cropped-target"
                            : isMixedMsaaReuseRoute()
                              ? "render-to-texture/mixed-msaa-reuse-target"
                              : isMixedMsaaResizeRoute()
                                ? "render-to-texture/mixed-msaa-resized-target"
                                : routeConfig.msaaMultiRenderTargets
                                  ? "render-to-texture/msaa-two-targets"
                                  : routeConfig.msaaCroppedSecondaryRenderTargets
                                    ? "render-to-texture/msaa-cropped-secondary-target"
                                    : routeConfig.resizeTarget &&
                                        routeConfig.targetMsaa
                                      ? "render-to-texture/msaa-resized-target"
                                      : routeConfig.targetClearLoad &&
                                          routeConfig.targetMsaa
                                        ? "render-to-texture/msaa-clear-load-target"
                                        : routeConfig.targetCrop &&
                                            routeConfig.targetMsaa
                                          ? "render-to-texture/msaa-cropped-target"
                                          : routeConfig.reuseStress &&
                                              routeConfig.targetMsaa
                                            ? "render-to-texture/msaa-reuse-target"
                                            : routeConfig.mixedMultiRenderTargets
                                              ? "render-to-texture/mixed-multi-targets"
                                              : routeConfig.mixedTargets
                                                ? "render-to-texture/mixed-targets"
                                                : "render-to-texture/offscreen",
  });

  if (!offscreenReport.ok) {
    publishStatus(
      failure(
        "offscreen-render",
        "offscreen-render-failed",
        "The ViewPacket render-target pass did not complete.",
        createFailureDetails(
          aperture,
          app,
          scene,
          loop,
          message,
          typedSnapshot,
          offscreenReport,
        ),
      ),
    );
    worker.terminate();
    return;
  }

  loop.offscreenFrames.push(
    createOffscreenFrameStatus(aperture, scene, message, offscreenReport),
  );

  if (
    routeConfig.reuseStress &&
    loop.offscreenFrames.length < routeConfig.requiredFrames
  ) {
    requestWorkerFrame(worker, loop);
    return;
  }

  const screenPass = routeConfig.croppedSecondaryRenderTargets
    ? await drawCroppedSecondaryRenderTargetTexturesToCanvas({
        aperture,
        app,
        scene,
        readbackUsage,
      })
    : routeConfig.dualSizeRenderTargets ||
        routeConfig.mixedDualSizeRenderTargets
      ? await drawDualSizeRenderTargetTexturesToCanvas({
          aperture,
          app,
          scene,
          readbackUsage,
        })
      : routeConfig.multiRenderTargets ||
          routeConfig.mixedMultiRenderTargets ||
          routeConfig.mixedMsaaMultiRenderTargets ||
          routeConfig.msaaMultiRenderTargets
        ? await drawMultipleRenderTargetTexturesToCanvas({
            aperture,
            app,
            scene,
            readbackUsage,
          })
        : await drawRenderTargetTextureToCanvas({
            aperture,
            app,
            texture: scene.offscreenTexture,
            readbackUsage,
            ...(routeConfig.targetClearLoad
              ? {
                  samples: [
                    clearLoadClearSample,
                    clearLoadBaseSample,
                    clearLoadOverlaySample,
                    screenClearSample,
                  ],
                  sampleLabels: {
                    clearOnly: clearLoadClearSample.id,
                    basePreserved: clearLoadBaseSample.id,
                    overlay: clearLoadOverlaySample.id,
                    screenClear: screenClearSample.id,
                  },
                }
              : {}),
            ...(routeConfig.targetCrop
              ? {
                  samples: [
                    cropInsideSample,
                    cropOutsideSample,
                    screenClearSample,
                  ],
                  sampleLabels: {
                    insideTarget: cropInsideSample.id,
                    outsideTarget: cropOutsideSample.id,
                    screenClear: screenClearSample.id,
                  },
                }
              : {}),
            ...(routeConfig.mixedTargets && !routeConfig.targetCrop
              ? {
                  quad: mixedPreviewQuad(),
                  samples: [previewSample, screenClearSample],
                  sampleLabels: {
                    preview: previewSample.id,
                    screenClear: screenClearSample.id,
                  },
                }
              : {}),
          });

  publishStatus(
    screenPass.ok
      ? createStatus(
          aperture,
          app,
          scene,
          loop,
          message,
          typedSnapshot,
          offscreenReport,
          screenPass,
        )
      : failure(
          "screen-pass",
          screenPass.reason,
          screenPass.message,
          createFailureDetails(
            aperture,
            app,
            scene,
            loop,
            message,
            typedSnapshot,
            offscreenReport,
            screenPass,
          ),
        ),
  );
  worker.terminate();
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
    });
  });
}

function isMixedMsaaResizeRoute() {
  return (
    routeConfig.mixedTargets &&
    routeConfig.resizeTarget &&
    routeConfig.targetMsaa &&
    !routeConfig.targetCrop
  );
}

function isMixedMsaaTargetCropRoute() {
  return (
    routeConfig.mixedTargets &&
    routeConfig.targetCrop &&
    routeConfig.targetMsaa &&
    !routeConfig.resizeTarget
  );
}

function isMixedMsaaResizedTargetCropRoute() {
  return (
    routeConfig.mixedTargets &&
    routeConfig.resizeTarget &&
    routeConfig.targetCrop &&
    routeConfig.targetMsaa
  );
}

function isMixedMsaaReuseRoute() {
  return (
    routeConfig.mixedTargets &&
    routeConfig.reuseStress &&
    routeConfig.targetMsaa &&
    !routeConfig.targetCrop
  );
}

function isMixedMsaaReuseTargetCropRoute() {
  return (
    routeConfig.mixedTargets &&
    routeConfig.reuseStress &&
    routeConfig.targetCrop &&
    routeConfig.targetMsaa
  );
}

function isMixedMsaaDualSizeRoute() {
  return (
    routeConfig.mixedDualSizeRenderTargets &&
    routeConfig.targetMsaa &&
    !routeConfig.reuseStress &&
    !routeConfig.resizeTarget
  );
}

function isMixedMsaaReusedDualSizeRoute() {
  return (
    routeConfig.mixedDualSizeRenderTargets &&
    routeConfig.reuseStress &&
    routeConfig.targetMsaa &&
    !routeConfig.resizeTarget
  );
}

function isMixedMsaaResizedDualSizeRoute() {
  return (
    routeConfig.mixedDualSizeRenderTargets &&
    routeConfig.resizeTarget &&
    routeConfig.targetMsaa
  );
}

function isMixedMsaaResizedClearLoadRoute() {
  return (
    routeConfig.mixedMsaaClearLoadTarget &&
    routeConfig.resizeTarget &&
    routeConfig.targetMsaa
  );
}

async function drawRenderTargetTextureToCanvas({
  aperture,
  app,
  texture,
  readbackUsage,
  quad = defaultPreviewQuad(),
  samples = [centerSample, screenClearSample],
  sampleLabels = {
    preview: centerSample.id,
    screenClear: screenClearSample.id,
  },
}) {
  const result = await drawRenderTargetTexturesToCanvas({
    aperture,
    app,
    readbackUsage,
    previews: [
      {
        id: "offscreen-preview",
        source: "off-screen render target",
        texture,
        quad,
      },
    ],
    samples,
    sampleLabels,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    quad: result.quads[0] ?? null,
  };
}

async function drawMultipleRenderTargetTexturesToCanvas({
  aperture,
  app,
  scene,
  readbackUsage,
}) {
  if (scene.secondaryOffscreenTexture === null) {
    return {
      ok: false,
      phase: "screen-pass",
      reason: "secondary-render-target-unavailable",
      message: "The secondary off-screen render target was not created.",
    };
  }

  const [leftQuad, rightQuad] = multiPreviewQuads();

  return drawRenderTargetTexturesToCanvas({
    aperture,
    app,
    readbackUsage,
    previews: [
      {
        id: "primary-offscreen-preview",
        role: "primary",
        source: "primary off-screen render target",
        renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
        texture: scene.offscreenTexture,
        quad: leftQuad,
        sampleId: leftPreviewSample.id,
      },
      {
        id: "secondary-offscreen-preview",
        role: "secondary",
        source: "secondary off-screen render target",
        renderTargetKey: aperture.assetHandleKey(scene.secondaryRenderTarget),
        texture: scene.secondaryOffscreenTexture,
        quad: rightQuad,
        sampleId: rightPreviewSample.id,
      },
    ],
    samples: [leftPreviewSample, rightPreviewSample, screenClearSample],
    sampleLabels: {
      leftPreview: leftPreviewSample.id,
      rightPreview: rightPreviewSample.id,
      screenClear: screenClearSample.id,
    },
  });
}

async function drawDualSizeRenderTargetTexturesToCanvas({
  aperture,
  app,
  scene,
  readbackUsage,
}) {
  if (scene.secondaryOffscreenTexture === null) {
    return {
      ok: false,
      phase: "screen-pass",
      reason: "secondary-render-target-unavailable",
      message: "The secondary off-screen render target was not created.",
    };
  }

  const [leftQuad, rightQuad] = dualSizePreviewQuads();
  const canvasAspectRatio = app.canvas.width / app.canvas.height;
  const primaryTarget = {
    width: routeConfig.offscreenSize,
    height: routeConfig.offscreenSize,
  };
  const secondaryTarget = dualSizeSecondarySize;

  return drawRenderTargetTexturesToCanvas({
    aperture,
    app,
    readbackUsage,
    previews: [
      {
        id: "primary-dual-size-preview",
        role: "primary",
        source: "primary square off-screen render target",
        renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
        texture: scene.offscreenTexture,
        quad: leftQuad,
        sampleId: leftPreviewSample.id,
        aspect: createPreviewAspectStatus({
          target: primaryTarget,
          quad: leftQuad,
          canvasAspectRatio,
        }),
      },
      {
        id: "secondary-dual-size-preview",
        role: "secondary",
        source: "secondary wide off-screen render target",
        renderTargetKey: aperture.assetHandleKey(scene.secondaryRenderTarget),
        texture: scene.secondaryOffscreenTexture,
        quad: rightQuad,
        sampleId: rightPreviewSample.id,
        aspect: createPreviewAspectStatus({
          target: secondaryTarget,
          quad: rightQuad,
          canvasAspectRatio,
        }),
      },
    ],
    samples: [leftPreviewSample, rightPreviewSample, screenClearSample],
    sampleLabels: {
      leftPreview: leftPreviewSample.id,
      rightPreview: rightPreviewSample.id,
      screenClear: screenClearSample.id,
    },
  });
}

async function drawCroppedSecondaryRenderTargetTexturesToCanvas({
  aperture,
  app,
  scene,
  readbackUsage,
}) {
  if (scene.secondaryOffscreenTexture === null) {
    return {
      ok: false,
      phase: "screen-pass",
      reason: "secondary-render-target-unavailable",
      message: "The secondary off-screen render target was not created.",
    };
  }

  const [leftQuad, rightQuad] = multiPreviewQuads();

  return drawRenderTargetTexturesToCanvas({
    aperture,
    app,
    readbackUsage,
    previews: [
      {
        id: "primary-secondary-crop-preview",
        role: "primary",
        source: "primary full off-screen render target",
        renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
        texture: scene.offscreenTexture,
        quad: leftQuad,
        sampleId: leftPreviewSample.id,
      },
      {
        id: "secondary-cropped-preview",
        role: "secondary",
        source: "secondary cropped off-screen render target",
        renderTargetKey: aperture.assetHandleKey(scene.secondaryRenderTarget),
        texture: scene.secondaryOffscreenTexture,
        quad: rightQuad,
        sampleId: secondaryCropInsideSample.id,
      },
    ],
    samples: [
      leftPreviewSample,
      secondaryCropInsideSample,
      secondaryCropOutsideSample,
      screenClearSample,
    ],
    sampleLabels: {
      leftPreview: leftPreviewSample.id,
      secondaryInside: secondaryCropInsideSample.id,
      secondaryOutside: secondaryCropOutsideSample.id,
      screenClear: screenClearSample.id,
    },
  });
}

async function drawRenderTargetTexturesToCanvas({
  aperture,
  app,
  readbackUsage,
  previews,
  samples,
  sampleLabels,
}) {
  const device = app.initialization.device;
  const context = app.initialization.context;
  const format = app.initialization.format;
  const current = createCurrentTextureColorTargetWithTexture({
    context,
    clearColor: screenClearColor,
  });

  if (!current.ok) {
    return current;
  }

  const sampler = device.createSampler({
    label: "aperture-render-to-texture-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
  });
  const previewDraws = previews.map((preview) => {
    const shader = device.createShaderModule({
      label: `aperture-render-to-texture-screen-shader/${preview.id}`,
      code: `
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f,
        }

        @group(0) @binding(0) var rttSampler: sampler;
        @group(0) @binding(1) var rttTexture: texture_2d<f32>;

        @vertex
        fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
          var positions = array<vec2f, 6>(
            ${preview.quad.positions
              .map((position) => `vec2f(${position[0]}, ${position[1]})`)
              .join(",\n            ")},
          );
          var uvs = array<vec2f, 6>(
            vec2f(0.0, 1.0),
            vec2f(1.0, 1.0),
            vec2f(1.0, 0.0),
            vec2f(0.0, 1.0),
            vec2f(1.0, 0.0),
            vec2f(0.0, 0.0),
          );

          var output: VertexOutput;
          output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
          output.uv = uvs[vertexIndex];
          return output;
        }

        @fragment
        fn fs(input: VertexOutput) -> @location(0) vec4f {
          return textureSample(rttTexture, rttSampler, input.uv);
        }
      `,
    });
    const pipeline = device.createRenderPipeline({
      label: `aperture-render-to-texture-screen-pipeline/${preview.id}`,
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs" },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const bindGroup = device.createBindGroup({
      label: `aperture-render-to-texture-screen-bind-group/${preview.id}`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: preview.texture.createView() },
      ],
    });

    return {
      ...preview,
      pipeline,
      bindGroup,
    };
  });
  const encoder = device.createCommandEncoder({
    label: "aperture-render-to-texture-screen-encoder",
  });
  const pass = encoder.beginRenderPass({
    label: "aperture-render-to-texture-screen-pass",
    colorAttachments: [
      {
        view: current.target.view,
        clearValue: current.target.clearColor,
        loadOp: current.target.loadOp,
        storeOp: current.target.storeOp,
      },
    ],
  });

  for (const preview of previewDraws) {
    pass.setPipeline(preview.pipeline);
    pass.setBindGroup(0, preview.bindGroup);
    pass.draw(6);
  }

  pass.end();

  const readbackPlan = readbackUsage.ok
    ? copyCurrentTextureReadbackSamples({
        device,
        encoder,
        texture: current.texture,
        format,
        width: app.canvas.width,
        height: app.canvas.height,
        samples,
      })
    : readbackUsage;

  device.queue.submit([encoder.finish()]);
  await waitForSubmittedWork(device);

  const readback = await mapCurrentTextureReadbackSamples(readbackPlan);

  return {
    ok: true,
    phase: "screen-pass",
    format,
    quads: previewDraws.map((preview) => ({
      id: preview.id,
      role: preview.role ?? "preview",
      source: preview.source,
      renderTargetKey: preview.renderTargetKey ?? null,
      sampleId: preview.sampleId ?? null,
      vertexCount: 6,
      widthNdc: preview.quad.widthNdc,
      heightNdc: preview.quad.heightNdc,
      normalizedRect: preview.quad.normalizedRect,
      ...(preview.aspect === undefined ? {} : { aspect: preview.aspect }),
    })),
    loadOp: current.target.loadOp,
    drawCalls: previewDraws.length,
    samples: sampleLabels,
    readback: aperture.markReadbackClearOk?.(readback, true) ?? readback,
  };
}

function defaultPreviewQuad() {
  return {
    positions: [
      [-0.62, -0.62],
      [0.62, -0.62],
      [0.62, 0.62],
      [-0.62, -0.62],
      [0.62, 0.62],
      [-0.62, 0.62],
    ],
    widthNdc: 1.24,
    heightNdc: 1.24,
    normalizedRect: {
      x: 0.19,
      y: 0.19,
      width: 0.62,
      height: 0.62,
    },
  };
}

function mixedPreviewQuad() {
  return {
    positions: [
      [0.16, -0.6],
      [0.92, -0.6],
      [0.92, 0.6],
      [0.16, -0.6],
      [0.92, 0.6],
      [0.16, 0.6],
    ],
    widthNdc: 0.76,
    heightNdc: 1.2,
    normalizedRect: {
      x: 0.58,
      y: 0.2,
      width: 0.38,
      height: 0.6,
    },
  };
}

function multiPreviewQuads() {
  return [
    {
      positions: [
        [-0.82, -0.58],
        [-0.12, -0.58],
        [-0.12, 0.58],
        [-0.82, -0.58],
        [-0.12, 0.58],
        [-0.82, 0.58],
      ],
      widthNdc: 0.7,
      heightNdc: 1.16,
      normalizedRect: {
        x: 0.09,
        y: 0.21,
        width: 0.35,
        height: 0.58,
      },
    },
    {
      positions: [
        [0.12, -0.58],
        [0.82, -0.58],
        [0.82, 0.58],
        [0.12, -0.58],
        [0.82, 0.58],
        [0.12, 0.58],
      ],
      widthNdc: 0.7,
      heightNdc: 1.16,
      normalizedRect: {
        x: 0.56,
        y: 0.21,
        width: 0.35,
        height: 0.58,
      },
    },
  ];
}

function dualSizePreviewQuads() {
  return [
    {
      positions: [
        [-0.825, -0.52],
        [-0.24, -0.52],
        [-0.24, 0.52],
        [-0.825, -0.52],
        [-0.24, 0.52],
        [-0.825, 0.52],
      ],
      widthNdc: 0.585,
      heightNdc: 1.04,
      normalizedRect: {
        x: 0.0875,
        y: 0.24,
        width: 0.2925,
        height: 0.52,
      },
    },
    {
      positions: [
        [-0.02, -0.4],
        [0.88, -0.4],
        [0.88, 0.4],
        [-0.02, -0.4],
        [0.88, 0.4],
        [-0.02, 0.4],
      ],
      widthNdc: 0.9,
      heightNdc: 0.8,
      normalizedRect: {
        x: 0.49,
        y: 0.3,
        width: 0.45,
        height: 0.4,
      },
    },
  ];
}

function createStatus(
  aperture,
  app,
  scene,
  loop,
  message,
  typedSnapshot,
  offscreenReport,
  screenPass,
) {
  const report = aperture.webGpuAppRenderReportToJsonValue(offscreenReport);

  return {
    ...baseStatus,
    ok: true,
    phase: "display",
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: scene.format,
    clearColors: {
      offscreen: rgbaToStatusColor(offscreenClearColor),
      screen: { ...screenClearColor },
    },
    renderTarget: {
      ...baseStatus.renderTarget,
      key: aperture.assetHandleKey(scene.renderTarget),
      textureUsage: scene.textureUsage,
    },
    ...(scene.renderTargetResize === null
      ? {}
      : {
          renderTargetResize: createRenderTargetResizeStatus(
            aperture,
            scene,
            offscreenReport,
            report,
          ),
        }),
    ...(isMixedMsaaResizeRoute()
      ? {
          mixedMsaaRenderTargetResize: createMixedMsaaRenderTargetResizeStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.reuseStress
      ? {
          renderTargetReuseStress: createRenderTargetReuseStressStatus(
            aperture,
            scene,
            loop,
            message,
          ),
        }
      : {}),
    ...(routeConfig.mixedTargets
      ? {
          mixedCameraTargets: createMixedCameraTargetsStatus(
            aperture,
            scene,
            message,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.multiRenderTargets && !routeConfig.msaaMultiRenderTargets
      ? {
          multiRenderTargets: createMultiRenderTargetsStatus(
            aperture,
            scene,
            message,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.msaaMultiRenderTargets
      ? {
          msaaMultiRenderTargets: createMsaaMultiRenderTargetsStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.mixedMsaaMultiRenderTargets
      ? {
          mixedMsaaMultiRenderTargets: createMixedMsaaMultiRenderTargetsStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.mixedMsaaCroppedSecondaryRenderTargets
      ? {
          mixedMsaaCroppedSecondaryRenderTargets:
            createMixedMsaaCroppedSecondaryRenderTargetsStatus(
              aperture,
              scene,
              message,
              offscreenReport,
              report,
              screenPass,
            ),
        }
      : {}),
    ...(isMixedMsaaResizedClearLoadRoute()
      ? {
          mixedMsaaResizedSameTargetClearLoad:
            createMixedMsaaResizedSameTargetClearLoadStatus(
              aperture,
              scene,
              message,
              offscreenReport,
              report,
              screenPass,
            ),
        }
      : {}),
    ...(routeConfig.mixedMsaaClearLoadTarget &&
    !isMixedMsaaResizedClearLoadRoute()
      ? {
          mixedMsaaSameTargetClearLoad:
            createMixedMsaaSameTargetClearLoadStatus(
              aperture,
              scene,
              message,
              offscreenReport,
              report,
              screenPass,
            ),
        }
      : {}),
    ...(isMixedMsaaTargetCropRoute()
      ? {
          mixedMsaaTargetCrop: createMixedMsaaTargetCropStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(isMixedMsaaResizedTargetCropRoute()
      ? {
          mixedMsaaResizedTargetCrop: createMixedMsaaResizedTargetCropStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(isMixedMsaaReuseRoute()
      ? {
          mixedMsaaRenderTargetReuse: createMixedMsaaRenderTargetReuseStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
            loop,
          ),
        }
      : {}),
    ...(isMixedMsaaReuseTargetCropRoute()
      ? {
          mixedMsaaReusedTargetCrop: createMixedMsaaReusedTargetCropStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
            loop,
          ),
        }
      : {}),
    ...(isMixedMsaaDualSizeRoute()
      ? {
          mixedMsaaDualSizeRenderTargets:
            createMixedMsaaDualSizeRenderTargetsStatus(
              aperture,
              scene,
              message,
              offscreenReport,
              report,
              screenPass,
            ),
        }
      : {}),
    ...(isMixedMsaaReusedDualSizeRoute()
      ? {
          mixedMsaaReusedDualSizeRenderTargets:
            createMixedMsaaReusedDualSizeRenderTargetsStatus(
              aperture,
              scene,
              message,
              offscreenReport,
              report,
              screenPass,
              loop,
            ),
        }
      : {}),
    ...(routeConfig.mixedCroppedSecondaryRenderTargets
      ? {
          mixedCroppedSecondaryRenderTargets:
            createMixedCroppedSecondaryRenderTargetsStatus(
              aperture,
              scene,
              message,
              report,
              screenPass,
            ),
        }
      : {}),
    ...(routeConfig.mixedMultiRenderTargets &&
    !routeConfig.mixedCroppedSecondaryRenderTargets
      ? {
          mixedMultiRenderTargets: createMixedMultiRenderTargetsStatus(
            aperture,
            scene,
            message,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(isMixedMsaaResizedDualSizeRoute()
      ? {
          mixedMsaaResizedDualSizeRenderTargets:
            createMixedMsaaResizedDualSizeRenderTargetsStatus(
              aperture,
              scene,
              message,
              offscreenReport,
              report,
              screenPass,
            ),
        }
      : {}),
    ...(routeConfig.mixedDualSizeRenderTargets &&
    !isMixedMsaaDualSizeRoute() &&
    !isMixedMsaaReusedDualSizeRoute() &&
    !isMixedMsaaResizedDualSizeRoute()
      ? {
          mixedDualSizeRenderTargets: createMixedDualSizeRenderTargetsStatus(
            aperture,
            scene,
            message,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.dualSizeRenderTargets
      ? {
          dualSizeRenderTargets: createDualSizeRenderTargetsStatus(
            aperture,
            scene,
            message,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.targetMsaa &&
    !routeConfig.msaaMultiRenderTargets &&
    !routeConfig.msaaCroppedSecondaryRenderTargets &&
    !routeConfig.mixedMsaaMultiRenderTargets &&
    !routeConfig.mixedMsaaCroppedSecondaryRenderTargets &&
    !routeConfig.mixedMsaaClearLoadTarget &&
    !isMixedMsaaTargetCropRoute() &&
    !isMixedMsaaResizedTargetCropRoute() &&
    !isMixedMsaaReuseTargetCropRoute() &&
    !isMixedMsaaReuseRoute() &&
    !isMixedMsaaReusedDualSizeRoute() &&
    !isMixedMsaaResizedDualSizeRoute() &&
    !isMixedMsaaDualSizeRoute() &&
    !isMixedMsaaResizeRoute()
      ? {
          msaaRenderTarget: createMsaaRenderTargetStatus(
            aperture,
            scene,
            offscreenReport,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.msaaCroppedSecondaryRenderTargets
      ? {
          msaaCroppedSecondaryRenderTargets:
            createMsaaCroppedSecondaryRenderTargetsStatus(
              aperture,
              scene,
              message,
              offscreenReport,
              report,
              screenPass,
            ),
        }
      : {}),
    ...(routeConfig.croppedSecondaryRenderTargets &&
    !routeConfig.msaaCroppedSecondaryRenderTargets &&
    !routeConfig.mixedCroppedSecondaryRenderTargets &&
    !routeConfig.mixedMsaaCroppedSecondaryRenderTargets
      ? {
          croppedSecondaryRenderTargets:
            createCroppedSecondaryRenderTargetsStatus(
              aperture,
              scene,
              message,
              report,
              screenPass,
            ),
        }
      : {}),
    ...(routeConfig.targetCrop
      ? {
          offscreenTargetCrop: createOffscreenTargetCropStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
          ),
        }
      : {}),
    ...(routeConfig.targetClearLoad && !routeConfig.mixedMsaaClearLoadTarget
      ? {
          sameRenderTargetClearLoad: createSameRenderTargetClearLoadStatus(
            aperture,
            scene,
            message,
            offscreenReport,
            report,
            screenPass,
          ),
        }
      : {}),
    sourceView: createSourceViewStatus(aperture, message.snapshot, scene),
    scene: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      clearMaterialKey: aperture.assetHandleKey(scene.clearMaterial),
      canvasMaterialKey: aperture.assetHandleKey(scene.canvasMaterial),
      currentMaterialKey: aperture.assetHandleKey(scene.currentMaterial),
      ...(routeConfig.multiRenderTargets ||
      routeConfig.mixedMultiRenderTargets ||
      routeConfig.dualSizeRenderTargets ||
      routeConfig.mixedDualSizeRenderTargets ||
      routeConfig.mixedCroppedSecondaryRenderTargets ||
      routeConfig.mixedMsaaMultiRenderTargets ||
      routeConfig.mixedMsaaCroppedSecondaryRenderTargets ||
      routeConfig.msaaMultiRenderTargets ||
      routeConfig.msaaCroppedSecondaryRenderTargets ||
      routeConfig.croppedSecondaryRenderTargets
        ? {
            secondaryRenderTargetKey: aperture.assetHandleKey(
              scene.secondaryRenderTarget,
            ),
          }
        : {}),
      materialKind: "unlit",
      expectedCenterColor: rgbaToStatusColor(planeColor),
      expectedClearMaterialColor: rgbaToStatusColor(clearMaterialColor),
      expectedCanvasColor: rgbaToStatusColor(canvasPlaneColor),
      expectedCurrentColor: rgbaToStatusColor(currentPlaneColor),
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    counts: {
      views: offscreenReport.counts.views,
      meshDraws: offscreenReport.counts.meshDraws,
      drawCalls: offscreenReport.counts.drawCalls,
      diagnostics: offscreenReport.counts.diagnostics,
    },
    report,
    screenPass: {
      phase: screenPass.phase,
      format: screenPass.format,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      quads: screenPass.quads,
      loadOp: screenPass.loadOp,
      samples: screenPass.samples,
    },
    readback: screenPass.readback,
    renderControl: {
      capabilities: exampleControlCapabilities(),
    },
    canvas: {
      width: app.canvas.width,
      height: app.canvas.height,
    },
  };
}

function createOffscreenTarget({
  aperture,
  device,
  format,
  textureUsage,
  size,
  label,
}) {
  const dimensions =
    typeof size === "number" ? { width: size, height: size } : size;
  const texture = device.createTexture({
    label,
    size: dimensions,
    format,
    usage:
      textureUsage.RENDER_ATTACHMENT |
      textureUsage.TEXTURE_BINDING |
      textureUsage.COPY_SRC,
  });

  return {
    texture,
    asset: aperture.createWebGpuAppRenderTargetAsset({
      label,
      texture,
      width: dimensions.width,
      height: dimensions.height,
      format,
    }),
  };
}

function destroyTexture(texture) {
  if (typeof texture.destroy !== "function") {
    return false;
  }

  texture.destroy();
  return true;
}

function routeConfigForPath(pathname) {
  if (pathname.endsWith("/render-target-resize.html")) {
    return {
      example: "render-target-resize",
      initialOffscreenSize: 128,
      offscreenSize: 384,
      resizeTarget: true,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-msaa-resize.html")) {
    return {
      example: "render-target-msaa-resize",
      initialOffscreenSize: 128,
      offscreenSize: 384,
      resizeTarget: true,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-resize.html")) {
    return {
      example: "mixed-msaa-resize",
      initialOffscreenSize: 128,
      offscreenSize: 384,
      resizeTarget: true,
      reuseStress: false,
      mixedTargets: true,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-resized-crop.html")) {
    return {
      example: "mixed-msaa-resized-crop",
      initialOffscreenSize: 128,
      offscreenSize: 384,
      resizeTarget: true,
      reuseStress: false,
      mixedTargets: true,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: true,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-reuse.html")) {
    return {
      example: "render-target-reuse",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: true,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 2,
    };
  }

  if (pathname.endsWith("/render-target-msaa-reuse.html")) {
    return {
      example: "render-target-msaa-reuse",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: true,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 2,
    };
  }

  if (pathname.endsWith("/mixed-msaa-reuse.html")) {
    return {
      example: "mixed-msaa-reuse",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: true,
      mixedTargets: true,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 2,
    };
  }

  if (pathname.endsWith("/mixed-msaa-reuse-crop.html")) {
    return {
      example: "mixed-msaa-reuse-crop",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: true,
      mixedTargets: true,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: true,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 2,
    };
  }

  if (pathname.endsWith("/mixed-camera-targets.html")) {
    return {
      example: "mixed-camera-targets",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: true,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/multi-render-targets.html")) {
    return {
      example: "multi-render-targets",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: true,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-multi-render-targets.html")) {
    return {
      example: "mixed-multi-render-targets",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: true,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-dual-size.html")) {
    return {
      example: "render-target-dual-size",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: true,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-dual-size-render-targets.html")) {
    return {
      example: "mixed-dual-size-render-targets",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: true,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-dual-size.html")) {
    return {
      example: "mixed-msaa-dual-size",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: true,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-resized-dual-size.html")) {
    return {
      example: "mixed-msaa-resized-dual-size",
      initialOffscreenSize: 128,
      offscreenSize: 384,
      resizeTarget: true,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: true,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-reuse-dual-size.html")) {
    return {
      example: "mixed-msaa-reuse-dual-size",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: true,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: true,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      mixedMsaaClearLoadTarget: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 2,
    };
  }

  if (pathname.endsWith("/mixed-secondary-crop-render-targets.html")) {
    return {
      example: "mixed-secondary-crop-render-targets",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: true,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: true,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-two-targets.html")) {
    return {
      example: "mixed-msaa-two-targets",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: true,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-secondary-crop.html")) {
    return {
      example: "mixed-msaa-secondary-crop",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: true,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: true,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-msaa.html")) {
    return {
      example: "render-target-msaa",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-msaa-two-targets.html")) {
    return {
      example: "render-target-msaa-two-targets",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: true,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: true,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-msaa-secondary-crop.html")) {
    return {
      example: "render-target-msaa-secondary-crop",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: true,
      croppedSecondaryRenderTargets: true,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-secondary-crop.html")) {
    return {
      example: "render-target-secondary-crop",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: true,
      targetCrop: false,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-viewport-crop.html")) {
    return {
      example: "render-target-viewport-crop",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: true,
      targetClearLoad: false,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-msaa-viewport-crop.html")) {
    return {
      example: "render-target-msaa-viewport-crop",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: true,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-clear-load.html")) {
    return {
      example: "render-target-clear-load",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: true,
      targetMsaa: false,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/render-target-msaa-clear-load.html")) {
    return {
      example: "render-target-msaa-clear-load",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: true,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-clear-load.html")) {
    return {
      example: "mixed-msaa-clear-load",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      mixedMsaaClearLoadTarget: true,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: true,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-resized-clear-load.html")) {
    return {
      example: "mixed-msaa-resized-clear-load",
      initialOffscreenSize: 128,
      offscreenSize: 384,
      resizeTarget: true,
      reuseStress: false,
      mixedTargets: false,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      mixedMsaaClearLoadTarget: true,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: false,
      targetClearLoad: true,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  if (pathname.endsWith("/mixed-msaa-target-crop.html")) {
    return {
      example: "mixed-msaa-target-crop",
      initialOffscreenSize: defaultOffscreenSize,
      offscreenSize: defaultOffscreenSize,
      resizeTarget: false,
      reuseStress: false,
      mixedTargets: true,
      multiRenderTargets: false,
      mixedMultiRenderTargets: false,
      dualSizeRenderTargets: false,
      mixedDualSizeRenderTargets: false,
      mixedCroppedSecondaryRenderTargets: false,
      mixedMsaaMultiRenderTargets: false,
      mixedMsaaCroppedSecondaryRenderTargets: false,
      msaaMultiRenderTargets: false,
      msaaCroppedSecondaryRenderTargets: false,
      croppedSecondaryRenderTargets: false,
      targetCrop: true,
      targetClearLoad: false,
      targetMsaa: true,
      requiredFrames: 1,
    };
  }

  return {
    example: "render-to-texture",
    initialOffscreenSize: defaultOffscreenSize,
    offscreenSize: defaultOffscreenSize,
    resizeTarget: false,
    reuseStress: false,
    mixedTargets: false,
    multiRenderTargets: false,
    mixedMultiRenderTargets: false,
    dualSizeRenderTargets: false,
    mixedDualSizeRenderTargets: false,
    msaaMultiRenderTargets: false,
    msaaCroppedSecondaryRenderTargets: false,
    croppedSecondaryRenderTargets: false,
    targetCrop: false,
    targetClearLoad: false,
    targetMsaa: false,
    requiredFrames: 1,
  };
}

function createRenderTargetResizeStatus(
  aperture,
  scene,
  offscreenReport,
  report,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const target =
    (report.renderTargets ?? []).find(
      (entry) => entry.renderTargetKey === renderTargetKey,
    ) ?? null;

  return {
    ...scene.renderTargetResize,
    stableRenderTargetKey:
      scene.renderTargetResize?.renderTargetKey === renderTargetKey &&
      target?.renderTargetKey === renderTargetKey,
    ...(routeConfig.targetMsaa
      ? createRenderTargetResizeMsaaStatus(offscreenReport, report, target)
      : {}),
  };
}

function createRenderTargetResizeMsaaStatus(offscreenReport, report, target) {
  const msaa = createMsaaStatusFromReport(report);
  const attachment = createMsaaAttachmentStatus(
    offscreenReport.boundaries?.[0],
  );

  return {
    msaaSampleCount: target?.msaaSampleCount ?? msaa.sampleCount,
    attachment,
    msaa: {
      mode: "msaa-resized-offscreen-render-target",
      requestedSampleCount: msaa.requestedSampleCount,
      sampleCount: msaa.sampleCount,
      enabled: msaa.enabled,
      clamped: msaa.clamped,
      supportedSampleCounts: msaa.supportedSampleCounts,
      colorTargets: msaa.colorTargets,
      colorTexturesCreated: msaa.colorTexturesCreated,
      colorTexturesReused: msaa.colorTexturesReused,
      target: {
        source: target?.source ?? "offscreen",
        width: target?.width ?? routeConfig.offscreenSize,
        height: target?.height ?? routeConfig.offscreenSize,
        drawCalls: target?.drawCalls ?? 0,
        msaaSampleCount: target?.msaaSampleCount ?? msaa.sampleCount,
        ok: target?.ok ?? false,
      },
      attachment,
    },
  };
}

function createOffscreenFrameStatus(aperture, scene, message, offscreenReport) {
  const report = aperture.webGpuAppRenderReportToJsonValue(offscreenReport);
  const renderTarget = report.renderTargets?.[0] ?? null;
  const msaa = createMsaaStatusFromReport(report);

  return {
    frame: message.frame ?? offscreenReport.frame,
    workerVariant: message.workerStep?.frameVariant ?? "single-frame",
    centerExpectation: message.workerStep?.centerExpectation ?? "plane",
    renderTargetKey:
      renderTarget?.renderTargetKey ??
      aperture.assetHandleKey(scene.renderTarget),
    width: renderTarget?.width ?? routeConfig.offscreenSize,
    height: renderTarget?.height ?? routeConfig.offscreenSize,
    drawCalls: renderTarget?.drawCalls ?? offscreenReport.counts.drawCalls,
    worldTranslation: snapshotPrimaryWorldTranslation(message.snapshot),
    ...(routeConfig.targetMsaa
      ? {
          msaaSampleCount: renderTarget?.msaaSampleCount ?? msaa.sampleCount,
          attachment: createMsaaAttachmentStatus(
            offscreenReport.boundaries?.[0],
          ),
          msaa: {
            requestedSampleCount: msaa.requestedSampleCount,
            sampleCount: msaa.sampleCount,
            enabled: msaa.enabled,
            clamped: msaa.clamped,
            supportedSampleCounts: msaa.supportedSampleCounts,
            colorTargets: msaa.colorTargets,
            colorTexturesCreated: msaa.colorTexturesCreated,
            colorTexturesReused: msaa.colorTexturesReused,
          },
        }
      : {}),
    diagnostics: offscreenReport.counts.diagnostics,
  };
}

function snapshotPrimaryWorldTranslation(snapshot) {
  const draw = snapshot?.meshDraws?.[0];
  const transforms = snapshot?.transforms;
  const offset = draw?.worldTransformOffset;

  if (
    transforms === undefined ||
    offset === undefined ||
    offset + 15 >= transforms.length
  ) {
    return null;
  }

  return [
    transforms[offset + 12] ?? 0,
    transforms[offset + 13] ?? 0,
    transforms[offset + 14] ?? 0,
  ];
}

function createRenderTargetReuseStressStatus(aperture, scene, loop, message) {
  const frames = loop.offscreenFrames;
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const stableDimensions = frames.every(
    (frame) =>
      frame.width === routeConfig.offscreenSize &&
      frame.height === routeConfig.offscreenSize,
  );
  const stableRenderTargetKey = frames.every(
    (frame) => frame.renderTargetKey === renderTargetKey,
  );

  return {
    mode: "same-render-target-two-worker-snapshots",
    renderTargetKey,
    stableRenderTargetKey,
    framesRequested: routeConfig.requiredFrames,
    framesRendered: frames.length,
    displayedFrame: message.frame ?? null,
    reusedHandle: true,
    textureRecreated: false,
    targetResourcePressure: {
      createdTextures: 1,
      reusedTextures: Math.max(0, frames.length - 1),
      stableDimensions,
    },
    ...(routeConfig.targetMsaa
      ? {
          msaa: createRenderTargetReuseStressMsaaStatus(frames),
        }
      : {}),
    frames,
    staleFirstFrameStatus:
      frames.length > 1 && frames[0]?.frame === (message.frame ?? null),
  };
}

function createRenderTargetReuseStressMsaaStatus(frames) {
  const latest =
    frames.findLast((frame) => frame.msaa !== undefined)?.msaa ??
    createMsaaStatusFromReport({});
  const colorTargets = frames.reduce(
    (total, frame) => total + (frame.msaa?.colorTargets ?? 0),
    0,
  );
  const colorTexturesCreated = frames.reduce(
    (total, frame) => total + (frame.msaa?.colorTexturesCreated ?? 0),
    0,
  );
  const colorTexturesReused = frames.reduce(
    (total, frame) => total + (frame.msaa?.colorTexturesReused ?? 0),
    0,
  );
  const sampleCount = latest.sampleCount ?? 1;

  return {
    mode: "msaa-offscreen-render-target-reuse",
    requestedSampleCount: latest.requestedSampleCount ?? 8,
    sampleCount,
    enabled: latest.enabled ?? sampleCount > 1,
    clamped: latest.clamped ?? false,
    supportedSampleCounts: latest.supportedSampleCounts ?? [1, 4],
    stableSampleCount: frames.every(
      (frame) => (frame.msaaSampleCount ?? sampleCount) === sampleCount,
    ),
    colorTargets: latest.colorTargets ?? 0,
    colorTexturesCreated,
    colorTexturesReused,
    resourcePressure: {
      framesRendered: frames.length,
      colorTargets,
      colorTexturesCreated,
      colorTexturesReused,
    },
    resolveAttachments: frames.map((frame) => ({
      frame: frame.frame,
      msaaSampleCount: frame.msaaSampleCount ?? sampleCount,
      ...(frame.attachment ?? createMsaaAttachmentStatus(undefined)),
    })),
  };
}

function createMixedCameraTargetsStatus(
  aperture,
  scene,
  message,
  report,
  screenPass,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const views = (message.snapshot?.views ?? []).map((view) => {
    const viewRenderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

    return {
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: viewRenderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey: viewRenderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });

  return {
    mode: "current-texture-plus-offscreen-render-target",
    renderTargetKey,
    source: "ViewPacket.renderTarget",
    views,
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: screenPass.samples,
    },
    canvasReadback: report.readback ?? null,
    expectedSamples: {
      canvas: {
        sampleId: canvasSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      offscreenPreview: {
        sampleId: previewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
    },
  };
}

function createMixedMsaaRenderTargetResizeStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const reportTargets = report.renderTargets ?? [];
  const offscreenTargetIndex = reportTargets.findIndex(
    (target) => target.renderTargetKey === renderTargetKey,
  );
  const currentTargetIndex = reportTargets.findIndex(
    (target) => target.source === "swapchain",
  );
  const offscreenTarget =
    offscreenTargetIndex === -1 ? null : reportTargets[offscreenTargetIndex];
  const currentTarget =
    currentTargetIndex === -1 ? null : reportTargets[currentTargetIndex];
  const views = (message.snapshot?.views ?? []).map((view) => {
    const viewRenderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const target =
      viewRenderTargetKey === null ? "current-texture" : "offscreen";

    return {
      role: target === "current-texture" ? "current" : "offscreen",
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target,
      renderTargetKey: viewRenderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const msaa = createMsaaStatusFromReport(report);
  const offscreenBoundary =
    offscreenTargetIndex === -1
      ? undefined
      : offscreenReport.boundaries?.[offscreenTargetIndex];
  const currentBoundary =
    currentTargetIndex === -1
      ? undefined
      : offscreenReport.boundaries?.[currentTargetIndex];

  return {
    mode: "current-texture-plus-msaa-resized-offscreen-render-target",
    source: "ViewPacket.renderTarget",
    renderTargetKey,
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    resize: createRenderTargetResizeStatus(
      aperture,
      scene,
      offscreenReport,
      report,
    ),
    renderTargets: [
      {
        role: "offscreen",
        target: "offscreen",
        key: renderTargetKey,
        source: offscreenTarget?.source ?? "offscreen",
        viewId: offscreenTarget?.viewId ?? null,
        width: offscreenTarget?.width ?? routeConfig.offscreenSize,
        height: offscreenTarget?.height ?? routeConfig.offscreenSize,
        format: offscreenTarget?.format ?? null,
        ok: offscreenTarget?.ok ?? false,
        drawCalls: offscreenTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
        displaySample: previewSample.id,
        displayQuad: screenPass.quad ?? null,
        msaaSampleCount: offscreenTarget?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(offscreenBoundary),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
        readbackSample: canvasSample.id,
        msaaSampleCount: currentTarget?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(currentBoundary),
      },
    ],
    views,
    passOrder: reportTargets.map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      msaaSampleCount: target.msaaSampleCount ?? msaa.sampleCount,
      attachment: createMsaaAttachmentStatus(
        offscreenReport.boundaries?.[index],
      ),
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: canvasSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      resizedPreview: {
        sampleId: previewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedMsaaTargetCropStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const reportTargets = report.renderTargets ?? [];
  const offscreenTargetIndex = reportTargets.findIndex(
    (target) => target.renderTargetKey === renderTargetKey,
  );
  const currentTargetIndex = reportTargets.findIndex(
    (target) => target.source === "swapchain",
  );
  const offscreenTarget =
    offscreenTargetIndex === -1 ? null : reportTargets[offscreenTargetIndex];
  const currentTarget =
    currentTargetIndex === -1 ? null : reportTargets[currentTargetIndex];
  const views = (message.snapshot?.views ?? []).map((view) => {
    const viewRenderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const target =
      viewRenderTargetKey === null ? "current-texture" : "offscreen";

    return {
      role: target === "current-texture" ? "current" : "offscreen",
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target,
      renderTargetKey: viewRenderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const msaa = createMsaaStatusFromReport(report);
  const offscreenBoundary =
    offscreenTargetIndex === -1
      ? undefined
      : offscreenReport.boundaries?.[offscreenTargetIndex];
  const currentBoundary =
    currentTargetIndex === -1
      ? undefined
      : offscreenReport.boundaries?.[currentTargetIndex];

  return {
    mode: "current-texture-plus-msaa-cropped-offscreen-render-target",
    source: "ViewPacket.renderTarget",
    renderTargetKey,
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    targetCrop: createOffscreenTargetCropStatus(
      aperture,
      scene,
      message,
      offscreenReport,
      report,
      screenPass,
    ),
    renderTargets: [
      {
        role: "offscreen",
        target: "offscreen",
        key: renderTargetKey,
        source: offscreenTarget?.source ?? "offscreen",
        viewId: offscreenTarget?.viewId ?? null,
        width: offscreenTarget?.width ?? routeConfig.offscreenSize,
        height: offscreenTarget?.height ?? routeConfig.offscreenSize,
        format: offscreenTarget?.format ?? null,
        ok: offscreenTarget?.ok ?? false,
        drawCalls: offscreenTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
        displaySample: cropInsideSample.id,
        displayQuad: screenPass.quad ?? null,
        msaaSampleCount: offscreenTarget?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(offscreenBoundary),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
        readbackSample: canvasSample.id,
        msaaSampleCount: currentTarget?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(currentBoundary),
      },
    ],
    views,
    passOrder: reportTargets.map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      msaaSampleCount: target.msaaSampleCount ?? msaa.sampleCount,
      attachment: createMsaaAttachmentStatus(
        offscreenReport.boundaries?.[index],
      ),
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: canvasSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      insideTarget: {
        sampleId: cropInsideSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      outsideTarget: {
        sampleId: cropOutsideSample.id,
        expectedColor: rgbaToStatusColor(offscreenClearColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedMsaaResizedTargetCropStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  return {
    ...createMixedMsaaTargetCropStatus(
      aperture,
      scene,
      message,
      offscreenReport,
      report,
      screenPass,
    ),
    mode: "current-texture-plus-msaa-resized-cropped-offscreen-render-target",
    resize: createRenderTargetResizeStatus(
      aperture,
      scene,
      offscreenReport,
      report,
    ),
  };
}

function createMixedMsaaRenderTargetReuseStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
  loop,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const reportTargets = report.renderTargets ?? [];
  const offscreenTargetIndex = reportTargets.findIndex(
    (target) => target.renderTargetKey === renderTargetKey,
  );
  const currentTargetIndex = reportTargets.findIndex(
    (target) => target.source === "swapchain",
  );
  const offscreenTarget =
    offscreenTargetIndex === -1 ? null : reportTargets[offscreenTargetIndex];
  const currentTarget =
    currentTargetIndex === -1 ? null : reportTargets[currentTargetIndex];
  const views = (message.snapshot?.views ?? []).map((view) => {
    const viewRenderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const target =
      viewRenderTargetKey === null ? "current-texture" : "offscreen";

    return {
      role: target === "current-texture" ? "current" : "offscreen",
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target,
      renderTargetKey: viewRenderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const msaa = createMsaaStatusFromReport(report);
  const offscreenBoundary =
    offscreenTargetIndex === -1
      ? undefined
      : offscreenReport.boundaries?.[offscreenTargetIndex];
  const currentBoundary =
    currentTargetIndex === -1
      ? undefined
      : offscreenReport.boundaries?.[currentTargetIndex];

  return {
    mode: "current-texture-plus-msaa-reused-offscreen-render-target",
    source: "ViewPacket.renderTarget",
    renderTargetKey,
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    reuse: createRenderTargetReuseStressStatus(aperture, scene, loop, message),
    renderTargets: [
      {
        role: "offscreen",
        target: "offscreen",
        key: renderTargetKey,
        source: offscreenTarget?.source ?? "offscreen",
        viewId: offscreenTarget?.viewId ?? null,
        width: offscreenTarget?.width ?? routeConfig.offscreenSize,
        height: offscreenTarget?.height ?? routeConfig.offscreenSize,
        format: offscreenTarget?.format ?? null,
        ok: offscreenTarget?.ok ?? false,
        drawCalls: offscreenTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
        displaySample: previewSample.id,
        displayQuad: screenPass.quad ?? null,
        msaaSampleCount: offscreenTarget?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(offscreenBoundary),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
        readbackSample: canvasSample.id,
        msaaSampleCount: currentTarget?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(currentBoundary),
      },
    ],
    views,
    passOrder: reportTargets.map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      msaaSampleCount: target.msaaSampleCount ?? msaa.sampleCount,
      attachment: createMsaaAttachmentStatus(
        offscreenReport.boundaries?.[index],
      ),
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: canvasSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      reusedPreview: {
        sampleId: previewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedMsaaReusedTargetCropStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
  loop,
) {
  return {
    ...createMixedMsaaTargetCropStatus(
      aperture,
      scene,
      message,
      offscreenReport,
      report,
      screenPass,
    ),
    mode: "current-texture-plus-msaa-reused-cropped-offscreen-render-target",
    reuse: createRenderTargetReuseStressStatus(aperture, scene, loop, message),
  };
}

function createMultiRenderTargetsStatus(
  aperture,
  scene,
  message,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportByKey = new Map(
    (report.renderTargets ?? []).map((target) => [
      target.renderTargetKey,
      target,
    ]),
  );
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

    return {
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });

  return {
    mode: "two-offscreen-render-target-previews",
    source: "ViewPacket.renderTarget",
    renderTargets: [
      createMultiRenderTargetStatusEntry({
        role: "primary",
        key: primaryKey,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
        sampleId: leftPreviewSample.id,
        target: reportByKey.get(primaryKey),
        displayQuad: quadsByRole.get("primary"),
      }),
      createMultiRenderTargetStatusEntry({
        role: "secondary",
        key: secondaryKey,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
        sampleId: rightPreviewSample.id,
        target: reportByKey.get(secondaryKey),
        displayQuad: quadsByRole.get("secondary"),
      }),
    ],
    views,
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
  };
}

function createMixedMultiRenderTargetsStatus(
  aperture,
  scene,
  message,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportByKey = new Map(
    (report.renderTargets ?? []).map((target) => [
      target.renderTargetKey,
      target,
    ]),
  );
  const currentTarget =
    (report.renderTargets ?? []).find(
      (target) => target.source === "swapchain",
    ) ?? null;
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

    return {
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });

  return {
    mode: "current-texture-plus-two-offscreen-render-targets",
    source: "ViewPacket.renderTarget",
    renderTargets: [
      {
        target: "offscreen",
        ...createMultiRenderTargetStatusEntry({
          role: "primary",
          key: primaryKey,
          materialKey: aperture.assetHandleKey(scene.material),
          expectedColor: rgbaToStatusColor(planeColor),
          sampleId: leftPreviewSample.id,
          target: reportByKey.get(primaryKey),
          displayQuad: quadsByRole.get("primary"),
        }),
      },
      {
        target: "offscreen",
        ...createMultiRenderTargetStatusEntry({
          role: "secondary",
          key: secondaryKey,
          materialKey: aperture.assetHandleKey(scene.canvasMaterial),
          expectedColor: rgbaToStatusColor(canvasPlaneColor),
          sampleId: rightPreviewSample.id,
          target: reportByKey.get(secondaryKey),
          displayQuad: quadsByRole.get("secondary"),
        }),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
        readbackSample: mixedMultiCurrentSample.id,
      },
    ],
    views,
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: mixedMultiCurrentSample.id,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
      },
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryPreview: {
        sampleId: rightPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedDualSizeRenderTargetsStatus(
  aperture,
  scene,
  message,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportByKey = new Map(
    (report.renderTargets ?? []).map((target) => [
      target.renderTargetKey,
      target,
    ]),
  );
  const currentTarget =
    (report.renderTargets ?? []).find(
      (target) => target.source === "swapchain",
    ) ?? null;
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

    return {
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });

  return {
    mode: "current-texture-plus-dual-size-offscreen-render-targets",
    source: "ViewPacket.renderTarget",
    renderTargets: [
      {
        target: "offscreen",
        ...createDualSizeRenderTargetStatusEntry({
          role: "primary",
          key: primaryKey,
          materialKey: aperture.assetHandleKey(scene.material),
          expectedColor: rgbaToStatusColor(planeColor),
          sampleId: leftPreviewSample.id,
          target: reportByKey.get(primaryKey),
          displayQuad: quadsByRole.get("primary"),
        }),
      },
      {
        target: "offscreen",
        ...createDualSizeRenderTargetStatusEntry({
          role: "secondary",
          key: secondaryKey,
          materialKey: aperture.assetHandleKey(scene.canvasMaterial),
          expectedColor: rgbaToStatusColor(canvasPlaneColor),
          sampleId: rightPreviewSample.id,
          target: reportByKey.get(secondaryKey),
          displayQuad: quadsByRole.get("secondary"),
        }),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
        readbackSample: mixedMultiCurrentSample.id,
      },
    ],
    views,
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: mixedMultiCurrentSample.id,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
      },
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryPreview: {
        sampleId: rightPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedMsaaDualSizeRenderTargetsStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportTargets = report.renderTargets ?? [];
  const reportByKey = new Map(
    reportTargets.map((target) => [target.renderTargetKey, target]),
  );
  const primaryTargetIndex = reportTargets.findIndex(
    (target) => target.renderTargetKey === primaryKey,
  );
  const secondaryTargetIndex = reportTargets.findIndex(
    (target) => target.renderTargetKey === secondaryKey,
  );
  const currentTargetIndex = reportTargets.findIndex(
    (target) => target.source === "swapchain",
  );
  const currentTarget =
    currentTargetIndex === -1 ? null : reportTargets[currentTargetIndex];
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const role =
      renderTargetKey === primaryKey
        ? "primary"
        : renderTargetKey === secondaryKey
          ? "secondary"
          : "current";

    return {
      role,
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const msaa = createMsaaStatusFromReport(report);

  return {
    mode: "current-texture-plus-msaa-dual-size-offscreen-render-targets",
    source: "ViewPacket.renderTarget",
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    renderTargets: [
      {
        target: "offscreen",
        ...createDualSizeRenderTargetStatusEntry({
          role: "primary",
          key: primaryKey,
          materialKey: aperture.assetHandleKey(scene.material),
          expectedColor: rgbaToStatusColor(planeColor),
          sampleId: leftPreviewSample.id,
          target: reportByKey.get(primaryKey),
          displayQuad: quadsByRole.get("primary"),
        }),
        msaaSampleCount:
          reportByKey.get(primaryKey)?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(
          primaryTargetIndex === -1
            ? undefined
            : offscreenReport.boundaries?.[primaryTargetIndex],
        ),
      },
      {
        target: "offscreen",
        ...createDualSizeRenderTargetStatusEntry({
          role: "secondary",
          key: secondaryKey,
          materialKey: aperture.assetHandleKey(scene.canvasMaterial),
          expectedColor: rgbaToStatusColor(canvasPlaneColor),
          sampleId: rightPreviewSample.id,
          target: reportByKey.get(secondaryKey),
          displayQuad: quadsByRole.get("secondary"),
        }),
        msaaSampleCount:
          reportByKey.get(secondaryKey)?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(
          secondaryTargetIndex === -1
            ? undefined
            : offscreenReport.boundaries?.[secondaryTargetIndex],
        ),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
        readbackSample: mixedMultiCurrentSample.id,
        msaaSampleCount: currentTarget?.msaaSampleCount ?? msaa.sampleCount,
        attachment: createMsaaAttachmentStatus(
          currentTargetIndex === -1
            ? undefined
            : offscreenReport.boundaries?.[currentTargetIndex],
        ),
      },
    ],
    views,
    passOrder: reportTargets.map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      msaaSampleCount: target.msaaSampleCount ?? msaa.sampleCount,
      attachment: createMsaaAttachmentStatus(
        offscreenReport.boundaries?.[index],
      ),
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: mixedMultiCurrentSample.id,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
      },
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryPreview: {
        sampleId: rightPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedMsaaResizedDualSizeRenderTargetsStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  return {
    ...createMixedMsaaDualSizeRenderTargetsStatus(
      aperture,
      scene,
      message,
      offscreenReport,
      report,
      screenPass,
    ),
    mode: "current-texture-plus-msaa-resized-dual-size-offscreen-render-targets",
    resize: createRenderTargetResizeStatus(
      aperture,
      scene,
      offscreenReport,
      report,
    ),
  };
}

function createMixedMsaaReusedDualSizeRenderTargetsStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
  loop,
) {
  return {
    ...createMixedMsaaDualSizeRenderTargetsStatus(
      aperture,
      scene,
      message,
      offscreenReport,
      report,
      screenPass,
    ),
    mode: "current-texture-plus-msaa-reused-dual-size-offscreen-render-targets",
    reuse: createRenderTargetReuseStressStatus(aperture, scene, loop, message),
  };
}

function createMixedCroppedSecondaryRenderTargetsStatus(
  aperture,
  scene,
  message,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportByKey = new Map(
    (report.renderTargets ?? []).map((target) => [
      target.renderTargetKey,
      target,
    ]),
  );
  const currentTarget =
    (report.renderTargets ?? []).find(
      (target) => target.source === "swapchain",
    ) ?? null;
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const role =
      renderTargetKey === primaryKey
        ? "primary"
        : renderTargetKey === secondaryKey
          ? "secondary"
          : "current";

    return {
      role,
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const secondaryView =
    views.find((view) => view.renderTargetKey === secondaryKey) ?? null;
  const secondaryTarget = reportByKey.get(secondaryKey);
  const secondaryTargetSize = {
    width: secondaryTarget?.width ?? routeConfig.offscreenSize,
    height: secondaryTarget?.height ?? routeConfig.offscreenSize,
  };
  const secondaryViewport =
    secondaryView === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: secondaryView.viewport,
          target: secondaryTargetSize,
          label: "mixed secondary offscreen target crop viewport",
        });
  const secondaryScissor =
    secondaryView === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: secondaryView.scissor,
          target: secondaryTargetSize,
          label: "mixed secondary offscreen target crop scissor",
        });

  return {
    mode: "current-texture-plus-cropped-secondary-offscreen-render-targets",
    source: "ViewPacket.renderTarget",
    renderTargets: [
      {
        target: "offscreen",
        ...createMultiRenderTargetStatusEntry({
          role: "primary",
          key: primaryKey,
          materialKey: aperture.assetHandleKey(scene.material),
          expectedColor: rgbaToStatusColor(planeColor),
          sampleId: leftPreviewSample.id,
          target: reportByKey.get(primaryKey),
          displayQuad: quadsByRole.get("primary"),
        }),
      },
      {
        target: "offscreen",
        ...createMultiRenderTargetStatusEntry({
          role: "secondary",
          key: secondaryKey,
          materialKey: aperture.assetHandleKey(scene.canvasMaterial),
          expectedColor: rgbaToStatusColor(canvasPlaneColor),
          sampleId: secondaryCropInsideSample.id,
          target: secondaryTarget,
          displayQuad: quadsByRole.get("secondary"),
        }),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
        readbackSample: mixedMultiCurrentSample.id,
      },
    ],
    views,
    secondaryCrop: {
      renderTargetKey: secondaryKey,
      expectedNormalizedRect: targetCropRect,
      viewportPixels: secondaryViewport?.rect ?? null,
      scissorPixels: secondaryScissor?.rect ?? null,
      diagnostics: [
        ...(secondaryViewport?.diagnostics ?? []),
        ...(secondaryScissor?.diagnostics ?? []),
      ],
      insideSample: secondaryCropInsideSample.id,
      outsideSample: secondaryCropOutsideSample.id,
    },
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: mixedMultiCurrentSample.id,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
      },
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryInside: {
        sampleId: secondaryCropInsideSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      secondaryOutside: {
        sampleId: secondaryCropOutsideSample.id,
        expectedColor: rgbaToStatusColor(offscreenClearColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedMsaaMultiRenderTargetsStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportTargets = report.renderTargets ?? [];
  const reportByKey = new Map(
    reportTargets.map((target) => [target.renderTargetKey, target]),
  );
  const currentTargetIndex = reportTargets.findIndex(
    (target) => target.source === "swapchain",
  );
  const currentTarget =
    currentTargetIndex === -1 ? null : reportTargets[currentTargetIndex];
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const role =
      renderTargetKey === primaryKey
        ? "primary"
        : renderTargetKey === secondaryKey
          ? "secondary"
          : "current";

    return {
      role,
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const msaa = createMsaaStatusFromReport(report);

  return {
    mode: "current-texture-plus-msaa-two-offscreen-render-targets",
    source: "ViewPacket.renderTarget",
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    renderTargets: [
      {
        target: "offscreen",
        ...createMsaaMultiRenderTargetStatusEntry({
          role: "primary",
          key: primaryKey,
          materialKey: aperture.assetHandleKey(scene.material),
          expectedColor: rgbaToStatusColor(planeColor),
          sampleId: leftPreviewSample.id,
          target: reportByKey.get(primaryKey),
          boundary: offscreenReport.boundaries?.[0],
          displayQuad: quadsByRole.get("primary"),
        }),
      },
      {
        target: "offscreen",
        ...createMsaaMultiRenderTargetStatusEntry({
          role: "secondary",
          key: secondaryKey,
          materialKey: aperture.assetHandleKey(scene.canvasMaterial),
          expectedColor: rgbaToStatusColor(canvasPlaneColor),
          sampleId: rightPreviewSample.id,
          target: reportByKey.get(secondaryKey),
          boundary: offscreenReport.boundaries?.[1],
          displayQuad: quadsByRole.get("secondary"),
        }),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
        readbackSample: mixedMultiCurrentSample.id,
        msaaSampleCount: currentTarget?.msaaSampleCount ?? 1,
        attachment: createMsaaAttachmentStatus(
          currentTargetIndex === -1
            ? undefined
            : offscreenReport.boundaries?.[currentTargetIndex],
        ),
      },
    ],
    views,
    passOrder: reportTargets.map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      msaaSampleCount: target.msaaSampleCount ?? 1,
      attachment: createMsaaAttachmentStatus(
        offscreenReport.boundaries?.[index],
      ),
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: mixedMultiCurrentSample.id,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
      },
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryPreview: {
        sampleId: rightPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedMsaaCroppedSecondaryRenderTargetsStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportTargets = report.renderTargets ?? [];
  const reportByKey = new Map(
    reportTargets.map((target) => [target.renderTargetKey, target]),
  );
  const currentTargetIndex = reportTargets.findIndex(
    (target) => target.source === "swapchain",
  );
  const currentTarget =
    currentTargetIndex === -1 ? null : reportTargets[currentTargetIndex];
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const role =
      renderTargetKey === primaryKey
        ? "primary"
        : renderTargetKey === secondaryKey
          ? "secondary"
          : "current";

    return {
      role,
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const secondaryView =
    views.find((view) => view.renderTargetKey === secondaryKey) ?? null;
  const secondaryTarget = reportByKey.get(secondaryKey);
  const secondaryTargetSize = {
    width: secondaryTarget?.width ?? routeConfig.offscreenSize,
    height: secondaryTarget?.height ?? routeConfig.offscreenSize,
  };
  const secondaryViewport =
    secondaryView === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: secondaryView.viewport,
          target: secondaryTargetSize,
          label: "mixed MSAA secondary offscreen target crop viewport",
        });
  const secondaryScissor =
    secondaryView === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: secondaryView.scissor,
          target: secondaryTargetSize,
          label: "mixed MSAA secondary offscreen target crop scissor",
        });
  const msaa = createMsaaStatusFromReport(report);

  return {
    mode: "current-texture-plus-msaa-cropped-secondary-offscreen-render-targets",
    source: "ViewPacket.renderTarget",
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    renderTargets: [
      {
        target: "offscreen",
        ...createMsaaMultiRenderTargetStatusEntry({
          role: "primary",
          key: primaryKey,
          materialKey: aperture.assetHandleKey(scene.material),
          expectedColor: rgbaToStatusColor(planeColor),
          sampleId: leftPreviewSample.id,
          target: reportByKey.get(primaryKey),
          boundary: offscreenReport.boundaries?.[0],
          displayQuad: quadsByRole.get("primary"),
        }),
      },
      {
        target: "offscreen",
        ...createMsaaMultiRenderTargetStatusEntry({
          role: "secondary",
          key: secondaryKey,
          materialKey: aperture.assetHandleKey(scene.canvasMaterial),
          expectedColor: rgbaToStatusColor(canvasPlaneColor),
          sampleId: secondaryCropInsideSample.id,
          target: secondaryTarget,
          boundary: offscreenReport.boundaries?.[1],
          displayQuad: quadsByRole.get("secondary"),
        }),
      },
      {
        role: "current",
        target: "current-texture",
        key: null,
        source: currentTarget?.source ?? "swapchain",
        viewId: currentTarget?.viewId ?? null,
        width: currentTarget?.width ?? scene.canvas.width,
        height: currentTarget?.height ?? scene.canvas.height,
        format: currentTarget?.format ?? null,
        ok: currentTarget?.ok ?? false,
        drawCalls: currentTarget?.drawCalls ?? 0,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
        readbackSample: mixedMultiCurrentSample.id,
        msaaSampleCount: currentTarget?.msaaSampleCount ?? 1,
        attachment: createMsaaAttachmentStatus(
          currentTargetIndex === -1
            ? undefined
            : offscreenReport.boundaries?.[currentTargetIndex],
        ),
      },
    ],
    views,
    secondaryCrop: {
      renderTargetKey: secondaryKey,
      expectedNormalizedRect: targetCropRect,
      viewportPixels: secondaryViewport?.rect ?? null,
      scissorPixels: secondaryScissor?.rect ?? null,
      diagnostics: [
        ...(secondaryViewport?.diagnostics ?? []),
        ...(secondaryScissor?.diagnostics ?? []),
      ],
      insideSample: secondaryCropInsideSample.id,
      outsideSample: secondaryCropOutsideSample.id,
    },
    passOrder: reportTargets.map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      target: target.source === "swapchain" ? "current-texture" : "offscreen",
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      msaaSampleCount: target.msaaSampleCount ?? 1,
      attachment: createMsaaAttachmentStatus(
        offscreenReport.boundaries?.[index],
      ),
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: mixedMultiCurrentSample.id,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
      },
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryInside: {
        sampleId: secondaryCropInsideSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      secondaryOutside: {
        sampleId: secondaryCropOutsideSample.id,
        expectedColor: rgbaToStatusColor(offscreenClearColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createDualSizeRenderTargetsStatus(
  aperture,
  scene,
  message,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportByKey = new Map(
    (report.renderTargets ?? []).map((target) => [
      target.renderTargetKey,
      target,
    ]),
  );
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

    return {
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });

  return {
    mode: "dual-size-offscreen-render-target-previews",
    source: "ViewPacket.renderTarget",
    renderTargets: [
      createDualSizeRenderTargetStatusEntry({
        role: "primary",
        key: primaryKey,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
        sampleId: leftPreviewSample.id,
        target: reportByKey.get(primaryKey),
        displayQuad: quadsByRole.get("primary"),
      }),
      createDualSizeRenderTargetStatusEntry({
        role: "secondary",
        key: secondaryKey,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
        sampleId: rightPreviewSample.id,
        target: reportByKey.get(secondaryKey),
        displayQuad: quadsByRole.get("secondary"),
      }),
    ],
    views,
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
  };
}

function createDualSizeRenderTargetStatusEntry({
  role,
  key,
  materialKey,
  expectedColor,
  sampleId,
  target,
  displayQuad,
}) {
  return {
    ...createMultiRenderTargetStatusEntry({
      role,
      key,
      materialKey,
      expectedColor,
      sampleId,
      target,
      displayQuad,
    }),
    aspect: displayQuad?.aspect ?? null,
  };
}

function createCroppedSecondaryRenderTargetsStatus(
  aperture,
  scene,
  message,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportByKey = new Map(
    (report.renderTargets ?? []).map((target) => [
      target.renderTargetKey,
      target,
    ]),
  );
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const role =
      renderTargetKey === primaryKey
        ? "primary"
        : renderTargetKey === secondaryKey
          ? "secondary"
          : "current";

    return {
      role,
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const secondaryView =
    views.find((view) => view.renderTargetKey === secondaryKey) ?? null;
  const secondaryTarget = reportByKey.get(secondaryKey);
  const secondaryTargetSize = {
    width: secondaryTarget?.width ?? routeConfig.offscreenSize,
    height: secondaryTarget?.height ?? routeConfig.offscreenSize,
  };
  const secondaryViewport =
    secondaryView === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: secondaryView.viewport,
          target: secondaryTargetSize,
          label: "secondary offscreen target crop viewport",
        });
  const secondaryScissor =
    secondaryView === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: secondaryView.scissor,
          target: secondaryTargetSize,
          label: "secondary offscreen target crop scissor",
        });

  return {
    mode: "cropped-secondary-offscreen-render-target-previews",
    source: "ViewPacket.renderTarget",
    renderTargets: [
      createMultiRenderTargetStatusEntry({
        role: "primary",
        key: primaryKey,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
        sampleId: leftPreviewSample.id,
        target: reportByKey.get(primaryKey),
        displayQuad: quadsByRole.get("primary"),
      }),
      createMultiRenderTargetStatusEntry({
        role: "secondary",
        key: secondaryKey,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
        sampleId: secondaryCropInsideSample.id,
        target: secondaryTarget,
        displayQuad: quadsByRole.get("secondary"),
      }),
    ],
    views,
    secondaryCrop: {
      renderTargetKey: secondaryKey,
      expectedNormalizedRect: targetCropRect,
      viewportPixels: secondaryViewport?.rect ?? null,
      scissorPixels: secondaryScissor?.rect ?? null,
      diagnostics: [
        ...(secondaryViewport?.diagnostics ?? []),
        ...(secondaryScissor?.diagnostics ?? []),
      ],
      insideSample: secondaryCropInsideSample.id,
      outsideSample: secondaryCropOutsideSample.id,
    },
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    expectedSamples: {
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryInside: {
        sampleId: secondaryCropInsideSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      secondaryOutside: {
        sampleId: secondaryCropOutsideSample.id,
        expectedColor: rgbaToStatusColor(offscreenClearColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMsaaCroppedSecondaryRenderTargetsStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportByKey = new Map(
    (report.renderTargets ?? []).map((target) => [
      target.renderTargetKey,
      target,
    ]),
  );
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const role =
      renderTargetKey === primaryKey
        ? "primary"
        : renderTargetKey === secondaryKey
          ? "secondary"
          : "current";

    return {
      role,
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const secondaryView =
    views.find((view) => view.renderTargetKey === secondaryKey) ?? null;
  const secondaryTarget = reportByKey.get(secondaryKey);
  const secondaryTargetSize = {
    width: secondaryTarget?.width ?? routeConfig.offscreenSize,
    height: secondaryTarget?.height ?? routeConfig.offscreenSize,
  };
  const secondaryViewport =
    secondaryView === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: secondaryView.viewport,
          target: secondaryTargetSize,
          label: "MSAA secondary offscreen target crop viewport",
        });
  const secondaryScissor =
    secondaryView === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: secondaryView.scissor,
          target: secondaryTargetSize,
          label: "MSAA secondary offscreen target crop scissor",
        });
  const msaa = createMsaaStatusFromReport(report);

  return {
    mode: "msaa-cropped-secondary-offscreen-render-target-previews",
    source: "ViewPacket.renderTarget",
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    renderTargets: [
      createMsaaMultiRenderTargetStatusEntry({
        role: "primary",
        key: primaryKey,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
        sampleId: leftPreviewSample.id,
        target: reportByKey.get(primaryKey),
        boundary: offscreenReport.boundaries?.[0],
        displayQuad: quadsByRole.get("primary"),
      }),
      createMsaaMultiRenderTargetStatusEntry({
        role: "secondary",
        key: secondaryKey,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
        sampleId: secondaryCropInsideSample.id,
        target: secondaryTarget,
        boundary: offscreenReport.boundaries?.[1],
        displayQuad: quadsByRole.get("secondary"),
      }),
    ],
    views,
    secondaryCrop: {
      renderTargetKey: secondaryKey,
      expectedNormalizedRect: targetCropRect,
      viewportPixels: secondaryViewport?.rect ?? null,
      scissorPixels: secondaryScissor?.rect ?? null,
      diagnostics: [
        ...(secondaryViewport?.diagnostics ?? []),
        ...(secondaryScissor?.diagnostics ?? []),
      ],
      insideSample: secondaryCropInsideSample.id,
      outsideSample: secondaryCropOutsideSample.id,
    },
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      msaaSampleCount: target.msaaSampleCount ?? 1,
      attachment: createMsaaAttachmentStatus(
        offscreenReport.boundaries?.[index],
      ),
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    expectedSamples: {
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryInside: {
        sampleId: secondaryCropInsideSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      secondaryOutside: {
        sampleId: secondaryCropOutsideSample.id,
        expectedColor: rgbaToStatusColor(offscreenClearColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMsaaRenderTargetStatus(
  aperture,
  scene,
  offscreenReport,
  report,
  screenPass,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const target =
    (report.renderTargets ?? []).find(
      (entry) => entry.renderTargetKey === renderTargetKey,
    ) ?? null;
  const boundary = offscreenReport.boundaries?.[0] ?? null;
  const attachment = boundary?.attachments?.plan?.colorAttachments?.[0] ?? null;
  const msaa = createMsaaStatusFromReport(report);

  return {
    mode: "msaa-offscreen-render-target-preview",
    source: "ViewPacket.renderTarget",
    renderTargetKey,
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    target: {
      source: target?.source ?? "offscreen",
      width: target?.width ?? routeConfig.offscreenSize,
      height: target?.height ?? routeConfig.offscreenSize,
      format: target?.format ?? null,
      drawCalls: target?.drawCalls ?? 0,
      msaaSampleCount: target?.msaaSampleCount ?? 1,
      ok: target?.ok ?? false,
    },
    attachment: {
      colorLoadOp: attachment?.loadOp ?? null,
      colorStoreOp: attachment?.storeOp ?? null,
      resolveTarget: attachment?.resolveTarget !== undefined,
    },
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: screenPass.samples,
    },
    expectedSamples: {
      preview: {
        sampleId: centerSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMsaaMultiRenderTargetsStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const primaryKey = aperture.assetHandleKey(scene.renderTarget);
  const secondaryKey = aperture.assetHandleKey(scene.secondaryRenderTarget);
  const reportByKey = new Map(
    (report.renderTargets ?? []).map((target) => [
      target.renderTargetKey,
      target,
    ]),
  );
  const quadsByRole = new Map(
    (screenPass.quads ?? []).map((quad) => [quad.role, quad]),
  );
  const views = (message.snapshot?.views ?? []).map((view) => {
    const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

    return {
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: renderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const msaa = createMsaaStatusFromReport(report);

  return {
    mode: "msaa-two-offscreen-render-target-previews",
    source: "ViewPacket.renderTarget",
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    renderTargets: [
      createMsaaMultiRenderTargetStatusEntry({
        role: "primary",
        key: primaryKey,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
        sampleId: leftPreviewSample.id,
        target: reportByKey.get(primaryKey),
        boundary: offscreenReport.boundaries?.[0],
        displayQuad: quadsByRole.get("primary"),
      }),
      createMsaaMultiRenderTargetStatusEntry({
        role: "secondary",
        key: secondaryKey,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
        sampleId: rightPreviewSample.id,
        target: reportByKey.get(secondaryKey),
        boundary: offscreenReport.boundaries?.[1],
        displayQuad: quadsByRole.get("secondary"),
      }),
    ],
    views,
    passOrder: (report.renderTargets ?? []).map((target, index) => ({
      index,
      viewId: target.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      msaaSampleCount: target.msaaSampleCount ?? 1,
      attachment: createMsaaAttachmentStatus(
        offscreenReport.boundaries?.[index],
      ),
    })),
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quads: screenPass.quads,
      samples: screenPass.samples,
    },
    expectedSamples: {
      primaryPreview: {
        sampleId: leftPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      secondaryPreview: {
        sampleId: rightPreviewSample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMsaaMultiRenderTargetStatusEntry({
  role,
  key,
  materialKey,
  expectedColor,
  sampleId,
  target,
  boundary,
  displayQuad,
}) {
  return {
    ...createMultiRenderTargetStatusEntry({
      role,
      key,
      materialKey,
      expectedColor,
      sampleId,
      target,
      displayQuad,
    }),
    msaaSampleCount: target?.msaaSampleCount ?? 1,
    attachment: createMsaaAttachmentStatus(boundary),
  };
}

function createMsaaAttachmentStatus(boundary) {
  const attachment = boundary?.attachments?.plan?.colorAttachments?.[0] ?? null;
  const resolveTarget = attachment?.resolveTarget !== undefined;

  return {
    colorLoadOp: attachment?.loadOp ?? null,
    colorStoreOp: attachment?.storeOp ?? null,
    resolveTarget,
    behavior: resolveTarget
      ? "resolve-to-render-target-texture"
      : "direct-render-target-write",
  };
}

function createMsaaStatusFromReport(report) {
  if (report.msaa !== undefined) {
    return report.msaa;
  }

  const msaaTargets = (report.renderTargets ?? []).filter(
    (target) => (target.msaaSampleCount ?? 1) > 1,
  );
  const sampleCount = msaaTargets[0]?.msaaSampleCount ?? 1;
  const requestedSampleCount = routeConfig.targetMsaa ? 8 : sampleCount;

  return {
    requestedSampleCount,
    sampleCount,
    enabled: sampleCount > 1,
    clamped: requestedSampleCount !== sampleCount,
    supportedSampleCounts: [1, 4],
    colorTargets: msaaTargets.length,
    colorTexturesCreated: msaaTargets.length,
    colorTexturesReused: 0,
  };
}

function createMultiRenderTargetStatusEntry({
  role,
  key,
  materialKey,
  expectedColor,
  sampleId,
  target,
  displayQuad,
}) {
  return {
    role,
    key,
    source: target?.source ?? "offscreen",
    viewId: target?.viewId ?? null,
    width: target?.width ?? routeConfig.offscreenSize,
    height: target?.height ?? routeConfig.offscreenSize,
    format: target?.format ?? null,
    ok: target?.ok ?? false,
    drawCalls: target?.drawCalls ?? 0,
    materialKey,
    expectedColor,
    displaySample: sampleId,
    displayQuad: displayQuad ?? null,
  };
}

function createMixedMsaaSameTargetClearLoadStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const msaa = createMsaaStatusFromReport(report);
  let viewOffscreenPass = 0;
  const views = (message.snapshot?.views ?? []).map((view, index) => {
    const viewRenderTargetKey = assetKeyOrNull(aperture, view.renderTarget);
    const target =
      viewRenderTargetKey === null ? "current-texture" : "offscreen";
    const role =
      target === "current-texture"
        ? "current"
        : viewOffscreenPass++ === 0
          ? "base"
          : "overlay";

    return {
      index,
      role,
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target,
      renderTargetKey: viewRenderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  let renderOffscreenPass = 0;
  const passOrder = (report.renderTargets ?? []).map((target, index) => {
    const boundary = offscreenReport.boundaries?.[index] ?? null;
    const colorLoadOp =
      boundary?.attachments?.plan?.colorAttachments?.[0]?.loadOp ?? null;
    const depthLoadOp =
      boundary?.attachments?.plan?.depthStencilAttachment?.depthLoadOp ?? null;
    const passTarget =
      target.source === "swapchain" ? "current-texture" : "offscreen";
    const role =
      passTarget === "current-texture"
        ? "current"
        : renderOffscreenPass++ === 0
          ? "base"
          : "overlay";

    return {
      index,
      role,
      viewId: target.viewId,
      source: target.source,
      target: passTarget,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      colorLoadOp,
      depthLoadOp,
      msaaSampleCount: target.msaaSampleCount ?? msaa.sampleCount,
      attachment: createMsaaAttachmentStatus(boundary),
      clearBehavior:
        passTarget === "current-texture"
          ? "current-texture-clear"
          : colorLoadOp === "load"
            ? "load-existing-target"
            : "target-cleared-before-view",
    };
  });
  const offscreenPasses = passOrder.filter(
    (pass) => pass.target === "offscreen",
  );
  const uniqueTargetKeys = [
    ...new Set(offscreenPasses.map((pass) => pass.renderTargetKey)),
  ];

  return {
    mode: "current-texture-plus-msaa-same-offscreen-render-target-clear-load",
    source: "ViewPacket.renderTarget",
    renderTargetKey,
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    views,
    passOrder,
    targetKeyReuse: {
      expectedRenderTargetKey: renderTargetKey,
      uniqueTargetKeys,
      allPassesShareTargetKey:
        uniqueTargetKeys.length === 1 &&
        uniqueTargetKeys[0] === renderTargetKey,
      passCount: offscreenPasses.length,
    },
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: screenPass.samples,
    },
    currentTextureReadback: report.readback ?? null,
    expectedSamples: {
      currentTexture: {
        sampleId: mixedMultiCurrentSample.id,
        materialKey: aperture.assetHandleKey(scene.currentMaterial),
        expectedColor: rgbaToStatusColor(currentPlaneColor),
      },
      clearOnly: {
        sampleId: clearLoadClearSample.id,
        expectedColor: rgbaToStatusColor(offscreenClearColor),
      },
      basePreserved: {
        sampleId: clearLoadBaseSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      overlay: {
        sampleId: clearLoadOverlaySample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createMixedMsaaResizedSameTargetClearLoadStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  return {
    ...createMixedMsaaSameTargetClearLoadStatus(
      aperture,
      scene,
      message,
      offscreenReport,
      report,
      screenPass,
    ),
    mode: "current-texture-plus-msaa-resized-same-offscreen-render-target-clear-load",
    resize: createRenderTargetResizeStatus(
      aperture,
      scene,
      offscreenReport,
      report,
    ),
  };
}

function createSameRenderTargetClearLoadStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const msaa = createMsaaStatusFromReport(report);
  const views = (message.snapshot?.views ?? []).map((view, index) => {
    const viewRenderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

    return {
      index,
      role: index === 0 ? "base" : "overlay",
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      target: viewRenderTargetKey === null ? "current-texture" : "offscreen",
      renderTargetKey: viewRenderTargetKey,
      viewport: Array.from(view.viewport),
      scissor: Array.from(view.scissor),
      clearColor: rgbaToStatusColor(view.clearColor),
    };
  });
  const passOrder = (report.renderTargets ?? []).map((target, index) => {
    const boundary = offscreenReport.boundaries?.[index] ?? null;
    const colorLoadOp =
      boundary?.attachments?.plan?.colorAttachments?.[0]?.loadOp ?? null;
    const depthLoadOp =
      boundary?.attachments?.plan?.depthStencilAttachment?.depthLoadOp ?? null;

    return {
      index,
      role: index === 0 ? "base" : "overlay",
      viewId: target.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      drawCalls: target.drawCalls,
      ok: target.ok,
      colorLoadOp,
      depthLoadOp,
      ...(routeConfig.targetMsaa
        ? {
            msaaSampleCount: target.msaaSampleCount ?? msaa.sampleCount,
            attachment: createMsaaAttachmentStatus(boundary),
          }
        : {}),
      clearBehavior:
        colorLoadOp === "load"
          ? "load-existing-target"
          : "target-cleared-before-view",
    };
  });
  const uniqueTargetKeys = [
    ...new Set(passOrder.map((pass) => pass.renderTargetKey)),
  ];

  return {
    mode: "same-offscreen-render-target-clear-load",
    source: "ViewPacket.renderTarget",
    renderTargetKey,
    ...(routeConfig.targetMsaa
      ? {
          requestedSampleCount: msaa.requestedSampleCount,
          sampleCount: msaa.sampleCount,
          enabled: msaa.enabled,
          clamped: msaa.clamped,
          supportedSampleCounts: msaa.supportedSampleCounts,
          colorTargets: msaa.colorTargets,
          colorTexturesCreated: msaa.colorTexturesCreated,
          colorTexturesReused: msaa.colorTexturesReused,
        }
      : {}),
    views,
    passOrder,
    targetKeyReuse: {
      expectedRenderTargetKey: renderTargetKey,
      uniqueTargetKeys,
      allPassesShareTargetKey:
        uniqueTargetKeys.length === 1 &&
        uniqueTargetKeys[0] === renderTargetKey,
      passCount: passOrder.length,
    },
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: screenPass.samples,
    },
    expectedSamples: {
      clearOnly: {
        sampleId: clearLoadClearSample.id,
        expectedColor: rgbaToStatusColor(offscreenClearColor),
      },
      basePreserved: {
        sampleId: clearLoadBaseSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      overlay: {
        sampleId: clearLoadOverlaySample.id,
        materialKey: aperture.assetHandleKey(scene.canvasMaterial),
        expectedColor: rgbaToStatusColor(canvasPlaneColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createOffscreenTargetCropStatus(
  aperture,
  scene,
  message,
  offscreenReport,
  report,
  screenPass,
) {
  const renderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const msaa = createMsaaStatusFromReport(report);
  const target =
    (report.renderTargets ?? []).find(
      (entry) => entry.renderTargetKey === renderTargetKey,
    ) ?? null;
  const targetSize = {
    width: target?.width ?? routeConfig.offscreenSize,
    height: target?.height ?? routeConfig.offscreenSize,
  };
  const view = message.snapshot?.views?.[0] ?? null;
  const viewport =
    view === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: view.viewport,
          target: targetSize,
          label: "offscreen target crop viewport",
        });
  const scissor =
    view === null
      ? null
      : aperture.resolveNormalizedViewRectangle({
          rect: view.scissor,
          target: targetSize,
          label: "offscreen target crop scissor",
        });

  return {
    mode: "offscreen-render-target-viewport-crop",
    source: "ViewPacket.renderTarget",
    renderTargetKey,
    target: {
      source: target?.source ?? "offscreen",
      width: targetSize.width,
      height: targetSize.height,
      format: target?.format ?? null,
      drawCalls: target?.drawCalls ?? 0,
      ...(routeConfig.targetMsaa
        ? { msaaSampleCount: target?.msaaSampleCount ?? msaa.sampleCount }
        : {}),
      ok: target?.ok ?? false,
    },
    ...(routeConfig.targetMsaa
      ? {
          requestedSampleCount: msaa.requestedSampleCount,
          sampleCount: msaa.sampleCount,
          enabled: msaa.enabled,
          clamped: msaa.clamped,
          supportedSampleCounts: msaa.supportedSampleCounts,
          colorTargets: msaa.colorTargets,
          colorTexturesCreated: msaa.colorTexturesCreated,
          colorTexturesReused: msaa.colorTexturesReused,
          attachment: createMsaaAttachmentStatus(
            offscreenReport.boundaries?.[0],
          ),
        }
      : {}),
    view:
      view === null
        ? null
        : {
            viewId: view.viewId,
            camera: view.camera,
            priority: view.priority,
            layerMask: view.layerMask,
            viewport: Array.from(view.viewport),
            scissor: Array.from(view.scissor),
            expectedNormalizedRect: targetCropRect,
            clearColor: rgbaToStatusColor(view.clearColor),
          },
    viewportPixels: viewport?.rect ?? null,
    scissorPixels: scissor?.rect ?? null,
    diagnostics: [
      ...(viewport?.diagnostics ?? []),
      ...(scissor?.diagnostics ?? []),
    ],
    displayPass: {
      loadOp: screenPass.loadOp,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: screenPass.samples,
    },
    expectedSamples: {
      insideTarget: {
        sampleId: cropInsideSample.id,
        materialKey: aperture.assetHandleKey(scene.material),
        expectedColor: rgbaToStatusColor(planeColor),
      },
      outsideTarget: {
        sampleId: cropOutsideSample.id,
        expectedColor: rgbaToStatusColor(offscreenClearColor),
      },
      screenClear: {
        sampleId: screenClearSample.id,
        expectedColor: { ...screenClearColor },
      },
    },
  };
}

function createFailureDetails(
  aperture,
  app,
  scene,
  loop,
  message,
  typedSnapshot,
  offscreenReport,
  screenPass = null,
) {
  return {
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: scene?.format ?? app.initialization.format,
    clearColors: {
      offscreen: rgbaToStatusColor(offscreenClearColor),
      screen: { ...screenClearColor },
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    counts: offscreenReport?.counts,
    report:
      offscreenReport === null || offscreenReport === undefined
        ? null
        : aperture.webGpuAppRenderReportToJsonValue(offscreenReport),
    screenPass,
    renderControl: {
      capabilities: exampleControlCapabilities(),
    },
  };
}

function createSourceViewStatus(aperture, snapshot, scene) {
  const expectedRenderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const view = snapshot?.views?.[0];

  if (view === undefined) {
    return {
      ok: false,
      reason: "source-view-missing",
      expectedRenderTargetKey,
    };
  }

  const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

  return {
    ok: true,
    viewId: view.viewId,
    camera: view.camera,
    priority: view.priority,
    layerMask: view.layerMask,
    viewport: Array.from(view.viewport),
    scissor: Array.from(view.scissor),
    clearColor: rgbaToStatusColor(view.clearColor),
    clearDepth: view.clearDepth,
    clearStencil: view.clearStencil,
    renderTargetKey,
    expectedRenderTargetKey,
    renderTargetMatches: renderTargetKey === expectedRenderTargetKey,
  };
}

function assetKeyOrNull(aperture, handle) {
  return handle === null || handle === undefined
    ? null
    : aperture.assetHandleKey(handle);
}

function exampleControlCapabilities() {
  return (
    globalThis.__APERTURE_EXAMPLE_CONTROL__?.capabilities ?? {
      status: true,
      warnings: true,
      screenshot: true,
      pause: false,
      resume: false,
      step: false,
      scenario: false,
      snapshot: true,
      readback: false,
    }
  );
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
}

function rgbaToStatusColor(color) {
  return {
    r: statusColorChannel(color[0]),
    g: statusColorChannel(color[1]),
    b: statusColorChannel(color[2]),
    a: statusColorChannel(color[3]),
  };
}

function statusColorChannel(value) {
  return Number(value.toFixed(6));
}

function createPreviewAspectStatus({ target, quad, canvasAspectRatio }) {
  const targetAspectRatio = target.width / target.height;
  const displayAspectRatio =
    (quad.widthNdc / quad.heightNdc) * canvasAspectRatio;

  return {
    targetWidth: target.width,
    targetHeight: target.height,
    targetAspectRatio: statusNumber(targetAspectRatio),
    displayAspectRatio: statusNumber(displayAspectRatio),
    preservesAspect: Math.abs(displayAspectRatio - targetAspectRatio) < 0.05,
    mapping: "preserve-target-aspect",
  };
}

function statusNumber(value) {
  return Number(value.toFixed(6));
}

async function waitForSubmittedWork(device) {
  if (typeof device.queue?.onSubmittedWorkDone === "function") {
    await device.queue.onSubmittedWorkDone();
  }
}

function failure(phase, reason, message, extra = {}) {
  return {
    ...baseStatus,
    ...extra,
    ok: false,
    phase,
    reason,
    message,
  };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
