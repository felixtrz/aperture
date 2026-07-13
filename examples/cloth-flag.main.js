import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";

import { configureApertureExampleControl } from "./example-control.js";
import {
  CLOTH_EXPECTED_FRAME_BYTES,
  CLOTH_FULL_UPLOAD_BYTES,
} from "./cloth-flag-scene.js";

// Main-thread half of the cloth-flag example (D5). Boots the generated browser
// app against cloth-flag.worker.js and publishes a status JSON. The worker
// deforms the flag each frame with meshes.update(...); this thread reads the
// resulting per-frame report and surfaces its dynamic-mesh partial-upload
// counters so the e2e can prove the uploads are partial (frameBytes ==
// moving-window size, strictly below a full re-realization) and repeated with
// no asset re-registration.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
// The flag is the only spawned mesh.
const expectedMeshDraws = 1;

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: [0.03, 0.04, 0.08, 1],
  },
});

configureApertureExampleControl({
  getStatus: () => clothStatus(),
});
requestAnimationFrame(function publishClothStatus() {
  clothStatus();
  requestAnimationFrame(publishClothStatus);
});

try {
  await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/cloth-flag.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/cloth-flag.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "cloth-flag",
    ok: false,
    state: "failed",
    reason: "cloth-flag-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Cloth flag example failed to start.",
  });
}

function clothStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const diagnostics = generated?.diagnostics ?? null;
  const lastFrame = diagnostics?.lastFrame ?? null;
  const counts = lastFrame?.counts ?? null;
  const meshDraws = counts?.meshDraws ?? 0;
  const drawCalls = counts?.drawCalls ?? 0;
  const uploads = lastFrame?.dynamicMeshUploads ?? null;

  const partialUpload =
    uploads !== null &&
    uploads.partial === true &&
    uploads.frameBytes === CLOTH_EXPECTED_FRAME_BYTES &&
    uploads.frameBytes < uploads.frameFullBytes;

  const status = {
    example: "cloth-flag",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      meshDraws === expectedMeshDraws &&
      drawCalls > 0 &&
      partialUpload,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    expectedMeshDraws,
    meshDraws,
    drawCalls,
    // The D5 headline: this frame's partial upload proof.
    expectedFrameBytes: CLOTH_EXPECTED_FRAME_BYTES,
    fullUploadBytes: CLOTH_FULL_UPLOAD_BYTES,
    partialUpload,
    upload:
      uploads === null
        ? null
        : {
            frameBytes: uploads.frameBytes,
            frameFullBytes: uploads.frameFullBytes,
            frameWrites: uploads.frameWrites,
            frameUpdates: uploads.frameUpdates,
            partial: uploads.partial,
            totalUpdates: uploads.totalUpdates,
            totalBytes: uploads.totalBytes,
          },
    frame: lastFrame?.frame ?? null,
    frameOk: lastFrame?.ok ?? null,
    snapshots: generated?.snapshots ?? 0,
    diagnosticsCount: counts?.diagnostics ?? 0,
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
