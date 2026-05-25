import {
  createSimulationWorker,
  type SimulationWorker,
  type SimulationWorkerErrorEvent,
  type SimulationWorkerSnapshotEvent,
  type SimulationWorkerEntry,
} from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  createWebGpuApp,
  type CreateWebGpuAppResult,
  type WebGpuCanvasLike,
} from "@aperture-engine/webgpu";
import { mirrorSourceAssetRegistryFromMessage } from "./asset-mirror.js";
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

export interface GeneratedBrowserAppStatus {
  status: "starting" | "running" | "webgpu-failed" | "worker-error";
  webgpuOk: boolean | null;
  snapshots: number;
  mirroredSourceAssets: number;
  skippedSourceAssets: number;
  lastFrame: number | null;
  lastError: unknown;
  lastWorkerSummary: unknown;
  diagnostics: unknown;
}

export async function startGeneratedBrowserApp(
  options: StartGeneratedBrowserAppOptions,
): Promise<GeneratedBrowserApp> {
  const config = defineApertureConfig(options.config);
  const canvas = resolveCanvas(config);
  const sourceAssets = new AssetRegistry();
  const status = installGeneratedStatus();
  const worker = createSimulationWorker(options.workerEntry, {
    workerOptions: { type: "module" },
    ...(options.workerFactory === undefined
      ? {}
      : { workerFactory: options.workerFactory }),
  });
  const mirroredWorker = mirrorSimulationWorkerSourceAssets(
    worker,
    sourceAssets,
    status,
  );
  const webgpu = await createWebGpuApp({
    canvas: canvas as unknown as WebGpuCanvasLike,
    simulationWorker: mirroredWorker,
    sourceAssets,
    autoStart: true,
  });

  status.webgpuOk = webgpu.ok;
  status.status = webgpu.ok ? "running" : "webgpu-failed";
  status.diagnostics = webgpu.ok ? webgpu.app.getDiagnostics() : webgpu;
  if (webgpu.ok) {
    syncGeneratedDiagnostics(webgpu.app.getDiagnostics, status);
  }
  installResizeObserver(canvas);

  return {
    worker,
    webgpu,
  };
}

function syncGeneratedDiagnostics(
  getDiagnostics: () => unknown,
  status: GeneratedBrowserAppStatus,
): void {
  const sync = () => {
    status.diagnostics = getDiagnostics();
    requestAnimationFrame(sync);
  };

  requestAnimationFrame(sync);
}

function mirrorSimulationWorkerSourceAssets(
  worker: SimulationWorker,
  sourceAssets: AssetRegistry,
  status: GeneratedBrowserAppStatus,
): SimulationWorker {
  return {
    ...worker,
    onSnapshot(callback) {
      return worker.onSnapshot((event: SimulationWorkerSnapshotEvent) => {
        const mirror = mirrorSourceAssetRegistryFromMessage(
          sourceAssets,
          event.message,
        );
        status.snapshots += 1;
        status.lastFrame = event.frame;
        status.mirroredSourceAssets += mirror.mirrored;
        status.skippedSourceAssets += mirror.skipped;
        status.lastWorkerSummary =
          typeof event.message === "object" && event.message !== null
            ? (event.message as { readonly workerSummary?: unknown })
                .workerSummary ?? null
            : null;
        callback(event);
      });
    },
    onError(callback) {
      return worker.onError((event: SimulationWorkerErrorEvent) => {
        status.status = "worker-error";
        status.lastError = event;
        callback(event);
      });
    },
  };
}

function installGeneratedStatus(): GeneratedBrowserAppStatus {
  const status: GeneratedBrowserAppStatus = {
    status: "starting",
    webgpuOk: null,
    snapshots: 0,
    mirroredSourceAssets: 0,
    skippedSourceAssets: 0,
    lastFrame: null,
    lastError: null,
    lastWorkerSummary: null,
    diagnostics: null,
  };

  (
    globalThis as {
      __APERTURE_GENERATED_APP__?: GeneratedBrowserAppStatus;
    }
  ).__APERTURE_GENERATED_APP__ = status;

  return status;
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
