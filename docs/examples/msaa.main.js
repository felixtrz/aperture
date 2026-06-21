import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { clearColor, msaaCanvasSize, registerMsaaScene } from "./msaa-scene.js";

const oneXCanvas = document.querySelector("#msaa-canvas-1x");
const eightXCanvas = document.querySelector("#msaa-canvas-8x");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "msaa",
  canvas: {
    oneX: {
      width: oneXCanvas?.width ?? 0,
      height: oneXCanvas?.height ?? 0,
    },
    eightX: {
      width: eightXCanvas?.width ?? 0,
      height: eightXCanvas?.height ?? 0,
    },
  },
};

let activeRuntime = null;

window.__APERTURE_MSAA_STOP__ = disposeActiveRuntime;

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

  if (oneXCanvas === null || eightXCanvas === null) {
    publishStatus(failure("canvas-unavailable", "MSAA canvases missing."));
  } else {
    const oneX = await createMsaaRuntime(aperture, oneXCanvas, 1);
    const eightX = await createMsaaRuntime(aperture, eightXCanvas, 8);

    if (!oneX.created.ok) {
      publishStatus(failure(oneX.created.reason, oneX.created.message));
      disposeCreatedRuntime(eightX.created);
    } else if (!eightX.created.ok) {
      publishStatus(failure(eightX.created.reason, eightX.created.message));
      disposeCreatedRuntime(oneX.created);
    } else {
      startWorkerSnapshotLoop(aperture, oneX, eightX);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "msaa-failed",
      error instanceof Error ? error.message : "MSAA example failed.",
    ),
  );
}

async function createMsaaRuntime(aperture, canvas, msaa) {
  const sourceAssets = new aperture.AssetRegistry();
  const scene = registerMsaaScene(aperture, sourceAssets);
  const created = await aperture.createWebGpuApp({
    canvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    msaa,
  });

  return {
    requestedMsaa: msaa,
    scene,
    created,
  };
}

function startWorkerSnapshotLoop(aperture, oneX, eightX) {
  const worker = new Worker("/aperture/worker-modules/examples/msaa.worker.js", {
    name: "aperture-msaa-simulation",
    type: "module",
  });
  const loop = {
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
  };

  activeRuntime = {
    oneX: oneX.created.app,
    eightX: eightX.created.app,
    worker,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, oneX, eightX, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The MSAA worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: msaaCanvasSize,
  });
}

async function handleWorkerMessage(
  aperture,
  oneX,
  eightX,
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
        message.message ?? "The MSAA worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;

  const oneXReport = await oneX.created.app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "msaa-1x",
  });
  const eightXReport = await eightX.created.app.renderSnapshot(
    message.snapshot,
    {
      frame: message.frame ?? 1,
      clearColor,
      label: "msaa-8x",
    },
  );

  publishStatus(
    createMsaaStatus({
      aperture,
      oneX,
      eightX,
      oneXReport,
      eightXReport,
      snapshot: oneXReport.snapshot,
      loop,
      workerStep: message.workerStep ?? null,
    }),
  );
  worker.terminate();
}

function createMsaaStatus(input) {
  const oneXFrame = frameStatus(input.oneXReport);
  const eightXFrame = frameStatus(input.eightXReport);
  const diagnostics =
    input.snapshot.diagnostics.length +
    input.oneXReport.diagnostics.length +
    input.eightXReport.diagnostics.length;

  return {
    ...baseStatus,
    ok:
      input.oneXReport.ok === true &&
      input.eightXReport.ok === true &&
      input.snapshot.meshDraws.length === 1 &&
      diagnostics === 0 &&
      oneXFrame.sampleCount === 1 &&
      eightXFrame.sampleCount === 4 &&
      eightXFrame.attachment.resolveTarget === true,
    phase: "submit",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    scene: {
      meshKey: input.oneX.scene.meshKey,
      materialKey: input.oneX.scene.materialKey,
    },
    oneX: oneXFrame,
    eightX: eightXFrame,
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
      oneX: input.oneXReport.diagnostics.length,
      eightX: input.eightXReport.diagnostics.length,
      total: diagnostics,
    },
  };
}

function frameStatus(report) {
  const attachment =
    report.boundaries?.[0]?.attachments?.plan?.colorAttachments?.[0];
  const renderTarget = report.renderTargets?.[0] ?? null;
  const msaa = report.msaa ?? {
    requestedSampleCount: 1,
    sampleCount: 1,
    enabled: false,
    clamped: false,
    supportedSampleCounts: [1, 4],
    colorTargets: 0,
    colorTexturesCreated: 0,
    colorTexturesReused: 0,
  };

  return {
    ok: report.ok,
    requestedSampleCount: msaa.requestedSampleCount,
    sampleCount: msaa.sampleCount,
    enabled: msaa.enabled,
    clamped: msaa.clamped,
    supportedSampleCounts: msaa.supportedSampleCounts,
    colorTargets: msaa.colorTargets,
    colorTexturesCreated: msaa.colorTexturesCreated,
    colorTexturesReused: msaa.colorTexturesReused,
    renderTarget: {
      width: renderTarget?.width ?? 0,
      height: renderTarget?.height ?? 0,
      drawCalls: renderTarget?.drawCalls ?? 0,
      msaaSampleCount: renderTarget?.msaaSampleCount ?? 1,
    },
    attachment: {
      storeOp: attachment?.storeOp ?? null,
      resolveTarget: attachment?.resolveTarget !== undefined,
    },
    counts: report.counts,
    diagnosticCodes: report.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function disposeCreatedRuntime(created) {
  created.app?.stop?.();
}

function disposeActiveRuntime() {
  activeRuntime?.oneX?.stop?.();
  activeRuntime?.eightX?.stop?.();
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
