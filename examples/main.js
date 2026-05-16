import { initializeWebGpuWithOptionalReadbackUsage } from "./webgpu-readback.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = { r: 0.08, g: 0.28, b: 0.64, a: 1 };

const baseStatus = {
  example: "webgpu-clear",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const aperture = await import("/dist/index.js");

  if (canvas === null) {
    publishStatus({
      ...baseStatus,
      ok: false,
      phase: "canvas",
      reason: "canvas-unavailable",
      message: "The Aperture example canvas is missing.",
    });
  } else {
    const initialization = await initializeWebGpuWithOptionalReadbackUsage({
      aperture,
      canvas,
    });
    const { initialized, readbackUsage } = initialization;

    if (!initialized.ok) {
      publishStatus({
        ...baseStatus,
        ok: false,
        phase: "initialize-webgpu",
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
        reason: initialized.reason,
        message: initialized.message,
      });
    } else {
      const clearReport = await clearCanvasWithOptionalReadback({
        aperture,
        initialized,
        readbackUsage,
      });
      const cleared = clearReport.clear;

      if (cleared.ok) {
        await waitForSubmittedWork(initialized.device);
      }

      publishStatus(
        cleared.ok
          ? {
              ...baseStatus,
              ok: true,
              phase: "clear",
              apertureVersion: aperture.APERTURE_VERSION,
              renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
              format: initialized.format,
              clearColor,
              readback: clearReport.readback,
            }
          : {
              ...baseStatus,
              ok: false,
              phase: "clear",
              apertureVersion: aperture.APERTURE_VERSION,
              renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
              format: initialized.format,
              reason: cleared.reason,
              message: cleared.message,
              clearColor,
              readback: clearReport.readback,
            },
      );
    }
  }
} catch (error) {
  publishStatus({
    ...baseStatus,
    ok: false,
    reason: "dist-import-failed",
    message:
      error instanceof Error
        ? error.message
        : "The built Aperture package could not be imported from /dist.",
  });
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

async function waitForSubmittedWork(device) {
  if (typeof device.queue?.onSubmittedWorkDone === "function") {
    await device.queue.onSubmittedWorkDone();
  }
}

async function clearCanvasWithOptionalReadback({
  aperture,
  initialized,
  readbackUsage,
}) {
  if (!readbackUsage.ok) {
    const clear = aperture.clearWebGpuCanvas({
      device: initialized.device,
      context: initialized.context,
      color: clearColor,
    });

    return {
      clear,
      readback: {
        ...readbackUsage,
        clearOk: clear.ok,
      },
    };
  }

  return aperture.clearWebGpuCanvasWithReadback({
    device: initialized.device,
    context: initialized.context,
    format: initialized.format,
    width: canvas.width,
    height: canvas.height,
    color: clearColor,
  });
}
