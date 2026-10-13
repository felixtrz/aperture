import type { ApertureGeneratedDiagnosticsStatus } from "../diagnostics.js";
import type { GeneratedBrowserRenderSettings, GeneratedCanvasResizeMeasurement } from "./render.js";
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
    workerMessages: GeneratedBrowserWorkerMessageStatus;
    performance: GeneratedBrowserPerformanceStatus | null;
    diagnostics: unknown;
    render: GeneratedBrowserRenderSettings | null;
    canvas: GeneratedCanvasResizeMeasurement | null;
    systems: readonly GeneratedBrowserSystemManifestEntry[];
}
export interface GeneratedBrowserWorkerMessageStatus {
    snapshotDecisions: GeneratedBrowserWorkerMessageDecisionCounters;
    sidebandDecisions: GeneratedBrowserWorkerMessageDecisionCounters;
}
export interface GeneratedBrowserWorkerMessageDecisionCounters {
    total: number;
    latest: unknown;
    postedMessages: Record<string, number>;
    postMessageReasons: Record<string, number>;
}
export interface GeneratedBrowserPerformanceTimingStats {
    readonly count: number;
    readonly latest: number | null;
    readonly average: number | null;
    readonly min: number | null;
    readonly p50: number | null;
    readonly p95: number | null;
    readonly p99: number | null;
    readonly max: number | null;
}
export interface GeneratedBrowserPerformanceStatus {
    readonly sampleWindow: number;
    readonly latest: {
        readonly frame: number;
        readonly transport: "shared-array-buffer" | "transferable";
        readonly preStepWorldChanged: boolean;
        readonly publish: Record<string, number>;
        readonly step: Record<string, number>;
        readonly lowLevel: Record<string, number>;
    } | null;
    readonly rolling: {
        readonly publish: Record<string, GeneratedBrowserPerformanceTimingStats>;
        readonly step: Record<string, GeneratedBrowserPerformanceTimingStats>;
        readonly lowLevel: Record<string, GeneratedBrowserPerformanceTimingStats>;
    };
}
export type GeneratedBrowserStatusListener = (status: GeneratedBrowserAppStatus) => void;
export interface GeneratedBrowserStatusSubscriptionOptions {
    readonly scope?: object;
    readonly immediate?: boolean;
}
export declare const APERTURE_GENERATED_STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";
export declare const APERTURE_GENERATED_RENDER_DIAGNOSTICS_PROPERTY = "__apertureRenderDiagnostics";
export interface GeneratedBrowserRenderDiagnosticsAccessor {
    getDiagnostics(options?: {
        readonly detail?: "full" | "status";
    }): unknown;
}
export declare function readGeneratedBrowserAppStatus(scope?: object): GeneratedBrowserAppStatus | null;
export declare function subscribeGeneratedBrowserAppStatus(listener: GeneratedBrowserStatusListener, options?: GeneratedBrowserStatusSubscriptionOptions): () => void;
export declare function installGeneratedStatus(): GeneratedBrowserAppStatus;
export declare function installGeneratedRenderDiagnosticsAccessor(status: GeneratedBrowserAppStatus, accessor: GeneratedBrowserRenderDiagnosticsAccessor): void;
//# sourceMappingURL=status.d.ts.map