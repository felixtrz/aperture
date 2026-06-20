import type { SimulationWorker } from "@aperture-engine/runtime";
import {
  APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
  createGeneratedCommandMessage,
} from "../commands.js";
import type { ApertureConfig, ApertureRenderDefaults } from "../config.js";
import {
  measureGeneratedCanvasResize,
  resolveGeneratedRenderSettings,
  type GeneratedCanvasResizeSource,
} from "./render.js";
import type { GeneratedBrowserAppStatus } from "./status.js";

export function resolveCanvas(config: ApertureConfig): HTMLCanvasElement {
  if (config.mode !== "browser") {
    throw new Error(
      "Generated browser bootstrap can only run configs with mode: 'browser'.",
    );
  }

  const selector = config.canvas;
  if (selector === undefined) {
    throw new Error("Browser Aperture config is missing canvas.");
  }

  const element = document.querySelector(selector);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(
      `Aperture canvas selector '${selector}' did not match a canvas element.`,
    );
  }

  return element;
}

export function installCanvasResizeSync(
  canvas: HTMLCanvasElement,
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  render: ApertureRenderDefaults | undefined,
  options: {
    readonly afterResize?: () => void;
    readonly renderProfile?: string | null;
  } = {},
): void {
  let lastSignature = "";

  const resize = (
    resizeSource: GeneratedCanvasResizeSource,
    resizeEntry?: ResizeObserverEntry,
  ) => {
    const resizeStatus = measureGeneratedCanvasResize(canvas, {
      resizeSource,
      ...(render === undefined ? {} : { render }),
      ...(resizeEntry === undefined ? {} : { resizeEntry }),
    });
    const signature = [
      resizeStatus.width,
      resizeStatus.height,
      resizeStatus.displayWidth,
      resizeStatus.displayHeight,
      resizeStatus.pixelRatio,
    ].join(":");

    status.render = resolveGeneratedRenderSettings(
      render,
      undefined,
      options.renderProfile ?? null,
    );

    if (canvas.width !== resizeStatus.width) {
      canvas.width = resizeStatus.width;
    }

    if (canvas.height !== resizeStatus.height) {
      canvas.height = resizeStatus.height;
    }

    status.canvas = resizeStatus;

    if (signature !== lastSignature) {
      worker.postMessage(
        createGeneratedCommandMessage({
          channel: APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
          payload: resizeStatus,
        }),
      );
      options.afterResize?.();
      lastSignature = signature;
    }
  };

  resize("initial");

  if ("ResizeObserver" in globalThis) {
    const observer = new ResizeObserver((entries) => {
      resize(
        "resize-observer",
        entries.find((entry) => entry.target === canvas),
      );
    });
    try {
      observer.observe(canvas, { box: "device-pixel-content-box" });
    } catch {
      observer.observe(canvas);
    }
    return;
  }

  window.addEventListener("resize", () => resize("window-resize"));
}
