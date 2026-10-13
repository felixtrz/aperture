import type { FrameBoundaryValidationReport } from "../render/frame/frame-boundary-validation.js";
import type { FrameSubmissionSmokeReport } from "../render/frame/frame-submission-smoke.js";
import type { RenderPassAssemblySmokeReport } from "../render/passes/render-pass-assembly-smoke.js";
import type { RendererAssemblySmokeReport } from "../render/frame/renderer-assembly-smoke.js";

export type MvpFrameReadinessDiagnosticCode =
  | "mvpFrameReadiness.rendererAssemblyNotReady"
  | "mvpFrameReadiness.renderPassAssemblyNotReady"
  | "mvpFrameReadiness.frameSubmissionNotReady"
  | "mvpFrameReadiness.frameBoundaryNotReady";

export interface MvpFrameReadinessDiagnostic {
  readonly code: MvpFrameReadinessDiagnosticCode;
  readonly message: string;
}

export interface MvpFrameReadinessSections {
  readonly rendererAssembly: boolean;
  readonly renderPassAssembly: boolean;
  readonly frameSubmission: boolean;
  readonly frameBoundary: boolean;
}

export interface MvpFrameReadinessReport {
  readonly ready: boolean;
  readonly sections: MvpFrameReadinessSections;
  readonly counts: {
    readonly rendererDiagnostics: number;
    readonly renderPassDiagnostics: number;
    readonly submissionDiagnostics: number;
    readonly boundaryDiagnostics: number;
  };
  readonly diagnostics: readonly MvpFrameReadinessDiagnostic[];
}

export function createMvpFrameReadinessReport(input: {
  readonly renderer: RendererAssemblySmokeReport;
  readonly renderPass: RenderPassAssemblySmokeReport;
  readonly submission: FrameSubmissionSmokeReport;
  readonly boundary: FrameBoundaryValidationReport;
}): MvpFrameReadinessReport {
  const diagnostics: MvpFrameReadinessDiagnostic[] = [];

  if (!input.renderer.ready) {
    diagnostics.push({
      code: "mvpFrameReadiness.rendererAssemblyNotReady",
      message: "Renderer assembly smoke report is not ready.",
    });
  }

  if (!input.renderPass.ready) {
    diagnostics.push({
      code: "mvpFrameReadiness.renderPassAssemblyNotReady",
      message: "Render pass assembly smoke report is not ready.",
    });
  }

  if (!input.submission.ready) {
    diagnostics.push({
      code: "mvpFrameReadiness.frameSubmissionNotReady",
      message: "Frame submission smoke report is not ready.",
    });
  }

  if (!input.boundary.ready) {
    diagnostics.push({
      code: "mvpFrameReadiness.frameBoundaryNotReady",
      message: "Frame boundary validation report is not ready.",
    });
  }

  return {
    ready: diagnostics.length === 0,
    sections: {
      rendererAssembly: input.renderer.ready,
      renderPassAssembly: input.renderPass.ready,
      frameSubmission: input.submission.ready,
      frameBoundary: input.boundary.ready,
    },
    counts: {
      rendererDiagnostics: input.renderer.diagnostics.length,
      renderPassDiagnostics: input.renderPass.diagnostics.length,
      submissionDiagnostics: input.submission.diagnostics.length,
      boundaryDiagnostics: input.boundary.diagnostics.length,
    },
    diagnostics,
  };
}

export interface MvpFrameReadinessReportJsonValue {
  readonly ready: boolean;
  readonly sections: MvpFrameReadinessSections;
  readonly counts: MvpFrameReadinessReport["counts"];
  readonly diagnostics: readonly MvpFrameReadinessDiagnostic[];
}

export function mvpFrameReadinessReportToJsonValue(
  report: MvpFrameReadinessReport,
): MvpFrameReadinessReportJsonValue {
  return {
    ready: report.ready,
    sections: {
      rendererAssembly: report.sections.rendererAssembly,
      renderPassAssembly: report.sections.renderPassAssembly,
      frameSubmission: report.sections.frameSubmission,
      frameBoundary: report.sections.frameBoundary,
    },
    counts: {
      rendererDiagnostics: report.counts.rendererDiagnostics,
      renderPassDiagnostics: report.counts.renderPassDiagnostics,
      submissionDiagnostics: report.counts.submissionDiagnostics,
      boundaryDiagnostics: report.counts.boundaryDiagnostics,
    },
    diagnostics: report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
    })),
  };
}

export function mvpFrameReadinessReportToJson(
  report: MvpFrameReadinessReport,
): string {
  return JSON.stringify(mvpFrameReadinessReportToJsonValue(report));
}
