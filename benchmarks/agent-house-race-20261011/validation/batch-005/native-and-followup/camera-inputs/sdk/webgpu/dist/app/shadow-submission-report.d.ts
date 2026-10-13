import type { RenderShadowFrameReport } from "../shadows/render-shadow-frame.js";
/** Count current-frame draws without inventing standalone command submissions. */
export declare function normalizeShadowSubmittedDrawCounts(report: RenderShadowFrameReport, submission: "cached" | "graph-submitted" | "graph-not-submitted" | "standalone"): RenderShadowFrameReport;
//# sourceMappingURL=shadow-submission-report.d.ts.map