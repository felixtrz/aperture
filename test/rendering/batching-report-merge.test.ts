import { describe, expect, it } from "vitest";

import {
  mergeDrawPackageBatchingReports,
  type DrawPackageBatchingReport,
} from "../../src/index.js";

describe("draw package batching report merge", () => {
  it("merges empty inputs", () => {
    expect(mergeDrawPackageBatchingReports([])).toEqual({
      reportCount: 0,
      drawCount: 0,
      batchCount: 0,
      diagnostics: [],
    });
  });

  it("sums report, draw, and batch counts", () => {
    expect(
      mergeDrawPackageBatchingReports([report(2, 1), report(3, 2)]),
    ).toMatchObject({
      reportCount: 2,
      drawCount: 5,
      batchCount: 3,
    });
  });

  it("preserves diagnostics", () => {
    expect(
      mergeDrawPackageBatchingReports([
        report(0, 0, [
          {
            code: "drawBatching.emptyPackages",
            message: "empty",
            severity: "info",
          },
        ]),
      ]).diagnostics,
    ).toEqual([
      {
        code: "drawBatching.emptyPackages",
        message: "empty",
        severity: "info",
      },
    ]);
  });
});

function report(
  drawCount: number,
  batchCount: number,
  diagnostics: DrawPackageBatchingReport["diagnostics"] = [],
): DrawPackageBatchingReport {
  return {
    drawCount,
    batchCount,
    groups: [],
    diagnostics,
  };
}
