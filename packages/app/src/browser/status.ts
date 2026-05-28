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

export const APERTURE_GENERATED_STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";

export function readGeneratedBrowserAppStatus(
  scope: object = globalThis,
): GeneratedBrowserAppStatus | null {
  const value = (scope as Record<string, unknown>)[
    APERTURE_GENERATED_STATUS_GLOBAL
  ];

  return isGeneratedBrowserAppStatus(value) ? value : null;
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
