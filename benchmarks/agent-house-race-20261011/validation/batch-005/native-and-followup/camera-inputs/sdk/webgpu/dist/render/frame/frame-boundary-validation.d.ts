import type { ClearCompatibilityReport } from "../clear/clear-compatibility.js";
import type { FrameBoundaryDiagnosticSummaryReport } from "./frame-boundary-diagnostics.js";
import type { FrameBoundarySmokeReport } from "./frame-boundary-smoke.js";
export type FrameBoundaryValidationDiagnosticCode = "frameBoundaryValidation.smokeNotReady" | "frameBoundaryValidation.compatibilityNotReady" | "frameBoundaryValidation.diagnosticWarnings" | "frameBoundaryValidation.diagnosticErrors";
export interface FrameBoundaryValidationDiagnostic {
    readonly code: FrameBoundaryValidationDiagnosticCode;
    readonly message: string;
}
export interface FrameBoundaryValidationReport {
    readonly ready: boolean;
    readonly counts: {
        readonly smokeDiagnostics: number;
        readonly compatibilityDiagnostics: number;
        readonly sourceDiagnostics: number;
        readonly warnings: number;
        readonly errors: number;
    };
    readonly diagnostics: readonly FrameBoundaryValidationDiagnostic[];
}
export declare function createFrameBoundaryValidationReport(input: {
    readonly smoke: FrameBoundarySmokeReport;
    readonly compatibility: ClearCompatibilityReport;
    readonly summary: FrameBoundaryDiagnosticSummaryReport;
}): FrameBoundaryValidationReport;
//# sourceMappingURL=frame-boundary-validation.d.ts.map