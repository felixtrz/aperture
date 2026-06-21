import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  createTonemapShowcaseIblResources,
  loadTonemapShowcaseEnvironment,
} from "./tonemap-showcase-environment.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const modeElements = Array.from(document.querySelectorAll("[data-ibl]"));
const clearColor = [0.015, 0.025, 0.035, 1];
const modes = ["brdf", "proof"];
const defaultMode = "brdf";
// facing-probe: sphere center (high NdotV). grazing-probe: near the silhouette
// (low NdotV) where the split-sum B/F90 horizon term brightens reflections.
const readbackSamples = [
  { id: "facing-probe", x: 0.5, y: 0.5 },
  { id: "grazing-probe", x: 0.5, y: 0.2 },
];
const searchParams = new URLSearchParams(window.location.search);

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "ibl-brdf",
  materialModel: "standard-direct-lit-diffuse-specular-ibl",
  modes,
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

modeElements.forEach((element) => {
  element.addEventListener("click", () => {
    const mode = element.getAttribute("data-ibl");

    if (mode !== null) {
      void startMode(mode, { updateUrl: true });
    }
  });
});

await startMode(resolveRequestedMode(searchParams.get("ibl")));

async function startMode(mode, options = {}) {
  const generation = runtimeGeneration + 1;

  runtimeGeneration = generation;
  disposeActiveRuntime();
  setActiveMode(mode);
  publishStatus({
    ...baseStatus,
    ok: false,
    phase: "loading",
    iblMode: mode,
    reason: "mode-loading",
    message: `Preparing ${mode} specular IBL.`,
  });

  if (options.updateUrl === true) {
    const url = new URL(window.location.href);

    url.searchParams.set("ibl", mode);
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

    const scene = await createBrdfScene(
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
          "ibl-brdf-failed",
          error instanceof Error
            ? error.message
            : "The IBL BRDF route could not start.",
          mode,
        ),
      );
    }
  }
}

function loadAperture() {
  aperturePromise ??= Promise.all([
    Promise.all([
      import("/aperture/worker-modules/packages/simulation/dist/index.js"),
      import("/aperture/worker-modules/packages/render/dist/index.js"),
      import("/aperture/worker-modules/packages/runtime/dist/index.js"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("/aperture/worker-modules/packages/webgpu/dist/index.js"),
  ]).then(([core, webgpu]) => ({ ...core, ...webgpu }));

  return aperturePromise;
}

async function createBrdfScene(aperture, app, sourceAssets, mode) {
  // Register the mesh + metal material the worker references (same ids) so the
  // app frame can resolve their source-asset dependencies as ready.
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });

  assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "IblBrdfSphere",
      radius: 1.3,
      widthSegments: 96,
      heightSegments: 64,
    }),
    { id: "ibl-brdf-sphere" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "IblBrdfMetal",
      baseColorFactor: new Float32Array([0.95, 0.78, 0.42, 1]),
      metallicFactor: 1,
      roughnessFactor: 0.22,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "ibl-brdf-metal" },
  );

  const environmentMap = aperture.createEnvironmentMapHandle(
    "spinning-cube-pisa-studio",
  );

  sourceAssets.register(environmentMap, { label: "IBL BRDF Pisa HDR studio" });
  sourceAssets.markReady(environmentMap, {
    label: "IBL BRDF Pisa HDR studio",
    diffuseResourceKey: "spinning-cube-pisa-studio/diffuse",
    specularResourceKey: "spinning-cube-pisa-studio/specular-prefilter",
  });

  const environmentSource = await loadTonemapShowcaseEnvironment(aperture);
  const baseIblResources = createTonemapShowcaseIblResources(
    aperture,
    app,
    environmentSource,
  );
  // The split-sum environment-BRDF (DFG) integration LUT. Building it runs the
  // GPU compute pass and proves the integration pipeline; the live shader term
  // is the analytic Karis approximation of the same DFG.
  const brdfLut = aperture.createBrdfIntegrationLutResource({
    device: app.initialization.device,
    size: 256,
  });
  const iblResources =
    mode === "brdf"
      ? { ...baseIblResources, brdfLutTextureResource: brdfLut }
      : baseIblResources;

  return { environmentMap, environmentSource, iblResources, brdfLut, mode };
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  mode,
  readbackUsage,
  generation,
) {
  const worker = new Worker("/aperture/worker-modules/examples/ibl-brdf.worker.js", {
    name: "aperture-ibl-brdf-simulation",
    type: "module",
  });
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
    label: `ibl-brdf-${mode}`,
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
  const specular = scene.iblResources.specularTextureResource;

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    iblMode: mode,
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
    material: {
      metallicFactor: 1,
      roughnessFactor: 0.22,
      model: mode === "brdf" ? "split-sum-dfg" : "specular-ibl-proof",
    },
    environment: {
      extracted: snapshot.environments.length,
      specularPrefiltering: specular.sections.prefiltering,
      specularDiagnosticCodes: specular.diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
      brdfLut: {
        ready: scene.brdfLut.ready,
        bound: mode === "brdf",
        size: scene.brdfLut.size,
        format: scene.brdfLut.format,
        diagnosticCodes: scene.brdfLut.diagnostics.map(
          (diagnostic) => diagnostic.code,
        ),
      },
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
    const active = element.getAttribute("data-ibl") === mode;

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
  return { ...baseStatus, ok: false, phase, iblMode: mode, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? status.iblMode : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
