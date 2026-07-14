import { mirrorSourceAssetRegistryFromMessage } from "/packages/app/dist/asset-mirror.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.02, 0.03, 0.05, 1];

// A 3x3 readback grid over the view center. Panning slides the ground box + side
// marker across these points; zooming in grows them so more grid points land on
// the box.
const samplePoints = [];
for (const y of [0.36, 0.5, 0.64]) {
  for (const x of [0.36, 0.5, 0.64]) {
    samplePoints.push({ id: `${x}-${y}`, x, y });
  }
}

// Scripted phases (by frame): idle baseline -> horizontal pan drag -> settle
// (capture afterPan while distance is still the baseline) -> wheel zoom-in ->
// settle (capture afterZoom). Stops after the final settle.
const IDLE_END = 3;
const PAN_FIRST = 4;
const PAN_LAST = 11;
const PAN_SETTLE = 12;
const ZOOM_FIRST = 13;
const ZOOM_LAST = 20;
const ZOOM_SETTLE = 21;
const STOP_FRAME = 22;
const PAN_STEP = 0.02; // drag dx per pan frame (slides the world right)
const ZOOM_STEP = -0.4; // wheel per zoom frame (negative = zoom in)

const captured = { baseline: null, afterPan: null, afterZoom: null };
const trace = [];

const baseStatus = {
  example: "map-camera",
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

function frameInput(frame) {
  if (frame >= PAN_FIRST && frame <= PAN_LAST) {
    return { phase: "pan", pan: { dx: PAN_STEP, dy: 0 }, wheel: 0 };
  }
  if (frame >= ZOOM_FIRST && frame <= ZOOM_LAST) {
    return { phase: "zoom", wheel: ZOOM_STEP };
  }
  return { phase: "idle", wheel: 0 };
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
      "map-camera-example-failed",
      error instanceof Error ? error.message : "The example failed.",
    ),
  );
}

function startWorkerLoop(aperture, app, sourceAssets) {
  const worker = new Worker("/worker-modules/examples/map-camera.worker.js", {
    name: "aperture-map-camera-simulation",
    type: "module",
  });
  const loop = {
    frame: 0,
    ready: false,
    startedAt: performance.now(),
    lastTimestamp: performance.now(),
    scene: null,
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
    canvas: { width: canvas?.width ?? 960, height: canvas?.height ?? 540 },
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
    loop.scene = message.scene ?? null;
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
    label: "map-camera-app-route",
    readbackSamples: samplePoints,
  });

  const samples = sampleColors(report);
  trace.push({ frame: message.frame, phase: message.phase, ...message.map });
  if (message.frame === IDLE_END) {
    captured.baseline = { samples, map: message.map };
  } else if (message.frame === PAN_SETTLE) {
    captured.afterPan = { samples, map: message.map };
  } else if (message.frame === ZOOM_SETTLE) {
    captured.afterZoom = { samples, map: message.map };
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

function sampleColors(report) {
  const out = {};
  for (const point of samplePoints) {
    const sample = report.readback?.samples?.find((s) => s.id === point.id);
    out[point.id] = sample?.pixel ?? null;
  }
  return out;
}

function channels(pixel) {
  if (pixel === null || pixel === undefined) {
    return null;
  }
  if (Array.isArray(pixel)) {
    return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0];
  }
  return [pixel.r ?? 0, pixel.g ?? 0, pixel.b ?? 0];
}

function isBackground(pixel) {
  const c = channels(pixel);
  if (c === null) {
    return true;
  }
  return c[0] + c[1] + c[2] < 60;
}

function gridDelta(a, b) {
  if (a === null || b === null) {
    return 0;
  }
  let total = 0;
  for (const point of samplePoints) {
    const ca = channels(a[point.id]);
    const cb = channels(b[point.id]);
    if (ca === null || cb === null) {
      continue;
    }
    total +=
      Math.abs(ca[0] - cb[0]) +
      Math.abs(ca[1] - cb[1]) +
      Math.abs(ca[2] - cb[2]);
  }
  return total;
}

function coverage(samples) {
  if (samples === null) {
    return 0;
  }
  let count = 0;
  for (const point of samplePoints) {
    if (!isBackground(samples[point.id])) {
      count += 1;
    }
  }
  return count;
}

function createStatus(report, message, loop) {
  const baseline = captured.baseline;
  const afterPan = captured.afterPan;
  const afterZoom = captured.afterZoom;
  const ready = baseline !== null && afterPan !== null && afterZoom !== null;
  const baseTarget = baseline?.map.target ?? null;
  const panTarget = afterPan?.map.target ?? null;
  const baseEye = baseline?.map.eye ?? null;
  const panEye = afterPan?.map.eye ?? null;
  return {
    ...baseStatus,
    ok: report.ok,
    phase: ready ? "ready" : (message.phase ?? "render"),
    reason: report.ok ? undefined : "map-camera-render-failed",
    renderingBackend: "webgpu-app-route",
    frame: message.frame,
    mirroredSourceAssets: loop.mirroredSourceAssets,
    meshDraws: report.snapshot.meshDraws.length,
    map: message.map ?? null,
    transforms: {
      targetXBaseline: baseTarget?.[0] ?? null,
      targetXAfterPan: panTarget?.[0] ?? null,
      targetZBaseline: baseTarget?.[2] ?? null,
      targetZAfterPan: panTarget?.[2] ?? null,
      eyeXBaseline: baseEye?.[0] ?? null,
      eyeXAfterPan: panEye?.[0] ?? null,
      distanceBaseline: baseline?.map.distance ?? null,
      distanceAfterPan: afterPan?.map.distance ?? null,
      distanceAfterZoom: afterZoom?.map.distance ?? null,
    },
    pixels: {
      panGridDelta: gridDelta(
        baseline?.samples ?? null,
        afterPan?.samples ?? null,
      ),
      zoomGridDelta: gridDelta(
        afterPan?.samples ?? null,
        afterZoom?.samples ?? null,
      ),
      coverageBaseline: coverage(baseline?.samples ?? null),
      coverageAfterZoom: coverage(afterZoom?.samples ?? null),
      baseline: baseline?.samples ?? null,
      afterPan: afterPan?.samples ?? null,
      afterZoom: afterZoom?.samples ?? null,
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
