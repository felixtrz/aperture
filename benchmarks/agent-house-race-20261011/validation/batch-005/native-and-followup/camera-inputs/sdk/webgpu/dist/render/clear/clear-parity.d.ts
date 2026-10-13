import type { WebGpuClearResult } from "./clear.js";
import type { ClearCompatibilityReport } from "./clear-compatibility.js";
export type ClearParityDiagnosticCode = "clearParity.clearFailedBoundaryReady" | "clearParity.clearSucceededBoundaryFailed" | "clearParity.bothFailed";
export interface ClearParityDiagnostic {
    readonly code: ClearParityDiagnosticCode;
    readonly message: string;
}
export interface ClearParityReport {
    readonly ready: boolean;
    readonly clearReady: boolean;
    readonly boundaryReady: boolean;
    readonly diagnostics: readonly ClearParityDiagnostic[];
}
export declare function createClearParityReport(clear: WebGpuClearResult, compatibility: ClearCompatibilityReport): ClearParityReport;
//# sourceMappingURL=clear-parity.d.ts.map