import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  contentShowcaseClearColor,
  contentShowcasePointer,
  contentShowcaseReadbackSamples,
  registerContentShowcaseScene,
} from "./content-showcase-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "content-showcase",
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
      const scene = registerContentShowcaseScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "content-showcase-failed",
      error instanceof Error
        ? error.message
        : "Content showcase example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/content-showcase.worker.js",
    {
      name: "aperture-content-showcase-simulation",
      type: "module",
    },
  );
  const loop = {
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    frame: null,
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
    worker.postMessage({ type: "frame", frame: 4 });
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

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 4,
    clearColor: message.clearColor ?? contentShowcaseClearColor,
    label: "content-showcase",
    readbackSamples: contentShowcaseReadbackSamples,
  });
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const interaction = createInteractionProof(aperture, report.snapshot, loop);

  loop.frame = {
    workerStep: message.workerStep,
    snapshot: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      spriteDraws: report.snapshot.spriteDraws?.length ?? 0,
      quadInstances:
        (report.snapshot.quads?.instanceFloats.length ?? 0) /
        (report.snapshot.quads?.instanceFloatStride ?? 1),
      quadBatches: report.snapshot.quadBatches?.length ?? 0,
      uiNodes: report.snapshot.uiNodes?.length ?? 0,
      uiHitRegions: report.snapshot.uiHitRegions?.length ?? 0,
      particleEmitters: report.snapshot.particleEmitters?.length ?? 0,
      diagnostics: report.snapshot.diagnostics.length,
    },
    counts: reportJson.counts,
    particles: reportJson.particles,
    interaction,
    readback: reportJson.readback,
    diagnosticCodes: reportJson.diagnostics.map(
      (diagnostic) => diagnostic.code,
    ),
    transport: {
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
  };

  publishStatus(
    createContentShowcaseStatus(scene, loop, reportJson.diagnostics),
  );
  worker.terminate();
}

function createInteractionProof(aperture, snapshot, loop) {
  const hit = aperture.hitTestUiLayout({
    position: contentShowcasePointer,
    nodes: snapshot.uiNodes ?? [],
    hitRegions: snapshot.uiHitRegions ?? [],
    layerMask: 1,
  });

  return {
    pointer: contentShowcasePointer,
    target: hit?.entity ?? null,
    blocksInput: hit?.blocksInput ?? false,
    cursor: hit?.cursor ?? null,
    blockedDraw: loop.workerScene?.blockedDraw ?? null,
    blocks3dPick:
      (hit?.blocksInput ?? false) &&
      snapshot.meshDraws.length + (snapshot.spriteDraws?.length ?? 0) > 0,
  };
}

function createContentShowcaseStatus(scene, loop, diagnostics) {
  const counts = loop.frame?.counts;
  const snapshot = loop.frame?.snapshot;
  const particles = loop.frame?.particles;
  const interaction = loop.frame?.interaction;

  return {
    ...baseStatus,
    ok:
      snapshot?.meshDraws === scene.expected.meshDraws &&
      snapshot?.spriteDraws === scene.expected.spriteDraws &&
      snapshot?.quadInstances === scene.expected.textGlyphs &&
      snapshot?.quadBatches === scene.expected.textBatches &&
      snapshot?.uiNodes === scene.expected.uiNodes &&
      snapshot?.uiHitRegions === scene.expected.uiHitRegions &&
      snapshot?.particleEmitters === scene.expected.particleEmitters &&
      counts?.quadInstances === scene.expected.textGlyphs &&
      counts?.uiNodes === scene.expected.uiNodes &&
      counts?.particleEmitters === scene.expected.particleEmitters &&
      particles?.liveParticles === scene.expected.liveParticles &&
      interaction?.blocks3dPick === true &&
      (loop.frame?.diagnosticCodes?.length ?? 0) === 0,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    content: {
      expected: scene.expected,
      samples: scene.readbackSamples,
      spriteTextureKey: scene.sprites.textureKey,
      uiFontKey: scene.ui.fontKey,
      particleEffectKey: scene.particles.effectKey,
    },
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
    },
    frame: loop.frame,
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
