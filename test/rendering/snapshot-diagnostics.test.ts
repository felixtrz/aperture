import { describe, expect, it } from "vitest";

import {
  summarizeRenderSnapshotDiagnostics,
  type RenderSnapshot,
} from "@aperture-engine/core";

describe("render snapshot diagnostic summary", () => {
  it("summarizes snapshots without diagnostics", () => {
    expect(summarizeRenderSnapshotDiagnostics(snapshot())).toMatchObject({
      frame: 1,
      packets: {
        views: 0,
        meshDraws: 0,
      },
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    });
  });

  it("summarizes mixed severities and repeated codes", () => {
    const report = summarizeRenderSnapshotDiagnostics({
      ...snapshot(),
      diagnostics: [
        { code: "a", message: "info", severity: "info" },
        { code: "b", message: "warning", severity: "warning" },
        { code: "b", message: "error", severity: "error" },
      ],
    });

    expect(report.diagnostics).toEqual({
      total: 3,
      bySeverity: { info: 1, warning: 1, error: 1 },
      byCode: { a: 1, b: 2 },
    });
  });
});

function snapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}
