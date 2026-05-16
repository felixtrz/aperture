import { describe, expect, it } from "vitest";

import {
  createMvpFrameReadinessReport,
  mvpFrameReadinessReportToJson,
  mvpFrameReadinessReportToJsonValue,
  type FrameBoundaryValidationReport,
  type FrameSubmissionSmokeReport,
  type RenderPassAssemblySmokeReport,
  type RendererAssemblySmokeReport,
} from "@aperture-engine/webgpu";

describe("MVP frame readiness aggregate", () => {
  it("reports ready when all major frame sections are ready", () => {
    expect(
      createMvpFrameReadinessReport({
        renderer: renderer(true),
        renderPass: renderPass(true),
        submission: submission(true),
        boundary: boundary(true),
      }),
    ).toEqual({
      ready: true,
      sections: {
        rendererAssembly: true,
        renderPassAssembly: true,
        frameSubmission: true,
        frameBoundary: true,
      },
      counts: {
        rendererDiagnostics: 0,
        renderPassDiagnostics: 0,
        submissionDiagnostics: 0,
        boundaryDiagnostics: 0,
      },
      diagnostics: [],
    });
  });

  it("reports renderer assembly failures", () => {
    expect(
      createMvpFrameReadinessReport({
        renderer: renderer(false),
        renderPass: renderPass(true),
        submission: submission(true),
        boundary: boundary(true),
      }).diagnostics,
    ).toMatchObject([{ code: "mvpFrameReadiness.rendererAssemblyNotReady" }]);
  });

  it("reports render-pass, submission, and boundary failures", () => {
    const report = createMvpFrameReadinessReport({
      renderer: renderer(true),
      renderPass: renderPass(false),
      submission: submission(false),
      boundary: boundary(false),
    });

    expect(report.ready).toBe(false);
    expect(report.sections).toEqual({
      rendererAssembly: true,
      renderPassAssembly: false,
      frameSubmission: false,
      frameBoundary: false,
    });
    expect(report.counts).toEqual({
      rendererDiagnostics: 0,
      renderPassDiagnostics: 1,
      submissionDiagnostics: 1,
      boundaryDiagnostics: 1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "mvpFrameReadiness.renderPassAssemblyNotReady",
      "mvpFrameReadiness.frameSubmissionNotReady",
      "mvpFrameReadiness.frameBoundaryNotReady",
    ]);
  });

  it("creates JSON-safe values with section readiness and key counts", () => {
    const report = createMvpFrameReadinessReport({
      renderer: renderer(false),
      renderPass: renderPass(true),
      submission: submission(true),
      boundary: boundary(true),
    });

    expect(mvpFrameReadinessReportToJsonValue(report)).toEqual({
      ready: false,
      sections: {
        rendererAssembly: false,
        renderPassAssembly: true,
        frameSubmission: true,
        frameBoundary: true,
      },
      counts: {
        rendererDiagnostics: 1,
        renderPassDiagnostics: 0,
        submissionDiagnostics: 0,
        boundaryDiagnostics: 0,
      },
      diagnostics: [
        {
          code: "mvpFrameReadiness.rendererAssemblyNotReady",
          message: "Renderer assembly smoke report is not ready.",
        },
      ],
    });
  });

  it("serializes stable repeated JSON output", () => {
    const report = createMvpFrameReadinessReport({
      renderer: renderer(true),
      renderPass: renderPass(false),
      submission: submission(false),
      boundary: boundary(true),
    });

    expect(
      JSON.parse(mvpFrameReadinessReportToJson(report)) as unknown,
    ).toEqual(mvpFrameReadinessReportToJsonValue(report));
    expect(mvpFrameReadinessReportToJson(report)).toBe(
      mvpFrameReadinessReportToJson(report),
    );
  });
});

function renderer(ready: boolean): RendererAssemblySmokeReport {
  return {
    ready,
    sections: {} as RendererAssemblySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "rendererAssembly.missingSnapshotInspection",
            message: "missing",
            severity: "error",
            section: "snapshot",
          },
        ],
    summary: {
      snapshot: null,
      cloneability: null,
      packages: null,
      resources: null,
      frame: null,
    },
  };
}

function renderPass(ready: boolean): RenderPassAssemblySmokeReport {
  return {
    ready,
    sections: {} as RenderPassAssemblySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "renderPassAssembly.missingCommandPlan",
            message: "missing",
            severity: "error",
            section: "commands",
          },
        ],
    summary: {
      drawList: null,
      resources: null,
      commands: null,
      execution: null,
    },
  };
}

function submission(ready: boolean): FrameSubmissionSmokeReport {
  return {
    ready,
    sections: {} as FrameSubmissionSmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "frameSubmission.submitFailed",
            message: "failed",
            severity: "warning",
            section: "submit",
          },
        ],
    summary: {
      attachments: null,
      begin: null,
      execution: null,
      end: null,
      finish: null,
      submit: null,
    },
  };
}

function boundary(ready: boolean): FrameBoundaryValidationReport {
  return {
    ready,
    counts: {
      smokeDiagnostics: ready ? 0 : 1,
      compatibilityDiagnostics: 0,
      sourceDiagnostics: 0,
      warnings: 0,
      errors: 0,
    },
    diagnostics: ready
      ? []
      : [
          {
            code: "frameBoundaryValidation.smokeNotReady",
            message: "not ready",
          },
        ],
  };
}
