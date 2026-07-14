import { mirrorSourceAssetRegistryFromMessage } from "/packages/app/dist/asset-mirror.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.02, 0.03, 0.05, 1];

// A 3x3 readback grid over the view center. A pointer-lock look-turn sweeps the
// box + side marker across these points; walking forward grows the box so more
// grid points land on it.
const samplePoints = [];
for (const y of [0.36, 0.5, 0.64]) {
  for (const x of [0.36, 0.5, 0.64]) {
    samplePoints.push({ id: `${x}-${y}`, x, y });
  }
}

// Scripted phases (by frame): idle baseline -> WASD forward walk (box grows) ->
// settle (capture afterMove) -> pointer-lock look-turn (marker sweeps) -> settle
// (capture afterLook). Move runs first while the camera looks straight at the
// box so the walk clearly changes the grid; the turn then sweeps the scene.
const IDLE_END = 3;
const MOVE_FIRST = 4;
const MOVE_LAST = 11;
const MOVE_SETTLE = 12;
const LOOK_FIRST = 13;
const LOOK_LAST = 20;
const LOOK_SETTLE = 21;
const STOP_FRAME = 22;
const MOVE_STEP = 0.32; // forward walk units per move frame
const LOOK_STEP = 40; // pointer-lock movementX px per look frame (turn right)

const captured = { baseline: null, afterMove: null, afterLook: null };
const trace = [];

const baseStatus = {
  example: "fps-camera",
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

function frameInput(frame) {
  if (frame >= MOVE_FIRST && frame <= MOVE_LAST) {
    return {
      phase: "move",
      move: { forward: MOVE_STEP, right: 0, up: 0 },
    };
  }
  if (frame >= LOOK_FIRST && frame <= LOOK_LAST) {
    return {
      phase: "look",
      look: { dx: LOOK_STEP, dy: 0 },
    };
  }
  return { phase: "idle" };
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
      "fps-camera-example-failed",
      error instanceof Error ? error.message : "The example failed.",
    ),
  );
}

function startWorkerLoop(aperture, app, sourceAssets) {
  const worker = new Worker("/worker-modules/examples/fps-camera.worker.js", {
    name: "aperture-fps-camera-simulation",
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
    label: "fps-camera-app-route",
    readbackSamples: samplePoints,
  });

  const samples = sampleColors(report);
  trace.push({ frame: message.frame, phase: message.phase, ...message.fps });
  if (message.frame === IDLE_END) {
    captured.baseline = { samples, fps: message.fps };
  } else if (message.frame === LOOK_SETTLE) {
    captured.afterLook = { samples, fps: message.fps };
  } else if (message.frame === MOVE_SETTLE) {
    captured.afterMove = { samples, fps: message.fps };
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

function horizontalDistance(a, b) {
  if (a === null || b === null) {
    return 0;
  }
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function createStatus(report, message, loop) {
  const baseline = captured.baseline;
  const afterLook = captured.afterLook;
  const afterMove = captured.afterMove;
  const ready = baseline !== null && afterLook !== null && afterMove !== null;
  const basePos = baseline?.fps.position ?? null;
  const movePos = afterMove?.fps.position ?? null;
  return {
    ...baseStatus,
    ok: report.ok,
    phase: ready ? "ready" : (message.phase ?? "render"),
    reason: report.ok ? undefined : "fps-camera-render-failed",
    renderingBackend: "webgpu-app-route",
    frame: message.frame,
    mirroredSourceAssets: loop.mirroredSourceAssets,
    meshDraws: report.snapshot.meshDraws.length,
    fps: message.fps ?? null,
    transforms: {
      yawBaseline: baseline?.fps.yaw ?? null,
      yawAfterLook: afterLook?.fps.yaw ?? null,
      pitchBaseline: baseline?.fps.pitch ?? null,
      posBaseline: basePos,
      posAfterMove: movePos,
      posYBaseline: basePos?.[1] ?? null,
      posYAfterMove: movePos?.[1] ?? null,
      horizontalMove: horizontalDistance(basePos, movePos),
    },
    pixels: {
      // Move runs first (baseline -> afterMove), then the look-turn
      // (afterMove -> afterLook).
      moveGridDelta: gridDelta(
        baseline?.samples ?? null,
        afterMove?.samples ?? null,
      ),
      lookGridDelta: gridDelta(
        afterMove?.samples ?? null,
        afterLook?.samples ?? null,
      ),
      coverageBaseline: coverage(baseline?.samples ?? null),
      coverageAfterMove: coverage(afterMove?.samples ?? null),
      baseline: baseline?.samples ?? null,
      afterMove: afterMove?.samples ?? null,
      afterLook: afterLook?.samples ?? null,
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
