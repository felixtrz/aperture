// M5-T5 proof: IOR-driven refraction + thickness + Beer-Lambert attenuation.
//
// `?ior=` bends the view ray through the glass volume (thickness>0), so an
// off-center probe behind the sphere shifts across the striped background as IOR
// rises — real Snell refraction, not a fixed normal.xy offset. `?attenuation=`
// + `?thickness=` over a white wall tint the transmitted light toward the
// attenuation passband as the volume thickens (Beer-Lambert). The glass material
// is registered identically on the worker (extraction) and here (app shading).

import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  defaultTransmissionIorConfig,
  registerTransmissionIorAssets,
} from "./transmission-ior-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const amberAttenuation = [0.92, 0.45, 0.16];
const readbackSamples = [
  { id: "through-center", x: 0.5, y: 0.5 },
  { id: "through-offset", x: 0.66, y: 0.5 },
  { id: "background", x: 0.05, y: 0.5 },
];
const searchParams = new URLSearchParams(window.location.search);

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "transmission-ior",
  materialModel: "standard-transmission-ior-volume",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

await startScenario(readConfigFromLocation());

function readConfigFromLocation() {
  const defaults = defaultTransmissionIorConfig();
  const ior = Number.parseFloat(searchParams.get("ior") ?? "");
  const thickness = Number.parseFloat(searchParams.get("thickness") ?? "");
  const attenuationDistance = Number.parseFloat(
    searchParams.get("attenuationDistance") ?? "",
  );
  const attenuation = searchParams.get("attenuation") ?? "clear";
  const background = searchParams.get("bg") ?? defaults.background;
  const amber = attenuation === "amber";

  return {
    ior: Number.isFinite(ior) && ior >= 1 ? ior : defaults.ior,
    thickness:
      Number.isFinite(thickness) && thickness >= 0
        ? thickness
        : defaults.thickness,
    attenuationColor: amber ? amberAttenuation : [1, 1, 1],
    attenuationDistance: amber
      ? Number.isFinite(attenuationDistance) && attenuationDistance > 0
        ? attenuationDistance
        : 1
      : 0,
    background: background === "white" ? "white" : "stripes",
    attenuation: amber ? "amber" : "clear",
  };
}

async function startScenario(config) {
  const generation = runtimeGeneration + 1;

  runtimeGeneration = generation;
  disposeActiveRuntime();
  publishStatus({
    ...baseStatus,
    ok: false,
    phase: "loading",
    config: configStatus(config),
    reason: "transmission-ior-loading",
    message: "Preparing refractive transmission scene.",
  });

  try {
    const aperture = await loadAperture();

    if (generation !== runtimeGeneration) {
      return;
    }

    if (canvas === null) {
      publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
      return;
    }

    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const registered = registerTransmissionIorAssets(
      aperture,
      sourceAssets,
      config,
    );
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (generation !== runtimeGeneration) {
      created.app?.stop();
      return;
    }

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
        config: configStatus(config),
      });
      return;
    }

    startWorkerSnapshotLoop(
      aperture,
      created.app,
      registered,
      config,
      readbackUsage,
      generation,
    );
  } catch (error) {
    if (generation === runtimeGeneration) {
      publishStatus(
        failure(
          "runtime",
          "transmission-ior-failed",
          error instanceof Error
            ? error.message
            : "The transmission-ior example could not start.",
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

function startWorkerSnapshotLoop(
  aperture,
  app,
  registered,
  config,
  readbackUsage,
  generation,
) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/transmission-ior.worker.js",
    { name: "aperture-transmission-ior-simulation", type: "module" },
  );
  const loop = { frame: 0, receivedSnapshots: 0, workerReady: false };

  activeRuntime = { app, worker };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      registered,
      worker,
      loop,
      event.data,
      config,
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
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: { width: canvas?.width ?? 960, height: canvas?.height ?? 960 },
    config: {
      ior: config.ior,
      thickness: config.thickness,
      attenuationColor: config.attenuationColor,
      attenuationDistance: config.attenuationDistance,
      background: config.background,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  registered,
  worker,
  loop,
  message,
  config,
  readbackUsage,
  generation,
) {
  if (generation !== runtimeGeneration) {
    return;
  }

  if (message?.type === "ready") {
    loop.workerReady = true;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        "worker",
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
    frame: message.frame,
    clearColor,
    label: "transmission-ior",
    ...(readbackUsage.ok ? { readbackSamples } : {}),
  });

  if (generation !== runtimeGeneration) {
    return;
  }

  const status = createFrameStatus({
    aperture,
    app,
    registered,
    report,
    loop,
    config,
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
  const { aperture, app, registered, report, loop, config, readbackUsage } =
    options;
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws.find((draw) =>
    draw.batchKey.pipelineKey.includes("transmission"),
  );
  const resources = report.resources?.resources ?? null;
  const reason = firstFailureReason(report, snapshot, resources);
  const material = registered.glassMaterialAsset;

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    ...(reason === null ? {} : reason),
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: app.initialization.format,
    config: configStatus(config),
    material: {
      kind: material.kind,
      key: aperture.assetHandleKey(registered.glassMaterial),
      transmission: {
        transmissionFactor: material.transmissionFactor,
        ior: material.ior,
        thickness: material.thickness,
        attenuationColor: Array.from(material.attenuationColor),
        attenuationDistance: material.attenuationDistance,
      },
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
    readback:
      report.readback ??
      (readbackUsage.ok
        ? {
            ok: false,
            reason: "readback-unavailable",
            message:
              "The transmission-ior frame did not produce readback samples.",
          }
        : readbackUsage),
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
    },
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      render: report.diagnostics.length,
      total: snapshot.diagnostics.length + report.diagnostics.length,
    },
    diagnostics: report.diagnostics.map(diagnosticToJson),
  };
}

function configStatus(config) {
  return {
    ior: config.ior,
    thickness: config.thickness,
    attenuation: config.attenuation,
    attenuationColor: Array.from(config.attenuationColor),
    attenuationDistance: config.attenuationDistance,
    background: config.background,
  };
}

function firstFailureReason(report, snapshot, resources) {
  if (report.ok) {
    return null;
  }

  if (snapshot.meshDraws.length === 0) {
    return {
      reason: "empty-snapshot",
      message: "The transmission-ior scene did not extract drawable meshes.",
    };
  }

  if (resources === null) {
    return {
      reason: "standard-resources-unavailable",
      message: "The transmission-ior standard material resources failed.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The transmission-ior frame could not be rendered.",
  };
}

function diagnosticToJson(diagnostic) {
  if (diagnostic === null || typeof diagnostic !== "object") {
    return { code: "unknown", message: String(diagnostic) };
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

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok
      ? `ior ${status.config?.ior ?? "?"}`
      : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function disposeActiveRuntime() {
  const runtime = activeRuntime;

  activeRuntime = null;

  runtime?.app?.stop();
  runtime?.app?.initialization.context?.unconfigure?.();
  runtime?.app?.initialization.device?.destroy?.();
  runtime?.worker?.terminate?.();
}
