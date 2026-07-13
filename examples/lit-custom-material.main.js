import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { configureApertureExampleControl } from "./example-control.js";

// Main-thread half of the lit-custom-material example: boots the generated
// browser app against the worker (lit-custom-material.worker.js) and
// publishes a status JSON. The scene is a custom lit-WGSL sphere (group(3)
// lit contract, A1) beside a StandardMaterial reference sphere over a
// shadow-receiving ground plane, lit by ambient + directional + point light.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const expectedMeshDraws = 3; // custom sphere + reference sphere + ground

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
  getStatus: () => litCustomMaterialStatus(),
});
requestAnimationFrame(function publishLitCustomMaterialStatus() {
  litCustomMaterialStatus();
  requestAnimationFrame(publishLitCustomMaterialStatus);
});

try {
  await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/lit-custom-material.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/lit-custom-material.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "lit-custom-material",
    ok: false,
    state: "failed",
    reason: "lit-custom-material-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Lit custom material example failed to start.",
  });
}

function litCustomMaterialStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const diagnostics = generated?.diagnostics ?? null;
  const lastFrame = diagnostics?.lastFrame ?? null;
  const meshDraws = lastFrame?.counts?.meshDraws ?? 0;
  const drawCalls = lastFrame?.counts?.drawCalls ?? 0;
  const status = {
    example: "lit-custom-material",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      meshDraws === expectedMeshDraws &&
      drawCalls > 0,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
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
