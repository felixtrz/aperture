// M5-T6 proof: SSAO attenuates only indirect (ambient/IBL) light, not direct or
// emissive. Runs with MSAA off so the lit pass emits its indirect color channel;
// the SSAO effect then removes only indirect * (1 - visibility). `?ssao=on|off`
// toggles the effect; the spec compares the two: a diffuse floor/wall crease
// darkens (indirect attenuated) while the emissive cube — also in a high-AO
// pocket — is preserved (the old whole-image multiply would have darkened it).

import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { registerSsaoIndirectScene } from "./ssao-indirect-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.05, 0.06, 0.075, 1];
const readbackSamples = [
  { id: "cube-face", x: 0.46, y: 0.52 },
  { id: "crease", x: 0.46, y: 0.62 },
  { id: "crease-left", x: 0.4, y: 0.58 },
  { id: "corner", x: 0.33, y: 0.5 },
  { id: "open-floor", x: 0.66, y: 0.84 },
];
const searchParams = new URLSearchParams(window.location.search);

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "ssao-indirect",
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

await startScenario(searchParams.get("ssao") !== "off");

async function startScenario(ssaoEnabled) {
  const generation = runtimeGeneration + 1;

  runtimeGeneration = generation;
  disposeActiveRuntime();
  publishStatus({
    ...baseStatus,
    ok: false,
    phase: "loading",
    ssao: ssaoStatus(ssaoEnabled),
    reason: "ssao-indirect-loading",
    message: "Preparing SSAO indirect scene.",
  });

  try {
    const aperture = await loadAperture();

    if (generation !== runtimeGeneration) {
      return;
    }

    if (canvas === null) {
      publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
      return;
    }

    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const scene = registerSsaoIndirectScene(aperture, sourceAssets);
    const postEffects = ssaoEnabled
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
      // MSAA off so the lit pass can emit the indirect color channel that
      // SSAO consumes (the second attachment has no MSAA resolve).
      msaa: 1,
      postEffects,
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (generation !== runtimeGeneration) {
      created.app?.stop();
      return;
    }

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
        ssao: ssaoStatus(ssaoEnabled),
      });
      return;
    }

    startWorkerSnapshotLoop(
      aperture,
      created.app,
      scene,
      ssaoEnabled,
      readbackUsage,
      generation,
    );
  } catch (error) {
    if (generation === runtimeGeneration) {
      publishStatus(
        failure(
          "runtime",
          "ssao-indirect-failed",
          error instanceof Error
            ? error.message
            : "The ssao-indirect example could not start.",
        ),
      );
    }
  }
}

function loadAperture() {
  aperturePromise ??= Promise.all([
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
  ]).then(([core, webgpu]) => ({ ...core, ...webgpu }));

  return aperturePromise;
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  ssaoEnabled,
  readbackUsage,
  generation,
) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/ssao-indirect.worker.js",
    {
      name: "aperture-ssao-indirect-simulation",
      type: "module",
    },
  );
  const loop = { frame: 0, receivedSnapshots: 0, workerReady: false };

  activeRuntime = { app, worker };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      scene,
      worker,
      loop,
      event.data,
      ssaoEnabled,
      readbackUsage,
      generation,
    );
  });
  worker.addEventListener("error", (event) => {
    if (generation !== runtimeGeneration) {
      return;
    }

    publishStatus(
      failure(
        "worker",
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: { width: canvas?.width ?? 512, height: canvas?.height ?? 512 },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
  ssaoEnabled,
  readbackUsage,
  generation,
) {
  if (generation !== runtimeGeneration) {
    return;
  }

  if (message?.type === "ready") {
    loop.workerReady = true;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        "worker",
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
    label: `ssao-indirect-${ssaoEnabled ? "on" : "off"}`,
    ...(readbackUsage.ok ? { readbackSamples } : {}),
  });

  if (generation !== runtimeGeneration) {
    return;
  }

  const status = createFrameStatus({
    aperture,
    app,
    scene,
    report,
    loop,
    ssaoEnabled,
    readbackUsage,
  });

  publishStatus(status);

  if (status.ok) {
    worker.terminate();

    if (activeRuntime?.worker === worker) {
      activeRuntime = { app, worker: null };
    }
  } else {
    worker.terminate();
  }
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame(() => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({ type: "frame", frame: loop.frame });
  });
}

function createFrameStatus(options) {
  const { app, report, loop, ssaoEnabled, readbackUsage } = options;
  const snapshot = report.snapshot;
  const standardDraw = snapshot.meshDraws.find((draw) =>
    draw.batchKey.pipelineKey.startsWith("standard"),
  );
  const resources = report.resources?.resources ?? null;
  const reason = firstFailureReason(report, snapshot, resources);

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    ...(reason === null ? {} : reason),
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: app.initialization.format,
    ssao: ssaoStatus(ssaoEnabled),
    extraction: {
      frame: snapshot.frame,
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
    pipeline: {
      key: standardDraw?.batchKey.pipelineKey ?? null,
      cacheKey: report.pipeline?.resource?.cacheKey ?? null,
    },
    postEffects: (report.postEffects ?? []).map((effect) => ({
      effectId: effect.effectId,
      ok: effect.ok,
      output: effect.output,
    })),
    readback:
      report.readback ??
      (readbackUsage.ok
        ? {
            ok: false,
            reason: "readback-unavailable",
            message:
              "The ssao-indirect frame did not produce readback samples.",
          }
        : readbackUsage),
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
    },
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      render: report.diagnostics.length,
      total: snapshot.diagnostics.length + report.diagnostics.length,
    },
    diagnostics: report.diagnostics.map(diagnosticToJson),
  };
}

function ssaoStatus(ssaoEnabled) {
  return {
    enabled: ssaoEnabled,
    // With MSAA off and the standard material, an enabled SSAO effect consumes
    // the lit pass's indirect channel and applies only to indirect light.
    appliesTo: ssaoEnabled ? "indirect" : "none",
    msaaSampleCount: 1,
  };
}

function firstFailureReason(report, snapshot, resources) {
  if (report.ok) {
    return null;
  }

  if (snapshot.meshDraws.length === 0) {
    return {
      reason: "empty-snapshot",
      message: "The ssao-indirect scene did not extract drawable meshes.",
    };
  }

  if (resources === null) {
    return {
      reason: "standard-resources-unavailable",
      message: "The ssao-indirect standard material resources failed.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The ssao-indirect frame could not be rendered.",
  };
}

function diagnosticToJson(diagnostic) {
  if (diagnostic === null || typeof diagnostic !== "object") {
    return { code: "unknown", message: String(diagnostic) };
  }

  return {
    code: typeof diagnostic.code === "string" ? diagnostic.code : "unknown",
    message:
      typeof diagnostic.message === "string"
        ? diagnostic.message
        : JSON.stringify(diagnostic),
    ...(typeof diagnostic.severity === "string"
      ? { severity: diagnostic.severity }
      : {}),
  };
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok
      ? `ssao ${status.ssao?.enabled ? "on" : "off"}`
      : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function disposeActiveRuntime() {
  const runtime = activeRuntime;

  activeRuntime = null;

  runtime?.app?.stop();
  runtime?.app?.initialization.context?.unconfigure?.();
  runtime?.app?.initialization.device?.destroy?.();
  runtime?.worker?.terminate?.();
}
