import type { RenderShadowFrameReport } from "../shadows/render-shadow-frame.js";

/** Count current-frame draws without inventing standalone command submissions. */
export function normalizeShadowSubmittedDrawCounts(
  report: RenderShadowFrameReport,
  submission:
    | "cached"
    | "graph-submitted"
    | "graph-not-submitted"
    | "standalone",
): RenderShadowFrameReport {
  return {
    ...report,
    ...(report.casterCounts === undefined
      ? {}
      : {
          casterCounts: {
            ...report.casterCounts,
            submittedDrawCalls:
              submission === "cached" || submission === "graph-not-submitted"
                ? 0
                : submission === "graph-submitted"
                  ? report.drawCalls
                  : report.casterCounts.submittedDrawCalls,
          },
        }),
    ...(report.lightKindReports === undefined
      ? {}
      : {
          lightKindReports: report.lightKindReports.map((child) =>
            normalizeShadowSubmittedDrawCounts(child, submission),
          ),
        }),
  };
}
