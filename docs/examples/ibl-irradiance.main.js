import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  createIblIrradianceEnvironmentSource,
  createIblIrradianceIblResources,
} from "./ibl-irradiance-environment.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const modeElements = Array.from(document.querySelectorAll("[data-irradiance]"));
const clearColor = [0.015, 0.025, 0.035, 1];
const modes = ["convolved", "raw"];
const defaultMode = "convolved";
// The bright hemisphere (+X/+Y/+Z) lights the +X (right) side of the sphere; the
// dark hemisphere (−X/−Y/−Z) faces the −X (left) side. bright-probe samples a
// normal facing the bright environment, dark-probe a normal facing the dark one.
const readbackSamples = [
  { id: "bright-probe", x: 0.66, y: 0.5 },
  { id: "dark-probe", x: 0.34, y: 0.5 },
];
const searchParams = new URLSearchParams(window.location.search);

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "ibl-irradiance",
  materialModel: "standard-direct-lit-diffuse-ibl",
  modes,
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

modeElements.forEach((element) => {
  element.addEventListener("click", () => {
    const mode = element.getAttribute("data-irradiance");

    if (mode !== null) {
      void startMode(mode, { updateUrl: true });
    }
  });
});

await startMode(resolveRequestedMode(searchParams.get("mode")));

async function startMode(mode, options = {}) {
  const generation = runtimeGeneration + 1;

  runtimeGeneration = generation;
  disposeActiveRuntime();
  setActiveMode(mode);
  publishStatus({
    ...baseStatus,
    ok: false,
    phase: "loading",
    irradianceMode: mode,
    reason: "mode-loading",
    message: `Preparing ${mode} diffuse IBL.`,
  });

  if (options.updateUrl === true) {
    const url = new URL(window.location.href);

    url.searchParams.set("mode", mode);
    history.replaceState(null, "", url);
  }

  try {
    const aperture = await loadAperture();

    if (generation !== runtimeGeneration) {
      return;
    }

    if (canvas === null) {
      publishStatus(
        failure("canvas", "canvas-unavailable", "Canvas missing.", mode),
      );
      return;
    }

    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      tonemap: aperture.resolveTonemapOperator("aces"),
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (generation !== runtimeGeneration) {
      created.app?.stop();
      return;
    }

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message, mode),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
      });
      return;
    }

    const scene = createIrradianceScene(
      aperture,
      created.app,
      sourceAssets,
      mode,
    );

    if (generation !== runtimeGeneration) {
      created.app.stop();
      return;
    }

    startWorkerSnapshotLoop(
      aperture,
      created.app,
      scene,
      mode,
      readbackUsage,
      generation,
    );
  } catch (error) {
    if (generation === runtimeGeneration) {
      publishStatus(
        failure(
          "runtime",
          "ibl-irradiance-failed",
          error instanceof Error
            ? error.message
            : "The IBL irradiance route could not start.",
          mode,
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

function createIrradianceScene(aperture, app, sourceAssets, mode) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });

  assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "IblIrradianceSphere",
      radius: 1.3,
      widthSegments: 96,
      heightSegments: 64,
    }),
    { id: "ibl-irradiance-sphere" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "IblIrradianceDiffuse",
      baseColorFactor: new Float32Array([0.92, 0.9, 0.86, 1]),
      metallicFactor: 0,
      roughnessFactor: 1,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "ibl-irradiance-diffuse" },
  );

  const environmentMap = aperture.createEnvironmentMapHandle(
    "ibl-irradiance-demo",
  );

  sourceAssets.register(environmentMap, { label: "IBL irradiance demo" });
  sourceAssets.markReady(environmentMap, {
    label: "IBL irradiance demo",
    diffuseResourceKey: "ibl-irradiance-demo/diffuse",
    specularResourceKey: "ibl-irradiance-demo/specular-prefilter",
  });

  const environmentSource = createIblIrradianceEnvironmentSource();
  const iblResources = createIblIrradianceIblResources(
    aperture,
    app,
    environmentSource,
    mode,
  );

  return { environmentMap, environmentSource, iblResources, mode };
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  mode,
  readbackUsage,
  generation,
) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/ibl-irradiance.worker.js",
    {
      name: "aperture-ibl-irradiance-simulation",
      type: "module",
    },
  );
  const loop = { frame: 0, receivedSnapshots: 0, workerReady: false };

  activeRuntime = { app, worker };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      scene,
      worker,
      loop,
      event.data,
      mode,
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
        mode,
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: { width: canvas?.width ?? 960, height: canvas?.height ?? 540 },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
  mode,
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
        mode,
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
    label: `ibl-irradiance-${mode}`,
    standardMaterialIblResources: scene.iblResources,
    ...(readbackUsage.ok ? { readbackSamples } : {}),
  });

  if (generation !== runtimeGeneration) {
    return;
  }

  const status = createFrameStatus(
    aperture,
    app,
    scene,
    report,
    loop,
    mode,
    readbackUsage,
  );

  publishStatus(status);

  if (status.ok) {
    requestWorkerFrame(worker, loop);
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

function createFrameStatus(
  aperture,
  app,
  scene,
  report,
  loop,
  mode,
  readbackUsage,
) {
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const diagnostics = report.diagnostics.map(diagnosticToJson);
  const diffuse = scene.iblResources.diffuseTextureResource;
  const diffuseDiagnosticCodes = diffuse.diagnostics.map(
    (diagnostic) => diagnostic.code,
  );

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    irradianceMode: mode,
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: app.initialization.format,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    extraction: {
      frame: snapshot.frame,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      environments: snapshot.environments.length,
      diagnostics: snapshot.diagnostics.length,
    },
    material: { metallicFactor: 0, roughnessFactor: 1 },
    environment: {
      brightFaceIndices: scene.environmentSource.brightFaceIndices,
      sourceFaceSize: scene.environmentSource.faceSize,
      diffuse: {
        convolved: diffuse.convolved === true,
        ready: diffuse.ready,
        faceSize:
          diffuse.irradianceFaceSize ?? scene.environmentSource.faceSize,
      },
      diagnosticCodes: diffuseDiagnosticCodes,
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
            message: "No readback sample produced.",
          }
        : readbackUsage),
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
    },
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      render: report.diagnostics.length,
    },
    diagnostics,
  };
}

function resolveRequestedMode(value) {
  return modes.includes(value) ? value : defaultMode;
}

function setActiveMode(mode) {
  modeElements.forEach((element) => {
    const active = element.getAttribute("data-irradiance") === mode;

    element.setAttribute("aria-pressed", String(active));
    element.toggleAttribute("disabled", active);
  });
}

function disposeActiveRuntime() {
  activeRuntime?.app?.stop();
  activeRuntime?.worker?.terminate();
  activeRuntime = null;
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

function failure(phase, reason, message, mode) {
  return {
    ...baseStatus,
    ok: false,
    phase,
    irradianceMode: mode,
    reason,
    message,
  };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? status.irradianceMode : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
