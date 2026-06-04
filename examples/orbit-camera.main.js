import { mirrorSourceAssetRegistryFromMessage } from "/packages/app/dist/asset-mirror.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.02, 0.03, 0.05, 1];

// A 3x3 readback grid over the orbit target. Orbiting changes the lit faces seen
// at these points; zooming in grows the box so more grid points land on it.
const samplePoints = [];
for (const y of [0.36, 0.5, 0.64]) {
  for (const x of [0.36, 0.5, 0.64]) {
    samplePoints.push({ id: `${x}-${y}`, x, y });
  }
}

// Scripted phases (by frame): idle baseline -> horizontal orbit drag -> settle
// (capture afterOrbit while distance is still the baseline) -> wheel zoom-in ->
// settle (capture afterZoom). Stops after the final settle.
const IDLE_END = 3;
const ORBIT_FIRST = 4;
const ORBIT_LAST = 11;
const ORBIT_SETTLE = 12;
const ZOOM_FIRST = 13;
const ZOOM_LAST = 20;
const ZOOM_SETTLE = 21;
const STOP_FRAME = 22;
const ORBIT_STEP = 0.05; // normalized pointer x per orbit frame
const ZOOM_STEP = -0.32; // wheel per zoom frame (negative = zoom in)

const captured = { baseline: null, afterOrbit: null, afterZoom: null };
const orbitTrace = [];

const baseStatus = {
  example: "orbit-camera",
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

function frameInput(frame) {
  if (frame >= ORBIT_FIRST && frame <= ORBIT_LAST) {
    // Drag horizontally to the right (orbit). x advances each frame.
    const step = frame - IDLE_END;
    return {
      phase: "orbit",
      pointer: { x: 0.5 + step * ORBIT_STEP, y: 0.5, pressed: true },
      wheel: 0,
    };
  }
  if (frame >= ZOOM_FIRST && frame <= ZOOM_LAST) {
    return {
      phase: "zoom",
      pointer: { x: 0.5, y: 0.5, pressed: false },
      wheel: ZOOM_STEP,
    };
  }
  return {
    phase: "idle",
    pointer: { x: 0.5, y: 0.5, pressed: false },
    wheel: 0,
  };
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
      "orbit-camera-example-failed",
      error instanceof Error ? error.message : "The example failed.",
    ),
  );
}

function startWorkerLoop(aperture, app, sourceAssets) {
  const worker = new Worker("/worker-modules/examples/orbit-camera.worker.js", {
    name: "aperture-orbit-camera-simulation",
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
    label: "orbit-camera-app-route",
    readbackSamples: samplePoints,
  });

  const samples = sampleColors(report);
  orbitTrace.push({
    frame: message.frame,
    phase: message.phase,
    ...message.orbit,
  });
  if (message.frame === IDLE_END) {
    captured.baseline = { samples, orbit: message.orbit };
  } else if (message.frame === ORBIT_SETTLE) {
    captured.afterOrbit = { samples, orbit: message.orbit };
  } else if (message.frame === ZOOM_SETTLE) {
    captured.afterZoom = { samples, orbit: message.orbit };
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
  // Clear color is very dark blue; "on the object" pixels are far brighter.
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
  const afterOrbit = captured.afterOrbit;
  const afterZoom = captured.afterZoom;
  const ready = baseline !== null && afterOrbit !== null && afterZoom !== null;
  return {
    ...baseStatus,
    ok: report.ok,
    phase: ready ? "ready" : (message.phase ?? "render"),
    reason: report.ok ? undefined : "orbit-camera-render-failed",
    renderingBackend: "webgpu-app-route",
    frame: message.frame,
    mirroredSourceAssets: loop.mirroredSourceAssets,
    meshDraws: report.snapshot.meshDraws.length,
    debug: {
      readbackOk: report.readback?.ok ?? null,
      readbackReason: report.readback?.reason ?? null,
      views: report.snapshot.views.length,
      lights: report.snapshot.lights.length,
      sampleCount: report.readback?.samples?.length ?? 0,
      centerPixel:
        report.readback?.samples?.find((s) => s.id === "0.5-0.5")?.pixel ??
        null,
    },
    orbit: message.orbit ?? null,
    transforms: {
      azimuthBaseline: baseline?.orbit.azimuth ?? null,
      azimuthAfterOrbit: afterOrbit?.orbit.azimuth ?? null,
      distanceBaseline: baseline?.orbit.distance ?? null,
      distanceAfterOrbit: afterOrbit?.orbit.distance ?? null,
      distanceAfterZoom: afterZoom?.orbit.distance ?? null,
    },
    pixels: {
      orbitGridDelta: gridDelta(
        baseline?.samples ?? null,
        afterOrbit?.samples ?? null,
      ),
      zoomGridDelta: gridDelta(
        afterOrbit?.samples ?? null,
        afterZoom?.samples ?? null,
      ),
      coverageBaseline: coverage(baseline?.samples ?? null),
      coverageAfterZoom: coverage(afterZoom?.samples ?? null),
      baseline: baseline?.samples ?? null,
      afterOrbit: afterOrbit?.samples ?? null,
      afterZoom: afterZoom?.samples ?? null,
    },
    trace: orbitTrace,
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
