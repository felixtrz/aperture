import { describe, expect, it } from "vitest";

import {
  mergeFrameBoundaryDiagnosticSummaryReports,
  type FrameBoundaryDiagnosticSummaryReport,
} from "../../src/index.js";

describe("frame boundary diagnostic summary merge", () => {
  it("merges empty inputs", () => {
    expect(mergeFrameBoundaryDiagnosticSummaryReports([])).toEqual({
      ready: true,
      reportCount: 0,
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    });
  });

  it("merges multiple ready reports", () => {
    expect(
      mergeFrameBoundaryDiagnosticSummaryReports([summary(), summary()]),
    ).toMatchObject({
      ready: true,
      reportCount: 2,
      diagnostics: { total: 0 },
    });
  });

  it("merges mixed diagnostics and repeated codes", () => {
    const merged = mergeFrameBoundaryDiagnosticSummaryReports([
      summary({ warning: 1 }, { repeated: 1 }),
      summary({ warning: 2, error: 1 }, { repeated: 2, failed: 1 }),
    ]);

    expect(merged.ready).toBe(false);
    expect(merged.reportCount).toBe(2);
    expect(merged.diagnostics).toEqual({
      total: 4,
      bySeverity: { info: 0, warning: 3, error: 1 },
      byCode: { repeated: 3, failed: 1 },
    });
  });
});

function summary(
  severity: Partial<Record<"info" | "warning" | "error", number>> = {},
  byCode: Record<string, number> = {},
): FrameBoundaryDiagnosticSummaryReport {
  const bySeverity = {
    info: severity.info ?? 0,
    warning: severity.warning ?? 0,
    error: severity.error ?? 0,
  };

  return {
    ready: bySeverity.info + bySeverity.warning + bySeverity.error === 0,
    diagnostics: {
      total: bySeverity.info + bySeverity.warning + bySeverity.error,
      bySeverity,
      byCode,
    },
  };
}
