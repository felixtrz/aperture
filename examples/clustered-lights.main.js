import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.012, 0.016, 0.022, 1];
const exampleParams = new URLSearchParams(globalThis.location.search);
const clusteredPointShadowEnabled = !exampleParams.has(
  "disable-cluster-point-shadow",
);
const clusteredSpotShadowEnabled =
  exampleParams.has("enable-cluster-spot-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow");
const clusteredPointShadowIntent = {
  mapSize: 256,
  depthBias: 0.0001,
  normalBias: 0.01,
  casterLayerMask: 1,
  receiverLayerMask: 1,
};
const clusteredSpotShadowIntent = {
  mapSize: 256,
  depthBias: 0.002,
  normalBias: 0.01,
  casterLayerMask: 2,
  receiverLayerMask: 2,
};
const maxStatusWarmupFrames = 90;
const readbackSamples = [
  { id: "left-bank", x: 0.26, y: 0.5 },
  { id: "center", x: 0.5, y: 0.5 },
  { id: "right-bank", x: 0.74, y: 0.5 },
];

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = registerClusteredLightAssets(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "clustered-lights-failed",
      error instanceof Error
        ? error.message
        : "Clustered lights example failed.",
    ),
  );
}

function registerClusteredLightAssets(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const panelMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "ClusteredLightsPanel",
      width: 5.2,
      height: 2.8,
    }),
    { id: "clustered-lights-panel" },
  );
  const panelMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredLightsStandard",
      baseColorFactor: new Float32Array([0.78, 0.8, 0.72, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.84,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-standard" },
  );
  const secondaryPanelMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredLightsStandardSecondary",
      baseColorFactor: new Float32Array([0.68, 0.76, 0.88, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.84,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-standard-secondary" },
  );
  const casterMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ClusteredPointShadowCaster",
      width: 0.52,
      height: 0.52,
      depth: 0.52,
    }),
    { id: "clustered-lights-point-shadow-caster" },
  );
  const casterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredPointShadowCasterStandard",
      baseColorFactor: new Float32Array([0.95, 0.58, 0.24, 1]),
      metallicFactor: 0.04,
      roughnessFactor: 0.58,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-point-shadow-caster-standard" },
  );
  const spotCasterMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ClusteredSpotShadowCaster",
      width: 0.48,
      height: 0.48,
      depth: 0.48,
    }),
    { id: "clustered-lights-spot-shadow-caster" },
  );
  const spotCasterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredSpotShadowCasterStandard",
      baseColorFactor: new Float32Array([0.36, 0.86, 0.92, 1]),
      metallicFactor: 0.04,
      roughnessFactor: 0.56,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-spot-shadow-caster-standard" },
  );

  return {
    meshKey: aperture.assetHandleKey(panelMesh),
    materialKey: aperture.assetHandleKey(panelMaterial),
    secondaryMaterialKey: aperture.assetHandleKey(secondaryPanelMaterial),
    casterMeshKey: aperture.assetHandleKey(casterMesh),
    casterMaterialKey: aperture.assetHandleKey(casterMaterial),
    spotCasterMeshKey: aperture.assetHandleKey(spotCasterMesh),
    spotCasterMaterialKey: aperture.assetHandleKey(spotCasterMaterial),
    clusteredPointShadowEnabled,
    clusteredSpotShadowEnabled,
    cameraFrameOffset:
      clusteredPointShadowEnabled || clusteredSpotShadowEnabled ? 0 : 1,
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/clustered-lights.worker.js",
    {
      name: "aperture-clustered-lights-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    previousClusterOccupancy: null,
    standardMaterialShadowReceiverResources: null,
    pointShadowDepthTextureResourceReport: null,
    spotShadowDepthTextureResourceReport: null,
    shadowStatus: null,
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
    cameraFrameOffset: scene.cameraFrameOffset,
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

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "clustered-lights",
    readbackSamples,
    ...(loop.standardMaterialShadowReceiverResources === null
      ? {}
      : {
          standardMaterialShadowReceiverResources:
            loop.standardMaterialShadowReceiverResources,
        }),
  });
  const status = statusFromReport(
    aperture,
    report,
    scene,
    loop,
    message,
    typedSnapshot,
  );
  const nextShadowResources = await createClusteredShadowReceiverResources(
    aperture,
    app,
    scene,
    loop,
    report,
  );

  loop.standardMaterialShadowReceiverResources =
    nextShadowResources?.standardMaterialShadowReceiverResources ?? null;
  loop.shadowStatus = nextShadowResources?.shadowStatus ?? null;

  if (
    (message.frame ?? loop.frame) < maxStatusWarmupFrames &&
    status.ok !== true
  ) {
    requestWorkerFrame(worker, loop);
    return;
  }

  publishStatus(status);
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

function statusFromReport(
  aperture,
  report,
  scene,
  loop,
  message,
  typedSnapshot,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const pipelineKeys = report.snapshot.meshDraws.map(
    (draw) => draw.batchKey.pipelineKey,
  );
  const localLightClusters = reportJson.localLightClusters ?? null;
  const clusterStatus = createClusterStatus(
    localLightClusters,
    pipelineKeys,
    loop,
    scene.clusteredPointShadowEnabled,
    scene.clusteredSpotShadowEnabled,
  );
  const readbackStatus = createReadbackStatus(reportJson.readback);
  recordClusterOccupancy(loop, localLightClusters);

  return {
    example: "clustered-lights",
    ok:
      report.ok &&
      reportJson.counts.diagnostics === 0 &&
      clusterStatus.ok &&
      readbackStatus.ok,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    clearColor: colorStatus(clearColor),
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    scene,
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    pipelineKeys,
    localLightClusters,
    clusterStatus,
    shadowStatus: loop.shadowStatus,
    readbackStatus,
    readback: reportJson.readback ?? null,
    resourceReuse: reportJson.resourceReuse,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
  };
}

function createClusterStatus(
  localLightClusters,
  pipelineKeys,
  loop,
  pointShadowEnabled,
  spotShadowEnabled,
) {
  const clusterPipelineUsed = pipelineKeys.some((pipelineKey) =>
    pipelineKey.includes("clusteredLocalLights"),
  );
  const clusterRoutes = clusterRoutesFromReport(localLightClusters);
  const primaryRoute = clusterRoutes[0] ?? null;
  const totalLocalLights = primaryRoute?.totalLocalLights ?? 0;
  const averageLights =
    primaryRoute?.averageLightsPerPopulatedCell ?? totalLocalLights;
  const occupancyHash = primaryRoute?.occupancyHash ?? null;
  const previousOccupancyHash = loop.previousClusterOccupancy?.hash ?? null;
  const occupancyChanged =
    occupancyHash !== null &&
    previousOccupancyHash !== null &&
    occupancyHash !== previousOccupancyHash;
  const routeViewIds = clusterRoutes.map((route) => route.viewId ?? null);
  const routeOccupancyHashes = clusterRoutes.map(
    (route) => route.occupancyHash ?? null,
  );
  const distinctViewIds = new Set(
    routeViewIds.filter((viewId) => viewId !== null),
  ).size;
  const distinctOccupancyHashes = new Set(
    routeOccupancyHashes.filter((hash) => hash !== null),
  ).size;
  const routePressureOk =
    clusterRoutes.length > 0 &&
    clusterRoutes.every((route) => {
      const routeTotalLocalLights = route.totalLocalLights ?? 0;
      const buildPressure = route.buildPressure ?? {};
      const naiveCellLightPairTests =
        buildPressure.naiveCellLightPairTests ?? 0;
      const lightCellRangeTests = buildPressure.lightCellRangeTests ?? 0;
      const lightCellWriteAttempts =
        buildPressure.lightCellWriteAttempts ?? naiveCellLightPairTests;

      return (
        route.enabled === true &&
        route.coordinateSpace === "view-depth" &&
        routeTotalLocalLights >= 64 &&
        (route.maxLightsPerPopulatedCell ?? routeTotalLocalLights) <
          routeTotalLocalLights &&
        (route.averageLightsPerPopulatedCell ?? routeTotalLocalLights) <
          routeTotalLocalLights &&
        buildPressure.assignmentStrategy === "light-range" &&
        lightCellRangeTests === route.clusteredLocalLights &&
        lightCellWriteAttempts < naiveCellLightPairTests
      );
    });
  const routeShadowStates = clusterRoutes.map((route) => {
    const shadow = route.shadowCookieMetadata?.shadow ?? null;

    return {
      status: shadow?.status ?? null,
      samplingSupported: shadow?.samplingSupported === true,
      localRequestCount: shadow?.localRequestCount ?? 0,
      clusteredLightCount: shadow?.clusteredLightCount ?? 0,
      supportedLightCount: shadow?.supportedLightCount ?? 0,
      fallbackReason: shadow?.fallbackReason ?? null,
    };
  });
  const routePointShadowSamplingOk =
    routeShadowStates.some(
      (shadow) =>
        shadow.status === "sampling-ready" &&
        shadow.samplingSupported === true &&
        shadow.localRequestCount >= 4 &&
        shadow.clusteredLightCount >= 4 &&
        shadow.supportedLightCount >= 1,
    );
  const routeSpotShadowSamplingOk =
    spotShadowEnabled === true && routePointShadowSamplingOk;
  const routeMetadataOk =
    clusterRoutes.length > 0 &&
    clusterRoutes.every((route) => {
      const shadow = route.shadowCookieMetadata?.shadow ?? null;
      const cookie = route.shadowCookieMetadata?.cookie ?? null;
      const shadowSamplingEnabled =
        pointShadowEnabled === true || spotShadowEnabled === true;
      const shadowReady =
        shadowSamplingEnabled
          ? (shadow?.status === "sampling-ready" &&
              shadow.samplingSupported === true &&
              (shadow.supportedLightCount ?? 0) >= 1) ||
            (shadow?.status === "metadata-only" &&
              shadow.samplingSupported === false &&
              shadow.fallbackReason ===
                "clustered-local-shadow-sampling-not-implemented")
          : shadow?.status === "metadata-only" &&
            shadow.samplingSupported === false &&
            shadow.fallbackReason ===
              "clustered-local-shadow-sampling-not-implemented";

      return (
        shadowReady &&
        (shadow.localRequestCount ?? 0) >= 4 &&
        (shadow.clusteredLightCount ?? 0) >= 4 &&
        cookie?.status === "not-supported" &&
        cookie.samplingSupported === false &&
        cookie.fallbackReason === "light-cookie-authoring-not-implemented"
      );
    });

  return {
    ok:
      clusterPipelineUsed &&
      clusterRoutes.length >= 2 &&
      distinctViewIds >= 2 &&
      distinctOccupancyHashes >= 2 &&
      routePressureOk &&
      routeMetadataOk &&
      (pointShadowEnabled !== true || routePointShadowSamplingOk) &&
      (spotShadowEnabled !== true || routeSpotShadowSamplingOk) &&
      occupancyChanged &&
      (localLightClusters?.resourceReuse?.buffersReused ?? 0) >= 8,
    clusterPipelineUsed,
    coordinateSpace: primaryRoute?.coordinateSpace ?? null,
    viewId: primaryRoute?.viewId ?? null,
    totalLocalLights,
    populatedCells: primaryRoute?.populatedCells ?? null,
    averageLightsPerPopulatedCell: averageLights,
    maxLightsPerPopulatedCell: primaryRoute?.maxLightsPerPopulatedCell ?? null,
    totalAssignedLightReferences: primaryRoute?.totalAssignedLightReferences ??
      null,
    occupancyHash,
    previousOccupancyHash,
    occupancyChanged,
    routeCount: clusterRoutes.length,
    routeViewIds,
    routeOccupancyHashes,
    distinctViewIds,
    distinctOccupancyHashes,
    routePressureOk,
    routeMetadataOk,
    routePointShadowSamplingOk,
    routeSpotShadowSamplingOk,
    routeShadowStates,
    routes: clusterRoutes.map((route) => ({
      enabled: route.enabled,
      layerMask: route.layerMask ?? null,
      lightSetKey: route.lightSetKey ?? null,
      coordinateSpace: route.coordinateSpace ?? null,
      viewId: route.viewId ?? null,
      totalLocalLights: route.totalLocalLights ?? 0,
      clusteredLocalLights: route.clusteredLocalLights ?? 0,
      populatedCells: route.populatedCells ?? null,
      averageLightsPerPopulatedCell:
        route.averageLightsPerPopulatedCell ?? null,
      maxLightsPerPopulatedCell: route.maxLightsPerPopulatedCell ?? null,
      totalAssignedLightReferences:
        route.totalAssignedLightReferences ?? null,
      occupancyHash: route.occupancyHash ?? null,
      buildPressure: route.buildPressure ?? null,
      shadowCookieMetadata: route.shadowCookieMetadata ?? null,
      resourceKey: route.resourceKey ?? null,
    })),
    buffersCreated: localLightClusters?.resourceReuse?.buffersCreated ?? 0,
    buffersReused: localLightClusters?.resourceReuse?.buffersReused ?? 0,
  };
}

function recordClusterOccupancy(loop, localLightClusters) {
  const primaryRoute = clusterRoutesFromReport(localLightClusters)[0] ?? null;

  if (primaryRoute?.enabled !== true) {
    return;
  }

  loop.previousClusterOccupancy = {
    hash: primaryRoute.occupancyHash ?? null,
    populatedCells: primaryRoute.populatedCells ?? null,
    totalAssignedLightReferences: primaryRoute.totalAssignedLightReferences ??
      null,
  };
}

function clusterRoutesFromReport(localLightClusters) {
  if (localLightClusters === null || localLightClusters === undefined) {
    return [];
  }

  if (
    Array.isArray(localLightClusters.routes) &&
    localLightClusters.routes.length > 0
  ) {
    return localLightClusters.routes;
  }

  return [localLightClusters];
}

function createReadbackStatus(readback) {
  if (readback?.ok !== true || !Array.isArray(readback.samples)) {
    return { ok: false, reason: "readback-unavailable" };
  }

  const clearPixel = {
    r: Math.round((clearColor[0] ?? 0) * 255),
    g: Math.round((clearColor[1] ?? 0) * 255),
    b: Math.round((clearColor[2] ?? 0) * 255),
    a: Math.round((clearColor[3] ?? 1) * 255),
  };
  const allTransparentZero = readback.samples.every(
    (sample) =>
      sample.pixel.r === 0 &&
      sample.pixel.g === 0 &&
      sample.pixel.b === 0 &&
      sample.pixel.a === 0,
  );

  if (allTransparentZero) {
    return {
      ok: false,
      reason: "transparent-zero-readback",
      samples: readback.samples.map((sample) => ({
        id: sample.id,
        pixel: sample.pixel,
      })),
    };
  }

  const distances = readback.samples.map((sample) =>
    pixelDistance(sample.pixel, clearPixel),
  );
  const maxClearDistance = Math.max(...distances, 0);
  const sampleLuminance = readback.samples.map((sample) =>
    luminance(sample.pixel),
  );

  return {
    ok: maxClearDistance > 24,
    maxClearDistance,
    luminanceRange: Math.max(...sampleLuminance) - Math.min(...sampleLuminance),
    samples: readback.samples.map((sample) => ({
      id: sample.id,
      pixel: sample.pixel,
    })),
  };
}

async function createClusteredPointShadowReceiverResources(
  aperture,
  app,
  scene,
  loop,
  report,
) {
  const request = report.snapshot.shadowRequests.find(
    (candidate) =>
      candidate.lightKind === "point" &&
      (candidate.receiverLayerMask & clusteredPointShadowIntent.receiverLayerMask) !==
        0,
  );

  if (request === undefined) {
    return {
      standardMaterialShadowReceiverResources: null,
      shadowStatus: {
        enabled: true,
        supported: false,
        reason: "point-shadow-request-unavailable",
      },
    };
  }

  const shadowRequests = [request];
  const shadowDescriptor = aperture.createShadowMapDescriptorReport({
    shadowRequests,
    descriptors: [
      {
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: clusteredPointShadowIntent.mapSize,
        depthBias: clusteredPointShadowIntent.depthBias,
        normalBias: clusteredPointShadowIntent.normalBias,
        faceCount: 6,
        viewDimension: "cube",
      },
    ],
  });
  const shadowTextures = aperture.createShadowTextureResourceReport({
    descriptors: shadowDescriptor,
  });

  loop.pointShadowDepthTextureResourceReport ??=
    aperture.createShadowDepthTextureResourceReport({
      device: app.initialization.device,
      textures: shadowTextures,
    });

  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: "shadow-sampler:clustered-point",
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const shadowPassPlan = aperture.createShadowPassPlanReport({
    shadowRequests,
    textures: shadowTextures,
    submission: "ready",
  });
  const shadowPassAttachments =
    aperture.createShadowPassAttachmentDescriptorReport({
      shadowPassPlan,
      depthTextureResources: loop.pointShadowDepthTextureResourceReport,
    });
  const shadowViewProjection =
    aperture.createPointShadowViewProjectionPlanReport({
      shadowRequests,
      lights: report.snapshot.lights,
      shadowPassPlan,
      computation: "ready",
    });
  const shadowMatrixComputation =
    aperture.createPointShadowMatrixComputationReport({
      viewProjection: shadowViewProjection,
      transforms: report.snapshot.transforms,
    });
  const shadowMatrixBuffer = aperture.createShadowMatrixBufferDescriptorReport({
    viewProjection: shadowViewProjection,
    upload: "ready",
    resourceKey: "shadow-matrix-buffer:clustered-point",
    label: "ClusteredPointShadowMatrices/storage",
  });
  const shadowMatrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: shadowMatrixBuffer,
      matrices: shadowMatrixComputation,
    });
  const shadowCasterMeshDraws = report.snapshot.meshDraws.filter(
    (draw) =>
      draw.sortKey.meshKey === scene.casterMeshKey && draw.castsShadow !== false,
  );
  const shadowCasterDrawList = aperture.createShadowCasterDrawListPlanReport({
    shadowRequests,
    meshDraws: shadowCasterMeshDraws,
    shadowPassPlan,
    commandEncoding: "ready",
  });
  const shadowCommandPlan =
    aperture.createShadowCasterCommandPlanReadinessReport({
      shadowPassPlan,
      viewProjection: shadowViewProjection,
      matrixBuffer: shadowMatrixBuffer,
      casterDrawList: shadowCasterDrawList,
      commandEncoding: "ready",
    });
  const shadowPassCommandEncoding =
    aperture.createShadowPassCommandEncodingReport({
      shadowPassPlan,
      depthTextureResources: loop.pointShadowDepthTextureResourceReport,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      casterDrawList: shadowCasterDrawList,
      commandPlan: shadowCommandPlan,
      commandEncoding: "ready",
    });
  const shadowCasterPipelineDescriptor =
    aperture.createShadowCasterPipelineDescriptorReport({
      commandEncoding: shadowPassCommandEncoding,
    });
  const shadowCasterPipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: shadowCasterPipelineDescriptor,
      cache: appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const shadowCasterMatrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      layout:
        shadowCasterPipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const shadowCasterFrameResources =
    aperture.createShadowCasterFrameResourceReadinessReport({
      casterDrawList: shadowCasterDrawList,
      preparedMeshes: createShadowCasterPreparedMeshViews(report),
      matrixBufferResource: shadowMatrixBufferResourceReport,
      pipelineDescriptor: shadowCasterPipelineDescriptor,
    });
  const shadowCasterCommandRecordPlan =
    aperture.createShadowCasterCommandRecordPlanReport({
      frameResources: aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
        shadowCasterFrameResources,
      ),
      commandPlan: aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
        shadowCommandPlan,
      ),
      pipelines:
        shadowCasterPipelineResourceReport.resource === null
          ? []
          : [
              {
                pipelineKey:
                  shadowCasterPipelineResourceReport.resource.pipelineKey,
                resourceKey:
                  shadowCasterPipelineResourceReport.resource.resourceKey,
                pipeline: shadowCasterPipelineResourceReport.resource.pipeline,
              },
            ],
      matrixBindGroups:
        shadowCasterMatrixBindGroupResourceReport.resource === null
          ? []
          : [
              {
                matrixResourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .matrixResourceKey,
                resourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .resourceKey,
                group: shadowCasterMatrixBindGroupResourceReport.resource.group,
                bindGroup:
                  shadowCasterMatrixBindGroupResourceReport.resource.bindGroup,
              },
            ],
      meshes: createShadowCasterExecutableMeshViews(report),
    });
  const shadowPassCommandEncoderResource =
    aperture.createCommandEncoderResource({
      device: app.initialization.device,
      label: "shadow-pass:clustered-point",
    });
  const shadowPassEncoderAssemblyReport =
    aperture.createShadowPassEncoderAssemblyReport({
      attachments: aperture.shadowPassAttachmentDescriptorReportToJsonValue(
        shadowPassAttachments,
      ),
      frameResources: aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
        shadowCasterFrameResources,
      ),
      commandEncoding: aperture.shadowPassCommandEncodingReportToJsonValue(
        shadowPassCommandEncoding,
      ),
      commands: shadowCasterCommandRecordPlan.commandRecords,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      resolveDepthView: (attachment) =>
        aperture.resolveShadowDepthTextureAttachmentView(
          loop.pointShadowDepthTextureResourceReport,
          attachment,
        ),
    });
  const shadowPassCommandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: shadowPassEncoderAssemblyReport,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: "shadow-pass:clustered-point",
      submit: true,
    });
  const supported =
    shadowPassCommandBufferSubmissionReport.status === "submitted" &&
    shadowMatrixBufferResourceReport.resource !== null &&
    loop.pointShadowDepthTextureResourceReport.resources.some(
      (resource) =>
        resource.shadowId === request.shadowId &&
        resource.lightId === request.lightId &&
        resource.viewDimension === "cube" &&
        resource.allocation.resource !== null,
    ) &&
    shadowSamplerResourceReport.resource !== null;

  return {
    standardMaterialShadowReceiverResources: supported
      ? {
          shadowKind: "point",
          matrixBufferResource: shadowMatrixBufferResourceReport,
          depthTextureResources: loop.pointShadowDepthTextureResourceReport,
          samplerResource: shadowSamplerResourceReport,
        }
      : null,
    shadowStatus: {
      enabled: true,
      supported,
      mode: "clustered-point-depth-cube-compare",
      shadowId: request.shadowId,
      lightId: request.lightId,
      casterDraws: shadowCasterMeshDraws.length,
      faceCount: shadowPassPlan.passCount,
      submission: shadowPassCommandBufferSubmissionReport.status,
    },
  };
}

async function createClusteredShadowReceiverResources(
  aperture,
  app,
  scene,
  loop,
  report,
) {
  const pointResult = scene.clusteredPointShadowEnabled
    ? await createClusteredPointShadowReceiverResources(
        aperture,
        app,
        scene,
        loop,
        report,
      )
    : {
        standardMaterialShadowReceiverResources: null,
        shadowStatus: {
          enabled: false,
          supported: false,
          reason: "disabled",
        },
      };
  const spotResult = scene.clusteredSpotShadowEnabled
    ? await createClusteredSpotShadowReceiverResources(
        aperture,
        app,
        scene,
        loop,
        report,
      )
    : {
        standardMaterialShadowReceiverResources: null,
        shadowStatus: {
          enabled: false,
          supported: false,
          reason: "disabled",
        },
      };
  const pointResources = pointResult.standardMaterialShadowReceiverResources;
  const spotResources = spotResult.standardMaterialShadowReceiverResources;
  const standardMaterialShadowReceiverResources =
    pointResources !== null && spotResources !== null
      ? {
          ...spotResources,
          shadowKind: "multi",
          spotShadowReceiverResources: spotResources,
          pointShadowReceiverResources: pointResources,
        }
      : spotResources ?? pointResources;

  return {
    standardMaterialShadowReceiverResources,
    shadowStatus: {
      enabled:
        scene.clusteredPointShadowEnabled || scene.clusteredSpotShadowEnabled,
      supported:
        (scene.clusteredPointShadowEnabled || scene.clusteredSpotShadowEnabled) &&
        (scene.clusteredPointShadowEnabled !== true ||
          pointResult.shadowStatus.supported === true) &&
        (scene.clusteredSpotShadowEnabled !== true ||
          spotResult.shadowStatus.supported === true),
      mode:
        pointResources !== null && spotResources !== null
          ? "clustered-point-spot-depth-compare"
          : spotResources !== null
            ? "clustered-spot-depth-compare"
            : pointResources !== null
              ? "clustered-point-depth-cube-compare"
              : "clustered-shadow-unavailable",
      point: pointResult.shadowStatus,
      spot: spotResult.shadowStatus,
    },
  };
}

async function createClusteredSpotShadowReceiverResources(
  aperture,
  app,
  scene,
  loop,
  report,
) {
  const request = report.snapshot.shadowRequests.find(
    (candidate) =>
      candidate.lightKind === "spot" &&
      (candidate.receiverLayerMask & clusteredSpotShadowIntent.receiverLayerMask) !==
        0,
  );

  if (request === undefined) {
    return {
      standardMaterialShadowReceiverResources: null,
      shadowStatus: {
        enabled: true,
        supported: false,
        reason: "spot-shadow-request-unavailable",
      },
    };
  }

  const shadowRequests = [request];
  const shadowDescriptor = aperture.createShadowMapDescriptorReport({
    shadowRequests,
    descriptors: [
      {
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: clusteredSpotShadowIntent.mapSize,
        depthBias: clusteredSpotShadowIntent.depthBias,
        normalBias: clusteredSpotShadowIntent.normalBias,
        faceCount: 1,
        viewDimension: "2d",
      },
    ],
  });
  const shadowTextures = aperture.createShadowTextureResourceReport({
    descriptors: shadowDescriptor,
  });

  loop.spotShadowDepthTextureResourceReport ??=
    aperture.createShadowDepthTextureResourceReport({
      device: app.initialization.device,
      textures: shadowTextures,
    });

  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: "shadow-sampler:clustered-spot",
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const shadowPassPlan = aperture.createShadowPassPlanReport({
    shadowRequests,
    textures: shadowTextures,
    submission: "ready",
  });
  const shadowPassAttachments =
    aperture.createShadowPassAttachmentDescriptorReport({
      shadowPassPlan,
      depthTextureResources: loop.spotShadowDepthTextureResourceReport,
    });
  const shadowViewProjection =
    aperture.createSpotShadowViewProjectionPlanReport({
      shadowRequests,
      lights: report.snapshot.lights,
      shadowPassPlan,
      computation: "ready",
    });
  const shadowMatrixComputation =
    aperture.createSpotShadowMatrixComputationReport({
      viewProjection: shadowViewProjection,
      transforms: report.snapshot.transforms,
    });
  const shadowMatrixBuffer = aperture.createShadowMatrixBufferDescriptorReport({
    viewProjection: shadowViewProjection,
    upload: "ready",
    resourceKey: "shadow-matrix-buffer:clustered-spot",
    label: "ClusteredSpotShadowMatrices/storage",
  });
  const shadowMatrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: shadowMatrixBuffer,
      matrices: shadowMatrixComputation,
    });
  const shadowCasterMeshDraws = report.snapshot.meshDraws.filter(
    (draw) =>
      draw.sortKey.meshKey === scene.spotCasterMeshKey &&
      draw.castsShadow !== false,
  );
  const shadowCasterDrawList = aperture.createShadowCasterDrawListPlanReport({
    shadowRequests,
    meshDraws: shadowCasterMeshDraws,
    shadowPassPlan,
    commandEncoding: "ready",
  });
  const shadowCommandPlan =
    aperture.createShadowCasterCommandPlanReadinessReport({
      shadowPassPlan,
      viewProjection: shadowViewProjection,
      matrixBuffer: shadowMatrixBuffer,
      casterDrawList: shadowCasterDrawList,
      commandEncoding: "ready",
    });
  const shadowPassCommandEncoding =
    aperture.createShadowPassCommandEncodingReport({
      shadowPassPlan,
      depthTextureResources: loop.spotShadowDepthTextureResourceReport,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      casterDrawList: shadowCasterDrawList,
      commandPlan: shadowCommandPlan,
      commandEncoding: "ready",
    });
  const shadowCasterPipelineDescriptor =
    aperture.createShadowCasterPipelineDescriptorReport({
      commandEncoding: shadowPassCommandEncoding,
    });
  const shadowCasterPipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: shadowCasterPipelineDescriptor,
      cache: appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const shadowCasterMatrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      layout:
        shadowCasterPipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const shadowCasterFrameResources =
    aperture.createShadowCasterFrameResourceReadinessReport({
      casterDrawList: shadowCasterDrawList,
      preparedMeshes: createShadowCasterPreparedMeshViews(report),
      matrixBufferResource: shadowMatrixBufferResourceReport,
      pipelineDescriptor: shadowCasterPipelineDescriptor,
    });
  const shadowCasterCommandRecordPlan =
    aperture.createShadowCasterCommandRecordPlanReport({
      frameResources: aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
        shadowCasterFrameResources,
      ),
      commandPlan: aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
        shadowCommandPlan,
      ),
      pipelines:
        shadowCasterPipelineResourceReport.resource === null
          ? []
          : [
              {
                pipelineKey:
                  shadowCasterPipelineResourceReport.resource.pipelineKey,
                resourceKey:
                  shadowCasterPipelineResourceReport.resource.resourceKey,
                pipeline: shadowCasterPipelineResourceReport.resource.pipeline,
              },
            ],
      matrixBindGroups:
        shadowCasterMatrixBindGroupResourceReport.resource === null
          ? []
          : [
              {
                matrixResourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .matrixResourceKey,
                resourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .resourceKey,
                group: shadowCasterMatrixBindGroupResourceReport.resource.group,
                bindGroup:
                  shadowCasterMatrixBindGroupResourceReport.resource.bindGroup,
              },
            ],
      meshes: createShadowCasterExecutableMeshViews(report),
    });
  const shadowPassCommandEncoderResource =
    aperture.createCommandEncoderResource({
      device: app.initialization.device,
      label: "shadow-pass:clustered-spot",
    });
  const shadowPassEncoderAssemblyReport =
    aperture.createShadowPassEncoderAssemblyReport({
      attachments: aperture.shadowPassAttachmentDescriptorReportToJsonValue(
        shadowPassAttachments,
      ),
      frameResources: aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
        shadowCasterFrameResources,
      ),
      commandEncoding: aperture.shadowPassCommandEncodingReportToJsonValue(
        shadowPassCommandEncoding,
      ),
      commands: shadowCasterCommandRecordPlan.commandRecords,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      resolveDepthView: (attachment) =>
        aperture.resolveShadowDepthTextureAttachmentView(
          loop.spotShadowDepthTextureResourceReport,
          attachment,
        ),
    });
  const shadowPassCommandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: shadowPassEncoderAssemblyReport,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: "shadow-pass:clustered-spot",
      submit: true,
    });
  const supported =
    shadowPassCommandBufferSubmissionReport.status === "submitted" &&
    shadowMatrixBufferResourceReport.resource !== null &&
    loop.spotShadowDepthTextureResourceReport.resources.some(
      (resource) =>
        resource.shadowId === request.shadowId &&
        resource.lightId === request.lightId &&
        resource.viewDimension === "2d" &&
        resource.allocation.resource !== null,
    ) &&
    shadowSamplerResourceReport.resource !== null;

  return {
    standardMaterialShadowReceiverResources: supported
      ? {
          shadowKind: "spot",
          matrixBufferResource: shadowMatrixBufferResourceReport,
          depthTextureResources: loop.spotShadowDepthTextureResourceReport,
          samplerResource: shadowSamplerResourceReport,
        }
      : null,
    shadowStatus: {
      enabled: true,
      supported,
      mode: "clustered-spot-depth-compare",
      shadowId: request.shadowId,
      lightId: request.lightId,
      casterDraws: shadowCasterMeshDraws.length,
      faceCount: shadowPassPlan.passCount,
      submission: shadowPassCommandBufferSubmissionReport.status,
    },
  };
}

function createShadowCasterPreparedMeshViews(report) {
  const meshResources = report.resources?.resources?.meshResources ?? [];
  const preparedMeshEntries =
    report.resourceReuse?.preparedMeshFacade?.entries ?? [];
  const meshResourceByLabel = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const meshResourceByKey = new Map();

  for (const entry of preparedMeshEntries) {
    const resource = meshResourceByLabel.get(`mesh-buffer:${entry.label}`);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBufferResourceKeys: resource.vertexBuffers.map(
        (buffer) => buffer.resourceKey,
      ),
      indexBufferResourceKey: resource.indexBuffer?.resourceKey ?? null,
    });
  }

  return [...meshResourceByKey.values()];
}

function createShadowCasterExecutableMeshViews(report) {
  const meshResources = report.resources?.resources?.meshResources ?? [];
  const preparedMeshEntries =
    report.resourceReuse?.preparedMeshFacade?.entries ?? [];
  const meshResourceByLabel = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const meshResourceByKey = new Map();

  for (const entry of preparedMeshEntries) {
    const resource = meshResourceByLabel.get(`mesh-buffer:${entry.label}`);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBuffers: resource.vertexBuffers.map((buffer) => ({
        resourceKey: buffer.resourceKey,
        buffer: buffer.buffer,
        vertexCount: buffer.vertexCount,
      })),
      indexBuffer:
        resource.indexBuffer === undefined
          ? null
          : {
              resourceKey: resource.indexBuffer.resourceKey,
              buffer: resource.indexBuffer.buffer,
              format: resource.indexBuffer.format,
              indexCount: resource.indexBuffer.indexCount,
            },
    });
  }

  return [...meshResourceByKey.values()];
}

function pixelDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = a.a - b.a;

  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

function luminance(pixel) {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}

function failure(reason, message) {
  return {
    example: "clustered-lights",
    ok: false,
    phase: "failed",
    reason,
    message,
    clearColor: colorStatus(clearColor),
  };
}

function colorStatus(color) {
  return {
    r: color[0] ?? 0,
    g: color[1] ?? 0,
    b: color[2] ?? 0,
    a: color[3] ?? 1,
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
