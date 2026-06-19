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
export function syncGeneratedDiagnostics(
  getDiagnostics: () => unknown,
  status: GeneratedBrowserAppStatus,
  options: SyncGeneratedDiagnosticsOptions = {},
): () => void {
  let lastErrorSig = "";
  let emptyWarned = false;
  const seenFrameDiags = new Set<string>();
  const intervalMilliseconds = normalizeDiagnosticsSyncInterval(
    options.intervalMilliseconds,
  );
  let disposed = false;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  const record = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  const numberAt = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const surface = (diagnostics: unknown): void => {
    const root = record(diagnostics);
    if (root === null) return;

    // 1. Render errors — speak them, once per distinct error.
    const error = record(root["lastError"]);
    if (error !== null) {
      const code = typeof error["code"] === "string" ? error["code"] : "";
      const message =
        typeof error["message"] === "string" ? error["message"] : code;
      const reason = typeof error["reason"] === "string" ? error["reason"] : "";
      const sig = `${code}|${message}`;
      if (sig !== lastErrorSig && (code !== "" || message !== "")) {
        lastErrorSig = sig;
        console.error(
          `[aperture] render error${code ? ` (${code})` : ""}: ${message}` +
            (reason ? ` — ${reason}` : ""),
        );
      }
    } else {
      lastErrorSig = "";
    }

    // 2. Empty / all-culled frame — a camera rendered but nothing drew.
    const frame = record(root["lastFrame"]);
    const counts = record(frame?.["counts"]);
    if (counts !== null) {
      const views = numberAt(counts["views"]) ?? 0;
      const meshDraws = numberAt(counts["meshDraws"]) ?? 0;
      const spriteDraws = numberAt(counts["spriteDraws"]) ?? 0;
      const particleEmitters = numberAt(counts["particleEmitters"]) ?? 0;
      const quadInstances = numberAt(counts["quadInstances"]) ?? 0;
      const uiNodes = numberAt(counts["uiNodes"]) ?? 0;
      const anyDraws =
        meshDraws + spriteDraws + particleEmitters + quadInstances + uiNodes;
      if (views > 0 && anyDraws === 0) {
        if (!emptyWarned) {
          emptyWarned = true;
          console.warn(
            "[aperture] render produced 0 draws for an active camera view — " +
              "the canvas will appear empty. Likely causes: the camera is aimed " +
              "away from the scene (everything frustum-culled), the near/far " +
              "frustum excludes it, or nothing renderable was spawned. " +
              "Check the camera transform vs. your entities' world positions.",
          );
        }
      } else if (anyDraws > 0) {
        emptyWarned = false;
      }
    }

    // 3. Per-frame render diagnostics (missing prepared material/mesh, pipeline
    //    routing failures, etc.) — surface warnings/errors once each so a feature
    //    that silently draws nothing (e.g. a dynamic material that never prepared)
    //    tells the developer WHY instead of just not appearing.
    const frameDiags = frame?.["diagnostics"];
    if (Array.isArray(frameDiags)) {
      for (const entry of frameDiags) {
        const diag = record(entry);
        if (diag === null) continue;
        const severity =
          typeof diag["severity"] === "string" ? diag["severity"] : "";
        if (severity !== "warning" && severity !== "error") continue;
        const code = typeof diag["code"] === "string" ? diag["code"] : "";
        const message =
          typeof diag["message"] === "string" ? diag["message"] : code;
        const sig = `${severity}|${code}|${message}`;
        if (seenFrameDiags.has(sig)) continue;
        seenFrameDiags.add(sig);
        const log = severity === "error" ? console.error : console.warn;
        log(
          `[aperture] render ${severity}${code ? ` (${code})` : ""}: ${message}`,
        );
      }
    }
  };

  const sync = () => {
    if (disposed) {
      return;
    }

    const diagnostics = getDiagnostics();
    status.diagnostics = diagnostics;
    surface(diagnostics);
    pendingTimer = setTimeout(sync, intervalMilliseconds);
  };

  pendingTimer = setTimeout(sync, intervalMilliseconds);

  return () => {
    disposed = true;
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  };
}

export interface SyncGeneratedDiagnosticsOptions {
  readonly intervalMilliseconds?: number;
}

export const DEFAULT_GENERATED_DIAGNOSTICS_SYNC_INTERVAL_MS = 250;
const MIN_GENERATED_DIAGNOSTICS_SYNC_INTERVAL_MS = 16;

function normalizeDiagnosticsSyncInterval(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_GENERATED_DIAGNOSTICS_SYNC_INTERVAL_MS;
  }

  return Math.max(
    MIN_GENERATED_DIAGNOSTICS_SYNC_INTERVAL_MS,
    Math.floor(value),
  );
}
