import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.012, 0.016, 0.022, 1];
const maxStatusWarmupFrames = 24;
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

  return {
    meshKey: aperture.assetHandleKey(panelMesh),
    materialKey: aperture.assetHandleKey(panelMaterial),
    secondaryMaterialKey: aperture.assetHandleKey(secondaryPanelMaterial),
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

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "clustered-lights",
    readbackSamples,
  });
  const status = statusFromReport(
    aperture,
    report,
    scene,
    loop,
    message,
    typedSnapshot,
  );

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
    readbackStatus,
    readback: reportJson.readback ?? null,
    resourceReuse: reportJson.resourceReuse,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
  };
}

function createClusterStatus(localLightClusters, pipelineKeys, loop) {
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

  return {
    ok:
      clusterPipelineUsed &&
      clusterRoutes.length >= 2 &&
      distinctViewIds >= 2 &&
      distinctOccupancyHashes >= 2 &&
      routePressureOk &&
      occupancyChanged &&
      (localLightClusters?.resourceReuse?.buffersReused ?? 0) >= 6,
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
