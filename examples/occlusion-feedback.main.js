import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.014, 0.018, 0.025, 1];
const maxStatusWarmupFrames = 6;
const readbackSamples = [
  { id: "occluder", x: 0.5, y: 0.5 },
  { id: "visible-query", x: 0.76, y: 0.5 },
  { id: "background", x: 0.08, y: 0.12 },
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
      const scene = registerOcclusionAssets(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "occlusion-feedback-failed",
      error instanceof Error
        ? error.message
        : "Occlusion feedback example failed.",
    ),
  );
}

function registerOcclusionAssets(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OcclusionFeedbackCube",
      width: 1,
      height: 1,
      depth: 1,
    }),
    { id: "occlusion-feedback-cube" },
  );
  const occluderMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OcclusionFeedbackOccluder",
      baseColorFactor: new Float32Array([0.045, 0.052, 0.064, 1]),
    }),
    { id: "occlusion-feedback-occluder" },
  );
  const hiddenMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OcclusionFeedbackHidden",
      baseColorFactor: new Float32Array([1, 0.12, 0.36, 1]),
    }),
    { id: "occlusion-feedback-hidden" },
  );
  const visibleMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OcclusionFeedbackVisible",
      baseColorFactor: new Float32Array([0.24, 0.95, 0.46, 1]),
    }),
    { id: "occlusion-feedback-visible" },
  );

  return {
    meshKey: aperture.assetHandleKey(mesh),
    materialKeys: {
      occluder: aperture.assetHandleKey(occluderMaterial),
      hidden: aperture.assetHandleKey(hiddenMaterial),
      visible: aperture.assetHandleKey(visibleMaterial),
    },
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/occlusion-feedback.worker.js",
    {
      name: "aperture-occlusion-feedback-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
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
    label: "occlusion-feedback",
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
  const occlusionQueries = reportJson.occlusionQueries ?? null;
  const occlusionStatus = createOcclusionStatus(
    occlusionQueries,
    loop.workerScene,
  );
  const readbackStatus = createReadbackStatus(reportJson.readback);

  return {
    example: "occlusion-feedback",
    ok:
      report.ok &&
      reportJson.counts.diagnostics === 0 &&
      occlusionStatus.ok &&
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
    occlusionQueries,
    occlusionStatus,
    readbackStatus,
    readback: reportJson.readback ?? null,
    renderBundles: reportJson.renderBundles ?? null,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
  };
}

function createOcclusionStatus(occlusionQueries, workerScene) {
  const visibleRenderId = workerScene?.visibleRenderId ?? null;
  const hiddenRenderId = workerScene?.hiddenRenderId ?? null;
  const visibleIds = occlusionQueries?.visibleRenderIds ?? [];
  const occludedIds = occlusionQueries?.occludedRenderIds ?? [];
  const skippedIds = occlusionQueries?.skippedRenderIds ?? [];
  const sampleCounts = occlusionQueries?.sampleCounts ?? [];
  const hasZeroSample = sampleCounts.includes("0");
  const hasNonZeroSample = sampleCounts.some((value) => Number(value) > 0);
  const visibleReported =
    visibleRenderId !== null && visibleIds.includes(visibleRenderId);
  const hiddenReported =
    hiddenRenderId !== null && occludedIds.includes(hiddenRenderId);
  const hiddenSkipped =
    hiddenRenderId !== null && skippedIds.includes(hiddenRenderId);

  return {
    ok:
      occlusionQueries?.status === "ready" &&
      occlusionQueries.queryCandidateDraws >= 2 &&
      occlusionQueries.queriedDraws >= 1 &&
      occlusionQueries.resolvedQueryResults >= 1 &&
      occlusionQueries.skippedFromQuery >= 1 &&
      visibleReported &&
      hiddenSkipped &&
      hasNonZeroSample &&
      occlusionQueries.fallbackReason === null &&
      (occlusionQueries.diagnostics?.length ?? 0) === 0,
    status: occlusionQueries?.status ?? "missing",
    queryCount: occlusionQueries?.queryCount ?? 0,
    queryCandidateDraws: occlusionQueries?.queryCandidateDraws ?? 0,
    queriedDraws: occlusionQueries?.queriedDraws ?? 0,
    resolvedQueryResults: occlusionQueries?.resolvedQueryResults ?? 0,
    skippedFromQuery: occlusionQueries?.skippedFromQuery ?? 0,
    forcedProbeDraws: occlusionQueries?.forcedProbeDraws ?? 0,
    fallbackReason: occlusionQueries?.fallbackReason ?? null,
    visibleRenderId,
    hiddenRenderId,
    visibleReported,
    hiddenReported,
    hiddenSkipped,
    hasZeroSample,
    hasNonZeroSample,
  };
}

function createReadbackStatus(readback) {
  if (readback?.ok !== true || !Array.isArray(readback.samples)) {
    return { ok: false, reason: readback?.reason ?? "readback-unavailable" };
  }

  const samples = readback.samples.map((sample) => ({
    id: sample.id,
    luminance: luminance(sample.pixel),
    distanceFromClear: colorDistance(sample.pixel, clearColor),
  }));
  const maxClearDistance = Math.max(
    ...samples.map((sample) => sample.distanceFromClear),
  );

  return {
    ok: maxClearDistance > 8,
    maxClearDistance,
    samples,
  };
}

function publishStatus(status) {
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ok" : status.phase;
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }

  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
}

function failure(reason, message) {
  return {
    example: "occlusion-feedback",
    ok: false,
    phase: "failed",
    reason,
    message,
  };
}

function colorStatus(color) {
  return {
    r: color[0],
    g: color[1],
    b: color[2],
    a: color[3],
  };
}

function luminance(pixel) {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}

function colorDistance(pixel, color) {
  const expected = {
    r: Math.round((color[0] ?? 0) * 255),
    g: Math.round((color[1] ?? 0) * 255),
    b: Math.round((color[2] ?? 0) * 255),
    a: Math.round((color[3] ?? 1) * 255),
  };

  return Math.hypot(
    pixel.r - expected.r,
    pixel.g - expected.g,
    pixel.b - expected.b,
    pixel.a - expected.a,
  );
}
