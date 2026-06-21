import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  clearColor,
  iridescenceReadbackSamples,
  registerIridescenceScene,
} from "./iridescence-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "iridescence",
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
      const scene = registerIridescenceScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "iridescence-failed",
      error instanceof Error ? error.message : "Iridescence example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker("/aperture/worker-modules/examples/iridescence.worker.js", {
    name: "aperture-iridescence-simulation",
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
    label: "iridescence",
    readbackSamples: iridescenceReadbackSamples,
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

  publishStatus(createIridescenceStatus(scene, loop, reportJson.diagnostics));
  worker.terminate();
}

function createIridescenceStatus(scene, loop, diagnostics) {
  const counts = loop.frame?.counts;
  const pipelineKeys = loop.frame?.pipelineKeys ?? [];
  const textureContrast = createIridescenceTextureContrastReport(
    loop.frame?.readback,
  );
  const thicknessContrast = createIridescenceThicknessContrastReport(
    loop.frame?.readback,
  );
  const readbackContrastOk =
    loop.frame?.readback?.ok !== true ||
    ((textureContrast === null || textureContrast.ok === true) &&
      (thicknessContrast === null || thicknessContrast.ok === true));

  return {
    ...baseStatus,
    ok:
      counts?.meshDraws === 4 &&
      loop.frame?.snapshot?.lights === 2 &&
      (counts?.drawCalls ?? 0) >= 1 &&
      counts?.diagnostics === 0 &&
      pipelineKeys.includes("standard|iridescence|opaque|none|less|none") &&
      pipelineKeys.includes(
        "standard|iridescence|iridescenceTexture|opaque|none|less|none",
      ) &&
      pipelineKeys.includes(
        "standard|iridescence|iridescenceThicknessTexture|opaque|none|less|none",
      ) &&
      readbackContrastOk,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    iridescence: {
      meshKey: scene.meshKey,
      textureMeshKey: scene.textureMeshKey,
      baseMaterialKey: scene.baseMaterialKey,
      filmMaterialKey: scene.filmMaterialKey,
      texturedFilmMaterialKey: scene.texturedFilmMaterialKey,
      thicknessTexturedFilmMaterialKey: scene.thicknessTexturedFilmMaterialKey,
      iridescenceTextureKey: scene.iridescenceTextureKey,
      iridescenceThicknessTextureKey: scene.iridescenceThicknessTextureKey,
      iridescenceSamplerKey: scene.iridescenceSamplerKey,
      iridescenceFactor: 1,
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 560,
      textureBackedFactor: true,
      textureBackedThickness: true,
      textureContrast,
      thicknessContrast,
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

function createIridescenceTextureContrastReport(readback) {
  if (readback?.ok !== true || !Array.isArray(readback.samples)) {
    return null;
  }

  const low = findReadbackPixel(readback.samples, "texture-low");
  const high = findReadbackPixel(readback.samples, "texture-high");

  if (low === null || high === null) {
    return {
      ok: false,
      reason: "missing-texture-sample",
    };
  }

  if (isTransparentZeroPixel(low) && isTransparentZeroPixel(high)) {
    return null;
  }

  const highLowDistance = pixelDistance(high, low);
  const highLuminance = luminance(high);
  const lowLuminance = luminance(low);

  return {
    ok: highLowDistance > 28,
    highLowDistance,
    lowLuminance,
    highLuminance,
  };
}

function createIridescenceThicknessContrastReport(readback) {
  if (readback?.ok !== true || !Array.isArray(readback.samples)) {
    return null;
  }

  const low = findReadbackPixel(readback.samples, "thickness-low");
  const high = findReadbackPixel(readback.samples, "thickness-high");

  if (low === null || high === null) {
    return {
      ok: false,
      reason: "missing-thickness-sample",
    };
  }

  if (isTransparentZeroPixel(low) && isTransparentZeroPixel(high)) {
    return null;
  }

  const highLowDistance = pixelDistance(high, low);
  const highLuminance = luminance(high);
  const lowLuminance = luminance(low);

  return {
    ok: highLowDistance > 18,
    highLowDistance,
    lowLuminance,
    highLuminance,
  };
}

function isTransparentZeroPixel(pixel) {
  return pixel.r === 0 && pixel.g === 0 && pixel.b === 0 && pixel.a === 0;
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

function luminance(pixel) {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
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
