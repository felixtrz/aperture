import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  atmosphereReadbackSamples,
  clearColor,
  fogColor,
  registerAtmosphereScene,
} from "./atmosphere-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "atmosphere",
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
      const scene = registerAtmosphereScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "atmosphere-failed",
      error instanceof Error ? error.message : "Atmosphere example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker("/aperture/worker-modules/examples/atmosphere.worker.js", {
    name: "aperture-atmosphere-simulation",
    type: "module",
  });
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
      height: canvas?.height ?? 960,
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
    worker.postMessage({ type: "frame", frame: 1 });
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
    frame: message.frame ?? 1,
    clearColor,
    label: "atmosphere",
    readbackSamples: atmosphereReadbackSamples,
  });
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  loop.frame = {
    workerStep: message.workerStep,
    snapshot: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      spriteDraws: report.snapshot.spriteDraws?.length ?? 0,
      skyboxes: report.snapshot.skyboxes?.length ?? 0,
      fogs: report.snapshot.fogs?.length ?? 0,
      bounds: report.snapshot.bounds.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    counts: reportJson.counts,
    renderOk: reportJson.ok,
    renderTargets: reportJson.renderTargets,
    readback: reportJson.readback,
    diagnosticCodes: reportJson.diagnostics.map(
      (diagnostic) => diagnostic.code,
    ),
    transport: {
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
  };

  publishStatus(createAtmosphereStatus(scene, loop, reportJson.diagnostics));
  worker.terminate();
}

function createAtmosphereStatus(scene, loop, diagnostics) {
  const counts = loop.frame?.counts;

  return {
    ...baseStatus,
    ok:
      counts?.meshDraws === 2 &&
      counts?.spriteDraws === 1 &&
      counts?.skyboxes === 1 &&
      counts?.fogs === 1 &&
      (counts?.drawCalls ?? 0) >= 3 &&
      counts?.diagnostics === 0,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    atmosphere: {
      fogColor,
      skyboxTextureKey: scene.skyboxTextureKey,
      skyboxSamplerKey: scene.skyboxSamplerKey,
      spriteTextureKey: scene.spriteTextureKey,
      spriteSamplerKey: scene.spriteSamplerKey,
      markerMeshKey: scene.markerMeshKey,
      markerMaterialKey: scene.markerMaterialKey,
      samples: scene.samples,
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
