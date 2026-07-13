// Reflective probe (B2): the worker captures the orbiting-box scene into a
// cube render target every N frames; this main thread prefilters the captured
// cube into IBL resources (prepareWebGpuAppEnvironmentAssets renderTargetSource)
// and renders the mirror sphere with them. The status dump exposes the
// per-frame capture pass counts and the cumulative capture generation so the
// e2e spec can assert the re-render cadence.

import { createNoopSimulationWorker } from "./noop-simulation-worker.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.01, 0.012, 0.02, 1];
const captureEvery = 4;
const probeTargetId = "reflective-probe.env";
// sphere-center reflects world +Z (where the red box starts); background is
// the untouched clear color.
const readbackSamples = [
  { id: "sphere-center", x: 0.5, y: 0.5 },
  { id: "sphere-offset", x: 0.56, y: 0.5 },
  { id: "background", x: 0.06, y: 0.1 },
];
const frameLogLimit = 96;

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "reflective-probe",
  materialModel: "standard-mirror-dynamic-probe-ibl",
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
    message: "Starting the reflective probe runtime.",
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

    const scene = createScene(aperture, sourceAssets);

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
          "reflective-probe-failed",
          error instanceof Error
            ? error.message
            : "The reflective probe route could not start.",
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

function createScene(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });

  assets.meshes.add(
    aperture.createSphereMeshAsset({
      label: "ReflectiveProbeSphere",
      radius: 1,
      widthSegments: 64,
      heightSegments: 48,
    }),
    { id: "reflective-probe-sphere" },
  );
  assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ReflectiveProbeMirror",
      baseColorFactor: new Float32Array([0.95, 0.95, 0.95, 1]),
      metallicFactor: 1,
      roughnessFactor: 0,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "reflective-probe-mirror" },
  );
  assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ReflectiveProbeBox",
      width: 1.1,
      height: 1.1,
      depth: 1.1,
    }),
    { id: "reflective-probe-box" },
  );

  for (const [id, color] of [
    ["reflective-probe-box-red", [1, 0.12, 0.1, 1]],
    ["reflective-probe-box-green", [0.1, 1, 0.2, 1]],
    ["reflective-probe-box-blue", [0.15, 0.35, 1, 1]],
  ]) {
    assets.materials.unlit.add(
      aperture.createUnlitMaterialAsset({
        label: id,
        baseColorFactor: new Float32Array(color),
      }),
      { id },
    );
  }

  // Renderer-side cube render target registration (the worker registers its
  // own copy so extraction recognizes the capture camera).
  const probeTarget = aperture.createRenderTargetHandle(probeTargetId);

  sourceAssets.register(probeTarget, { label: "Reflective probe target" });
  sourceAssets.markReady(
    probeTarget,
    aperture.createRenderTargetAsset({
      label: "Reflective probe target",
      dimension: "cube",
      size: 32,
    }),
  );

  const environmentMap = aperture.createEnvironmentMapHandle(
    "reflective-probe-env",
  );

  sourceAssets.register(environmentMap, { label: "Reflective probe IBL" });
  sourceAssets.markReady(environmentMap, {
    label: "Reflective probe IBL",
    diffuseResourceKey: "reflective-probe/diffuse",
    specularResourceKey: "reflective-probe/specular",
  });

  return { probeTarget, environmentMap, frameLog: [] };
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  readbackUsage,
  generation,
) {
  const worker = new Worker(
    "/worker-modules/examples/reflective-probe.worker.js",
    {
      name: "aperture-reflective-probe-simulation",
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

  // Prefilter the latest captured cube into IBL resources. The probe becomes
  // ready after its first completed capture; every later capture bumps the
  // generation, re-versioning the derived resources.
  const environmentAssets = aperture.prepareWebGpuAppEnvironmentAssets({
    app,
    assets: [
      {
        handle: scene.environmentMap,
        label: "reflective-probe",
        diffuseResourceKey: "reflective-probe/diffuse",
        specularResourceKey: "reflective-probe/specular",
        renderTargetSource: { renderTarget: probeTargetId, mipLevelCount: 4 },
      },
    ],
    activeHandle: scene.environmentMap,
  });
  const activeEnvironment = environmentAssets.active;
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame,
    clearColor,
    label: "reflective-probe",
    ...(activeEnvironment?.ready === true
      ? {
          standardMaterialIblResources:
            activeEnvironment.standardMaterialIblResources,
        }
      : {}),
    ...(readbackUsage.ok ? { readbackSamples } : {}),
  });

  if (generation !== runtimeGeneration) {
    return;
  }

  // AC3 frame-report pass counts: face submissions per frame + the cumulative
  // capture generation drive the e2e cadence assertions.
  const faceSubmissions = (report.renderTargets ?? []).filter(
    (submission) => submission.face !== undefined,
  );
  const capture = (report.renderTargetCaptures ?? []).find(
    (entry) => entry.renderTargetKey === `render-target:${probeTargetId}`,
  );

  const sphereSample = readSample(report, "sphere-center");

  scene.frameLog.push({
    frame: message.frame,
    faces: faceSubmissions.length,
    captureGeneration: capture?.captureGeneration ?? null,
    // Sphere-centre reflection pixel per frame: the e2e spec asserts the
    // reflected environment changes as the probe re-captures the orbit.
    ...(sphereSample === null ? {} : { spherePixel: sphereSample }),
  });

  if (scene.frameLog.length > frameLogLimit) {
    scene.frameLog.splice(0, scene.frameLog.length - frameLogLimit);
  }

  const status = createFrameStatus(app, scene, report, loop, readbackUsage, {
    environment: activeEnvironment,
    faceSubmissions,
    capture,
  });

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

function createFrameStatus(app, scene, report, loop, readbackUsage, frame) {
  const snapshot = report.snapshot;
  const diagnostics = report.diagnostics.map(diagnosticToJson);
  const renderTargetProjection =
    frame.environment?.renderTargetProjection ?? null;
  const captureGeneration = renderTargetProjection?.captureGeneration ?? 0;

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: app.initialization.format,
    extraction: {
      frame: snapshot.frame,
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      environments: snapshot.environments.length,
      diagnostics: snapshot.diagnostics.length,
    },
    probe: {
      renderTargetKey: `render-target:${probeTargetId}`,
      faceSize: 32,
      captureEvery,
      // Face passes submitted THIS frame (6 on capture frames, 0 otherwise).
      faceSubmissionsThisFrame: frame.faceSubmissions.length,
      captureGeneration,
      frameLog: [...scene.frameLog],
    },
    environment: {
      ready: frame.environment?.ready === true,
      renderTargetSource: renderTargetProjection,
      specularPrefiltering:
        frame.environment?.specularTextureResource.sections.prefiltering ??
        false,
      diffuseConvolved:
        frame.environment?.diffuseTextureResource.convolved === true,
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

function readSample(report, id) {
  if (report.readback?.ok !== true) {
    return null;
  }

  const sample = report.readback.samples.find((entry) => entry.id === id);

  return sample?.pixel ?? null;
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "probe" : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
