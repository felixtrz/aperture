import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  createIblEquirectEnvironmentAssetInput,
  loadIblEquirectEnvironment,
} from "./ibl-equirect-environment.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
// reflect-probe: sphere centre reflects the +Z longitude — the equirect's bright
// band — so it should be bright. rim-probe reflects an off-axis (dark) direction.
const readbackSamples = [
  { id: "reflect-probe", x: 0.5, y: 0.5 },
  { id: "rim-probe", x: 0.83, y: 0.5 },
];

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "ibl-equirect",
  materialModel: "standard-direct-lit-diffuse-specular-ibl",
  canvas: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
};

await start();

async function start() {
  const generation = runtimeGeneration + 1;

  runtimeGeneration = generation;
  disposeActiveRuntime();
  publishStatus({
    ...baseStatus,
    ok: false,
    phase: "loading",
    reason: "loading",
    message: "Projecting equirect HDR to a cubemap.",
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
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
      });
      return;
    }

    const scene = await createScene(aperture, created.app, sourceAssets);

    if (generation !== runtimeGeneration) {
      created.app.stop();
      return;
    }

    startWorkerSnapshotLoop(
      aperture,
      created.app,
      scene,
      readbackUsage,
      generation,
    );
  } catch (error) {
    if (generation === runtimeGeneration) {
      publishStatus(
        failure(
          "runtime",
          "ibl-equirect-failed",
          error instanceof Error
            ? error.message
            : "The IBL equirect route could not start.",
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

async function createScene(aperture, app, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });

  assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "IblEquirectSphere",
      radius: 1.3,
      widthSegments: 96,
      heightSegments: 64,
    }),
    { id: "ibl-equirect-sphere" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "IblEquirectMirror",
      baseColorFactor: new Float32Array([0.95, 0.95, 0.95, 1]),
      metallicFactor: 1,
      roughnessFactor: 0,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "ibl-equirect-mirror" },
  );

  const environmentMap =
    aperture.createEnvironmentMapHandle("ibl-equirect-demo");

  sourceAssets.register(environmentMap, { label: "IBL equirect demo" });
  sourceAssets.markReady(environmentMap, {
    label: "IBL equirect demo",
    diffuseResourceKey: "ibl-equirect-demo/diffuse",
    specularResourceKey: "ibl-equirect-demo/specular-prefilter",
  });

  const environment = await loadIblEquirectEnvironment(aperture);
  const environmentAssetInput = createIblEquirectEnvironmentAssetInput(
    aperture,
    environment.image,
  );
  const environmentAssets = aperture.prepareWebGpuAppEnvironmentAssets({
    app,
    assets: [environmentAssetInput],
    activeHandle: environmentMap,
  });
  const activeEnvironment = environmentAssets.active;

  if (activeEnvironment === null || !activeEnvironment.ready) {
    throw new Error("Generic equirect environment asset preparation failed.");
  }

  return {
    environmentMap,
    environment,
    environmentAssets,
    iblResources: activeEnvironment.standardMaterialIblResources,
  };
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  readbackUsage,
  generation,
) {
  const worker = new Worker("/aperture/worker-modules/examples/ibl-equirect.worker.js", {
    name: "aperture-ibl-equirect-simulation",
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
    label: "ibl-equirect",
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

function createFrameStatus(aperture, app, scene, report, loop, readbackUsage) {
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const diagnostics = report.diagnostics.map(diagnosticToJson);
  const activeEnvironment = scene.environmentAssets.active;
  const equirectProjection = activeEnvironment?.equirectProjection ?? null;

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
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
    material: { metallicFactor: 1, roughnessFactor: 0 },
    environment: {
      source: {
        loader: scene.environment.loader,
        projection: equirectProjection?.projection ?? null,
        faceCount: equirectProjection?.faceCount ?? 0,
        width: scene.environment.width,
        height: scene.environment.height,
      },
      genericAssetInput: true,
      specularPrefiltering:
        activeEnvironment?.specularTextureResource.sections.prefiltering ??
        false,
      diffuseConvolved:
        activeEnvironment?.diffuseTextureResource.convolved === true,
      specularDiagnosticCodes:
        activeEnvironment?.specularTextureResource.diagnostics.map(
          (diagnostic) => diagnostic.code,
        ) ?? [],
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

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "equirect" : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
