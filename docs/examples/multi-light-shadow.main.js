import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

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
// M3-T5: ?graph=1 folds every (directional/spot/point) shadow caster pass into
// the single forward encoder instead of submitting separate caster buffers.
const useFrameGraph = exampleParams.get("graph") === "1";
let pendingShadowCasterGraphPasses = null;

const clearColor = [0.014, 0.019, 0.026, 1];
const shadowIntent = {
  mapSize: 512,
  directional: { key: "multi-shadow:directional:0", depthBias: 0.002 },
  spot: { key: "multi-shadow:spot:0", depthBias: 0.002 },
  point: { key: "multi-shadow:point:0", depthBias: 0.0001 },
  normalBias: 0.01,
};
const shadowDepthTextureReports = new Map();

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
      ...(useFrameGraph ? { useFrameGraph: true } : {}),
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createPresentationScene(
        aperture,
        created.app,
        sourceAssets,
        canvas,
      );

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "multi-light-shadow-failed",
      error instanceof Error
        ? error.message
        : "Multi-light shadow example failed.",
    ),
  );
}

function createPresentationScene(aperture, app, sourceAssets, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const wallMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "MultiShadowReceiverWall",
      width: 5.8,
      height: 2.8,
      depth: 0.06,
    }),
    { id: "multi-shadow-wall" },
  );
  const directionalCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DirectionalShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-directional-cube" },
  );
  const spotCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SpotShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-spot-cube" },
  );
  const pointCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PointShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-point-cube" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "MultiShadowReceiverStandard",
      baseColorFactor: new Float32Array([0.9, 0.94, 0.86, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.76,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-wall-standard" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "DirectionalShadowCasterStandard",
      baseColorFactor: new Float32Array([0.95, 0.55, 0.34, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.45,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-directional-standard" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SpotShadowCasterStandard",
      baseColorFactor: new Float32Array([0.35, 0.74, 1.0, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.48,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-spot-standard" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PointShadowCasterStandard",
      baseColorFactor: new Float32Array([1.0, 0.8, 0.32, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.42,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-point-standard" },
  );

  setupShadowControls(shadowControls);

  return {
    canvas: targetCanvas,
    wallMeshKey: aperture.assetHandleKey(wallMesh),
    casterMeshKeys: {
      directional: aperture.assetHandleKey(directionalCubeMesh),
      spot: aperture.assetHandleKey(spotCubeMesh),
      point: aperture.assetHandleKey(pointCubeMesh),
    },
    shadowControls,
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/multi-light-shadow.worker.js",
    {
      name: "aperture-multi-light-shadow-simulation",
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
  });
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
    label: "multi-light-shadow-app",
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
  const bundles = {
    directional: await createShadowBundle({
      aperture,
      app,
      report,
      scene,
      kind: "directional",
      casterMeshKey: scene.casterMeshKeys.directional,
      intent: shadowIntent.directional,
      appEnvironmentResourceCache,
    }),
    spot: await createShadowBundle({
      aperture,
      app,
      report,
      scene,
      kind: "spot",
      casterMeshKey: scene.casterMeshKeys.spot,
      intent: shadowIntent.spot,
      appEnvironmentResourceCache,
    }),
    point: await createShadowBundle({
      aperture,
      app,
      report,
      scene,
      kind: "point",
      casterMeshKey: scene.casterMeshKeys.point,
      intent: shadowIntent.point,
      appEnvironmentResourceCache,
    }),
  };
  // M3-T5: hand the engine every bundle's folded caster passes as ONE list so the
  // single forward encoder renders all three shadow depth maps before the receivers.
  pendingShadowCasterGraphPasses = useFrameGraph
    ? [
        ...bundles.directional.shadowCasterGraphPasses,
        ...bundles.spot.shadowCasterGraphPasses,
        ...bundles.point.shadowCasterGraphPasses,
      ]
    : null;
  const multiShadowRoute = findMultiShadowRoute(reportJson);
  const renderingSupported =
    scene.shadowControls.receiverEnabled &&
    scene.shadowControls.casterEnabled &&
    Object.values(bundles).every(
      (bundle) => bundle.commandBufferSubmissionReport.status === "submitted",
    ) &&
    multiShadowRoute !== null;

  publishStatus({
    example: "multi-light-shadow",
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
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      shadowRequests: report.snapshot.shadowRequests.length,
      diagnostics: report.snapshot.diagnostics.length,
      transformDiagnostics: step?.transformDiagnostics ?? 0,
    },
    shadow: {
      controls: {
        receiverEnabled: scene.shadowControls.receiverEnabled,
        casterEnabled: scene.shadowControls.casterEnabled,
      },
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
      })),
      bundles: shadowBundleStatus(bundles),
      rendering: {
        supported: renderingSupported,
        mode: "directional-spot-point-depth-compare",
        pipelineKey: multiShadowRoute?.pipelineKey ?? null,
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      multiShadowRoute,
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

  return {
    standardMaterialShadowReceiverResources:
      scene.shadowControls.receiverEnabled &&
      bundles.directional.receiverResources !== null &&
      bundles.spot.receiverResources !== null &&
      bundles.point.receiverResources !== null
        ? {
            shadowKind: "multi",
            ...bundles.directional.receiverResources,
            spotShadowReceiverResources: bundles.spot.receiverResources,
            pointShadowReceiverResources: bundles.point.receiverResources,
          }
        : null,
  };
}

async function createShadowBundle(input) {
  const { aperture, app, report, scene, kind, intent } = input;
  const shadowRequests = report.snapshot.shadowRequests.filter(
    (request) => request.lightKind === kind,
  );
  const descriptor = aperture.shadowMapDescriptorReportToJsonValue(
    aperture.createShadowMapDescriptorReport({
      shadowRequests,
      descriptors: shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: shadowIntent.mapSize,
        depthBias: intent.depthBias,
        normalBias: shadowIntent.normalBias,
        faceCount: kind === "point" ? 6 : 1,
        viewDimension: kind === "point" ? "cube" : "2d",
        resourceKey: intent.key,
      })),
    }),
  );
  const shadowTextures = aperture.shadowTextureResourceReportToJsonValue(
    aperture.createShadowTextureResourceReport({ descriptors: descriptor }),
  );
  const cacheKey = `${kind}:${shadowIntent.mapSize}`;

  if (!shadowDepthTextureReports.has(cacheKey)) {
    shadowDepthTextureReports.set(
      cacheKey,
      aperture.createShadowDepthTextureResourceReport({
        device: app.initialization.device,
        textures: shadowTextures,
      }),
    );
  }

  const shadowDepthTextureResourceReport =
    shadowDepthTextureReports.get(cacheKey);
  const depthTextureResources =
    aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowDepthTextureResourceReport,
    );
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: `shadow-sampler:${kind}`,
      cache: input.appEnvironmentResourceCache.shadowSamplers,
    });
  const samplerResource = aperture.shadowSamplerResourceReportToJsonValue(
    shadowSamplerResourceReport,
  );
  const shadowPassPlan = aperture.shadowPassPlanReportToJsonValue(
    aperture.createShadowPassPlanReport({
      shadowRequests,
      textures: shadowTextures,
      submission: "ready",
    }),
  );
  const shadowPassAttachments =
    aperture.shadowPassAttachmentDescriptorReportToJsonValue(
      aperture.createShadowPassAttachmentDescriptorReport({
        shadowPassPlan,
        depthTextureResources: shadowDepthTextureResourceReport,
      }),
    );
  const viewProjection = createViewProjection(aperture, kind, {
    shadowRequests,
    lights: report.snapshot.lights,
    shadowPassPlan,
  });
  const matrixComputation = createMatrixComputation(aperture, kind, {
    viewProjection,
    transforms: report.snapshot.transforms,
  });
  const matrixBuffer = aperture.shadowMatrixBufferDescriptorReportToJsonValue(
    aperture.createShadowMatrixBufferDescriptorReport({
      viewProjection,
      upload: "ready",
      resourceKey: `shadow-matrix-buffer:${kind}`,
      label: `${kind}ShadowMatrices/storage`,
    }),
  );
  const matrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: matrixBuffer,
      matrices: matrixComputation,
    });
  const matrixBufferResource =
    aperture.shadowMatrixBufferResourceReportToJsonValue(
      matrixBufferResourceReport,
    );
  const shadowCasterMeshDraws = scene.shadowControls.casterEnabled
    ? report.snapshot.meshDraws.filter(
        (draw) => draw.sortKey.meshKey === input.casterMeshKey,
      )
    : [];
  const casterDrawList = aperture.shadowCasterDrawListPlanReportToJsonValue(
    aperture.createShadowCasterDrawListPlanReport({
      shadowRequests,
      meshDraws: shadowCasterMeshDraws,
      shadowPassPlan,
      commandEncoding: "ready",
    }),
  );
  const commandPlan =
    aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
      aperture.createShadowCasterCommandPlanReadinessReport({
        shadowPassPlan,
        viewProjection,
        matrixBuffer,
        casterDrawList,
        commandEncoding: "ready",
      }),
    );
  const commandEncoding = aperture.shadowPassCommandEncodingReportToJsonValue(
    aperture.createShadowPassCommandEncodingReport({
      shadowPassPlan,
      depthTextureResources: shadowDepthTextureResourceReport,
      matrixBufferResource: matrixBufferResourceReport,
      casterDrawList,
      commandPlan,
      commandEncoding: "ready",
    }),
  );
  const pipelineDescriptor =
    aperture.shadowCasterPipelineDescriptorReportToJsonValue(
      aperture.createShadowCasterPipelineDescriptorReport({
        commandEncoding,
      }),
    );
  const pipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: pipelineDescriptor,
      cache: input.appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const pipelineResource =
    aperture.shadowCasterPipelineResourceReportToJsonValue(
      pipelineResourceReport,
    );
  const matrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: matrixBufferResourceReport,
      layout: pipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: input.appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const matrixBindGroupResource =
    aperture.shadowCasterMatrixBindGroupResourceReportToJsonValue(
      matrixBindGroupResourceReport,
    );
  const shadowCasterMeshViews =
    aperture.createShadowCasterMeshViewsFromAppReport(report);
  const frameResources =
    aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
      aperture.createShadowCasterFrameResourceReadinessReport({
        casterDrawList,
        preparedMeshes: shadowCasterMeshViews.preparedMeshes,
        matrixBufferResource: matrixBufferResourceReport,
        pipelineDescriptor,
      }),
    );
  const commandRecordPlan = aperture.createShadowCasterCommandRecordPlanReport({
    frameResources,
    commandPlan,
    pipelines:
      pipelineResourceReport.resource === null
        ? []
        : [
            {
              pipelineKey: pipelineResourceReport.resource.pipelineKey,
              resourceKey: pipelineResourceReport.resource.resourceKey,
              pipeline: pipelineResourceReport.resource.pipeline,
            },
          ],
    matrixBindGroups:
      matrixBindGroupResourceReport.resource === null
        ? []
        : [
            {
              matrixResourceKey:
                matrixBindGroupResourceReport.resource.matrixResourceKey,
              resourceKey: matrixBindGroupResourceReport.resource.resourceKey,
              group: matrixBindGroupResourceReport.resource.group,
              bindGroup: matrixBindGroupResourceReport.resource.bindGroup,
            },
          ],
    meshes: shadowCasterMeshViews.executableMeshes,
  });
  const commandRecords =
    aperture.shadowCasterCommandRecordPlanReportToJsonValue(commandRecordPlan);
  const encoderResource = aperture.createCommandEncoderResource({
    device: app.initialization.device,
    label: `shadow-pass:${kind}`,
  });
  const encoderAssemblyReport = aperture.createShadowPassEncoderAssemblyReport({
    attachments: shadowPassAttachments,
    frameResources,
    commandEncoding,
    commands: commandRecordPlan.commandRecords,
    encoder: encoderResource.resource?.encoder,
    resolveDepthView: (attachment) =>
      resolveShadowDepthView(shadowDepthTextureResourceReport, attachment),
  });
  const encoderAssembly = aperture.shadowPassEncoderAssemblyReportToJsonValue(
    encoderAssemblyReport,
  );
  const commandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: encoderAssemblyReport,
      encoder: encoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: `shadow-pass:${kind}`,
      submit: scene.shadowControls.casterEnabled && !useFrameGraph,
    });
  const commandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      commandBufferSubmissionReport,
    );
  const shadowCasterGraphPasses = useFrameGraph
    ? aperture.createShadowCasterGraphPasses({
        passAttachments: shadowPassAttachments,
        depthTextureResources: shadowDepthTextureResourceReport,
        commandRecords: commandRecordPlan.commandRecords,
      })
    : [];

  return {
    kind,
    descriptor,
    textures: shadowTextures,
    depthTextureResources,
    samplerResource,
    passPlan: shadowPassPlan,
    passAttachments: shadowPassAttachments,
    viewProjection,
    matrixComputation,
    matrixBuffer,
    matrixBufferResource,
    casterDrawList,
    commandPlan,
    commandEncoding,
    pipelineDescriptor,
    pipelineResource,
    matrixBindGroupResource,
    frameResources,
    commandRecords,
    encoderAssembly,
    commandBufferSubmission,
    commandBufferSubmissionReport,
    shadowCasterGraphPasses,
    receiverResources:
      matrixBufferResourceReport.resource !== null &&
      shadowDepthTextureResourceReport.resources.some(
        (resource) => resource.allocation.resource !== null,
      ) &&
      shadowSamplerResourceReport.resource !== null
        ? {
            matrixBufferResource: matrixBufferResourceReport,
            depthTextureResources: shadowDepthTextureResourceReport,
            samplerResource: shadowSamplerResourceReport,
          }
        : null,
  };
}

function createViewProjection(aperture, kind, input) {
  if (kind === "point") {
    return aperture.pointShadowViewProjectionPlanReportToJsonValue(
      aperture.createPointShadowViewProjectionPlanReport({
        ...input,
        computation: "ready",
      }),
    );
  }

  if (kind === "spot") {
    return aperture.spotShadowViewProjectionPlanReportToJsonValue(
      aperture.createSpotShadowViewProjectionPlanReport({
        ...input,
        computation: "ready",
      }),
    );
  }

  return aperture.directionalShadowViewProjectionPlanReportToJsonValue(
    aperture.createDirectionalShadowViewProjectionPlanReport({
      ...input,
      computation: "ready",
    }),
  );
}

function createMatrixComputation(aperture, kind, input) {
  if (kind === "point") {
    return aperture.pointShadowMatrixComputationReportToJsonValue(
      aperture.createPointShadowMatrixComputationReport(input),
    );
  }

  if (kind === "spot") {
    return aperture.spotShadowMatrixComputationReportToJsonValue(
      aperture.createSpotShadowMatrixComputationReport(input),
    );
  }

  return aperture.directionalShadowMatrixComputationReportToJsonValue(
    aperture.createDirectionalShadowMatrixComputationReport(input),
  );
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

function resolveShadowDepthView(depthTextureResourceReport, attachment) {
  for (const resource of depthTextureResourceReport.resources) {
    if (
      resource.shadowId !== attachment.shadowId ||
      resource.lightId !== attachment.lightId
    ) {
      continue;
    }

    const attachmentView = resource.attachmentViews.find(
      (view) => view.viewKey === attachment.viewKey,
    );

    if (attachmentView !== undefined) {
      return attachmentView.view;
    }

    return resource.allocation.resource?.view ?? null;
  }

  return null;
}

function shadowBundleStatus(bundles) {
  return Object.fromEntries(
    Object.entries(bundles).map(([kind, bundle]) => [
      kind,
      {
        descriptor: bundle.descriptor,
        depthTextureResources: bundle.depthTextureResources,
        samplerResource: bundle.samplerResource,
        passPlan: bundle.passPlan,
        viewProjection: bundle.viewProjection,
        matrixComputation: bundle.matrixComputation,
        matrixBufferResource: bundle.matrixBufferResource,
        casterDrawList: bundle.casterDrawList,
        commandEncoding: bundle.commandEncoding,
        pipelineResource: bundle.pipelineResource,
        frameResources: bundle.frameResources,
        encoderAssembly: bundle.encoderAssembly,
        commandBufferSubmission: bundle.commandBufferSubmission,
      },
    ]),
  );
}

function findMultiShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find(
      (pipeline) =>
        pipeline.pipelineKey.includes("shadowMap") &&
        pipeline.pipelineKey.includes("pointShadowMap"),
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
    example: "multi-light-shadow",
    ok: false,
    phase: "failed",
    reason,
    message,
    ...extra,
  };
}
