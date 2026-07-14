import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { configureApertureExampleControl } from "./example-control.js";
import {
  racetrackTubeClearColor,
  racetrackTubeConfig,
  racetrackTubeExpectedMeshDraws,
} from "./racetrack-tube.main.js";

// Parity plan G2: a procedural racetrack tube authored through the app facade.
// The generated simulation worker builds a closed Catmull-Rom loop, sweeps it
// into a single `createTubeMeshAsset` mesh, and spawns it with one
// `material.standard()`; this thread only initializes the generated browser app
// and publishes render-frame status for the e2e.

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

configureApertureExampleControl({
  getStatus: () => racetrackTubeStatus(),
});
requestAnimationFrame(function publishRacetrackTubeStatus() {
  racetrackTubeStatus();
  requestAnimationFrame(publishRacetrackTubeStatus);
});

try {
  await startGeneratedBrowserApp({
    config: racetrackTubeConfig,
    workerEntry: "/worker-modules/examples/racetrack-tube.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/racetrack-tube.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "racetrack-tube",
    ok: false,
    state: "failed",
    reason: "racetrack-tube-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Racetrack tube example failed to start.",
  });
}

function racetrackTubeStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const lastFrame = generated?.diagnostics?.lastFrame ?? null;
  const counts = lastFrame?.counts ?? null;
  const meshDraws = counts?.meshDraws ?? 0;
  const status = {
    example: "racetrack-tube",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      meshDraws === racetrackTubeExpectedMeshDraws &&
      (counts?.drawCalls ?? 0) >= 1 &&
      (counts?.diagnostics ?? 0) === 0,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    renderingBackend: "webgpu-explicit",
    canvas: {
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
    },
    clearColor: racetrackTubeClearColor,
    tube: {
      expectedMeshDraws: racetrackTubeExpectedMeshDraws,
    },
    frame: {
      counts:
        counts === null
          ? null
          : {
              views: counts.views,
              meshDraws: counts.meshDraws,
              drawCalls: counts.drawCalls,
              diagnostics: counts.diagnostics,
            },
    },
    snapshots: generated?.snapshots ?? 0,
  };

  publishStatus(status);
  return status;
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : status.state;
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function webGpuFailureReason(generated) {
  if (generated?.status !== "webgpu-failed") {
    return undefined;
  }

  return typeof generated.diagnostics?.reason === "string"
    ? generated.diagnostics.reason
    : "webgpu-failed";
}

function webGpuFailureMessage(generated) {
  if (generated?.status !== "webgpu-failed") {
    return undefined;
  }

  return typeof generated.diagnostics?.message === "string"
    ? generated.diagnostics.message
    : "WebGPU initialization failed.";
}
