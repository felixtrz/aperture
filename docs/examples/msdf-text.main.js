import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  backgrounds,
  readbackSamples,
  registerMsdfTextScene,
  textProofs,
} from "./msdf-text-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "msdf-text",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
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
      const scene = registerMsdfTextScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "msdf-text-failed",
      error instanceof Error ? error.message : "MSDF text example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker("/aperture/worker-modules/examples/msdf-text.worker.js", {
    name: "aperture-msdf-text-simulation",
    type: "module",
  });
  const loop = {
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    frames: [],
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, scene, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    worker.postMessage({ type: "frame", frame: 1, background: "dark" });
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
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

  const background = message.background === "light" ? "light" : "dark";
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor: backgrounds[background].clearColor,
    label: `msdf-text-${background}`,
    readbackSamples,
  });
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  loop.frames.push({
    background,
    clearColor: backgrounds[background].clearColor,
    workerStep: message.workerStep,
    snapshot: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      spriteDraws: report.snapshot.spriteDraws?.length ?? 0,
      quadInstances:
        (report.snapshot.quads?.instanceFloats.length ?? 0) /
        (report.snapshot.quads?.instanceFloatStride ?? 1),
      quadBatches: report.snapshot.quadBatches?.length ?? 0,
      diagnostics: report.snapshot.diagnostics.length,
    },
    glyphColors: sampleGlyphColors(report.snapshot),
    counts: reportJson.counts,
    readback: reportJson.readback,
    diagnosticCodes: reportJson.diagnostics.map(
      (diagnostic) => diagnostic.code,
    ),
    transport: {
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
  });

  if (background === "dark") {
    worker.postMessage({ type: "frame", frame: 2, background: "light" });
    return;
  }

  publishStatus(createMsdfTextStatus(scene, loop, reportJson.diagnostics));
  worker.terminate();
}

function sampleGlyphColors(snapshot) {
  const quads = snapshot.quads;

  if (quads === undefined) {
    return [];
  }

  const instanceCount = quads.instanceFloats.length / quads.instanceFloatStride;
  const sampleIndices = [0, Math.max(0, instanceCount - 1)];

  return sampleIndices.map((instance) => {
    const offset = instance * quads.instanceFloatStride + 13;

    return {
      instance,
      color: Array.from(quads.instanceFloats.slice(offset, offset + 4)),
    };
  });
}

function createMsdfTextStatus(scene, loop, diagnostics) {
  const dark = loop.frames.find((frame) => frame.background === "dark") ?? null;
  const light =
    loop.frames.find((frame) => frame.background === "light") ?? null;
  const expectedGlyphs = scene.glyphCount;
  const expectedBatches = textProofs.length;

  return {
    ...baseStatus,
    ok:
      dark?.counts?.quadInstances === expectedGlyphs &&
      light?.counts?.quadInstances === expectedGlyphs &&
      dark?.counts?.quadBatches === expectedBatches &&
      light?.counts?.quadBatches === expectedBatches &&
      dark?.counts?.drawCalls === expectedBatches &&
      light?.counts?.drawCalls === expectedBatches,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    text: {
      textureKey: scene.textureKey,
      samplerKey: scene.samplerKey,
      glyphCount: expectedGlyphs,
      batches: expectedBatches,
      proofs: scene.proofs,
      samples: scene.samples,
    },
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
    },
    frames: loop.frames,
    diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
  };
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
