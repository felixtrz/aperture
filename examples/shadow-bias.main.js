import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  registerShadowBiasScene,
  shadowBiasIntent,
} from "./shadow-bias-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const exampleParams = new URLSearchParams(globalThis.location.search);
const stopAfterReady = exampleParams.has("stop-after-ready");
const depthBiasOverride = exampleParams.has("shadow-depth-bias")
  ? Number(exampleParams.get("shadow-depth-bias"))
  : undefined;
const shadowTypeOverride = exampleParams.has("shadow-type")
  ? Number(exampleParams.get("shadow-type"))
  : undefined;
const casterEnabled = exampleParams.has("caster");

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("@aperture-engine/simulation"),
      import("@aperture-engine/render"),
      import("@aperture-engine/runtime"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-shadow-bias",
        }),
      );
    } else {
      const scene = createPresentationScene(aperture, sourceAssets, canvas);
      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "shadow-bias-failed",
      error instanceof Error ? error.message : "Shadow bias example failed.",
    ),
  );
}

function createPresentationScene(aperture, sourceAssets, targetCanvas) {
  // Presentation-side asset registration mirrors the worker scene so the render
  // app can resolve mesh/material handles from the snapshot.
  const assets = registerShadowBiasScene(aperture, sourceAssets);

  return {
    canvas: targetCanvas,
    floorMeshKey: assets.floorMeshKey,
    pillarMeshKey: assets.pillarMeshKey,
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker("/worker-modules/examples/shadow-bias.worker.js", {
    name: "aperture-shadow-bias-simulation",
    type: "module",
  });
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    standardMaterialShadowReceiverResources: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, scene, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
    depthBias: depthBiasOverride,
    shadowType: shadowTypeOverride,
    caster: casterEnabled,
  });
  globalThis.__APERTURE_STOP_EXAMPLE__ = () => {
    loop.workerReady = false;
    worker.terminate();
  };
  window.__APERTURE_STOP_EXAMPLE__ = globalThis.__APERTURE_STOP_EXAMPLE__;
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
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

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame,
    clearColor,
    label: "shadow-bias-app",
    autoStandardMaterialShadowReceiverResources: false,
    ...(loop.standardMaterialShadowReceiverResources === null
      ? {}
      : {
          standardMaterialShadowReceiverResources:
            loop.standardMaterialShadowReceiverResources,
        }),
  });

  const nextFrameResources = publishFrameStatus(
    aperture,
    app,
    scene,
    loop,
    message.workerStep,
    report,
  );
  loop.standardMaterialShadowReceiverResources =
    nextFrameResources.standardMaterialShadowReceiverResources;
  requestWorkerFrame(worker, loop);
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({ type: "frame", frame: loop.frame, timestamp });
  });
}

function publishFrameStatus(aperture, app, scene, loop, step, report) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowFrame = createShadowBiasShadowFrame({
    aperture,
    app,
    report,
    reportJson,
    step,
    appEnvironmentResourceCache,
  });
  const renderingSupported =
    report.frame >= 3 &&
    shadowFrame.commandBufferSubmissionReport.status === "submitted" &&
    shadowFrame.route !== null;

  publishStatus({
    example: "shadow-bias",
    ok: report.ok,
    phase: report.ok ? "render" : "failed",
    renderingBackend: "webgpu-shadow-bias",
    frame: report.frame,
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
    },
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      shadowRequests: report.snapshot.shadowRequests.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    scene: {
      floorMeshKey: scene.floorMeshKey,
      pillarMeshKey: scene.pillarMeshKey,
    },
    shadow: {
      intent: { ...shadowBiasIntent, kind: "directional" },
      requests: report.snapshot.shadowRequests.map((request) => ({
        lightKind: request.lightKind,
        cascadeCount: request.cascadeCount ?? 1,
        shadowType: request.shadowType ?? 1,
        depthBias: request.depthBias ?? 0,
        normalBias: request.normalBias ?? 0,
        filterRadius: request.filterRadius ?? 1,
        strength: request.strength ?? 1,
      })),
      authoredDepthBias: step?.depthBias ?? null,
      authoredNormalBias: step?.normalBias ?? null,
      report: shadowFrame.report,
      descriptor: shadowFrame.descriptor,
      depthTextureResources: shadowFrame.depthTextureResources,
      passPlan: shadowFrame.passPlan,
      matrixComputation: shadowFrame.matrixComputation,
      casterDrawList: shadowFrame.casterDrawList,
      commandEncoding: shadowFrame.commandEncoding,
      encoderAssembly: shadowFrame.encoderAssembly,
      commandBufferSubmission: shadowFrame.commandBufferSubmission,
      rendering: {
        supported: renderingSupported,
        mode: "frame-loop-auto-directional-csm",
        cascadeCount: shadowBiasIntent.cascadeCount,
        pipelineKey: shadowFrame.route?.pipelineKey ?? null,
      },
    },
    resources: {
      cascadedShadowRoute: shadowFrame.route,
      bindGroups: report.resources?.resources?.bindGroups.length ?? 0,
      reuse: report.resourceReuse,
    },
    renderWorld: { active: app.renderWorld.size },
  });

  if (stopAfterReady && renderingSupported) {
    globalThis.__APERTURE_STOP_EXAMPLE__?.();
  }

  return {
    standardMaterialShadowReceiverResources: shadowFrame.receiverResources,
  };
}

function createShadowBiasShadowFrame(input) {
  const {
    aperture,
    app,
    report,
    reportJson,
    step,
    appEnvironmentResourceCache,
  } = input;
  const shadowCasterMeshViews =
    aperture.createShadowCasterMeshViewsFromAppReport(report);
  const shadowFrame = aperture.createRenderShadowFrame({
    device: app.initialization.device,
    snapshot: report.snapshot,
    preparedMeshes: shadowCasterMeshViews.preparedMeshes,
    executableMeshes: shadowCasterMeshViews.executableMeshes,
    cache: appEnvironmentResourceCache,
    shadowMap: {
      mapSize: shadowBiasIntent.mapSize,
      depthBias: step?.depthBias ?? shadowBiasIntent.depthBias,
      normalBias: step?.normalBias ?? shadowBiasIntent.normalBias,
      cascadeCount: shadowBiasIntent.cascadeCount,
      resourceKey: shadowBiasIntent.key,
    },
    label: "shadow-pass:shadow-bias",
    submit: true,
  });
  const route = findCascadedShadowRoute(reportJson);
  const commandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowFrame.commandBufferSubmission,
    );

  return {
    report: shadowFrame.report,
    descriptor: aperture.shadowMapDescriptorReportToJsonValue(
      shadowFrame.descriptor,
    ),
    depthTextureResources: aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowFrame.depthTextureResources,
    ),
    passPlan: aperture.shadowPassPlanReportToJsonValue(shadowFrame.passPlan),
    matrixComputation:
      aperture.directionalShadowMatrixComputationReportToJsonValue(
        shadowFrame.matrixComputation,
      ),
    casterDrawList: aperture.shadowCasterDrawListPlanReportToJsonValue(
      shadowFrame.casterDrawList,
    ),
    commandEncoding: aperture.shadowPassCommandEncodingReportToJsonValue(
      shadowFrame.commandEncoding,
    ),
    encoderAssembly: aperture.shadowPassEncoderAssemblyReportToJsonValue(
      shadowFrame.encoderAssembly,
    ),
    commandBufferSubmission,
    commandBufferSubmissionReport: shadowFrame.commandBufferSubmission,
    receiverResources: shadowFrame.receiverResources,
    route,
  };
}

function findCascadedShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find((pipeline) =>
      pipeline.pipelineKey.includes("cascadedShadowMap"),
    ) ?? null
  );
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? (status.phase ?? "ready") : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message, extra = {}) {
  return {
    example: "shadow-bias",
    ok: false,
    phase: "failed",
    reason,
    message,
    ...extra,
  };
}
