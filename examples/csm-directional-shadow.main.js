import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  clearColor,
  registerCsmDirectionalShadowScene,
  shadowIntent,
} from "./csm-directional-shadow-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const shadowReceiverToggle = document.querySelector("#shadow-receiver-toggle");
const shadowCasterToggle = document.querySelector("#shadow-caster-toggle");
const exampleParams = new URLSearchParams(globalThis.location.search);
const shadowControls = {
  receiverEnabled: !exampleParams.has("disable-shadow-receiver"),
  casterEnabled: !exampleParams.has("disable-shadow-caster"),
};
const stopAfterReady = exampleParams.has("stop-after-ready");
const useFrameGraph = exampleParams.get("graph") === "1";
let pendingShadowCasterGraphPasses = null;

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
      // M3-T4: ?graph=1 routes the forward (shadow-receiver) frame through the
      // single-encoder graph; shadow caster passes stay on their own path (T5).
      ...(exampleParams.get("graph") === "1" ? { useFrameGraph: true } : {}),
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
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
      "csm-directional-shadow-failed",
      error instanceof Error
        ? error.message
        : "Cascaded directional shadow example failed.",
    ),
  );
}

function createPresentationScene(aperture, sourceAssets, targetCanvas) {
  const assets = registerCsmDirectionalShadowScene(aperture, sourceAssets);

  setupShadowControls(shadowControls);

  return {
    canvas: targetCanvas,
    receiverMeshKeys: assets.receiverMeshKeys,
    casterMeshKeys: assets.casterMeshKeys,
    shadowControls,
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/csm-directional-shadow.worker.js",
    {
      name: "aperture-csm-directional-shadow-simulation",
      type: "module",
    },
  );
  const loop = {
    shadowCasterGraphPasses: null,
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
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
    // M4-T4 proof: let the spec drive the authored shadow strength so it can
    // assert full darkness (strength=1) vs no-shadow (strength=0).
    shadowStrength: exampleParams.has("shadow-strength")
      ? Number(exampleParams.get("shadow-strength"))
      : undefined,
    // M4-T5 proof: drive the authored receiver depth bias (and normal bias) so
    // the spec can assert acne at bias=0 and peter-panning at very large bias.
    shadowDepthBias: exampleParams.has("shadow-depth-bias")
      ? Number(exampleParams.get("shadow-depth-bias"))
      : undefined,
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
    loop.workerScene = message.scene ?? null;
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
    label: "csm-directional-shadow-app",
    autoStandardMaterialShadowReceiverResources: false,
    ...(useFrameGraph && loop.shadowCasterGraphPasses
      ? { shadowCasterGraphPasses: loop.shadowCasterGraphPasses }
      : {}),
    ...(!scene.shadowControls.receiverEnabled ||
    loop.standardMaterialShadowReceiverResources === null
      ? {}
      : {
          standardMaterialShadowReceiverResources:
            loop.standardMaterialShadowReceiverResources,
        }),
  });
  const nextFrameResources = await publishFrameStatus(
    aperture,
    app,
    scene,
    loop,
    message.workerStep,
    report,
    message.frame,
  );

  loop.standardMaterialShadowReceiverResources =
    nextFrameResources.standardMaterialShadowReceiverResources;
  loop.shadowCasterGraphPasses = pendingShadowCasterGraphPasses;
  requestWorkerFrame(worker, loop);
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

async function publishFrameStatus(
  aperture,
  app,
  scene,
  loop,
  step,
  report,
  frame,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowFrame = await createCsmShadowFrame({
    aperture,
    app,
    report,
    reportJson,
    scene,
    appEnvironmentResourceCache,
  });
  const renderingSupported =
    scene.shadowControls.receiverEnabled &&
    scene.shadowControls.casterEnabled &&
    frame >= 3 &&
    shadowFrame.commandBufferSubmissionReport.status === "submitted" &&
    shadowFrame.route !== null;

  publishStatus({
    example: "csm-directional-shadow",
    ok: report.ok,
    phase: report.ok ? "render" : "failed",
    renderingBackend: "webgpu-explicit",
    frame,
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
    },
    transport: {
      mode: "transferable-postMessage",
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    scene: {
      receiverMeshKeys: scene.receiverMeshKeys,
      casterMeshKeys: scene.casterMeshKeys,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      shadowRequests: report.snapshot.shadowRequests.length,
      diagnostics: report.snapshot.diagnostics.length,
      transformDiagnostics: step?.diagnostics ?? 0,
    },
    shadow: {
      controls: {
        receiverEnabled: scene.shadowControls.receiverEnabled,
        casterEnabled: scene.shadowControls.casterEnabled,
      },
      intent: {
        ...shadowIntent,
        kind: "directional",
      },
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind,
        cascadeCount: request.cascadeCount ?? 1,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
        // Authored shadow params (M4-T3) surfaced for the proof; defaults shown
        // when the light did not author them.
        shadowType: request.shadowType ?? 1,
        strength: request.strength ?? 1,
        filterRadius: request.filterRadius ?? 1,
        slopeBias: request.slopeBias ?? 0,
        depthBias: request.depthBias ?? 0,
        normalBias: request.normalBias ?? 0,
      })),
      descriptor: shadowFrame.descriptor,
      textures: shadowFrame.textures,
      depthTextureResources: shadowFrame.depthTextureResources,
      samplerResource: shadowFrame.samplerResource,
      passPlan: shadowFrame.passPlan,
      passAttachments: shadowFrame.passAttachments,
      viewProjection: shadowFrame.viewProjection,
      matrixComputation: shadowFrame.matrixComputation,
      matrixBuffer: shadowFrame.matrixBuffer,
      matrixBufferResource: shadowFrame.matrixBufferResource,
      casterDrawList: shadowFrame.casterDrawList,
      commandPlan: shadowFrame.commandPlan,
      commandEncoding: shadowFrame.commandEncoding,
      pipelineDescriptor: shadowFrame.pipelineDescriptor,
      pipelineResource: shadowFrame.pipelineResource,
      matrixBindGroupResource: shadowFrame.matrixBindGroupResource,
      frameResources: shadowFrame.frameResources,
      commandRecords: shadowFrame.commandRecords,
      encoderAssembly: shadowFrame.encoderAssembly,
      commandBufferSubmission: shadowFrame.commandBufferSubmission,
      rendering: {
        supported: renderingSupported,
        mode: "directional-csm-depth-array-compare",
        cascadeCount: shadowIntent.cascadeCount,
        pipelineKey: shadowFrame.route?.pipelineKey ?? null,
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      cascadedShadowRoute: shadowFrame.route,
      bindGroups: report.resources?.resources?.bindGroups.length ?? 0,
      reuse: report.resourceReuse,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
      indexedDrawCalls: report.boundary?.execution?.indexedDrawCalls ?? 0,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    canvas: {
      width: scene.canvas.width,
      height: scene.canvas.height,
    },
    report: reportJson,
  });
  if (stopAfterReady && renderingSupported) {
    globalThis.__APERTURE_STOP_EXAMPLE__?.();
  }

  return {
    standardMaterialShadowReceiverResources:
      scene.shadowControls.receiverEnabled && shadowFrame.receiverResources
        ? shadowFrame.receiverResources
        : null,
  };
}

async function createCsmShadowFrame(input) {
  const {
    aperture,
    app,
    report,
    reportJson,
    scene,
    appEnvironmentResourceCache,
  } = input;
  const shadowRequests = report.snapshot.shadowRequests.filter(
    (request) => request.lightKind === "directional",
  );
  const casterMeshKeys = new Set(scene.casterMeshKeys);
  const shadowCasterDraws = scene.shadowControls.casterEnabled
    ? report.snapshot.meshDraws.filter((draw) =>
        casterMeshKeys.has(draw.sortKey.meshKey),
      )
    : [];
  const shadowCasterSnapshot = {
    ...report.snapshot,
    shadowRequests,
    shadowCasterDraws,
  };
  const shadowCasterMeshViews =
    aperture.createShadowCasterMeshViewsFromAppReport(report);
  const shadowFrame = aperture.createRenderShadowFrame({
    device: app.initialization.device,
    snapshot: shadowCasterSnapshot,
    preparedMeshes: shadowCasterMeshViews.preparedMeshes,
    executableMeshes: shadowCasterMeshViews.executableMeshes,
    cache: appEnvironmentResourceCache,
    shadowMap: {
      mapSize: shadowIntent.mapSize,
      depthBias: shadowIntent.depthBias,
      normalBias: shadowIntent.normalBias,
      cascadeCount: shadowIntent.cascadeCount,
      resourceKey: shadowIntent.key,
    },
    // Static center/size are the fallback; when the camera frustum is available
    // createRenderShadowFrame frustum-fits and texel-snaps the cascades.
    matrix: {
      center: shadowIntent.center,
      orthographicSize: shadowIntent.orthographicSize,
    },
    label: "shadow-pass:csm-directional",
    submit: scene.shadowControls.casterEnabled && !useFrameGraph,
  });
  pendingShadowCasterGraphPasses = useFrameGraph
    ? aperture.createShadowCasterGraphPasses({
        passAttachments: shadowFrame.passAttachments,
        depthTextureResources: shadowFrame.depthTextureResources,
        commandRecords: shadowFrame.commandRecords.commandRecords,
      })
    : null;
  const route = findCascadedShadowRoute(reportJson);
  const commandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowFrame.commandBufferSubmission,
    );

  return {
    descriptor: aperture.shadowMapDescriptorReportToJsonValue(
      shadowFrame.descriptor,
    ),
    textures: aperture.shadowTextureResourceReportToJsonValue(
      shadowFrame.textures,
    ),
    depthTextureResources: aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowFrame.depthTextureResources,
    ),
    samplerResource: aperture.shadowSamplerResourceReportToJsonValue(
      shadowFrame.samplerResource,
    ),
    passPlan: aperture.shadowPassPlanReportToJsonValue(shadowFrame.passPlan),
    passAttachments: aperture.shadowPassAttachmentDescriptorReportToJsonValue(
      shadowFrame.passAttachments,
    ),
    viewProjection:
      aperture.directionalShadowViewProjectionPlanReportToJsonValue(
        shadowFrame.viewProjection,
      ),
    matrixComputation:
      aperture.directionalShadowMatrixComputationReportToJsonValue(
        shadowFrame.matrixComputation,
      ),
    matrixBuffer: aperture.shadowMatrixBufferDescriptorReportToJsonValue(
      shadowFrame.matrixBuffer,
    ),
    matrixBufferResource: aperture.shadowMatrixBufferResourceReportToJsonValue(
      shadowFrame.matrixBufferResource,
    ),
    casterDrawList: aperture.shadowCasterDrawListPlanReportToJsonValue(
      shadowFrame.casterDrawList,
    ),
    commandPlan: aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
      shadowFrame.commandPlan,
    ),
    commandEncoding: aperture.shadowPassCommandEncodingReportToJsonValue(
      shadowFrame.commandEncoding,
    ),
    pipelineDescriptor:
      aperture.shadowCasterPipelineDescriptorReportToJsonValue(
        shadowFrame.pipelineDescriptor,
      ),
    pipelineResource: aperture.shadowCasterPipelineResourceReportToJsonValue(
      shadowFrame.pipelineResource,
    ),
    matrixBindGroupResource:
      aperture.shadowCasterMatrixBindGroupResourceReportToJsonValue(
        shadowFrame.matrixBindGroupResource,
      ),
    frameResources:
      aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
        shadowFrame.frameResources,
      ),
    commandRecords: aperture.shadowCasterCommandRecordPlanReportToJsonValue(
      shadowFrame.commandRecords,
    ),
    encoderAssembly: aperture.shadowPassEncoderAssemblyReportToJsonValue(
      shadowFrame.encoderAssembly,
    ),
    commandBufferSubmission,
    commandBufferSubmissionReport: shadowFrame.commandBufferSubmission,
    route,
    receiverResources:
      scene.shadowControls.receiverEnabled && shadowFrame.receiverResources
        ? shadowFrame.receiverResources
        : null,
  };
}

function setupShadowControls(controls) {
  if (shadowReceiverToggle instanceof HTMLInputElement) {
    shadowReceiverToggle.checked = controls.receiverEnabled;
    shadowReceiverToggle.addEventListener("change", () => {
      controls.receiverEnabled = shadowReceiverToggle.checked;
    });
  }

  if (shadowCasterToggle instanceof HTMLInputElement) {
    shadowCasterToggle.checked = controls.casterEnabled;
    shadowCasterToggle.addEventListener("change", () => {
      controls.casterEnabled = shadowCasterToggle.checked;
    });
  }
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

function familyBuckets(report) {
  const buckets = report.resources?.routeSummary?.familyBuckets;

  if (!Array.isArray(buckets)) {
    return [];
  }

  return buckets.map((bucket) => ({
    family: bucket.family,
    routedItems: bucket.routedItems,
    frameResources: bucket.frameResources,
  }));
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
    example: "csm-directional-shadow",
    ok: false,
    phase: "failed",
    reason,
    message,
    ...extra,
  };
}
