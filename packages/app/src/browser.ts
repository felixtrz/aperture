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
import {
  createGeneratedInputEventMessage,
  type ApertureGeneratedInputEvent,
} from "./input.js";
import {
  APERTURE_GENERATED_COMMAND_EVENT,
  createGeneratedCommandMessage,
  parseGeneratedCommand,
  type ApertureGeneratedCommand,
} from "./commands.js";
import {
  createApertureGeneratedDiagnosticsStatus,
  type ApertureGeneratedDiagnosticsStatus,
} from "./diagnostics.js";

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
  forwardedInputEvents: number;
  lastInputEvent: unknown;
  forwardedCommandEvents: number;
  lastCommandEvent: unknown;
  lastFrame: number | null;
  lastError: unknown;
  lastFailure: ApertureGeneratedDiagnosticsStatus | null;
  lastWorkerSummary: unknown;
  diagnostics: unknown;
}

export const APERTURE_GENERATED_STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";

export function readGeneratedBrowserAppStatus(
  scope: object = globalThis,
): GeneratedBrowserAppStatus | null {
  const value = (scope as Record<string, unknown>)[
    APERTURE_GENERATED_STATUS_GLOBAL
  ];

  return isGeneratedBrowserAppStatus(value) ? value : null;
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
  installGeneratedInputForwarding(canvas, worker, status);
  installGeneratedCommandForwarding(worker, status);
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
            ? ((event.message as { readonly workerSummary?: unknown })
                .workerSummary ?? null)
            : null;
        callback(event);
      });
    },
    onError(callback) {
      return worker.onError((event: SimulationWorkerErrorEvent) => {
        status.status = "worker-error";
        status.lastFailure = createApertureGeneratedDiagnosticsStatus({
          status: "failed",
          diagnostics:
            event.diagnostics ??
            [
              {
                code: event.reason,
                severity: "error",
                message: event.message,
                worker: event.source,
                suggestedFix:
                  "Inspect generated worker diagnostics and restart the app after fixing the reported issue.",
              },
            ],
        });
        status.lastError = status.lastFailure;
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
    forwardedInputEvents: 0,
    lastInputEvent: null,
    forwardedCommandEvents: 0,
    lastCommandEvent: null,
    lastFrame: null,
    lastError: null,
    lastFailure: null,
    lastWorkerSummary: null,
    diagnostics: null,
  };

  (globalThis as Record<string, unknown>)[APERTURE_GENERATED_STATUS_GLOBAL] =
    status;

  return status;
}

function isGeneratedBrowserAppStatus(
  value: unknown,
): value is GeneratedBrowserAppStatus {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly status?: unknown }).status === "string" &&
    "snapshots" in value
  );
}

function installGeneratedCommandForwarding(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
): void {
  window.addEventListener(APERTURE_GENERATED_COMMAND_EVENT, (event) => {
    const command = parseGeneratedCommand((event as CustomEvent).detail);

    if (command === null) {
      status.lastCommandEvent = {
        error: "aperture.command.invalid",
        suggestedFix:
          "Dispatch aperture:command with detail { channel, payload? }.",
      };
      return;
    }

    forwardCommand(worker, status, command);
  });
}

function forwardCommand(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  command: ApertureGeneratedCommand,
): void {
  worker.postMessage(createGeneratedCommandMessage(command));
  status.forwardedCommandEvents += 1;
  status.lastCommandEvent = command;
}

function installGeneratedInputForwarding(
  canvas: HTMLCanvasElement,
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
): void {
  if (!canvas.hasAttribute("tabindex")) {
    canvas.tabIndex = 0;
  }

  canvas.addEventListener("pointermove", (event) => {
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
    });
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus();
    canvas.setPointerCapture?.(event.pointerId);
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
      pressed: true,
    });
  });

  canvas.addEventListener("pointerup", (event) => {
    canvas.releasePointerCapture?.(event.pointerId);
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
      pressed: false,
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    forwardInput(worker, status, {
      kind: "keyboard",
      key: event.code || event.key,
      pressed: true,
    });
  });

  window.addEventListener("keyup", (event) => {
    forwardInput(worker, status, {
      kind: "keyboard",
      key: event.code || event.key,
      pressed: false,
    });
  });
}

function forwardInput(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  event: ApertureGeneratedInputEvent,
): void {
  worker.postMessage(createGeneratedInputEventMessage(event));
  status.forwardedInputEvents += 1;
  status.lastInputEvent = event;
}

function pointerPosition(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): readonly [number, number] {
  const rect = canvas.getBoundingClientRect();
  const x = rect.width <= 0 ? 0 : (event.clientX - rect.left) / rect.width;
  const y = rect.height <= 0 ? 0 : (event.clientY - rect.top) / rect.height;

  return [clamp01(x), clamp01(y)];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
