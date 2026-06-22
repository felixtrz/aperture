import {
  readGeneratedBrowserAppStatus,
  startGeneratedBrowserApp,
} from "@aperture-engine/app/browser";
import { configureApertureExampleControl } from "./example-control.js";
import {
  particleBurstsEffectId,
  particleBurstsExpected,
  particleBurstsTextureId,
  particleBurstsConfig,
} from "./particle-bursts.shared.js";

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
let latestStatus = null;

configureApertureExampleControl({
  getStatus: () => latestStatus,
});
requestAnimationFrame(function publishParticleBurstStatus() {
  particleBurstsStatus();
  requestAnimationFrame(publishParticleBurstStatus);
});

try {
  await startGeneratedBrowserApp({
    config: particleBurstsConfig,
    workerEntry: "/worker-modules/examples/particle-bursts.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/particle-bursts.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "particle-bursts",
    ok: false,
    state: "failed",
    reason: "particle-bursts-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Particle burst proof failed to start.",
  });
}

function particleBurstsStatus() {
  const generated = readGeneratedBrowserAppStatus();
  const workerSummary = generated?.lastWorkerSummary ?? null;
  const workerParticles = recordAt(workerSummary, "particles");
  const frame = recordAt(generated?.diagnostics ?? null, "lastFrame");
  const counts = recordAt(frame, "counts");
  const rendererParticles = recordAt(frame, "particles");
  const diagnostics = Array.isArray(frame?.diagnostics)
    ? frame.diagnostics
    : [];
  const assets = Array.isArray(workerSummary?.assets)
    ? workerSummary.assets
    : [];
  const texture = assets.find((entry) => entry?.id === particleBurstsTextureId);
  const effect = assets.find((entry) => entry?.id === particleBurstsEffectId);
  const liveParticles = numberAt(rendererParticles, "liveParticles");
  const texturedEmitters = numberAt(rendererParticles, "texturedEmitters");
  const textureResourceTouches =
    numberAt(rendererParticles, "textureResourcesCreated") +
    numberAt(rendererParticles, "textureResourcesReused");
  const queueDropped = numberAt(workerParticles, "dropped");
  const queueRejected =
    numberAt(workerParticles, "rejectedNotReady") +
    numberAt(workerParticles, "rejectedInvalid");
  const ok =
    generated?.status === "running" &&
    generated.webgpuOk === true &&
    texture?.ready === true &&
    effect?.ready === true &&
    numberAt(workerParticles, "enqueued") >=
      particleBurstsExpected.minEnqueuedBursts &&
    numberAt(workerParticles, "active") > 0 &&
    queueDropped === 0 &&
    queueRejected === 0 &&
    numberAt(counts, "particleEmitters") > 0 &&
    numberAt(counts, "drawCalls") > 0 &&
    liveParticles >= particleBurstsExpected.minLiveParticles &&
    texturedEmitters > 0 &&
    textureResourceTouches > 0 &&
    diagnostics.length === 0;
  const status = {
    example: "particle-bursts",
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
    expected: particleBurstsExpected,
    assets: {
      texture: summarizeAsset(texture),
      effect: summarizeAsset(effect),
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
