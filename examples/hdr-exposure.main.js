// M5-T4 proof: a persistent rgba16float HDR scene buffer + a final exposure
// tonemap post stage. The bright (> 1.0) emissive sphere is rendered into the
// linear HDR scene buffer with NO in-material tonemap; the appended HDR tonemap
// post effect applies `color * exposure`, the operator, and the sRGB encode.
//
// Sweeping `?exposure=` re-creates the app with a different exposure and reads
// the swapchain back: brighter exposure must brighten the resolved highlight,
// proving the value reaches the GPU through the post stage (not baked at author
// time). Because tonemap moved to the post stage, the standard lit pipeline
// renders into rgba16float and bakes no `tonemap:`/`output-color:` token — the
// spec asserts both.

import { createNoopSimulationWorker } from "./noop-simulation-worker.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const exposureElements = Array.from(
  document.querySelectorAll("[data-exposure]"),
);
const clearColor = [0.01, 0.01, 0.015, 1];
const tonemapOperator = "aces";
const exposurePresets = [0.25, 1, 4];
const defaultExposure = 1;
const readbackSamples = [
  { id: "sphere-center", x: 0.5, y: 0.5 },
  { id: "sphere-upper", x: 0.5, y: 0.36 },
  { id: "background", x: 0.06, y: 0.5 },
];
const searchParams = new URLSearchParams(window.location.search);

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "hdr-exposure",
  materialModel: "standard-emissive-hdr-scene-buffer",
  tonemapOperator,
  exposurePresets,
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

exposureElements.forEach((element) => {
  element.addEventListener("click", () => {
    const value = Number.parseFloat(
      element.getAttribute("data-exposure") ?? "",
    );

    if (Number.isFinite(value)) {
      void startExposure(value, { updateUrl: true });
    }
  });
});

await startExposure(resolveRequestedExposure(searchParams.get("exposure")));

async function startExposure(exposure, options = {}) {
  const generation = runtimeGeneration + 1;

  runtimeGeneration = generation;
  disposeActiveRuntime();
  setActiveExposure(exposure);
  publishStatus({
    ...baseStatus,
    ok: false,
    phase: "loading",
    requestedExposure: exposure,
    reason: "exposure-loading",
    message: `Preparing HDR exposure ${exposure}.`,
  });

  if (options.updateUrl === true) {
    const url = new URL(window.location.href);

    url.searchParams.set("exposure", String(exposure));
    history.replaceState(null, "", url);
  }

  try {
    const aperture = await loadAperture();

    if (generation !== runtimeGeneration) {
      return;
    }

    if (canvas === null) {
      publishStatus(
        failure("canvas", "canvas-unavailable", "Canvas missing.", exposure),
      );
      return;
    }

    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const scene = createHdrExposureScene(aperture, sourceAssets);
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      tonemap: tonemapOperator,
      exposure,
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (generation !== runtimeGeneration) {
      created.app?.stop();
      return;
    }

    if (!created.ok) {
      publishStatus({
        ...failure(
          "initialize-webgpu",
          created.reason,
          created.message,
          exposure,
        ),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
      });
      return;
    }

    startWorkerSnapshotLoop(
      aperture,
      created.app,
      scene,
      exposure,
      readbackUsage,
      generation,
    );
  } catch (error) {
    if (generation === runtimeGeneration) {
      publishStatus(
        failure(
          "runtime",
          "hdr-exposure-failed",
          error instanceof Error
            ? error.message
            : "The HDR exposure example could not start.",
          exposure,
        ),
      );
    }
  }
}

function loadAperture() {
  aperturePromise ??= Promise.all([
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
  ]).then(([core, webgpu]) => ({ ...core, ...webgpu }));

  return aperturePromise;
}

function createHdrExposureScene(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "HdrExposureSphere",
      radius: 1.3,
      widthSegments: 64,
      heightSegments: 48,
    }),
    { id: "hdr-exposure-sphere" },
  );
  const materialAsset = aperture.createStandardMaterialAsset({
    label: "HdrExposureEmissive",
    baseColorFactor: new Float32Array([0.05, 0.05, 0.05, 1]),
    metallicFactor: 0,
    roughnessFactor: 1,
    // Bright HDR emissive highlight (red/green > 1.0). Only an rgba16float
    // scene buffer preserves the > 1.0 signal so the post stage can scale it by
    // exposure; the magnitudes stay below ACES saturation across 0.25×–4× so the
    // swept readback brightens monotonically with clear gaps.
    emissiveFactor: [1.5, 1, 0.6],
  });
  const material = assets.materials.standard.add(materialAsset, {
    id: "hdr-exposure-emissive",
  });

  return { mesh, material, materialAsset };
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  exposure,
  readbackUsage,
  generation,
) {
  const worker = new Worker("/worker-modules/examples/hdr-exposure.worker.js", {
    name: "aperture-hdr-exposure-simulation",
    type: "module",
  });
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
  };

  activeRuntime = { app, worker };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      scene,
      worker,
      loop,
      event.data,
      exposure,
      readbackUsage,
      generation,
    );
  });
  worker.addEventListener("error", (event) => {
    if (generation !== runtimeGeneration) {
      return;
    }

    publishStatus(
      failure(
        "worker",
        "worker-error",
        event.message || "The simulation worker reported an error.",
        exposure,
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
  exposure,
  readbackUsage,
  generation,
) {
  if (generation !== runtimeGeneration) {
    return;
  }

  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        "worker",
        message.reason ?? "worker-error",
        message.message ?? "The simulation worker failed.",
        exposure,
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
    frame: message.frame,
    clearColor,
    label: `hdr-exposure-${exposure}`,
    ...(readbackUsage.ok ? { readbackSamples } : {}),
  });

  if (generation !== runtimeGeneration) {
    return;
  }

  const status = createFrameStatus({
    aperture,
    app,
    scene,
    report,
    loop,
    message,
    exposure,
    readbackUsage,
  });

  publishStatus(status);

  if (status.ok) {
    worker.terminate();

    if (activeRuntime?.worker === worker) {
      activeRuntime = { app, worker: null };
    }
  } else {
    worker.terminate();
  }
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame(() => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({ type: "frame", frame: loop.frame });
  });
}

function createFrameStatus(options) {
  const {
    aperture,
    app,
    scene,
    report,
    loop,
    message,
    exposure,
    readbackUsage,
  } = options;
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const reason = firstFailureReason(report, firstDraw, resources);
  const swapchainFormat = app.initialization.format;
  const hdrSceneBuffer = app.sceneRenderFormat !== swapchainFormat;

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    requestedExposure: exposure,
    ...(reason === null ? {} : reason),
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: swapchainFormat,
    output: {
      // The persistent HDR scene buffer format (M5-T4). rgba16float when the
      // exposure path is active; equals the swapchain format otherwise.
      sceneBufferFormat: app.sceneRenderFormat,
      swapchainFormat,
      hdrSceneBuffer,
      // Where tonemap runs: the appended post stage when HDR is active, the
      // legacy in-material output otherwise.
      tonemapStage: hdrSceneBuffer ? "post" : "in-material",
      tonemapOperator: app.tonemap,
      exposure: app.exposure,
      outputColorSpace: app.outputColorSpace,
    },
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    material: {
      kind: scene.materialAsset.kind,
      key: aperture.assetHandleKey(scene.material),
      emissiveFactor: Array.from(scene.materialAsset.emissiveFactor ?? []),
    },
    extraction: {
      frame: snapshot.frame,
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
    pipeline: {
      key: firstDraw?.batchKey.pipelineKey ?? null,
      cacheKey: report.pipeline?.resource?.cacheKey ?? null,
    },
    postEffects: (report.postEffects ?? []).map((effect) => ({
      effectId: effect.effectId,
      label: effect.label,
      ok: effect.ok,
      input: effect.input,
      output: effect.output,
      drawCalls: effect.drawCalls,
    })),
    readback:
      report.readback ??
      (readbackUsage.ok
        ? {
            ok: false,
            reason: "readback-unavailable",
            message:
              "The HDR exposure frame did not produce a swapchain readback.",
          }
        : readbackUsage),
    command: {
      drawCount: report.boundary?.execution?.drawCalls ?? 0,
      indexedDrawCount: report.boundary?.execution?.indexedDrawCalls ?? 0,
    },
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      render: report.diagnostics.length,
      total: snapshot.diagnostics.length + report.diagnostics.length,
    },
    diagnostics: report.diagnostics.map(diagnosticToJson),
  };
}

function resolveRequestedExposure(value) {
  const parsed = Number.parseFloat(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultExposure;
}

function setActiveExposure(exposure) {
  exposureElements.forEach((element) => {
    const value = Number.parseFloat(
      element.getAttribute("data-exposure") ?? "",
    );
    const active = Number.isFinite(value) && value === exposure;

    element.setAttribute("aria-pressed", String(active));
    element.toggleAttribute("disabled", active);
  });
}

function disposeActiveRuntime() {
  const runtime = activeRuntime;

  activeRuntime = null;

  runtime?.app?.stop();
  runtime?.app?.initialization.context?.unconfigure?.();
  runtime?.app?.initialization.device?.destroy?.();
  runtime?.worker?.terminate?.();
}

function firstFailureReason(report, firstDraw, resources) {
  if (report.ok) {
    return null;
  }

  if (firstDraw === undefined) {
    return {
      reason: "empty-snapshot",
      message: "The HDR exposure scene did not extract a drawable sphere.",
    };
  }

  if (resources === null) {
    return {
      reason: "standard-resources-unavailable",
      message: "The HDR exposure standard material resources were not ready.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The HDR exposure frame could not be rendered.",
  };
}

function diagnosticToJson(diagnostic) {
  if (diagnostic === null || typeof diagnostic !== "object") {
    return {
      code: "unknown",
      message: String(diagnostic),
    };
  }

  return {
    code: typeof diagnostic.code === "string" ? diagnostic.code : "unknown",
    message:
      typeof diagnostic.message === "string"
        ? diagnostic.message
        : JSON.stringify(diagnostic),
    ...(typeof diagnostic.severity === "string"
      ? { severity: diagnostic.severity }
      : {}),
  };
}

function failure(phase, reason, message, exposure) {
  return {
    ...baseStatus,
    ok: false,
    phase,
    requestedExposure: exposure,
    reason,
    message,
  };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok
      ? `exposure ${status.output?.exposure ?? status.requestedExposure}`
      : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
