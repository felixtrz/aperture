import {
  summarizeDiagnostics,
  type DiagnosticSummary,
} from "@aperture-engine/simulation";
import type { RenderSnapshot } from "./snapshot.js";

export interface RenderSnapshotDiagnosticSummaryReport {
  readonly frame: number;
  readonly packets: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly shadowRequests: number;
    readonly bounds: number;
  };
  readonly diagnostics: DiagnosticSummary;
}

export function summarizeRenderSnapshotDiagnostics(
  snapshot: RenderSnapshot,
): RenderSnapshotDiagnosticSummaryReport {
  return {
    frame: snapshot.frame,
    packets: {
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      environments: snapshot.environments.length,
      shadowRequests: snapshot.shadowRequests.length,
      bounds: snapshot.bounds.length,
    },
    diagnostics: summarizeDiagnostics(snapshot.diagnostics),
  };
}
