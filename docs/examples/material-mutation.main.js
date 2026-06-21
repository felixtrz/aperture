import { mirrorSourceAssetRegistryFromMessage } from "/aperture/packages/app/dist/asset-mirror.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.01, 0.018, 0.028, 1];
const samplePoint = { id: "center", x: 0.5, y: 0.5 };
const STOP_FRAME = 18;
const samples = [];

const baseStatus = {
  example: "material-mutation",
  scenario: "unlit-baseColor",
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
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
      "material-mutation-example-failed",
      error instanceof Error ? error.message : "The example failed.",
    ),
  );
}

function startWorkerLoop(aperture, app, sourceAssets) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/material-mutation.worker.js",
    { name: "aperture-material-mutation-simulation", type: "module" },
  );
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
    publishStatus(
      failure("worker-error", event.message || "Simulation worker error."),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: { width: canvas?.width ?? 256, height: canvas?.height ?? 256 },
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
    label: "material-mutation-app-route",
    readbackSamples: [samplePoint],
  });

  const centerSample = report.readback?.samples?.find(
    (sample) => sample.id === samplePoint.id,
  );
  if (centerSample !== undefined) {
    samples.push({
      frame: message.frame,
      mutated: message.mutated === true,
      pixel: centerSample.pixel,
    });
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
    const elapsedSeconds = (timestamp - loop.startedAt) / 1000;
    const deltaSeconds = Math.max(0, (timestamp - loop.lastTimestamp) / 1000);
    loop.lastTimestamp = timestamp;
    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      time: elapsedSeconds,
      delta: deltaSeconds,
    });
  });
}

function createStatus(report, message, loop) {
  const before = samples.find((sample) => !sample.mutated);
  const after = samples.filter((sample) => sample.mutated).at(-1);
  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "mutate" : "render",
    reason: report.ok ? undefined : "material-mutation-render-failed",
    renderingBackend: "webgpu-app-route",
    material: loop.scene ?? null,
    mutated: message.mutated === true,
    mutationVersion: message.mutationVersion ?? null,
    mirroredSourceAssets: loop.mirroredSourceAssets,
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    readback: report.readback,
    samples: [...samples],
    beforeSample: before ?? null,
    afterSample: after ?? null,
    diagnostics: report.diagnostics.length,
  };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ok" : "failed";
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return { ...baseStatus, ok: false, phase: reason, reason, message };
}
