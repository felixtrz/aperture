import { describe, expect, it } from "vitest";
import { summarizeDiagnostics } from "@aperture-engine/simulation";

describe("diagnostic summary helpers", () => {
  it("summarizes empty diagnostics", () => {
    expect(summarizeDiagnostics([])).toEqual({
      total: 0,
      bySeverity: { info: 0, warning: 0, error: 0 },
      byCode: {},
    });
  });

  it("counts mixed severities and repeated codes", () => {
    expect(
      summarizeDiagnostics([
        { code: "a", severity: "info" },
        { code: "b", severity: "warning" },
        { code: "b", severity: "error" },
        { code: "b", severity: "error" },
      ]),
    ).toEqual({
      total: 4,
      bySeverity: { info: 1, warning: 1, error: 2 },
      byCode: { a: 1, b: 3 },
    });
  });

  it("uses warning as the default severity and allows overrides", () => {
    expect(summarizeDiagnostics([{ code: "missing-severity" }])).toEqual({
      total: 1,
      bySeverity: { info: 0, warning: 1, error: 0 },
      byCode: { "missing-severity": 1 },
    });
    expect(
      summarizeDiagnostics([{ code: "missing-severity" }], {
        defaultSeverity: "info",
      }),
    ).toEqual({
      total: 1,
      bySeverity: { info: 1, warning: 0, error: 0 },
      byCode: { "missing-severity": 1 },
    });
  });
});
