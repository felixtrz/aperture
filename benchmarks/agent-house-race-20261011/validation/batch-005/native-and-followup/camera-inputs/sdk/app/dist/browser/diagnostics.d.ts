import type { GeneratedBrowserAppStatus } from "./status.js";
/**
 * Mirror the live render diagnostics into `status.diagnostics` on a lightweight
 * developer-telemetry cadence AND surface render failures to the browser
 * console.
 *
 * Rationale (first-release DX): the renderer already collects rich telemetry
 * (lastError, per-view cull stats, mesh-draw counts), but historically NONE of it
 * reached the console — so a render that failed or produced an empty/all-culled
 * frame showed up as a silent black/empty canvas with no error, leaving the
 * developer with no way to reason about it. We now log, deduped:
 *   1. render `lastError` (e.g. a failed snapshot replay, a lost device) → error
 *   2. a frame that drew 0 meshes while a camera view rendered → warn (the
 *      classic "camera aimed away / frustum excludes the scene / nothing spawned"
 *      class of bug that otherwise looks like a blank screen).
 */
export declare function syncGeneratedDiagnostics(getDiagnostics: () => unknown, status: GeneratedBrowserAppStatus, options?: SyncGeneratedDiagnosticsOptions): () => void;
export interface SyncGeneratedDiagnosticsOptions {
    readonly intervalMilliseconds?: number;
}
export declare const DEFAULT_GENERATED_DIAGNOSTICS_SYNC_INTERVAL_MS = 250;
//# sourceMappingURL=diagnostics.d.ts.map