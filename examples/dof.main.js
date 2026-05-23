import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { dofCanvasSize, dofClearColor, registerDofScene } from "./dof-scene.js";

const rawCanvas = document.querySelector("#dof-canvas-raw");
const dofCanvas = document.querySelector("#dof-canvas-dof");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "dof",
  canvas: {
    raw: {
      width: rawCanvas?.width ?? 0,
      height: rawCanvas?.height ?? 0,
    },
    dof: {
      width: dofCanvas?.width ?? 0,
      height: dofCanvas?.height ?? 0,
    },
  },
};

let activeRuntime = null;

window.__APERTURE_DOF_STOP__ = disposeActiveRuntime;

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (rawCanvas === null || dofCanvas === null) {
    publishStatus(failure("canvas-unavailable", "DOF canvases missing."));
  } else {
    const raw = await createDofRuntime(aperture, rawCanvas, false);
    const dof = await createDofRuntime(aperture, dofCanvas, true);

    if (!raw.created.ok) {
      publishStatus(failure(raw.created.reason, raw.created.message));
      disposeCreatedRuntime(dof.created);
    } else if (!dof.created.ok) {
      publishStatus(failure(dof.created.reason, dof.created.message));
      disposeCreatedRuntime(raw.created);
    } else {
      startWorkerSnapshotLoop(aperture, raw, dof);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "dof-failed",
      error instanceof Error ? error.message : "DOF example failed.",
    ),
  );
}

async function createDofRuntime(aperture, canvas, enabled) {
  const sourceAssets = new aperture.AssetRegistry();
  const scene = registerDofScene(aperture, sourceAssets);
  const postEffects = enabled
    ? [
        aperture.createWebGpuDofPostEffect({
          near: 0.1,
          far: 20,
          focusDistance: 3.2,
          focusRange: 0.55,
          aperture: 1.55,
          maxBlurPixels: 18,
          nearBlur: false,
          blurRings: 4,
          blurRingPoints: 4,
          farBlurScale: 0.75,
          nearBlurScale: 1,
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
    dofEnabled: enabled,
    scene,
    created,
  };
}

function startWorkerSnapshotLoop(aperture, raw, dof) {
  const worker = new Worker("/worker-modules/examples/dof.worker.js", {
    name: "aperture-dof-simulation",
    type: "module",
  });
  const loop = {
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    rawReport: null,
    dofReport: null,
  };

  activeRuntime = {
    raw: raw.created.app,
    dof: dof.created.app,
    worker,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, raw, dof, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The DOF worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: dofCanvasSize,
  });
}

async function handleWorkerMessage(aperture, raw, dof, worker, loop, message) {
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
        message.message ?? "The DOF worker failed.",
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
    clearColor: dofClearColor,
    label: "dof-raw",
  });
  loop.dofReport = await dof.created.app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor: dofClearColor,
    label: "dof-enabled",
  });

  publishStatus(
    createDofStatus({
      aperture,
      rawReport: loop.rawReport,
      dofReport: loop.dofReport,
      snapshot: loop.dofReport.snapshot,
      loop,
      workerStep: message.workerStep ?? null,
    }),
  );
  worker.terminate();
}

function createDofStatus(input) {
  const rawFrame = frameStatus(input.rawReport);
  const dofFrame = frameStatus(input.dofReport);
  const diagnostics =
    input.snapshot.diagnostics.length +
    input.rawReport.diagnostics.length +
    input.dofReport.diagnostics.length;
  const dofEffects = input.dofReport.postEffects ?? [];

  return {
    ...baseStatus,
    ok:
      input.rawReport.ok === true &&
      input.dofReport.ok === true &&
      input.snapshot.meshDraws.length === 32 &&
      diagnostics === 0 &&
      dofEffects.some((effect) => effect.effectId === "dof" && effect.ok),
    phase: "submit",
    apertureVersion: input.aperture.APERTURE_VERSION,
    renderingBackend: input.aperture.APERTURE_IDENTITY.renderingBackend,
    raw: rawFrame,
    dof: dofFrame,
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
      dof: input.dofReport.diagnostics.length,
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
  activeRuntime?.dof?.stop?.();
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
