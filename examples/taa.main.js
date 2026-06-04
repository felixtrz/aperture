import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  registerTaaScene,
  taaCanvasSize,
  taaFrameCount,
} from "./taa-scene.js";

const rawCanvas = document.querySelector("#taa-canvas-raw");
const taaCanvas = document.querySelector("#taa-canvas-taa");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

// M3-T6: `?graph=1` routes the whole frame (forward + post, including TAA color
// history) through the single-encoder FrameGraph. Default OFF keeps the legacy
// multi-submit path, so the existing legacy proof is unaffected.
const useFrameGraph =
  new URLSearchParams(globalThis.location?.search ?? "").get("graph") === "1";

const baseStatus = {
  example: "taa",
  useFrameGraph,
  canvas: {
    raw: {
      width: rawCanvas?.width ?? 0,
      height: rawCanvas?.height ?? 0,
    },
    taa: {
      width: taaCanvas?.width ?? 0,
      height: taaCanvas?.height ?? 0,
    },
  },
};

let activeRuntime = null;

window.__APERTURE_TAA_STOP__ = disposeActiveRuntime;

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

  if (rawCanvas === null || taaCanvas === null) {
    publishStatus(failure("canvas-unavailable", "TAA canvases missing."));
  } else {
    const raw = await createTaaRuntime(aperture, rawCanvas, false);
    const taa = await createTaaRuntime(aperture, taaCanvas, true);

    if (!raw.created.ok) {
      publishStatus(failure(raw.created.reason, raw.created.message));
      disposeCreatedRuntime(taa.created);
    } else if (!taa.created.ok) {
      publishStatus(failure(taa.created.reason, taa.created.message));
      disposeCreatedRuntime(raw.created);
    } else {
      startWorkerSnapshotLoop(aperture, raw, taa);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "taa-failed",
      error instanceof Error ? error.message : "TAA example failed.",
    ),
  );
}

async function createTaaRuntime(aperture, canvas, enabled) {
  const sourceAssets = new aperture.AssetRegistry();
  const scene = registerTaaScene(aperture, sourceAssets);
  const postEffects = enabled
    ? [
        aperture.createWebGpuTaaPostEffect({ historyWeight: 0.92 }),
        aperture.createWebGpuCopyPostEffect({
          id: "taa-present",
          label: "TAA Present",
        }),
      ]
    : [];
  const created = await aperture.createWebGpuApp({
    canvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    postEffects,
    useFrameGraph,
  });

  return {
    taaEnabled: enabled,
    scene,
    created,
  };
}

function startWorkerSnapshotLoop(aperture, raw, taa) {
  const worker = new Worker("/worker-modules/examples/taa.worker.js", {
    name: "aperture-taa-simulation",
    type: "module",
  });
  const loop = {
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    lastWorkerStep: null,
    rawReport: null,
    taaReport: null,
  };

  activeRuntime = {
    raw: raw.created.app,
    taa: taa.created.app,
    worker,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, raw, taa, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The TAA worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: taaCanvasSize,
  });
}

async function handleWorkerMessage(aperture, raw, taa, worker, loop, message) {
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
        message.message ?? "The TAA worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;
  loop.lastWorkerStep = message.workerStep ?? null;

  loop.rawReport = await raw.created.app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "taa-raw",
  });
  loop.taaReport = await taa.created.app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "taa-temporal",
  });

  if ((message.frame ?? 1) < taaFrameCount) {
    worker.postMessage({ type: "frame", frame: (message.frame ?? 1) + 1 });
    return;
  }

  publishStatus(
    createTaaStatus({
      aperture,
      raw,
      taa,
      rawReport: loop.rawReport,
      taaReport: loop.taaReport,
      snapshot: loop.taaReport.snapshot,
      loop,
    }),
  );
  worker.terminate();
}

function createTaaStatus(input) {
  const rawFrame = frameStatus(input.rawReport);
  const taaFrame = frameStatus(input.taaReport);
  const diagnostics =
    input.snapshot.diagnostics.length +
    input.rawReport.diagnostics.length +
    input.taaReport.diagnostics.length;
  const taaEffects = input.taaReport.postEffects ?? [];
  const motionVectors = input.taaReport.motionVectors ?? null;
  const objectTransforms = motionVectors?.objectTransforms ?? null;

  return {
    ...baseStatus,
    ok:
      input.rawReport.ok === true &&
      input.taaReport.ok === true &&
      input.snapshot.meshDraws.length === 1 &&
      diagnostics === 0 &&
      motionVectors?.status === "scene-attachment" &&
      objectTransforms?.used > 0 &&
      objectTransforms?.available === true &&
      taaEffects.some((effect) => effect.effectId === "taa" && effect.ok),
    phase: "submit",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    scene: {
      meshKey: input.raw.scene.meshKey,
      materialKey: input.raw.scene.materialKey,
    },
    raw: rawFrame,
    taa: taaFrame,
    motionVectors,
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
      step: input.loop.lastWorkerStep,
    },
    diagnosticCounts: {
      extraction: input.snapshot.diagnostics.length,
      raw: input.rawReport.diagnostics.length,
      taa: input.taaReport.diagnostics.length,
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
    counts: report.counts,
    postEffects: report.postEffects ?? [],
    motionVectors: report.motionVectors ?? null,
    boundaries: report.boundaries?.length ?? 0,
    diagnosticCodes: report.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function disposeCreatedRuntime(created) {
  created.app?.stop?.();
}

function disposeActiveRuntime() {
  activeRuntime?.raw?.stop?.();
  activeRuntime?.taa?.stop?.();
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
