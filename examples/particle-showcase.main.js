import {
  readGeneratedBrowserAppStatus,
  startGeneratedBrowserApp,
} from "@aperture-engine/app/browser";
import { configureApertureExampleControl } from "./example-control.js";
import {
  particleShowcaseConfig,
  particleShowcaseEffects,
  particleShowcaseExpected,
  particleShowcaseModels,
  particleShowcaseTextures,
} from "./particle-showcase.shared.js";

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
let latestStatus = null;
let renderedOnce = false;

configureApertureExampleControl({
  getStatus: () => latestStatus,
});

requestAnimationFrame(function publishParticleShowcaseStatus() {
  particleShowcaseStatus();
  requestAnimationFrame(publishParticleShowcaseStatus);
});

try {
  await startGeneratedBrowserApp({
    config: particleShowcaseConfig,
    workerEntry: "/worker-modules/examples/particle-showcase.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/particle-showcase.worker.js",
        hasDefaultExport: false,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "particle-showcase",
    ok: false,
    state: "failed",
    reason: "particle-showcase-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Particle showcase failed to start.",
  });
}

function particleShowcaseStatus() {
  const generated = readGeneratedBrowserAppStatus();
  const workerSummary = generated?.lastWorkerSummary ?? null;
  const workerParticles = recordAt(workerSummary, "particles");
  const frame = recordAt(generated?.diagnostics ?? null, "lastFrame");
  const counts = recordAt(frame, "counts");
  const rendererParticles = recordAt(frame, "particles");
  const diagnostics = Array.isArray(frame?.diagnostics)
    ? frame.diagnostics
    : [];
  const hasAssetSummary = Array.isArray(workerSummary?.assets);
  const assets = hasAssetSummary ? workerSummary.assets : [];
  const textureAssets = particleShowcaseTextures.map((texture) =>
    summarizeAsset(assets.find((entry) => entry?.id === texture.id)),
  );
  const effectAssets = particleShowcaseEffects.map((effect) =>
    summarizeAsset(assets.find((entry) => entry?.id === effect.id)),
  );
  const modelAssets = particleShowcaseModels.map((model) =>
    summarizeAsset(assets.find((entry) => entry?.id === model.id)),
  );
  const readyAssets = [
    ...textureAssets,
    ...effectAssets,
    ...modelAssets,
  ].filter((entry) => entry?.ready === true).length;
  const liveParticles = numberAt(rendererParticles, "liveParticles");
  const texturedEmitters = numberAt(rendererParticles, "texturedEmitters");
  const queueDropped = numberAt(workerParticles, "dropped");
  const queueRejected =
    numberAt(workerParticles, "rejectedNotReady") +
    numberAt(workerParticles, "rejectedInvalid");
  const healthy =
    generated?.status === "running" &&
    generated.webgpuOk === true &&
    (!hasAssetSummary ||
      readyAssets >= particleShowcaseExpected.minReadyAssets) &&
    numberAt(workerParticles, "enqueued") >=
      particleShowcaseExpected.minEnqueuedBursts &&
    queueDropped === 0 &&
    queueRejected === 0 &&
    numberAt(counts, "drawCalls") >= particleShowcaseExpected.minDrawCalls &&
    diagnostics.length === 0;
  const hasRenderedFrame =
    healthy &&
    numberAt(workerParticles, "active") > 0 &&
    numberAt(counts, "particleEmitters") > 0 &&
    texturedEmitters > 0 &&
    liveParticles >= particleShowcaseExpected.minLiveParticles;
  if (hasRenderedFrame) {
    renderedOnce = true;
  }
  const ok = healthy && renderedOnce;
  const status = {
    example: "particle-showcase",
    ok,
    state: generated?.status ?? "starting",
    reason:
      generated?.webgpuOk === false &&
      typeof generated.diagnostics?.reason === "string"
        ? generated.diagnostics.reason
        : undefined,
    message:
      generated?.webgpuOk === false &&
      typeof generated.diagnostics?.message === "string"
        ? generated.diagnostics.message
        : undefined,
    phase: ok ? "rendered" : "waiting",
    expected: particleShowcaseExpected,
    assets: {
      reported: hasAssetSummary,
      ready: readyAssets,
      textures: textureAssets,
      effects: effectAssets,
      models: modelAssets,
    },
    worker: {
      snapshots: generated?.snapshots ?? 0,
      particles: workerParticles,
    },
    frame: {
      frame: typeof frame?.frame === "number" ? frame.frame : null,
      counts,
      particles: rendererParticles,
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic?.code),
    },
  };

  publishStatus(status);
  return status;
}

function publishStatus(status) {
  latestStatus = status;
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : status.state;
    stateElement.dataset.state = status.ok ? "ready" : "waiting";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function recordAt(value, key) {
  const next = value?.[key];

  return typeof next === "object" && next !== null ? next : null;
}

function numberAt(value, key) {
  const next = value?.[key];

  return typeof next === "number" && Number.isFinite(next) ? next : 0;
}

function summarizeAsset(asset) {
  if (asset === undefined) {
    return null;
  }

  return {
    id: asset.id,
    kind: asset.kind,
    ready: asset.ready === true,
    ...(asset.runtimeFeatures === undefined
      ? {}
      : { runtimeFeatures: asset.runtimeFeatures }),
  };
}
