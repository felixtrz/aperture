import { describe, expect, it } from "vitest";

import {
  clearParityReportToJson,
  clearParityReportToJsonValue,
  type ClearParityReport,
} from "../../src/index.js";

describe("clear parity JSON helpers", () => {
  it("creates JSON-safe values for matching success", () => {
    expect(clearParityReportToJsonValue(report(true))).toEqual({
      ready: true,
      clearReady: true,
      boundaryReady: true,
      diagnostics: [],
    });
  });

  it("creates JSON-safe values for matching failure", () => {
    expect(clearParityReportToJsonValue(report(false))).toEqual({
      ready: false,
      clearReady: false,
      boundaryReady: false,
      diagnostics: [{ code: "clearParity.bothFailed", message: "both failed" }],
    });
  });

  it("creates JSON-safe values for mismatch reports", () => {
    expect(
      clearParityReportToJsonValue({
        ready: false,
        clearReady: true,
        boundaryReady: false,
        diagnostics: [
          {
            code: "clearParity.clearSucceededBoundaryFailed",
            message: "mismatch",
          },
        ],
      }),
    ).toMatchObject({
      ready: false,
      clearReady: true,
      boundaryReady: false,
    });
  });

  it("serializes stable repeated JSON output", () => {
    const value = report(false);

    expect(clearParityReportToJson(value)).toBe(clearParityReportToJson(value));
  });
});

function report(ready: boolean): ClearParityReport {
  return {
    ready,
    clearReady: ready,
    boundaryReady: ready,
    diagnostics: ready
      ? []
      : [{ code: "clearParity.bothFailed", message: "both failed" }],
  };
}
