import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { configureApertureExampleControl } from "./example-control.js";

// Main-thread half of the minimap example: boots the generated browser app
// against the worker (minimap.worker.js) and publishes a status JSON. The
// scene is an arena with a moving player box, rendered by a main chase
// camera and by an overhead orthographic camera into a facade-registered
// render target (B1: this.renderTargets.register); a screen-space HUD quad
// in the upper-left corner samples the target through material.texture.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
// ground + 4 corner boxes + player + HUD quad
const expectedMeshDraws = 7;
const expectedViews = 2; // minimap render-target view + main swapchain view

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
  getStatus: () => minimapStatus(),
});
requestAnimationFrame(function publishMinimapStatus() {
  minimapStatus();
  requestAnimationFrame(publishMinimapStatus);
});

try {
  await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/minimap.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/minimap.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "minimap",
    ok: false,
    state: "failed",
    reason: "minimap-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Minimap example failed to start.",
  });
}

function minimapStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const diagnostics = generated?.diagnostics ?? null;
  const lastFrame = diagnostics?.lastFrame ?? null;
  const meshDraws = lastFrame?.counts?.meshDraws ?? 0;
  const drawCalls = lastFrame?.counts?.drawCalls ?? 0;
  const views = lastFrame?.counts?.views ?? 0;
  const status = {
    example: "minimap",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      views === expectedViews &&
      meshDraws === expectedMeshDraws &&
      drawCalls > 0,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    expectedMeshDraws,
    expectedViews,
    meshDraws,
    drawCalls,
    views,
    renderTarget: {
      id: "minimap.rt",
      width: 256,
      height: 256,
      source: "this.renderTargets.register",
      sampledBy: "material.texture (HUD quad, upper-left corner)",
    },
    // Normalized screen rect the HUD quad covers (sampled by the e2e spec).
    hudRect: { x: 0.025, y: 0.03, width: 0.3, height: 0.32 },
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
