import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { registerSingleLightShadowAssets } from "./single-light-shadow-assets.js";
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
// M3-T5: ?graph=1 folds the spot shadow caster pass into the forward encoder.
const useFrameGraph = exampleParams.get("graph") === "1";
let pendingShadowCasterGraphPasses = null;

const clearColor = [0.014, 0.019, 0.026, 1];
const shadowIntent = {
  key: "spot-shadow:2d:0",
  mapSize: 512,
  depthBias: 0.002,
  normalBias: 0.01,
};

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
      const scene = createPresentationScene(aperture, sourceAssets, canvas);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "spot-shadow-failed",
      error instanceof Error ? error.message : "Spot shadow example failed.",
    ),
  );
}

function createPresentationScene(aperture, sourceAssets, targetCanvas) {
  const assets = registerSingleLightShadowAssets(
    aperture,
    sourceAssets,
    "spot",
  );

  setupShadowControls(shadowControls);

  return {
    canvas: targetCanvas,
    cubeMeshKey: assets.cubeMeshKey,
    wallMeshKey: assets.wallMeshKey,
    cubeMaterialKey: assets.cubeMaterialKey,
    wallMaterialKey: assets.wallMaterialKey,
    shadowControls,
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker("/worker-modules/examples/spot-shadow.worker.js", {
    name: "aperture-spot-shadow-simulation",
    type: "module",
  });
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
    label: "spot-shadow-app",
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
  const shadowCasterMeshDraws = scene.shadowControls.casterEnabled
    ? report.snapshot.meshDraws.filter(
        (draw) => draw.sortKey.meshKey === scene.cubeMeshKey,
      )
    : [];
  const shadowCasterMeshViews =
    aperture.createShadowCasterMeshViewsFromAppReport(report);
  const shadowFrame = aperture.createRenderShadowFrame({
    device: app.initialization.device,
    snapshot: {
      ...report.snapshot,
      shadowCasterDraws: shadowCasterMeshDraws,
    },
    preparedMeshes: shadowCasterMeshViews.preparedMeshes,
    executableMeshes: shadowCasterMeshViews.executableMeshes,
    cache: appEnvironmentResourceCache,
    shadowMap: {
      mapSize: shadowIntent.mapSize,
      depthBias: shadowIntent.depthBias,
      normalBias: shadowIntent.normalBias,
      resourceKey: shadowIntent.key,
    },
    label: "shadow-pass:spot",
    submit: scene.shadowControls.casterEnabled && !useFrameGraph,
  });
  const shadowDescriptor = aperture.shadowMapDescriptorReportToJsonValue(
    shadowFrame.descriptor,
  );
  const shadowTextures = aperture.shadowTextureResourceReportToJsonValue(
    shadowFrame.textures,
  );
  const shadowDepthTextureResources =
    aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowFrame.depthTextureResources,
    );
  const shadowSamplerResource = aperture.shadowSamplerResourceReportToJsonValue(
    shadowFrame.samplerResource,
  );
  const shadowPassPlan = aperture.shadowPassPlanReportToJsonValue(
    shadowFrame.passPlan,
  );
  const shadowPassAttachments =
    aperture.shadowPassAttachmentDescriptorReportToJsonValue(
      shadowFrame.passAttachments,
    );
  const shadowViewProjection =
    aperture.spotShadowViewProjectionPlanReportToJsonValue(
      shadowFrame.viewProjection,
    );
  const shadowMatrixComputation =
    aperture.spotShadowMatrixComputationReportToJsonValue(
      shadowFrame.matrixComputation,
    );
  const shadowProjectionCoverage = createSpotShadowProjectionCoverageReport(
    shadowFrame.matrixComputation,
  );
  const shadowMatrixBuffer =
    aperture.shadowMatrixBufferDescriptorReportToJsonValue(
      shadowFrame.matrixBuffer,
    );
  const shadowMatrixBufferResource =
    aperture.shadowMatrixBufferResourceReportToJsonValue(
      shadowFrame.matrixBufferResource,
    );
  const shadowCasterDrawList =
    aperture.shadowCasterDrawListPlanReportToJsonValue(
      shadowFrame.casterDrawList,
    );
  const shadowCommandPlan =
    aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
      shadowFrame.commandPlan,
    );
  const shadowPassCommandEncoding =
    aperture.shadowPassCommandEncodingReportToJsonValue(
      shadowFrame.commandEncoding,
    );
  const shadowCasterPipelineDescriptor =
    aperture.shadowCasterPipelineDescriptorReportToJsonValue(
      shadowFrame.pipelineDescriptor,
    );
  const shadowCasterPipelineResource =
    aperture.shadowCasterPipelineResourceReportToJsonValue(
      shadowFrame.pipelineResource,
    );
  const shadowCasterMatrixBindGroupResource =
    aperture.shadowCasterMatrixBindGroupResourceReportToJsonValue(
      shadowFrame.matrixBindGroupResource,
    );
  const shadowCasterFrameResources =
    aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
      shadowFrame.frameResources,
    );
  const shadowCasterCommandRecords =
    aperture.shadowCasterCommandRecordPlanReportToJsonValue(
      shadowFrame.commandRecords,
    );
  const shadowPassEncoderAssembly =
    aperture.shadowPassEncoderAssemblyReportToJsonValue(
      shadowFrame.encoderAssembly,
    );
  const shadowPassCommandBufferSubmissionReport =
    shadowFrame.commandBufferSubmission;
  const shadowPassCommandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowPassCommandBufferSubmissionReport,
    );
  const shadowDepthProbeReport = await aperture.createShadowDepthProbeReport({
    device: app.initialization.device,
    samples: shadowProjectionCoverage.records,
    depthTextureResources: shadowFrame.depthTextureResources,
    samplerResource: shadowFrame.samplerResource,
    commandBufferSubmission: shadowPassCommandBufferSubmissionReport,
    depthBias: shadowIntent.depthBias,
  });
  const shadowDepthProbe = aperture.shadowDepthProbeReportToJsonValue(
    shadowDepthProbeReport,
  );
  pendingShadowCasterGraphPasses = useFrameGraph
    ? aperture.createShadowCasterGraphPasses({
        passAttachments: shadowFrame.passAttachments,
        depthTextureResources: shadowFrame.depthTextureResources,
        commandRecords: shadowFrame.commandRecords.commandRecords,
      })
    : null;
  const spotShadowRoute = findSpotShadowRoute(reportJson);
  const renderingSupported =
    scene.shadowControls.receiverEnabled &&
    scene.shadowControls.casterEnabled &&
    shadowPassCommandBufferSubmissionReport.status === "submitted" &&
    spotShadowRoute !== null;

  publishStatus({
    example: "spot-shadow",
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
      cubeMeshKey: scene.cubeMeshKey,
      wallMeshKey: scene.wallMeshKey,
      cubeMaterialKey: scene.cubeMaterialKey,
      wallMaterialKey: scene.wallMaterialKey,
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
      intent: {
        ...shadowIntent,
        kind: "spot",
      },
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
      })),
      descriptor: shadowDescriptor,
      textures: shadowTextures,
      depthTextureResources: shadowDepthTextureResources,
      samplerResource: shadowSamplerResource,
      passPlan: shadowPassPlan,
      passAttachments: shadowPassAttachments,
      viewProjection: shadowViewProjection,
      matrixComputation: shadowMatrixComputation,
      projectionCoverage: shadowProjectionCoverage,
      depthProbe: shadowDepthProbe,
      matrixBuffer: shadowMatrixBuffer,
      matrixBufferResource: shadowMatrixBufferResource,
      casterDrawList: shadowCasterDrawList,
      commandPlan: shadowCommandPlan,
      commandEncoding: shadowPassCommandEncoding,
      pipelineDescriptor: shadowCasterPipelineDescriptor,
      pipelineResource: shadowCasterPipelineResource,
      matrixBindGroupResource: shadowCasterMatrixBindGroupResource,
      frameResources: shadowCasterFrameResources,
      commandRecords: shadowCasterCommandRecords,
      encoderAssembly: shadowPassEncoderAssembly,
      commandBufferSubmission: shadowPassCommandBufferSubmission,
      rendering: {
        supported: renderingSupported,
        mode: "spot-depth-compare",
        faceCount: shadowPassPlan.passCount,
        pipelineKey: spotShadowRoute?.pipelineKey ?? null,
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      spotShadowRoute,
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
    standardMaterialShadowReceiverResources: shadowFrame.receiverResources,
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

function findSpotShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find((pipeline) => pipeline.pipelineKey.includes("shadowMap")) ??
    null
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

function createSpotShadowProjectionCoverageReport(matrixComputation) {
  const matrix = matrixComputation.matrices?.[0] ?? null;

  if (matrix === null) {
    return {
      ready: false,
      status: "missing",
      matrixKey: null,
      sampleCount: 0,
      receiverInsideCount: 0,
      casterInsideCount: 0,
      records: [],
      diagnostics: [
        {
          code: "spotShadow.projectionCoverage.missingMatrix",
          severity: "warning",
          message:
            "Spot shadow projection coverage requires a ready spot shadow matrix.",
        },
      ],
    };
  }

  const records = spotShadowProjectionSamples().map((sample) =>
    projectShadowSample(matrix.viewProjectionMatrix, sample),
  );
  const receiverRecords = records.filter(
    (record) => record.role === "receiver",
  );
  const casterRecords = records.filter((record) => record.role === "caster");
  const receiverInsideCount = receiverRecords.filter(
    (record) => record.insideProjection,
  ).length;
  const casterInsideCount = casterRecords.filter(
    (record) => record.insideProjection,
  ).length;
  const ready = receiverInsideCount > 0 && casterInsideCount > 0;

  return {
    ready,
    status: ready ? "ready" : "missing",
    matrixKey: matrix.matrixKey,
    sampleCount: records.length,
    receiverInsideCount,
    casterInsideCount,
    records,
    diagnostics: ready
      ? []
      : [
          {
            code: "spotShadow.projectionCoverage.noOverlap",
            severity: "warning",
            message:
              "Spot shadow projection coverage did not find both receiver and caster samples inside the light projection.",
          },
        ],
  };
}

function spotShadowProjectionSamples() {
  return [
    ...spotShadowReceiverSamples(),
    {
      key: "caster:cube:center",
      role: "caster",
      shape: "cube",
      worldPosition: [0, -0.02, 0.03],
    },
    {
      key: "caster:cube:back-center",
      role: "caster",
      shape: "cube",
      worldPosition: [0, -0.02, -0.42],
    },
    {
      key: "caster:cube:front-center",
      role: "caster",
      shape: "cube",
      worldPosition: [0, -0.02, 0.48],
    },
    {
      key: "caster:cube:top",
      role: "caster",
      shape: "cube",
      worldPosition: [0, 0.43, 0.03],
    },
    {
      key: "caster:cube:bottom",
      role: "caster",
      shape: "cube",
      worldPosition: [0, -0.47, 0.03],
    },
    {
      key: "caster:cube:left",
      role: "caster",
      shape: "cube",
      worldPosition: [-0.45, -0.02, 0.03],
    },
    {
      key: "caster:cube:right",
      role: "caster",
      shape: "cube",
      worldPosition: [0.45, -0.02, 0.03],
    },
  ];
}

function spotShadowReceiverSamples() {
  const samples = [];
  const xValues = [-0.9, -0.55, -0.25, 0.05, 0.4];
  const yValues = [-1.15, -0.8, -0.5, -0.2, 0.15];

  for (const y of yValues) {
    for (const x of xValues) {
      samples.push({
        key: `receiver:wall:${x}:${y}`,
        role: "receiver",
        shape: "wall",
        worldPosition: [x, y, -0.92],
      });
    }
  }

  return samples;
}

function projectShadowSample(matrix, sample) {
  const clip = transformPoint4(matrix, sample.worldPosition);
  const w = Math.abs(clip[3]) <= 0.00001 ? 1 : clip[3];
  const ndc = [clip[0] / w, clip[1] / w, clip[2] / w];
  const depth = ndc[2] < 0 ? ndc[2] * 0.5 + 0.5 : ndc[2];
  const uv = [ndc[0] * 0.5 + 0.5, 0.5 - ndc[1] * 0.5];
  const clampedUv = [clamp01(uv[0]), clamp01(uv[1])];
  const clampedDepth = clamp01(depth);
  const projectionDistance = Math.max(
    Math.hypot(uv[0] - clampedUv[0], uv[1] - clampedUv[1]),
    Math.abs(depth - clampedDepth),
  );

  return {
    key: sample.key,
    role: sample.role,
    shape: sample.shape,
    worldPosition: sample.worldPosition,
    uv: sanitizeTuple2(uv),
    depth: sanitizeNumber(depth),
    insideProjection:
      uv[0] >= 0 &&
      uv[0] <= 1 &&
      uv[1] >= 0 &&
      uv[1] <= 1 &&
      depth >= 0 &&
      depth <= 1,
    projectionDistance: sanitizeNumber(projectionDistance),
  };
}

function transformPoint4(matrix, point) {
  const x = point[0];
  const y = point[1];
  const z = point[2];

  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15],
  ];
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function sanitizeTuple2(value) {
  return [sanitizeNumber(value[0]), sanitizeNumber(value[1])];
}

function sanitizeNumber(value) {
  return Object.is(value, -0) ? 0 : value;
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
    example: "spot-shadow",
    ok: false,
    phase: "failed",
    reason,
    message,
    ...extra,
  };
}
