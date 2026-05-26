import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { registerSsaoScene } from "./ssao-scene.js";

const rawCanvas = document.querySelector("#ssao-canvas-raw");
const ssaoCanvas = document.querySelector("#ssao-canvas-ssao");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.05, 0.06, 0.075, 1];
const canvasSize = { width: 512, height: 512 };
const readbackSamples = [
  { id: "cube-contact", x: 0.5, y: 0.58 },
  { id: "left-corner", x: 0.38, y: 0.6 },
  { id: "right-corner", x: 0.62, y: 0.6 },
  { id: "open-floor", x: 0.5, y: 0.76 },
  { id: "back-wall", x: 0.5, y: 0.34 },
];

const baseStatus = {
  example: "ssao",
  canvas: {
    raw: {
      width: rawCanvas?.width ?? 0,
      height: rawCanvas?.height ?? 0,
    },
    ssao: {
      width: ssaoCanvas?.width ?? 0,
      height: ssaoCanvas?.height ?? 0,
    },
  },
};

let activeRuntime = null;

window.__APERTURE_SSAO_STOP__ = disposeActiveRuntime;

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

  if (rawCanvas === null || ssaoCanvas === null) {
    publishStatus(failure("canvas-unavailable", "SSAO canvases missing."));
  } else {
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const raw = await createSsaoRuntime(
      aperture,
      rawCanvas,
      false,
      readbackUsage,
    );
    const ssao = await createSsaoRuntime(
      aperture,
      ssaoCanvas,
      true,
      readbackUsage,
    );

    if (!raw.created.ok) {
      publishStatus(failure(raw.created.reason, raw.created.message));
      disposeCreatedRuntime(ssao.created);
    } else if (!ssao.created.ok) {
      publishStatus(failure(ssao.created.reason, ssao.created.message));
      disposeCreatedRuntime(raw.created);
    } else {
      startWorkerSnapshotLoop(aperture, raw, ssao, readbackUsage);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "ssao-failed",
      error instanceof Error ? error.message : "SSAO example failed.",
    ),
  );
}

async function createSsaoRuntime(aperture, canvas, enabled, readbackUsage) {
  const sourceAssets = new aperture.AssetRegistry();
  const scene = registerSsaoScene(aperture, sourceAssets);
  const postEffects = enabled
    ? [
        aperture.createWebGpuSsaoPostEffect({
          near: 0.1,
          far: 40,
          fovYRadians: Math.PI / 3,
          radiusPixels: 18,
          sampleCount: 18,
          minAngleDegrees: 5,
          intensity: 2.8,
          power: 1.15,
          depthBias: 0.0004,
          maxDepthDifference: 0.18,
        }),
      ]
    : [];
  const created = await aperture.createWebGpuApp({
    canvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    msaa: enabled ? 8 : 1,
    postEffects,
    ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
  });

  return {
    ssaoEnabled: enabled,
    scene,
    created,
  };
}

function startWorkerSnapshotLoop(aperture, raw, ssao, readbackUsage) {
  const worker = new Worker("/worker-modules/examples/ssao.worker.js", {
    name: "aperture-ssao-simulation",
    type: "module",
  });
  const loop = {
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    rawReport: null,
    ssaoReport: null,
  };

  activeRuntime = {
    raw: raw.created.app,
    ssao: ssao.created.app,
    worker,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      raw,
      ssao,
      readbackUsage,
      worker,
      loop,
      event.data,
    );
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The SSAO worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: canvasSize,
  });
}

async function handleWorkerMessage(
  aperture,
  raw,
  ssao,
  readbackUsage,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    worker.postMessage({ type: "frame", frame: 1 });
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        message.reason ?? "worker-error",
        message.message ?? "The SSAO worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;

  const readbackOptions = readbackUsage.ok ? { readbackSamples } : {};
  loop.rawReport = await raw.created.app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "ssao-raw",
    ...readbackOptions,
  });
  loop.ssaoReport = await ssao.created.app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "ssao-enabled",
    ...readbackOptions,
  });

  publishStatus(
    createSsaoStatus({
      aperture,
      rawReport: loop.rawReport,
      ssaoReport: loop.ssaoReport,
      snapshot: loop.ssaoReport.snapshot,
      loop,
      readbackUsage,
      workerStep: message.workerStep ?? null,
    }),
  );
  worker.terminate();
}

function createSsaoStatus(input) {
  const rawFrame = frameStatus(input.rawReport);
  const ssaoFrame = frameStatus(input.ssaoReport);
  const comparison = compareReadbackSamples(
    input.rawReport.readback,
    input.ssaoReport.readback,
  );
  const diagnostics =
    input.snapshot.diagnostics.length +
    input.rawReport.diagnostics.length +
    input.ssaoReport.diagnostics.length;
  const ssaoEffects = input.ssaoReport.postEffects ?? [];

  return {
    ...baseStatus,
    ok:
      input.rawReport.ok === true &&
      input.ssaoReport.ok === true &&
      input.snapshot.meshDraws.length >= 4 &&
      diagnostics === 0 &&
      ssaoEffects.some((effect) => effect.effectId === "ssao" && effect.ok),
    phase: "submit",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    raw: rawFrame,
    ssao: ssaoFrame,
    comparison,
    extraction: {
      frame: input.snapshot.frame,
      views: input.snapshot.views.length,
      meshDraws: input.snapshot.meshDraws.length,
      diagnostics: input.snapshot.diagnostics.length,
    },
    worker: {
      running: input.loop.workerReady,
      snapshotsReceived: input.loop.receivedSnapshots,
      scene: input.loop.workerScene,
      step: input.workerStep,
    },
    readbackUsage: input.readbackUsage,
    diagnosticCounts: {
      extraction: input.snapshot.diagnostics.length,
      raw: input.rawReport.diagnostics.length,
      ssao: input.ssaoReport.diagnostics.length,
      total: diagnostics,
    },
  };
}

function frameStatus(report) {
  const renderTarget = report.renderTargets?.[0] ?? null;

  return {
    ok: report.ok,
    renderTarget: {
      width: renderTarget?.width ?? 0,
      height: renderTarget?.height ?? 0,
      drawCalls: renderTarget?.drawCalls ?? 0,
      msaaSampleCount: renderTarget?.msaaSampleCount ?? 1,
    },
    msaa: report.msaa ?? {
      requestedSampleCount: 1,
      sampleCount: 1,
      enabled: false,
      clamped: false,
      supportedSampleCounts: [1, 4],
      colorTargets: 0,
      colorTexturesCreated: 0,
      colorTexturesReused: 0,
    },
    depthAttachment: report.depthAttachment ?? null,
    counts: report.counts,
    postEffects: report.postEffects ?? [],
    boundaries: report.boundaries?.length ?? 0,
    readback: report.readback ?? null,
    diagnosticCodes: report.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function compareReadbackSamples(rawReadback, ssaoReadback) {
  if (rawReadback?.ok !== true || ssaoReadback?.ok !== true) {
    return {
      readbackAvailable: false,
      darkenedSamples: [],
      samples: [],
    };
  }

  const ssaoSamples = new Map(
    ssaoReadback.samples.map((sample) => [sample.id, sample]),
  );
  const samples = [];

  for (const rawSample of rawReadback.samples) {
    const ssaoSample = ssaoSamples.get(rawSample.id);

    if (ssaoSample === undefined) {
      continue;
    }

    const rawLuma = luma(rawSample.pixel);
    const ssaoLuma = luma(ssaoSample.pixel);
    const lumaDelta = rawLuma - ssaoLuma;

    samples.push({
      id: rawSample.id,
      raw: rawSample.pixel,
      ssao: ssaoSample.pixel,
      rawLuma,
      ssaoLuma,
      lumaDelta,
    });
  }

  return {
    readbackAvailable: true,
    darkenedSamples: samples
      .filter((sample) => sample.lumaDelta >= 4)
      .map((sample) => sample.id),
    samples,
  };
}

function luma(pixel) {
  return 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;
}

function disposeCreatedRuntime(created) {
  created.app?.stop?.();
}

function disposeActiveRuntime() {
  activeRuntime?.raw?.stop?.();
  activeRuntime?.ssao?.stop?.();
  activeRuntime?.worker?.terminate?.();
  activeRuntime = null;
}

function failure(reason, message, extra = {}) {
  return {
    ...baseStatus,
    ok: false,
    reason,
    message,
    ...extra,
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
