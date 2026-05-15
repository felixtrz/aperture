import { describe, expect, it } from "vitest";

import {
  createFrameExecutionReport,
  summarizeFrameExecutionDiagnosticsBySection,
} from "../../src/index.js";
import { createFrameExecutionSmokeFixture } from "./fixtures/frame-execution.js";

describe("frame execution diagnostics by section", () => {
  it("groups missing command metric inputs", () => {
    const report = summarizeFrameExecutionDiagnosticsBySection(
      createFrameExecutionReport(
        createFrameExecutionSmokeFixture({ failAt: "texture" }).assembly,
      ),
    );

    expect(report.ready).toBe(false);
    expect(report.sections.commandSubmissionMetrics.diagnostics).toMatchObject({
      total: 3,
      bySeverity: { error: 3 },
      byCode: {
        "frameExecution.missingExecution": 1,
        "frameExecution.missingFinish": 1,
        "frameExecution.missingSubmit": 1,
      },
    });
    expect(report.sections.boundarySmoke.diagnostics.byCode).toMatchObject({
      "frameBoundary.textureFailed": 1,
    });
  });

  it("exposes source diagnostics on the diagnostic summary section", () => {
    const report = summarizeFrameExecutionDiagnosticsBySection(
      createFrameExecutionReport(
        createFrameExecutionSmokeFixture({ failAt: "execute" }).assembly,
      ),
    );

    expect(report.sections.diagnosticSummary.diagnostics).toMatchObject({
      total: 1,
      bySeverity: { warning: 1 },
      byCode: {
        "renderPassCommandExecutor.missingMethod": 1,
      },
    });
    expect(report.sections.boundaryValidation.diagnostics.byCode).toMatchObject(
      {
        "frameBoundaryValidation.diagnosticWarnings": 1,
      },
    );
  });

  it("produces stable repeated JSON-safe output", () => {
    const report = summarizeFrameExecutionDiagnosticsBySection(
      createFrameExecutionReport(
        createFrameExecutionSmokeFixture({ failAt: "submit" }).assembly,
      ),
    );

    expect(JSON.stringify(report)).toBe(JSON.stringify(report));
    expect(JSON.stringify(report)).not.toContain("command-encoder-handle");
    expect(JSON.stringify(report)).not.toContain("command-buffer");
  });
});
