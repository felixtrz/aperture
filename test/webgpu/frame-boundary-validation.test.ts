import { describe, expect, it } from "vitest";

import {
  createFrameBoundaryValidationReport,
  type ClearCompatibilityReport,
  type FrameBoundaryDiagnosticSummaryReport,
  type FrameBoundarySmokeReport,
} from "@aperture-engine/webgpu/test-support";

describe("frame boundary validation aggregate", () => {
  it("reports ready when smoke, compatibility, and diagnostics are clear", () => {
    expect(
      createFrameBoundaryValidationReport({
        smoke: smoke(true),
        compatibility: compatibility(true),
        summary: summary(),
      }),
    ).toEqual({
      ready: true,
      counts: {
        smokeDiagnostics: 0,
        compatibilityDiagnostics: 0,
        sourceDiagnostics: 0,
        warnings: 0,
        errors: 0,
      },
      diagnostics: [],
    });
  });

  it("reports smoke failures", () => {
    expect(
      createFrameBoundaryValidationReport({
        smoke: smoke(false),
        compatibility: compatibility(true),
        summary: summary(),
      }).diagnostics,
    ).toMatchObject([{ code: "frameBoundaryValidation.smokeNotReady" }]);
  });

  it("reports compatibility failures", () => {
    expect(
      createFrameBoundaryValidationReport({
        smoke: smoke(true),
        compatibility: compatibility(false),
        summary: summary(),
      }).diagnostics,
    ).toMatchObject([
      { code: "frameBoundaryValidation.compatibilityNotReady" },
    ]);
  });

  it("reports diagnostic warning and error cases", () => {
    const report = createFrameBoundaryValidationReport({
      smoke: smoke(true),
      compatibility: compatibility(true),
      summary: summary({ warnings: 2, errors: 1 }),
    });

    expect(report.ready).toBe(false);
    expect(report.counts).toMatchObject({
      sourceDiagnostics: 3,
      warnings: 2,
      errors: 1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "frameBoundaryValidation.diagnosticWarnings",
      "frameBoundaryValidation.diagnosticErrors",
    ]);
  });
});

function smoke(ready: boolean): FrameBoundarySmokeReport {
  return {
    ready,
    sections: {} as FrameBoundarySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [{ code: "frameBoundary.submitFailed", message: "submit failed" }],
  };
}

function compatibility(ready: boolean): ClearCompatibilityReport {
  return {
    ready,
    diagnostics: ready
      ? []
      : [
          {
            code: "clearCompatibility.missingQueueSubmit",
            message: "missing",
          },
        ],
  };
}

function summary(
  counts: { readonly warnings?: number; readonly errors?: number } = {},
): FrameBoundaryDiagnosticSummaryReport {
  const warnings = counts.warnings ?? 0;
  const errors = counts.errors ?? 0;

  return {
    ready: warnings + errors === 0,
    diagnostics: {
      total: warnings + errors,
      bySeverity: { info: 0, warning: warnings, error: errors },
      byCode: {},
    },
  };
}
