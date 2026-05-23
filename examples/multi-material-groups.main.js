import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  MULTI_MATERIAL_GROUPS_CLEAR_COLOR,
  registerMultiMaterialGroupAssets,
} from "./multi-material-groups.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const readbackSamples = [
  { id: "left", x: 0.36, y: 0.5 },
  { id: "right", x: 0.64, y: 0.5 },
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
      const scene = registerMultiMaterialGroupAssets(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "multi-material-groups-failed",
      error instanceof Error
        ? error.message
        : "Multi-material groups example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/multi-material-groups.worker.js",
    {
      name: "aperture-multi-material-groups-simulation",
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
    clearColor: MULTI_MATERIAL_GROUPS_CLEAR_COLOR,
    label: "multi-material-groups",
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
  const groupStatus = createGroupStatus(message.workerStep, scene);
  const readbackStatus = createReadbackStatus(reportJson.readback);

  return {
    example: "multi-material-groups",
    ok:
      report.ok &&
      reportJson.counts.diagnostics === 0 &&
      groupStatus.ok &&
      readbackStatus.ok,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    scene: {
      meshKey: scene.meshKey,
      materialKeys: scene.materialKeys,
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    groupStatus,
    readbackStatus,
    readback: reportJson.readback ?? null,
    renderBundles: reportJson.renderBundles ?? null,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
  };
}

function createGroupStatus(workerStep, scene) {
  const groups = workerStep?.groups ?? [];
  const materialKeys = groups.map((group) => group.materialKey);
  const indexStarts = groups.map((group) => group.indexStart);
  const indexCounts = groups.map((group) => group.indexCount);

  return {
    ok:
      workerStep?.meshDraws === 2 &&
      workerStep?.sameMesh === true &&
      materialKeys.includes(scene.materialKeys.left) &&
      materialKeys.includes(scene.materialKeys.right) &&
      indexStarts.includes(0) &&
      indexStarts.includes(6) &&
      indexCounts.every((count) => count === 6),
    meshDraws: workerStep?.meshDraws ?? 0,
    sameMesh: workerStep?.sameMesh ?? false,
    groups,
    materialKeys,
    indexStarts,
    indexCounts,
  };
}

function createReadbackStatus(readback) {
  if (readback?.ok !== true || !Array.isArray(readback.samples)) {
    return { ok: false, reason: readback?.reason ?? "readback-unavailable" };
  }

  const samples = Object.fromEntries(
    readback.samples.map((sample) => [sample.id, sample.pixel]),
  );
  const left = samples.left;
  const right = samples.right;
  const background = samples.background;

  if (!isPixelLike(left) || !isPixelLike(right)) {
    return { ok: false, reason: "missing-left-or-right-sample", samples };
  }

  const colorDelta = colorDistance(left, right);
  const leftFromClear = colorDistance(left, MULTI_MATERIAL_GROUPS_CLEAR_COLOR);
  const rightFromClear = colorDistance(
    right,
    MULTI_MATERIAL_GROUPS_CLEAR_COLOR,
  );
  const backgroundFromClear = isPixelLike(background)
    ? colorDistance(background, MULTI_MATERIAL_GROUPS_CLEAR_COLOR)
    : null;

  return {
    ok:
      colorDelta > 60 &&
      leftFromClear > 20 &&
      rightFromClear > 20 &&
      (backgroundFromClear === null || backgroundFromClear < 12),
    colorDelta,
    leftFromClear,
    rightFromClear,
    backgroundFromClear,
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
    example: "multi-material-groups",
    ok: false,
    phase: "failed",
    reason,
    message,
  };
}

function colorDistance(a, b) {
  const dr = pixelChannelByte(a, 0, "r") - pixelChannelByte(b, 0, "r");
  const dg = pixelChannelByte(a, 1, "g") - pixelChannelByte(b, 1, "g");
  const db = pixelChannelByte(a, 2, "b") - pixelChannelByte(b, 2, "b");

  return Math.hypot(dr, dg, db);
}

function pixelChannelByte(pixel, index, key) {
  const value = Array.isArray(pixel)
    ? (pixel[index] ?? 0)
    : (pixel?.[key] ?? 0);

  return value <= 1 ? value * 255 : value;
}

function isPixelLike(pixel) {
  return (
    Array.isArray(pixel) ||
    (pixel !== null &&
      typeof pixel === "object" &&
      Number.isFinite(pixel.r) &&
      Number.isFinite(pixel.g) &&
      Number.isFinite(pixel.b))
  );
}
