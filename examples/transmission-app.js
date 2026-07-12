import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { configureApertureExampleControl } from "./example-control.js";
import {
  transmissionAppExpectedMeshDraws,
  transmissionAppRoughness,
  transmissionAppStripeCount,
  transmissionAppTransmissionFactor,
  transmissionAppConfig,
} from "./transmission-app.shared.js";

// Parity plan A3 AC2: the transmission scene authored purely through the app
// facade — createApertureApp systems in the generated simulation worker spawn
// `material.standard()` descriptors (transmissionFactor + blend renderState),
// with zero low-level asset construction on either thread.

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

configureApertureExampleControl({
  getStatus: () => transmissionAppStatus(),
});
requestAnimationFrame(function publishTransmissionAppStatus() {
  transmissionAppStatus();
  requestAnimationFrame(publishTransmissionAppStatus);
});

try {
  await startGeneratedBrowserApp({
    config: transmissionAppConfig,
    workerEntry: "/worker-modules/examples/transmission-app.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/transmission-app.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
} catch (error) {
  publishStatus({
    example: "transmission-app",
    ok: false,
    state: "failed",
    reason: "transmission-app-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Transmission app example failed to start.",
  });
}

function transmissionAppStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const lastFrame = generated?.diagnostics?.lastFrame ?? null;
  const counts = lastFrame?.counts ?? null;
  const grabPass = lastFrame?.transmissionGrabPass ?? null;
  const meshDraws = counts?.meshDraws ?? 0;
  const status = {
    example: "transmission-app",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      meshDraws === transmissionAppExpectedMeshDraws &&
      (counts?.drawCalls ?? 0) >= 2 &&
      (counts?.diagnostics ?? 0) === 0 &&
      grabPass?.ok === true,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    renderingBackend: "webgpu-explicit",
    canvas: {
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
    },
    transmission: {
      transmissionFactor: transmissionAppTransmissionFactor,
      roughness: transmissionAppRoughness,
      stripeCount: transmissionAppStripeCount,
      expectedMeshDraws: transmissionAppExpectedMeshDraws,
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
      transmissionGrabPass:
        grabPass === null
          ? null
          : {
              enabled: grabPass.enabled,
              ok: grabPass.ok,
              width: grabPass.width,
              height: grabPass.height,
              commands: grabPass.commands,
              drawCalls: grabPass.drawCalls,
              textureResourceKey: grabPass.textureResourceKey,
              samplerResourceKey: grabPass.samplerResourceKey,
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
