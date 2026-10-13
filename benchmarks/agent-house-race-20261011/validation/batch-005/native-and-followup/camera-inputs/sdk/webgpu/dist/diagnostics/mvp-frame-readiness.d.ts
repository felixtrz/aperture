import type { FrameBoundaryValidationReport } from "../render/frame/frame-boundary-validation.js";
import type { FrameSubmissionSmokeReport } from "../render/frame/frame-submission-smoke.js";
import type { RenderPassAssemblySmokeReport } from "../render/passes/render-pass-assembly-smoke.js";
import type { RendererAssemblySmokeReport } from "../render/frame/renderer-assembly-smoke.js";
export type MvpFrameReadinessDiagnosticCode = "mvpFrameReadiness.rendererAssemblyNotReady" | "mvpFrameReadiness.renderPassAssemblyNotReady" | "mvpFrameReadiness.frameSubmissionNotReady" | "mvpFrameReadiness.frameBoundaryNotReady";
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
export declare function createMvpFrameReadinessReport(input: {
    readonly renderer: RendererAssemblySmokeReport;
    readonly renderPass: RenderPassAssemblySmokeReport;
    readonly submission: FrameSubmissionSmokeReport;
    readonly boundary: FrameBoundaryValidationReport;
}): MvpFrameReadinessReport;
export interface MvpFrameReadinessReportJsonValue {
    readonly ready: boolean;
    readonly sections: MvpFrameReadinessSections;
    readonly counts: MvpFrameReadinessReport["counts"];
    readonly diagnostics: readonly MvpFrameReadinessDiagnostic[];
}
export declare function mvpFrameReadinessReportToJsonValue(report: MvpFrameReadinessReport): MvpFrameReadinessReportJsonValue;
export declare function mvpFrameReadinessReportToJson(report: MvpFrameReadinessReport): string;
//# sourceMappingURL=mvp-frame-readiness.d.ts.map