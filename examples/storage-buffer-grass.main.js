import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { configureApertureExampleControl } from "./example-control.js";

// Main-thread half of the storage-buffer grass example: boots the generated
// browser app against the worker (storage-buffer-grass.worker.js) and
// publishes a status JSON asserting the instanced draw shape — 64 mesh draws
// collapsing into a small number of instanced draw calls, with the
// runtime-buffer packet family flowing through every frame.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const bladeCount = 64;

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: [0.012, 0.02, 0.03, 1],
  },
});

configureApertureExampleControl({
  getStatus: () => storageBufferGrassStatus(),
});
requestAnimationFrame(function publishStorageBufferGrassStatus() {
  storageBufferGrassStatus();
  requestAnimationFrame(publishStorageBufferGrassStatus);
});

try {
  await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/storage-buffer-grass.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/storage-buffer-grass.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "storage-buffer-grass",
    ok: false,
    state: "failed",
    reason: "storage-buffer-grass-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Storage buffer grass example failed to start.",
  });
}

function storageBufferGrassStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const diagnostics = generated?.diagnostics ?? null;
  const lastFrame = diagnostics?.lastFrame ?? null;
  const meshDraws = lastFrame?.counts?.meshDraws ?? 0;
  const drawCalls = lastFrame?.counts?.drawCalls ?? 0;
  const runtimeBuffers = lastFrame?.counts?.runtimeBuffers ?? 0;
  const status = {
    example: "storage-buffer-grass",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      meshDraws === bladeCount &&
      runtimeBuffers === 1 &&
      drawCalls > 0 &&
      drawCalls < bladeCount,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    bladeCount,
    meshDraws,
    drawCalls,
    runtimeBuffers,
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
