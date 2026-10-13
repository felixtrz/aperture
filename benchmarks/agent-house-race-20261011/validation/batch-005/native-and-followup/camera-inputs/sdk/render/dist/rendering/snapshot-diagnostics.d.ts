import { type DiagnosticSummary } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "./snapshot.js";
export interface RenderSnapshotDiagnosticSummaryReport {
    readonly frame: number;
    readonly packets: {
        readonly views: number;
        readonly meshDraws: number;
        readonly shadowCasterDraws: number;
        readonly lights: number;
        readonly environments: number;
        readonly shadowRequests: number;
        readonly bounds: number;
    };
    readonly diagnostics: DiagnosticSummary;
}
export declare function summarizeRenderSnapshotDiagnostics(snapshot: RenderSnapshot): RenderSnapshotDiagnosticSummaryReport;
//# sourceMappingURL=snapshot-diagnostics.d.ts.map