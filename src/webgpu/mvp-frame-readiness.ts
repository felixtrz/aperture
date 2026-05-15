import type { FrameBoundaryValidationReport } from "./frame-boundary-validation.js";
import type { FrameSubmissionSmokeReport } from "./frame-submission-smoke.js";
import type { RenderPassAssemblySmokeReport } from "./render-pass-assembly-smoke.js";
import type { RendererAssemblySmokeReport } from "./renderer-assembly-smoke.js";

export type MvpFrameReadinessDiagnosticCode =
  | "mvpFrameReadiness.rendererAssemblyNotReady"
  | "mvpFrameReadiness.renderPassAssemblyNotReady"
  | "mvpFrameReadiness.frameSubmissionNotReady"
  | "mvpFrameReadiness.frameBoundaryNotReady";

export interface MvpFrameReadinessDiagnostic {
  readonly code: MvpFrameReadinessDiagnosticCode;
  readonly message: string;
}

export interface MvpFrameReadinessReport {
  readonly ready: boolean;
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
    counts: {
      rendererDiagnostics: input.renderer.diagnostics.length,
      renderPassDiagnostics: input.renderPass.diagnostics.length,
      submissionDiagnostics: input.submission.diagnostics.length,
      boundaryDiagnostics: input.boundary.diagnostics.length,
    },
    diagnostics,
  };
}
