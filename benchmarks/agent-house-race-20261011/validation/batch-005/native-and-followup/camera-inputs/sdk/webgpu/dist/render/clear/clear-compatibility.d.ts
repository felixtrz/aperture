import type { FrameBoundaryAssemblyReport } from "../frame/frame-boundary.js";
export type ClearCompatibilityDiagnosticCode = "clearCompatibility.missingTextureView" | "clearCompatibility.missingCommandEncoder" | "clearCompatibility.missingPassBegin" | "clearCompatibility.missingPassEnd" | "clearCompatibility.missingCommandBuffer" | "clearCompatibility.missingQueueSubmit";
export interface ClearCompatibilityDiagnostic {
    readonly code: ClearCompatibilityDiagnosticCode;
    readonly message: string;
}
export interface ClearCompatibilityReport {
    readonly ready: boolean;
    readonly diagnostics: readonly ClearCompatibilityDiagnostic[];
}
export declare function createClearCompatibilityReport(report: FrameBoundaryAssemblyReport): ClearCompatibilityReport;
//# sourceMappingURL=clear-compatibility.d.ts.map