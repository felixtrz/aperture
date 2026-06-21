import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  createTonemapShowcaseIblResources,
  loadTonemapShowcaseEnvironment,
} from "./tonemap-showcase-environment.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const operatorElements = Array.from(
  document.querySelectorAll("[data-tonemap]"),
);
const clearColor = [0.015, 0.025, 0.035, 1];
const operators = ["linear", "reinhard", "aces", "agx"];
const defaultOperator = "aces";
const readbackSample = { id: "highlight-probe", x: 0.54, y: 0.5 };
const searchParams = new URLSearchParams(window.location.search);

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "tonemap-showcase",
  materialModel: "standard-direct-lit-diffuse-specular-ibl",
  operators,
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

operatorElements.forEach((element) => {
  element.addEventListener("click", () => {
    const operator = element.getAttribute("data-tonemap");

    if (operator !== null) {
      void startOperator(operator, { updateUrl: true });
    }
  });
});

await startOperator(resolveRequestedOperator(searchParams.get("tonemap")));

async function startOperator(operator, options = {}) {
  const generation = runtimeGeneration + 1;

  runtimeGeneration = generation;
  disposeActiveRuntime();
  setActiveOperator(operator);
  publishStatus({
    ...baseStatus,
    ok: false,
    phase: "loading",
    selectedOperator: operator,
    reason: "operator-loading",
    message: `Preparing ${operator} tonemap showcase.`,
  });

  if (options.updateUrl === true) {
    const url = new URL(window.location.href);

    url.searchParams.set("tonemap", operator);
    history.replaceState(null, "", url);
  }

  try {
    const aperture = await loadAperture();

    if (generation !== runtimeGeneration) {
      return;
    }

    if (canvas === null) {
      publishStatus(
        failure("canvas", "canvas-unavailable", "Canvas missing.", operator),
      );
      return;
    }

    const tonemap = aperture.resolveTonemapOperator(operator);
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      tonemap,
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
          operator,
        ),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
      });
      return;
    }

    const scene = await createShowcaseScene(
      aperture,
      created.app,
      sourceAssets,
    );

    if (generation !== runtimeGeneration) {
      created.app.stop();
      return;
    }

    startWorkerSnapshotLoop(
      aperture,
      created.app,
      scene,
      operator,
      readbackUsage,
      generation,
    );
  } catch (error) {
    if (generation === runtimeGeneration) {
      publishStatus(
        failure(
          "runtime",
          "tonemap-showcase-failed",
          error instanceof Error
            ? error.message
            : "The tonemap showcase could not start.",
          operator,
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

async function createShowcaseScene(aperture, app, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "TonemapShowcaseCube",
      width: 1.45,
      height: 1.45,
      depth: 1.45,
    }),
    { id: "spinning-cube" },
  );
  const materialAsset = aperture.createStandardMaterialAsset({
    label: "TonemapShowcaseStandard",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.82,
    roughnessFactor: 0.18,
    emissiveFactor: [0.12, 0.06, 0.025],
  });
  const material = assets.materials.standard.add(materialAsset, {
    id: "spinning-cube-standard",
  });
  const glossyMaterialAsset = aperture.createStandardMaterialAsset({
    label: "TonemapShowcaseGlossyProbe",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.92,
    roughnessFactor: 0,
    emissiveFactor: [0.04, 0.035, 0.03],
  });
  const roughMaterialAsset = aperture.createStandardMaterialAsset({
    label: "TonemapShowcaseRoughProbe",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.92,
    roughnessFactor: 1,
    emissiveFactor: [0.04, 0.035, 0.03],
  });

  assets.materials.standard.add(glossyMaterialAsset, {
    id: "spinning-cube-glossy-probe",
  });
  assets.materials.standard.add(roughMaterialAsset, {
    id: "spinning-cube-rough-probe",
  });

  const environmentMap = aperture.createEnvironmentMapHandle(
    "spinning-cube-pisa-studio",
  );

  sourceAssets.register(environmentMap, {
    label: "Tonemap showcase Pisa HDR studio IBL",
  });
  sourceAssets.markReady(environmentMap, {
    label: "Tonemap showcase Pisa HDR studio IBL",
    diffuseResourceKey: "tonemap-showcase-pisa-studio/diffuse",
    specularResourceKey: "tonemap-showcase-pisa-studio/specular-prefilter",
  });

  const environmentSource = await loadTonemapShowcaseEnvironment(aperture);
  const iblResources = createTonemapShowcaseIblResources(
    aperture,
    app,
    environmentSource,
  );

  return {
    mesh,
    material,
    materialAsset,
    glossyMaterialAsset,
    roughMaterialAsset,
    environmentMap,
    environmentSource,
    iblResources,
    authoredLights: 3,
    authoredEnvironments: 1,
  };
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  requestedOperator,
  readbackUsage,
  generation,
) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/tonemap-showcase.worker.js",
    {
      name: "aperture-tonemap-showcase-simulation",
      type: "module",
    },
  );
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
      requestedOperator,
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
        requestedOperator,
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
  requestedOperator,
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
        requestedOperator,
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
    label: `tonemap-showcase-${app.tonemap}`,
    standardMaterialIblResources: scene.iblResources,
    ...(readbackUsage.ok ? { readbackSamples: [readbackSample] } : {}),
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
    message,
    requestedOperator,
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
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
    });
  });
}

function createFrameStatus(
  aperture,
  app,
  scene,
  report,
  loop,
  message,
  requestedOperator,
  readbackUsage,
) {
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const standardResources = firstFamilyResource(resources, "standard");
  const boundary = report.boundary;
  const reason = firstFailureReason(report, firstDraw, resources);
  const diagnostics = report.diagnostics.map(diagnosticToJson);

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    selectedOperator: app.tonemap,
    ...(reason === null ? {} : reason),
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: app.initialization.format,
    tonemap: {
      operator: app.tonemap,
      requested: requestedOperator,
      pipelineKey: `tonemap:${app.tonemap}`,
      outputColorSpace: app.outputColorSpace,
      outputPipelineKey: `output-color:${app.outputColorSpace}`,
    },
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    extraction: snapshotCounts(snapshot),
    material: {
      kind: scene.materialAsset.kind,
      key: aperture.assetHandleKey(scene.material),
      baseColorFactor: Array.from(scene.materialAsset.baseColorFactor),
      metallicFactor: scene.materialAsset.metallicFactor,
      roughnessFactor: scene.materialAsset.roughnessFactor,
      roughnessProof: {
        glossy: scene.glossyMaterialAsset.roughnessFactor,
        rough: scene.roughMaterialAsset.roughnessFactor,
      },
    },
    lighting: {
      authored: scene.authoredLights,
      extracted: snapshot.lights.length,
      kinds: snapshot.lights.map((light) => light.kind),
      gpuLights: standardResources?.lightGpuBuffers?.lightBuffer.count ?? 0,
    },
    environment: {
      authored: scene.authoredEnvironments,
      extracted: snapshot.environments.length,
      handleKey: aperture.assetHandleKey(scene.environmentMap),
      source: {
        kind: scene.environmentSource.kind,
        loader: scene.environmentSource.loader,
        asset: scene.environmentSource.assetPath,
        label: scene.environmentSource.label,
        format: scene.environmentSource.sourceFormat,
        colorSpace: scene.environmentSource.sourceColorSpace,
        width: scene.environmentSource.width,
        height: scene.environmentSource.height,
        faceSize: scene.environmentSource.faceSize,
        faceCount: scene.environmentSource.faces.length,
        faceOrder: scene.environmentSource.faceOrder,
      },
      specularPrefiltering:
        scene.iblResources.specularTextureResource.sections.prefiltering,
      diffuseResourceKey:
        scene.iblResources.diffuseTextureResource.resources[0]?.resource
          ?.resourceKey,
      specularResourceKey:
        scene.iblResources.specularTextureResource.resources[0]?.resource
          ?.resourceKey,
      specularDiagnosticCodes:
        scene.iblResources.specularTextureResource.diagnostics.map(
          (diagnostic) => diagnostic.code,
        ),
      samplerKey:
        scene.iblResources.samplerResource.resources[0]?.resource?.resourceKey,
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
              "The tonemap showcase frame did not produce a highlight readback sample.",
          }
        : readbackUsage),
    resources: {
      materials: familyResourceCount(resources, "standard", 1),
      bindGroups: resources?.bindGroups.length ?? 0,
      lightBindGroup: standardResources?.lightBindGroup === undefined ? 0 : 1,
      diffuseIblTexture:
        standardResources?.standardMaterialIblBindGroup === undefined ? 0 : 1,
      specularIblTexture:
        scene.iblResources.specularTextureResource.resources[0]?.resource ===
        undefined
          ? 0
          : 1,
      reuse: report.resourceReuse,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
    },
    command: {
      commands: boundary?.execution?.commandCount ?? 0,
      drawCount: boundary?.execution?.drawCalls ?? 0,
      indexedDrawCount: boundary?.execution?.indexedDrawCalls ?? 0,
    },
    submission: {
      commandBuffers: boundary?.submit?.submitted ?? 0,
      drawCalls: boundary?.execution?.drawCalls ?? 0,
      indexedDrawCalls: boundary?.execution?.indexedDrawCalls ?? 0,
    },
    animation: {
      frames: message.animation?.frames ?? message.frame,
      elapsedSeconds: message.animation?.elapsedSeconds ?? 0,
      rotationRadians: message.animation?.rotationRadians ?? 0,
    },
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      render: report.diagnostics.length,
      total: snapshot.diagnostics.length + diagnostics.length,
    },
    diagnostics,
  };
}

function resolveRequestedOperator(value) {
  return operators.includes(value) ? value : defaultOperator;
}

function setActiveOperator(operator) {
  operatorElements.forEach((element) => {
    const active = element.getAttribute("data-tonemap") === operator;

    element.setAttribute("aria-pressed", String(active));
    element.toggleAttribute("disabled", active);
  });
}

function disposeActiveRuntime() {
  activeRuntime?.app?.stop();
  activeRuntime?.worker?.terminate();
  activeRuntime = null;
}

function firstFamilyResource(resources, family) {
  const list = resources?.[family];

  if (Array.isArray(list) && list.length > 0) {
    return list[0];
  }

  return resources;
}

function familyResourceCount(resources, family, fallback) {
  const list = resources?.[family];

  return Array.isArray(list) ? list.length : fallback;
}

function firstFailureReason(report, firstDraw, resources) {
  if (report.ok) {
    return null;
  }

  if (firstDraw === undefined) {
    return {
      reason: "empty-snapshot",
      message: "The tonemap showcase scene did not extract drawable probes.",
    };
  }

  if (resources === null) {
    return {
      reason: "standard-resources-unavailable",
      message:
        "The tonemap showcase standard material resources were not ready.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The tonemap showcase frame could not be rendered.",
  };
}

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    environments: snapshot.environments.length,
    transforms: snapshot.transforms.length / 16,
    viewMatrices: snapshot.viewMatrices.length / 16,
    diagnostics: snapshot.diagnostics.length,
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

function failure(phase, reason, message, operator) {
  return {
    ...baseStatus,
    ok: false,
    phase,
    selectedOperator: operator,
    reason,
    message,
  };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent =
      status.ok && status.selectedOperator !== undefined
        ? status.selectedOperator
        : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
