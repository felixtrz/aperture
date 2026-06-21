import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.02, 0.025, 0.03, 1];
const routeOptions = readRouteOptions();

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("/aperture/worker-modules/packages/simulation/dist/index.js"),
      import("/aperture/worker-modules/packages/render/dist/index.js"),
      import("/aperture/worker-modules/packages/runtime/dist/index.js"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("/aperture/worker-modules/packages/webgpu/dist/index.js"),
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
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = registerQueuePhaseAssets(
        aperture,
        sourceAssets,
        routeOptions,
      );

      startWorkerSnapshotLoop(aperture, created.app, scene, routeOptions);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "standard-queue-phases-failed",
      error instanceof Error
        ? error.message
        : "Standard queue phase example failed.",
    ),
  );
}

function registerQueuePhaseAssets(aperture, sourceAssets, options) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "StandardQueuePhasePlane",
      width: 0.48,
      height: 0.9,
    }),
    { id: "standard-queue-phase-plane" },
  );
  const leftOpaque = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueRed", [0.95, 0.08, 0.04, 1]),
    { id: "phase-opaque-red" },
  );
  const alphaCutout = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseAlphaCutout", [0.08, 1, 0.1, 0], {
      alphaMode: "mask",
      alphaCutoff: 0.5,
    }),
    { id: "phase-alpha-cutout" },
  );
  const blueOpaque = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueBlue", [0.08, 0.16, 0.95, 1]),
    { id: "phase-opaque-blue" },
  );
  const transparentDepthBack = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentDepthBack",
      [0.02, 0.95, 0.16, 0.55],
    ),
    { id: "phase-transparent-depth-back" },
  );
  const transparentDepthFront = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentDepthFront",
      [1, 0.08, 0.04, 0.55],
    ),
    { id: "phase-transparent-depth-front" },
  );
  const transparentStableFirst = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentStableFirst",
      [0.02, 0.95, 0.16, 0.55],
    ),
    { id: "phase-transparent-stable-first" },
  );
  const transparentStableLast = assets.materials.standard.add(
    transparentMaterial(
      aperture,
      "PhaseTransparentStableLast",
      [1, 0.08, 0.04, 0.55],
    ),
    { id: "phase-transparent-stable-last" },
  );
  const pressureMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "StandardQueueTransparentPressurePlane",
      width: 0.68,
      height: 0.82,
    }),
    { id: "standard-queue-transparent-pressure-plane" },
  );
  const pressureSpecs = createTransparentPressureSpecs();
  const pressureMaterials = pressureSpecs.map((spec) =>
    assets.materials.standard.add(
      transparentMaterial(aperture, spec.label, spec.color),
      { id: spec.materialId },
    ),
  );

  return {
    mesh,
    pressureMesh,
    materialKeys: {
      leftOpaque: aperture.assetHandleKey(leftOpaque),
      alphaCutout: aperture.assetHandleKey(alphaCutout),
      blueOpaque: aperture.assetHandleKey(blueOpaque),
      transparentDepthBack: aperture.assetHandleKey(transparentDepthBack),
      transparentDepthFront: aperture.assetHandleKey(transparentDepthFront),
      transparentStableFirst: aperture.assetHandleKey(transparentStableFirst),
      transparentStableLast: aperture.assetHandleKey(transparentStableLast),
      transparentPressure: pressureMaterials.map((material) =>
        aperture.assetHandleKey(material),
      ),
    },
    expectedSamples: {
      alphaCutout: [0.95, 0.08, 0.04, 1],
      transparentDepthTieBreak: [0.56, 0.28, 0.2, 1],
      transparentStableTieBreak: [0.56, 0.28, 0.2, 1],
    },
    route: {
      transparentPressure: options.transparentPressure,
    },
    transparentPressure: {
      expectedRecordCount: pressureSpecs.length,
      materialKeys: pressureMaterials.map((material) =>
        aperture.assetHandleKey(material),
      ),
      overlapRegions: [
        "depth-stack-left",
        "render-order-center",
        "stable-id-right",
      ],
    },
  };
}

function startWorkerSnapshotLoop(aperture, app, scene, options) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/standard-queue-phases.worker.js",
    {
      name: "aperture-standard-queue-phases-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    route: {
      transparentPressure: options.transparentPressure,
    },
    renderBundleHistory: {
      created: 0,
      reused: 0,
      unsupported: 0,
      failed: 0,
      disabled: 0,
      encodedCommands: 0,
      executedBundles: 0,
      drawCalls: 0,
      reports: [],
    },
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
    transparentPressure: options.transparentPressure,
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
    label: "standard-queue-phases",
  });
  const status = statusFromReport(
    aperture,
    report,
    scene,
    loop,
    message,
    typedSnapshot,
  );

  publishStatus(status);

  if (status.ok) {
    requestWorkerFrame(worker, loop);
  } else {
    worker.terminate();
  }
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

function standardMaterial(aperture, label, color, renderState = {}) {
  return aperture.createStandardMaterialAsset({
    label,
    baseColorFactor: new Float32Array(color),
    emissiveFactor: [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0],
    metallicFactor: 0,
    roughnessFactor: 1,
    renderState: { cullMode: "none", ...renderState },
  });
}

function transparentMaterial(aperture, label, color) {
  return standardMaterial(aperture, label, color, {
    alphaMode: "blend",
    depth: { test: true, write: false, compare: "less" },
    blend: { preset: "alpha" },
  });
}

function readRouteOptions() {
  const params = new URLSearchParams(window.location.search);

  return {
    transparentPressure: params.get("transparent-pressure") === "1",
  };
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
  const renderBundleHistory = updateRenderBundleHistory(
    loop,
    reportJson.renderBundles ?? null,
  );
  const queueStateSort =
    reportJson.diagnosticsSummary?.renderFrameQueue?.stateSort ?? null;
  const queuedBindGroups = {
    created: reportJson.resourceReuse?.queuedBindGroupsCreated ?? 0,
    reused: reportJson.resourceReuse?.queuedBindGroupsReused ?? 0,
    cacheSize: reportJson.resourceReuse?.queuedBindGroupCacheSize ?? 0,
  };
  const transparentSort = report.snapshot.meshDraws
    .filter((draw) => draw.sortKey.queue === "transparent")
    .map((draw) => ({
      renderId: draw.renderId,
      materialKey: draw.sortKey.materialKey,
      viewId: draw.sortKey.viewId,
      layer: draw.sortKey.layer,
      order: draw.sortKey.order,
      depth: draw.sortKey.depth,
      stableId: draw.sortKey.stableId,
    }));
  const transparentPressure = scene.route.transparentPressure
    ? createTransparentPressureReport({
        transparentSort,
        transparentRecordCount:
          reportJson.diagnosticsSummary?.renderQueueSortPhases?.find(
            (phase) => phase.phase === "transparent",
          )?.recordCount ?? transparentSort.length,
        expectedRecordCount: scene.transparentPressure.expectedRecordCount,
        workerStep: message.workerStep?.transparentPressure ?? null,
        overlapRegions: scene.transparentPressure.overlapRegions,
      })
    : null;

  return {
    example: "standard-queue-phases",
    ok: report.ok,
    frame: report.frame,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: "webgpu-explicit",
    clearColor: toRgbaObject(clearColor),
    route: loop.route,
    routeTransparentPressureReady: transparentPressure?.ready ?? false,
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    materialKeys: scene.materialKeys,
    expectedSamples: scene.expectedSamples,
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    queues: report.snapshot.meshDraws.map((draw) => draw.sortKey.queue),
    pipelineKeys: report.snapshot.meshDraws.map(
      (draw) => draw.batchKey.pipelineKey,
    ),
    transparentSort,
    transparentPressure,
    transparentSortPolicy:
      reportJson.diagnosticsSummary?.renderQueueSortPhases?.find(
        (phase) => phase.phase === "transparent",
      )?.sortPolicy ?? null,
    commandPressure: reportJson.commandPressure ?? null,
    queueStateSort,
    queuedBindGroups,
    renderBundles: reportJson.renderBundles ?? null,
    renderBundleHistory,
    report: reportJson,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
  };
}

function updateRenderBundleHistory(loop, renderBundles) {
  const history = loop.renderBundleHistory;

  if (renderBundles !== null) {
    history.created += renderBundles.created ?? 0;
    history.reused += renderBundles.reused ?? 0;
    history.unsupported += renderBundles.unsupported ?? 0;
    history.failed += renderBundles.failed ?? 0;
    history.disabled += renderBundles.disabled ?? 0;
    history.encodedCommands += renderBundles.encodedCommands ?? 0;
    history.executedBundles += renderBundles.executedBundles ?? 0;
    history.drawCalls += renderBundles.drawCalls ?? 0;
    history.reports = [
      ...history.reports,
      ...(renderBundles.reports ?? []).map((entry) => ({
        status: entry.status,
        commandCount: entry.commandCount,
        encodedCommands: entry.encodedCommands,
        executedBundles: entry.executedBundles,
        drawCalls: entry.drawCalls,
      })),
    ].slice(-8);
  }

  return {
    created: history.created,
    reused: history.reused,
    unsupported: history.unsupported,
    failed: history.failed,
    disabled: history.disabled,
    encodedCommands: history.encodedCommands,
    executedBundles: history.executedBundles,
    drawCalls: history.drawCalls,
    reports: history.reports,
  };
}

function createTransparentPressureReport(input) {
  const records = input.transparentSort;
  const depthEpsilon = 0.0001;
  let depthOrderInversions = 0;
  let renderOrderTieBreakCount = 0;
  let stableIdTieBreakCount = 0;

  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    const left = records[leftIndex];

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < records.length;
      rightIndex += 1
    ) {
      const right = records[rightIndex];

      if (left.viewId !== right.viewId || left.layer !== right.layer) {
        continue;
      }

      const sameDepth = Math.abs(left.depth - right.depth) <= depthEpsilon;
      const sameOrder = left.order === right.order;

      if (sameDepth && left.order !== right.order) {
        renderOrderTieBreakCount += 1;
      }

      if (sameDepth && sameOrder && left.stableId !== right.stableId) {
        stableIdTieBreakCount += 1;
      }

      if (sameOrder && left.depth + depthEpsilon < right.depth) {
        depthOrderInversions += 1;
      }
    }
  }

  const orderSignature = records
    .map(
      (record) =>
        `${record.order}:${record.depth.toFixed(4)}:${record.stableId}`,
    )
    .join("|");

  return {
    enabled: true,
    ready:
      input.transparentRecordCount >= input.expectedRecordCount &&
      depthOrderInversions === 0,
    recordCount: input.transparentRecordCount,
    expectedRecordCount: input.expectedRecordCount,
    depthOrderInversions,
    renderOrderTieBreakCount,
    stableIdTieBreakCount,
    cameraPhase: input.workerStep?.cameraPhase ?? "unknown",
    cameraX: input.workerStep?.cameraX ?? 0,
    cameraMoved: input.workerStep?.cameraMoved ?? false,
    overlapRegions: input.overlapRegions,
    orderSignature,
  };
}

function createTransparentPressureSpecs() {
  const specs = [];
  const columns = [
    {
      x: -0.56,
      y: 0,
      nearColor: [1, 0.08, 0.04],
      farColor: [0.04, 0.22, 1],
    },
    {
      x: 0,
      y: 0,
      nearColor: [0.08, 1, 0.16],
      farColor: [1, 0.1, 0.75],
    },
    {
      x: 0.56,
      y: 0,
      nearColor: [0.1, 0.24, 1],
      farColor: [1, 0.78, 0.06],
    },
  ];

  for (let column = 0; column < columns.length; column += 1) {
    const columnSpec = columns[column];

    for (let layer = 0; layer < 8; layer += 1) {
      const t = layer / 7;

      specs.push({
        label: `PressureDepth${column}${layer}`,
        materialId: `pressure-depth-${column}-${layer}`,
        color: [
          mix(columnSpec.farColor[0], columnSpec.nearColor[0], t),
          mix(columnSpec.farColor[1], columnSpec.nearColor[1], t),
          mix(columnSpec.farColor[2], columnSpec.nearColor[2], t),
          0.38,
        ],
        translation: [
          columnSpec.x + (layer % 2 === 0 ? -0.018 : 0.018),
          columnSpec.y + (layer % 3 === 0 ? 0.025 : -0.015),
          layer * 0.08,
        ],
        order: 10,
      });
    }
  }

  const renderOrderTieColors = [
    [0.04, 0.95, 0.95, 0.42],
    [1, 0.08, 0.04, 0.42],
    [0.95, 0.92, 0.08, 0.42],
    [0.92, 0.12, 1, 0.42],
  ];
  const stableTieColors = [
    [0.06, 1, 0.2, 0.42],
    [0.08, 0.3, 1, 0.42],
    [1, 0.78, 0.05, 0.42],
    [1, 0.08, 0.04, 0.42],
  ];

  for (let index = 0; index < renderOrderTieColors.length; index += 1) {
    specs.push({
      label: `PressureRenderOrderTie${index}`,
      materialId: `pressure-render-order-tie-${index}`,
      color: renderOrderTieColors[index],
      translation: [0, 0.24 + (index % 2) * 0.018, 0.76],
      order: index < 2 ? 20 : 21,
    });
  }

  for (let index = 0; index < stableTieColors.length; index += 1) {
    specs.push({
      label: `PressureStableTie${index}`,
      materialId: `pressure-stable-tie-${index}`,
      color: stableTieColors[index],
      translation: [0.56, -0.24 + (index % 2) * 0.018, 0.9],
      order: 30,
    });
  }

  return specs;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function failure(reason, message) {
  return {
    example: "standard-queue-phases",
    ok: false,
    phase: "failed",
    reason,
    message,
    clearColor: toRgbaObject(clearColor),
    route: routeOptions,
  };
}

function toRgbaObject(color) {
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
