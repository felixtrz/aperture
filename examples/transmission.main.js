import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  clearColor,
  registerTransmissionScene,
  transmissionReadbackSamples,
} from "./transmission-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "transmission",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
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
      const scene = registerTransmissionScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "transmission-failed",
      error instanceof Error ? error.message : "Transmission example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker("/worker-modules/examples/transmission.worker.js", {
    name: "aperture-transmission-simulation",
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
    label: "transmission",
    readbackSamples: transmissionReadbackSamples,
  });
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  loop.frame = {
    workerStep: message.workerStep,
    snapshot: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      bounds: report.snapshot.bounds.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    counts: reportJson.counts,
    renderOk: reportJson.ok,
    renderTargets: reportJson.renderTargets,
    transmissionGrabPass: reportJson.transmissionGrabPass,
    readback: reportJson.readback,
    pipelineKeys: report.snapshot.meshDraws.map(
      (draw) => draw.batchKey.pipelineKey,
    ),
    diagnosticCodes: reportJson.diagnostics.map(
      (diagnostic) => diagnostic.code,
    ),
    transport: {
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
  };

  publishStatus(createTransmissionStatus(scene, loop, reportJson.diagnostics));
  worker.terminate();
}

function createTransmissionStatus(scene, loop, diagnostics) {
  const counts = loop.frame?.counts;
  const pipelineKeys = loop.frame?.pipelineKeys ?? [];
  const roughnessContrast = createTransmissionContrastReport(
    loop.frame?.readback,
  );
  const readbackContrastOk =
    loop.frame?.readback?.ok !== true || roughnessContrast?.ok === true;

  return {
    ...baseStatus,
    ok:
      counts?.meshDraws === scene.expectedMeshDraws &&
      loop.frame?.snapshot?.lights === 2 &&
      (counts?.drawCalls ?? 0) >= 2 &&
      counts?.diagnostics === 0 &&
      loop.frame?.transmissionGrabPass?.ok === true &&
      pipelineKeys.includes("standard|transmission|blend|none|less|alpha") &&
      readbackContrastOk,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    transmission: {
      sphereMeshKey: scene.sphereMeshKey,
      panelMeshKey: scene.panelMeshKey,
      glassMaterialKey: scene.glassMaterialKey,
      roughGlassMaterialKey: scene.roughGlassMaterialKey,
      backgroundMaterialKey: scene.backgroundMaterialKey,
      brightBackgroundMaterialKey: scene.brightBackgroundMaterialKey,
      darkBackgroundMaterialKey: scene.darkBackgroundMaterialKey,
      transmissionFactor: scene.transmissionFactor,
      roughness: scene.roughness,
      stripeCount: scene.stripeCount,
      expectedMeshDraws: scene.expectedMeshDraws,
      roughnessContrast,
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

function createTransmissionContrastReport(readback) {
  if (readback?.ok !== true || !Array.isArray(readback.samples)) {
    return null;
  }

  const glossyDark = findReadbackPixel(readback.samples, "glossy-dark");
  const glossyBright = findReadbackPixel(readback.samples, "glossy-bright");
  const roughDark = findReadbackPixel(readback.samples, "rough-dark");
  const roughBright = findReadbackPixel(readback.samples, "rough-bright");
  const backgroundGlossyDark = findReadbackPixel(
    readback.samples,
    "background-glossy-dark",
  );
  const backgroundGlossyBright = findReadbackPixel(
    readback.samples,
    "background-glossy-bright",
  );
  const backgroundRoughDark = findReadbackPixel(
    readback.samples,
    "background-rough-dark",
  );
  const backgroundRoughBright = findReadbackPixel(
    readback.samples,
    "background-rough-bright",
  );

  if (
    glossyDark === null ||
    glossyBright === null ||
    roughDark === null ||
    roughBright === null ||
    backgroundGlossyDark === null ||
    backgroundGlossyBright === null ||
    backgroundRoughDark === null ||
    backgroundRoughBright === null
  ) {
    return {
      ok: false,
      reason: "missing-contrast-sample",
    };
  }

  const glossy = pixelDistance(glossyDark, glossyBright);
  const rough = pixelDistance(roughDark, roughBright);
  const backgroundGlossy = pixelDistance(
    backgroundGlossyDark,
    backgroundGlossyBright,
  );
  const backgroundRough = pixelDistance(
    backgroundRoughDark,
    backgroundRoughBright,
  );
  const roughToGlossyRatio = rough / Math.max(1, glossy);

  return {
    ok:
      glossy > 25 &&
      rough < glossy * 0.85 &&
      backgroundGlossy > 70 &&
      backgroundRough > 70,
    glossy,
    rough,
    backgroundGlossy,
    backgroundRough,
    roughToGlossyRatio,
  };
}

function findReadbackPixel(samples, id) {
  return samples.find((sample) => sample.id === id)?.pixel ?? null;
}

function pixelDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = a.a - b.a;

  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
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
