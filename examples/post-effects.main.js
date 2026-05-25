import { configureApertureExampleControl } from "./example-control.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const effectButtons = Array.from(document.querySelectorAll("[data-effect]"));
const clearColor = [0.015, 0.018, 0.025, 1];
const readbackSamples = createGridReadbackSamples(21, 13);

let aperturePromise = null;
let activeRuntime = null;
let runtimeGeneration = 0;

const baseStatus = {
  example: "post-effects",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

configureApertureExampleControl({
  capabilities: {
    scenario: true,
    readback: true,
  },
  async setScenario(id) {
    const config = postEffectsScenarioConfig(id);

    await withTimeout(
      startConfig(config, { updateUrl: true }),
      8000,
      "post-effects-scenario-start-timeout",
    );
    return waitForPostEffectsStatus(config);
  },
  getFrameState() {
    const status = globalThis.__APERTURE_EXAMPLE_STATUS__ ?? null;

    return {
      status,
      frame: status?.extraction?.frame ?? null,
      effects: status?.effects ?? null,
      readback: status?.readback ?? null,
    };
  },
});

window.__APERTURE_POST_EFFECTS_STOP__ = disposeActiveRuntime;

effectButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const effect = button.getAttribute("data-effect");
    const current = readConfigFromLocation();

    if (effect === "fxaa") {
      void startConfig(
        { ...current, fxaa: !current.fxaa },
        { updateUrl: true },
      );
    } else if (effect === "bloom") {
      void startConfig(
        { ...current, bloom: !current.bloom },
        { updateUrl: true },
      );
    }
  });
});

await startConfig(readConfigFromLocation());

async function startConfig(config, options = {}) {
  const generation = runtimeGeneration + 1;

  runtimeGeneration = generation;
  disposeActiveRuntime();
  updateButtons(config);
  publishStatus({
    ...baseStatus,
    ok: false,
    phase: "loading",
    effects: effectStatus(config, []),
    reason: "post-effects-loading",
    message: "Preparing post effect chain.",
  });

  if (options.updateUrl === true) {
    const url = new URL(window.location.href);

    url.searchParams.set("fxaa", config.fxaa ? "1" : "0");
    url.searchParams.set("bloom", config.bloom ? "1" : "0");
    history.replaceState(null, "", url);
  }

  try {
    const aperture = await loadAperture();

    if (generation !== runtimeGeneration) {
      return;
    }

    if (canvas === null) {
      publishStatus(
        failure(
          "canvas",
          "canvas-unavailable",
          "Post effects canvas missing.",
          config,
        ),
      );
      return;
    }

    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const scene = createPostEffectPresentationAssets(aperture, sourceAssets);
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: {
        start() {},
        onSnapshot() {
          return () => {};
        },
        onError() {
          return () => {};
        },
      },
      sourceAssets,
      postEffects: createPostEffects(aperture, config),
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
          config,
        ),
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      });
      return;
    }

    startWorkerSnapshotLoop(
      aperture,
      created.app,
      scene,
      config,
      readbackUsage,
      generation,
    );
  } catch (error) {
    if (generation === runtimeGeneration) {
      publishStatus(
        failure(
          "runtime",
          "post-effects-failed",
          error instanceof Error
            ? error.message
            : "The post effects example could not start.",
          config,
        ),
      );
    }
  }
}

function loadAperture() {
  aperturePromise ??= Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]).then(([core, webgpu]) => ({ ...core, ...webgpu }));

  return aperturePromise;
}

function createPostEffects(aperture, config) {
  const effects = [];

  if (config.fxaa) {
    effects.push(aperture.createWebGpuFxaaPostEffect());
  }

  if (config.bloom) {
    effects.push(
      aperture.createWebGpuBloomPostEffect({
        threshold: 0.65,
        intensity: 1.15,
        radiusPixels: 1.25,
      }),
    );
  }

  return effects;
}

function createPostEffectPresentationAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const edgeMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "PostEffectsEdgePlane",
      width: 1.5,
      height: 1.75,
    }),
    { id: "post-effects-edge-plane" },
  );
  const glowMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "PostEffectsGlowPlane",
      width: 0.34,
      height: 0.34,
    }),
    { id: "post-effects-glow-plane" },
  );
  const whiteMaterialAsset = aperture.createUnlitMaterialAsset({
    label: "PostEffectsWhite",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    renderState: { cullMode: "none" },
  });
  const whiteMaterial = assets.materials.unlit.add(whiteMaterialAsset, {
    id: "post-effects-white",
  });

  return {
    edgeMesh,
    glowMesh,
    whiteMaterial,
    whiteMaterialAsset,
  };
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  config,
  readbackUsage,
  generation,
) {
  const worker = new Worker("/worker-modules/examples/post-effects.worker.js", {
    name: "aperture-post-effects-simulation",
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
        event.message || "The post effects worker reported an error.",
        config,
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
  config,
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
        message.message ?? "The post effects worker failed.",
        config,
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
    label: "post-effects",
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
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
    });
  });
}

function createFrameStatus(options) {
  const { aperture, app, scene, report, loop, message, config, readbackUsage } =
    options;
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const reason = firstFailureReason(report, firstDraw, resources);

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    ...(reason === null ? {} : reason),
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: app.initialization.format,
    effects: effectStatus(config, report.postEffects ?? []),
    scene: {
      meshKeys: [
        aperture.assetHandleKey(scene.edgeMesh),
        aperture.assetHandleKey(scene.glowMesh),
      ],
      materialKey: aperture.assetHandleKey(scene.whiteMaterial),
      materialColor: Array.from(scene.whiteMaterialAsset.baseColorFactor),
    },
    extraction: {
      frame: snapshot.frame,
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      transforms: snapshot.transforms.length / 16,
      diagnostics: snapshot.diagnostics.length,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
    },
    command: {
      commands: report.boundary?.execution?.commandCount ?? 0,
      drawCount: report.boundary?.execution?.drawCalls ?? 0,
      indexedDrawCount: report.boundary?.execution?.indexedDrawCalls ?? 0,
    },
    readback:
      report.readback ??
      (readbackUsage.ok
        ? {
            ok: false,
            reason: "readback-unavailable",
            message: "The post effects frame did not produce readback samples.",
          }
        : readbackUsage),
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

function effectStatus(config, report) {
  return {
    fxaa: config.fxaa,
    bloom: config.bloom,
    enabledIds: [
      ...(config.fxaa ? ["fxaa"] : []),
      ...(config.bloom ? ["bloom"] : []),
    ],
    report: report.map((effect) => ({
      effectId: effect.effectId,
      label: effect.label,
      ok: effect.ok,
      input: effect.input,
      output: effect.output,
      drawCalls: effect.drawCalls,
      graph: effect.graph,
      diagnostics: effect.diagnostics,
    })),
  };
}

function readConfigFromLocation() {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    fxaa: searchParams.get("fxaa") !== "0",
    bloom: searchParams.get("bloom") !== "0",
  };
}

function postEffectsScenarioConfig(id) {
  if (id === "raw" || id === "none") {
    return { fxaa: false, bloom: false };
  }

  if (id === "fxaa") {
    return { fxaa: true, bloom: false };
  }

  if (id === "bloom") {
    return { fxaa: false, bloom: true };
  }

  if (id === "fxaa-bloom" || id === "default") {
    return { fxaa: true, bloom: true };
  }

  throw new Error(`Unknown post-effects scenario '${id}'.`);
}

async function waitForPostEffectsStatus(config) {
  const deadline = performance.now() + 8000;

  while (performance.now() < deadline) {
    const status = globalThis.__APERTURE_EXAMPLE_STATUS__;

    if (
      status?.ok === true &&
      status.effects?.fxaa === config.fxaa &&
      status.effects?.bloom === config.bloom
    ) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return {
    ok: false,
    reason: "post-effects-scenario-timeout",
    message: "Post effects scenario did not reach a ready status.",
    expected: config,
    status: globalThis.__APERTURE_EXAMPLE_STATUS__ ?? null,
  };
}

async function withTimeout(promise, timeoutMs, reason) {
  let timeoutId = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(reason));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

function updateButtons(config) {
  effectButtons.forEach((button) => {
    const effect = button.getAttribute("data-effect");
    const enabled =
      (effect === "fxaa" && config.fxaa) ||
      (effect === "bloom" && config.bloom);

    button.setAttribute("aria-pressed", String(enabled));
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

function createGridReadbackSamples(columns, rows) {
  const samples = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      samples.push({
        id: `grid-${x}-${y}`,
        x: (x + 0.5) / columns,
        y: (y + 0.5) / rows,
      });
    }
  }

  return samples;
}

function firstFailureReason(report, firstDraw, resources) {
  if (report.ok) {
    return null;
  }

  if (firstDraw === undefined) {
    return {
      reason: "empty-snapshot",
      message: "The post effects scene did not extract drawable planes.",
    };
  }

  if (resources === null) {
    return {
      reason: "resources-unavailable",
      message: "The post effects render resources were not ready.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The post effects frame could not be rendered.",
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

function failure(phase, reason, message, config) {
  return {
    ...baseStatus,
    ok: false,
    phase,
    reason,
    message,
    effects: effectStatus(config, []),
  };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok
      ? status.effects.enabledIds.join("+") || "none"
      : status.phase;
    stateElement.dataset.state =
      status.ok || status.phase === "loading" ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
