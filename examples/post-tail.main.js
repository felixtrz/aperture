import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { registerPostTailScene } from "./post-tail-scene.js";

const canvases = {
  raw: document.querySelector("#post-tail-canvas-raw"),
  mb: document.querySelector("#post-tail-canvas-mb"),
  lut: document.querySelector("#post-tail-canvas-lut"),
  outline: document.querySelector("#post-tail-canvas-outline"),
};
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.03, 0.03, 0.05, 1];
const canvasSize = { width: 256, height: 256 };
const FRAMES = 5;
const OUTLINE_COLOR = [1, 0.5, 0.05];
const LUT_SIZE = 16;

const baseStatus = {
  example: "post-tail",
  canvas: {
    raw: { width: canvases.raw?.width ?? 0, height: canvases.raw?.height ?? 0 },
  },
};

let runtime = null;

window.__APERTURE_POST_TAIL_STOP__ = disposeRuntime;

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

  if (Object.values(canvases).some((canvas) => canvas === null)) {
    publishStatus(failure("canvas-unavailable", "Post-tail canvases missing."));
  } else {
    const apps = {
      raw: await createRuntime(aperture, canvases.raw, []),
      mb: await createRuntime(aperture, canvases.mb, [
        aperture.createWebGpuMotionBlurPostEffect({
          intensity: 1.6,
          samples: 16,
          maxVelocity: 0.2,
        }),
      ]),
      lut: await createRuntime(aperture, canvases.lut, [
        aperture.createWebGpuLutColorGradePostEffect({
          size: LUT_SIZE,
          data: buildCoolLut(LUT_SIZE),
          intensity: 1,
        }),
      ]),
      outline: await createRuntime(aperture, canvases.outline, [
        aperture.createWebGpuOutlinePostEffect({
          color: OUTLINE_COLOR,
          thickness: 3,
          opacity: 1,
          fillOpacity: 0,
        }),
      ]),
    };

    const failed = Object.entries(apps).find(([, entry]) => !entry.created.ok);
    if (failed !== undefined) {
      publishStatus(
        failure(failed[1].created.reason, failed[1].created.message),
      );
      for (const [, entry] of Object.entries(apps)) {
        entry.created.app?.stop?.();
      }
    } else {
      startWorkerLoop(aperture, apps);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "post-tail-failed",
      error instanceof Error ? error.message : "Post-tail example failed.",
    ),
  );
}

async function createRuntime(aperture, canvas, postEffects) {
  const sourceAssets = new aperture.AssetRegistry();
  registerPostTailScene(aperture, sourceAssets);
  const created = await aperture.createWebGpuApp({
    canvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    postEffects,
  });
  return { created };
}

function startWorkerLoop(aperture, apps) {
  const worker = new Worker("/worker-modules/examples/post-tail.worker.js", {
    name: "aperture-post-tail-simulation",
    type: "module",
  });
  const loop = {
    workerReady: false,
    workerScene: null,
    receivedSnapshots: 0,
    targetEntity: null,
    lastSnapshot: null,
    reports: { raw: null, mb: null, lut: null, outline: null },
    outlineSelected: true,
  };

  runtime = { apps, worker, loop, aperture };

  window.__APERTURE_POST_TAIL_SET_OUTLINE__ = (enabled) => {
    void applyOutlineSelection(aperture, apps, loop, enabled === true);
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, apps, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The post-tail worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({ type: "init", canvas: canvasSize });
}

async function handleWorkerMessage(aperture, apps, worker, loop, message) {
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
        message.message ?? "The post-tail worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;
  const snapshot = message.snapshot;
  loop.lastSnapshot = snapshot;

  // AC2: capture the target box entity from the first snapshot and select it on
  // the outline app so its silhouette outline appears.
  if (loop.targetEntity === null && loop.workerScene !== null) {
    const targetDraw = snapshot.meshDraws.find(
      (draw) =>
        aperture.assetHandleKey(draw.material) ===
        loop.workerScene.targetMaterialKey,
    );
    if (targetDraw !== undefined) {
      loop.targetEntity = targetDraw.entity;
      apps.outline.created.app.setOutlineSelection([targetDraw.entity]);
    }
  }

  const frame = message.frame ?? 1;
  loop.reports.raw = await apps.raw.created.app.renderSnapshot(snapshot, {
    frame,
    clearColor,
    label: "post-tail-raw",
  });
  loop.reports.mb = await apps.mb.created.app.renderSnapshot(snapshot, {
    frame,
    clearColor,
    label: "post-tail-mb",
  });
  loop.reports.lut = await apps.lut.created.app.renderSnapshot(snapshot, {
    frame,
    clearColor,
    label: "post-tail-lut",
  });
  loop.reports.outline = await apps.outline.created.app.renderSnapshot(
    snapshot,
    { frame, clearColor, label: "post-tail-outline" },
  );

  if (frame < FRAMES) {
    worker.postMessage({ type: "frame", frame: frame + 1 });
    return;
  }

  worker.terminate();
  publishStatus(createStatus(loop));
}

// Toggle the outline selection and re-render the last snapshot so the e2e can
// screenshot the outline appearing (selected) and disappearing (deselected).
async function applyOutlineSelection(aperture, apps, loop, enabled) {
  if (loop.lastSnapshot === null) {
    return;
  }
  if (enabled && loop.targetEntity !== null) {
    apps.outline.created.app.setOutlineSelection([loop.targetEntity]);
  } else {
    apps.outline.created.app.setOutlineSelection([]);
  }
  loop.outlineSelected = enabled;
  loop.reports.outline = await apps.outline.created.app.renderSnapshot(
    loop.lastSnapshot,
    { frame: FRAMES, clearColor, label: "post-tail-outline-toggle" },
  );
  publishStatus(createStatus(loop));
}

function createStatus(loop) {
  const reports = loop.reports;
  const outlineEffects = reports.outline?.postEffects ?? [];
  const mbEffects = reports.mb?.postEffects ?? [];
  const lutEffects = reports.lut?.postEffects ?? [];
  const diagnostics =
    (reports.raw?.diagnostics.length ?? 0) +
    (reports.mb?.diagnostics.length ?? 0) +
    (reports.lut?.diagnostics.length ?? 0) +
    (reports.outline?.diagnostics.length ?? 0);

  return {
    ...baseStatus,
    ok:
      reports.raw?.ok === true &&
      reports.mb?.ok === true &&
      reports.lut?.ok === true &&
      reports.outline?.ok === true &&
      diagnostics === 0 &&
      mbEffects.some(
        (effect) => effect.effectId === "motion-blur" && effect.ok,
      ) &&
      lutEffects.some((effect) => effect.effectId === "lut" && effect.ok) &&
      outlineEffects.some(
        (effect) => effect.effectId === "outline" && effect.ok,
      ),
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    frames: loop.receivedSnapshots,
    worker: { running: loop.workerReady, scene: loop.workerScene },
    outlineSelected: loop.outlineSelected,
    selection: {
      hasTarget: loop.targetEntity !== null,
      count: reports.outline?.outline?.selection ?? 0,
    },
    raw: frameStatus(reports.raw),
    mb: frameStatus(reports.mb),
    lut: frameStatus(reports.lut),
    outline: frameStatus(reports.outline),
    diagnosticCounts: { total: diagnostics },
  };
}

function frameStatus(report) {
  if (report === null || report === undefined) {
    return null;
  }
  return {
    ok: report.ok,
    postEffects: report.postEffects ?? [],
    motionVectors: report.motionVectors
      ? { status: report.motionVectors.status }
      : null,
    outline: report.outline ?? null,
    boundaries: report.boundaries?.length ?? 0,
    diagnosticCodes: report.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

// A cool/blue color grade LUT strip (N slices of an N x N red/green tile). Shifts
// scene color toward blue so the LUT remap is unmistakable against the raw pass.
function buildCoolLut(size) {
  const max = size - 1;
  const data = new Array(size * size * size * 4);
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const x = b * size + r;
        const offset = (g * (size * size) + x) * 4;
        const cr = r / max;
        const cg = g / max;
        const cb = b / max;
        data[offset] = Math.round(clamp01(cr * 0.55) * 255);
        data[offset + 1] = Math.round(clamp01(cg * 0.75) * 255);
        data[offset + 2] = Math.round(clamp01(cb * 1.1 + 0.22) * 255);
        data[offset + 3] = 255;
      }
    }
  }
  return data;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function disposeRuntime() {
  if (runtime === null) {
    return;
  }
  for (const entry of Object.values(runtime.apps)) {
    entry.created.app?.stop?.();
  }
  runtime.worker?.terminate?.();
  runtime = null;
}

function failure(reason, message, extra = {}) {
  return { ...baseStatus, ok: false, reason, message, ...extra };
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
