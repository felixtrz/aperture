import type { ApertureGeneratedDiagnosticsStatus } from "../diagnostics.js";
import type {
  GeneratedBrowserRenderSettings,
  GeneratedCanvasResizeMeasurement,
} from "./render.js";

export interface GeneratedBrowserSystemManifestEntry {
  readonly moduleUrl: string;
  readonly hasDefaultExport: boolean;
  readonly schedule: {
    readonly priority: number;
  };
}

export interface GeneratedBrowserAppStatus {
  status: "starting" | "running" | "webgpu-failed" | "worker-error";
  webgpuOk: boolean | null;
  snapshots: number;
  mirroredSourceAssets: number;
  skippedSourceAssets: number;
  forwardedInputEvents: number;
  forwardedInputFrames: number;
  connectedGamepads: number;
  lastInputReset: string | null;
  lastInputEvent: unknown;
  forwardedCommandEvents: number;
  lastCommandEvent: unknown;
  lastFrame: number | null;
  lastError: unknown;
  lastFailure: ApertureGeneratedDiagnosticsStatus | null;
  lastWorkerSummary: unknown;
  diagnostics: unknown;
  render: GeneratedBrowserRenderSettings | null;
  canvas: GeneratedCanvasResizeMeasurement | null;
  systems: readonly GeneratedBrowserSystemManifestEntry[];
}

export type GeneratedBrowserStatusListener = (
  status: GeneratedBrowserAppStatus,
) => void;

export interface GeneratedBrowserStatusSubscriptionOptions {
  readonly scope?: object;
  readonly immediate?: boolean;
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

export function subscribeGeneratedBrowserAppStatus(
  listener: GeneratedBrowserStatusListener,
  options: GeneratedBrowserStatusSubscriptionOptions = {},
): () => void {
  const scope = options.scope ?? globalThis;
  let disposed = false;
  let previousStamp: string | null = null;

  const frame = () => {
    if (disposed) return;

    const status = readGeneratedBrowserAppStatus(scope);
    if (status !== null) {
      const stamp = generatedStatusStamp(status);
      if (stamp !== previousStamp) {
        previousStamp = stamp;
        listener(status);
      }
    }

    schedule(frame);
  };

  if (options.immediate !== false) {
    const initial = readGeneratedBrowserAppStatus(scope);
    if (initial !== null) {
      previousStamp = generatedStatusStamp(initial);
      listener(initial);
    }
  }

  schedule(frame);

  return () => {
    disposed = true;
  };
}

export function installGeneratedStatus(): GeneratedBrowserAppStatus {
  const status: GeneratedBrowserAppStatus = {
    status: "starting",
    webgpuOk: null,
    snapshots: 0,
    mirroredSourceAssets: 0,
    skippedSourceAssets: 0,
    forwardedInputEvents: 0,
    forwardedInputFrames: 0,
    connectedGamepads: 0,
    lastInputReset: null,
    lastInputEvent: null,
    forwardedCommandEvents: 0,
    lastCommandEvent: null,
    lastFrame: null,
    lastError: null,
    lastFailure: null,
    lastWorkerSummary: null,
    diagnostics: null,
    render: null,
    canvas: null,
    systems: [],
  };

  (globalThis as Record<string, unknown>)[APERTURE_GENERATED_STATUS_GLOBAL] =
    status;

  return status;
}

function generatedStatusStamp(status: GeneratedBrowserAppStatus): string {
  const diagnostics = status.diagnostics as
    | {
        readonly lastFrame?: {
          readonly frame?: unknown;
          readonly ok?: unknown;
        };
        readonly lastError?: unknown;
      }
    | null
    | undefined;
  const lastFailure = status.lastFailure as {
    readonly code?: unknown;
    readonly message?: unknown;
  } | null;

  return [
    status.status,
    String(status.webgpuOk),
    status.snapshots,
    status.lastFrame ?? "",
    diagnostics?.lastFrame?.frame ?? "",
    String(diagnostics?.lastFrame?.ok ?? ""),
    errorStamp(status.lastError ?? diagnostics?.lastError),
    errorStamp(lastFailure),
  ].join("|");
}

function errorStamp(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  const error = value as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly name?: unknown;
    readonly status?: unknown;
  };
  return [
    error.name ?? "",
    error.code ?? "",
    error.status ?? "",
    error.message ?? String(value),
  ].join(":");
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

function schedule(callback: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(callback);
    return;
  }

  setTimeout(callback, 16);
}
