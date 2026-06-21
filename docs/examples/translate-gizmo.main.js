import { mirrorSourceAssetRegistryFromMessage } from "/aperture/packages/app/dist/asset-mirror.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.03, 0.04, 0.06, 1];

// Scripted phases (by frame): idle baseline -> hover the X handle -> press ->
// drag rightward in three moves -> release -> settle (capture afterDrag).
const HANDLE_X = 0.62; // normalized screen x where the +X handle projects
const BASELINE_FRAME = 3;
const SETTLE_FRAME = 10;
const STOP_FRAME = 11;

const captured = { baseline: null, afterDrag: null };
const trace = [];

const baseStatus = {
  example: "translate-gizmo",
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

function frameInput(frame) {
  switch (frame) {
    case 4:
      return {
        phase: "hover",
        pointer: { x: HANDLE_X, y: 0.5, pressed: false },
      };
    case 5:
      return {
        phase: "press",
        pointer: { x: HANDLE_X, y: 0.5, pressed: true },
      };
    case 6:
      return { phase: "drag", pointer: { x: 0.68, y: 0.5, pressed: true } };
    case 7:
      return { phase: "drag", pointer: { x: 0.74, y: 0.5, pressed: true } };
    case 8:
      return { phase: "drag", pointer: { x: 0.8, y: 0.5, pressed: true } };
    case 9:
      return { phase: "release", pointer: { x: 0.8, y: 0.5, pressed: false } };
    default:
      return { phase: "idle", pointer: { x: 0.5, y: 0.5, pressed: false } };
  }
}

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
      startWorkerLoop(aperture, created.app, sourceAssets);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "translate-gizmo-example-failed",
      error instanceof Error ? error.message : "The example failed.",
    ),
  );
}

function startWorkerLoop(aperture, app, sourceAssets) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/translate-gizmo.worker.js",
    {
      name: "aperture-translate-gizmo-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    ready: false,
    startedAt: performance.now(),
    lastTimestamp: performance.now(),
    mirroredSourceAssets: 0,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      sourceAssets,
      worker,
      loop,
      event.data,
    );
  });
  worker.addEventListener("error", (event) => {
    publishStatus(failure("worker-error", event.message || "Worker error."));
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: { width: canvas?.width ?? 480, height: canvas?.height ?? 360 },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  sourceAssets,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.ready = true;
    requestWorkerFrame(worker, loop);
    return;
  }
  if (message?.type === "error") {
    publishStatus(failure(message.reason ?? "worker-error", message.message));
    worker.terminate();
    return;
  }
  if (message?.type !== "snapshot") {
    return;
  }

  const mirror = mirrorSourceAssetRegistryFromMessage(sourceAssets, message);
  loop.mirroredSourceAssets += mirror.mirrored;

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "translate-gizmo-app-route",
  });

  trace.push({ frame: message.frame, phase: message.phase, ...message.gizmo });
  if (message.frame === BASELINE_FRAME) {
    captured.baseline = message.gizmo;
  } else if (message.frame === SETTLE_FRAME) {
    captured.afterDrag = message.gizmo;
  }

  publishStatus(createStatus(report, message, loop));

  if (!report.ok || message.frame >= STOP_FRAME) {
    worker.terminate();
    return;
  }
  requestWorkerFrame(worker, loop);
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.ready) {
      return;
    }
    const time = (timestamp - loop.startedAt) / 1000;
    const delta = Math.max(0, (timestamp - loop.lastTimestamp) / 1000);
    loop.lastTimestamp = timestamp;
    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      time,
      delta,
      ...frameInput(loop.frame),
    });
  });
}

function createStatus(report, message, loop) {
  const baseline = captured.baseline;
  const afterDrag = captured.afterDrag;
  const ready = baseline !== null && afterDrag !== null;
  return {
    ...baseStatus,
    ok: report.ok,
    phase: ready ? "ready" : (message.phase ?? "render"),
    reason: report.ok ? undefined : "translate-gizmo-render-failed",
    renderingBackend: "webgpu-app-route",
    frame: message.frame,
    mirroredSourceAssets: loop.mirroredSourceAssets,
    meshDraws: message.meshDraws ?? report.snapshot.meshDraws.length,
    gizmo: message.gizmo ?? null,
    drag: {
      baselineTarget: baseline?.target ?? null,
      afterDragTarget: afterDrag?.target ?? null,
      baselineHandleX: baseline?.handleX ?? null,
      afterDragHandleX: afterDrag?.handleX ?? null,
    },
    trace,
  };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? (status.phase ?? "ok") : "failed";
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return { ...baseStatus, ok: false, phase: reason, reason, message };
}
