import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { registerSsaoScene } from "./ssao-scene.js";

const rawCanvas = document.querySelector("#ssr-canvas-raw");
const ssrCanvas = document.querySelector("#ssr-canvas-ssr");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.05, 0.06, 0.075, 1];
const canvasSize = { width: 512, height: 512 };

const baseStatus = {
  example: "ssr",
  canvas: {
    raw: {
      width: rawCanvas?.width ?? 0,
      height: rawCanvas?.height ?? 0,
    },
    ssr: {
      width: ssrCanvas?.width ?? 0,
      height: ssrCanvas?.height ?? 0,
    },
  },
};

let activeRuntime = null;

window.__APERTURE_SSR_STOP__ = disposeActiveRuntime;

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

  if (rawCanvas === null || ssrCanvas === null) {
    publishStatus(failure("canvas-unavailable", "SSR canvases missing."));
  } else {
    const raw = await createSsrRuntime(aperture, rawCanvas, false);
    const ssr = await createSsrRuntime(aperture, ssrCanvas, true);

    if (!raw.created.ok) {
      publishStatus(failure(raw.created.reason, raw.created.message));
      disposeCreatedRuntime(ssr.created);
    } else if (!ssr.created.ok) {
      publishStatus(failure(ssr.created.reason, ssr.created.message));
      disposeCreatedRuntime(raw.created);
    } else {
      startWorkerSnapshotLoop(aperture, raw, ssr);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "ssr-failed",
      error instanceof Error ? error.message : "SSR example failed.",
    ),
  );
}

async function createSsrRuntime(aperture, canvas, enabled) {
  const sourceAssets = new aperture.AssetRegistry();
  const scene = registerSsaoScene(aperture, sourceAssets);
  const postEffects = enabled
    ? [
        aperture.createWebGpuSsrPostEffect({
          opacity: 0.82,
          maxSteps: 48,
          stridePixels: 2.5,
          thickness: 0.16,
          near: 0.1,
          far: 40,
          fovYRadians: Math.PI / 3,
          maxDistance: 9,
          fresnel: true,
          distanceAttenuation: true,
          reflectionBlurPixels: 1.5,
          fallbackOpacity: 0.2,
        }),
      ]
    : [];
  const created = await aperture.createWebGpuApp({
    canvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    postEffects,
  });

  return {
    ssrEnabled: enabled,
    scene,
    created,
  };
}

function startWorkerSnapshotLoop(aperture, raw, ssr) {
  const worker = new Worker("/aperture/worker-modules/examples/ssao.worker.js", {
    name: "aperture-ssr-simulation",
    type: "module",
  });
  const loop = {
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    rawReport: null,
    ssrReport: null,
  };

  activeRuntime = {
    raw: raw.created.app,
    ssr: ssr.created.app,
    worker,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, raw, ssr, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The SSR worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: canvasSize,
  });
}

async function handleWorkerMessage(aperture, raw, ssr, worker, loop, message) {
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
        message.message ?? "The SSR worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;
  loop.rawReport = await raw.created.app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "ssr-raw",
  });
  loop.ssrReport = await ssr.created.app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "ssr-enabled",
  });

  publishStatus(
    createSsrStatus({
      aperture,
      rawReport: loop.rawReport,
      ssrReport: loop.ssrReport,
      snapshot: loop.ssrReport.snapshot,
      loop,
      workerStep: message.workerStep ?? null,
    }),
  );
  worker.terminate();
}

function createSsrStatus(input) {
  const rawFrame = frameStatus(input.rawReport);
  const ssrFrame = frameStatus(input.ssrReport);
  const diagnostics =
    input.snapshot.diagnostics.length +
    input.rawReport.diagnostics.length +
    input.ssrReport.diagnostics.length;
  const ssrEffects = input.ssrReport.postEffects ?? [];

  return {
    ...baseStatus,
    ok:
      input.rawReport.ok === true &&
      input.ssrReport.ok === true &&
      input.snapshot.meshDraws.length >= 4 &&
      diagnostics === 0 &&
      ssrEffects.some((effect) => effect.effectId === "ssr" && effect.ok),
    phase: "submit",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    raw: rawFrame,
    ssr: ssrFrame,
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
    diagnosticCounts: {
      extraction: input.snapshot.diagnostics.length,
      raw: input.rawReport.diagnostics.length,
      ssr: input.ssrReport.diagnostics.length,
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
    },
    depthAttachment: report.depthAttachment ?? null,
    counts: report.counts,
    postEffects: report.postEffects ?? [],
    boundaries: report.boundaries?.length ?? 0,
    diagnosticCodes: report.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function disposeCreatedRuntime(created) {
  created.app?.stop?.();
}

function disposeActiveRuntime() {
  activeRuntime?.raw?.stop?.();
  activeRuntime?.ssr?.stop?.();
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
