import {
  createSimulationWorker,
  type SimulationWorker,
  type SimulationWorkerEntry,
} from "@aperture-engine/runtime";
import {
  createWebGpuApp,
  type CreateWebGpuAppResult,
  type WebGpuCanvasLike,
} from "@aperture-engine/webgpu";
import { defineApertureConfig, type ApertureConfig } from "./config.js";

export interface GeneratedBrowserSystemManifestEntry {
  readonly moduleUrl: string;
  readonly hasDefaultExport: boolean;
  readonly schedule: {
    readonly priority: number;
  };
}

export interface StartGeneratedBrowserAppOptions {
  readonly config: ApertureConfig;
  readonly workerEntry: SimulationWorkerEntry;
  readonly systemManifest?: readonly GeneratedBrowserSystemManifestEntry[];
  readonly workerFactory?: (
    entry: string | URL,
    options?: WorkerOptions,
  ) => Worker;
}

export interface GeneratedBrowserApp {
  readonly worker: SimulationWorker;
  readonly webgpu: CreateWebGpuAppResult;
}

export async function startGeneratedBrowserApp(
  options: StartGeneratedBrowserAppOptions,
): Promise<GeneratedBrowserApp> {
  const config = defineApertureConfig(options.config);
  const canvas = resolveCanvas(config);
  const worker = createSimulationWorker(options.workerEntry, {
    workerOptions: { type: "module" },
    ...(options.workerFactory === undefined
      ? {}
      : { workerFactory: options.workerFactory }),
  });
  const webgpu = await createWebGpuApp({
    canvas: canvas as unknown as WebGpuCanvasLike,
    simulationWorker: worker,
    autoStart: true,
  });

  installResizeObserver(canvas);

  return {
    worker,
    webgpu,
  };
}

function resolveCanvas(config: ApertureConfig): HTMLCanvasElement {
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

function installResizeObserver(canvas: HTMLCanvasElement): void {
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
    const height = Math.max(
      1,
      Math.floor(rect.height * window.devicePixelRatio),
    );

    if (canvas.width !== width) {
      canvas.width = width;
    }

    if (canvas.height !== height) {
      canvas.height = height;
    }
  };

  resize();

  if ("ResizeObserver" in globalThis) {
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return;
  }

  window.addEventListener("resize", resize);
}
