import type { FrameBoundaryAssemblyReport } from "./frame-boundary.js";
export type FrameBoundarySmokeSection = "texture" | "attachments" | "encoder" | "begin" | "execution" | "end" | "finish" | "submit";
export type FrameBoundarySmokeDiagnosticCode = "frameBoundary.textureFailed" | "frameBoundary.missingAttachments" | "frameBoundary.attachmentsFailed" | "frameBoundary.missingEncoder" | "frameBoundary.encoderFailed" | "frameBoundary.missingBegin" | "frameBoundary.beginFailed" | "frameBoundary.missingExecution" | "frameBoundary.executionFailed" | "frameBoundary.missingEnd" | "frameBoundary.endFailed" | "frameBoundary.missingFinish" | "frameBoundary.finishFailed" | "frameBoundary.missingSubmit" | "frameBoundary.submitFailed";
export interface FrameBoundarySmokeDiagnostic {
    readonly code: FrameBoundarySmokeDiagnosticCode;
    readonly message: string;
    readonly section: FrameBoundarySmokeSection;
    readonly severity: "warning" | "error";
}
export interface FrameBoundarySmokeSectionStatus {
    readonly section: FrameBoundarySmokeSection;
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCodes: readonly string[];
}
export interface FrameBoundarySmokeReport {
    readonly ready: boolean;
    readonly sections: Readonly<Record<FrameBoundarySmokeSection, FrameBoundarySmokeSectionStatus>>;
    readonly diagnostics: readonly {
        readonly code: string;
        readonly message: string;
    }[];
}
export declare function createFrameBoundarySmokeReport(report: FrameBoundaryAssemblyReport): FrameBoundarySmokeReport;
//# sourceMappingURL=frame-boundary-smoke.d.ts.map