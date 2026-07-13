import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { configureApertureExampleControl } from "./example-control.js";

// Main-thread half of the shadow-displacement example: boots the generated
// browser app against the worker (shadow-displacement.worker.js) and
// publishes a status JSON. The scene is 12 custom-WGSL flag strips (with a
// shadowVertex caster entry point), one standard-material pole, and one
// standard-material ground receiving the directional shadow — the runtime
// uniform packet carries the wave time every frame.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const stripCount = 12;
const expectedMeshDraws = stripCount + 2; // strips + ground + pole

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: [0.02, 0.03, 0.05, 1],
  },
});

configureApertureExampleControl({
  getStatus: () => shadowDisplacementStatus(),
});
requestAnimationFrame(function publishShadowDisplacementStatus() {
  shadowDisplacementStatus();
  requestAnimationFrame(publishShadowDisplacementStatus);
});

try {
  await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/shadow-displacement.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/shadow-displacement.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "shadow-displacement",
    ok: false,
    state: "failed",
    reason: "shadow-displacement-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Shadow displacement example failed to start.",
  });
}

function shadowDisplacementStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const diagnostics = generated?.diagnostics ?? null;
  const lastFrame = diagnostics?.lastFrame ?? null;
  const meshDraws = lastFrame?.counts?.meshDraws ?? 0;
  const drawCalls = lastFrame?.counts?.drawCalls ?? 0;
  const status = {
    example: "shadow-displacement",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      meshDraws === expectedMeshDraws &&
      drawCalls > 0,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    stripCount,
    expectedMeshDraws,
    meshDraws,
    drawCalls,
    frame: lastFrame?.frame ?? null,
    frameOk: lastFrame?.ok ?? null,
    snapshots: generated?.snapshots ?? 0,
    mirroredSourceAssets: generated?.mirroredSourceAssets ?? 0,
    diagnosticsCount: lastFrame?.counts?.diagnostics ?? 0,
  };

  publishStatus(status);
  return status;
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

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "running" : status.state;
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
