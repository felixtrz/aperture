import { type ApertureDiagnosticErrorDetails } from "./internal/diagnostic-error.js";
export { APERTURE_DIAGNOSTIC_ERROR_LIMITS } from "./internal/diagnostic-error.js";
export type { ApertureDiagnosticErrorDetails } from "./internal/diagnostic-error.js";
export interface ApertureGeneratedDiagnosticSource {
    readonly file?: string;
    readonly module?: string;
    readonly asset?: string;
    readonly worker?: string;
    readonly glob?: string;
}
export interface ApertureGeneratedDiagnostic {
    readonly code: string;
    readonly severity: "info" | "warning" | "error";
    readonly message: string;
    readonly source?: ApertureGeneratedDiagnosticSource;
    readonly data?: Readonly<Record<string, unknown>>;
    /** Bounded, serializable error details; lifecycle wrappers retain the original exception in error.cause. */
    readonly error?: ApertureDiagnosticErrorDetails;
    readonly suggestedFix: string;
}
export interface ApertureGeneratedDiagnosticsStatus {
    readonly status: "ok" | "failed";
    readonly diagnostics: readonly ApertureGeneratedDiagnostic[];
}
export interface ApertureDiagnosticFallback {
    readonly code: string;
    readonly message: string;
    readonly severity?: ApertureGeneratedDiagnostic["severity"];
    readonly suggestedFix: string;
    readonly source?: ApertureGeneratedDiagnosticSource;
    readonly data?: Readonly<Record<string, unknown>>;
}
export declare function createApertureGeneratedDiagnosticsStatus(input: {
    readonly status: "ok" | "failed";
    readonly diagnostics: readonly unknown[];
    readonly fallback?: ApertureDiagnosticFallback;
}): ApertureGeneratedDiagnosticsStatus;
export declare function createApertureGeneratedFailureStatus(input: {
    readonly error: unknown;
    readonly fallback: ApertureDiagnosticFallback;
}): ApertureGeneratedDiagnosticsStatus;
export declare function normalizeApertureDiagnostic(value: unknown, fallback?: ApertureDiagnosticFallback): ApertureGeneratedDiagnostic;
export declare function errorToApertureDiagnostic(error: unknown, fallback: ApertureDiagnosticFallback): ApertureGeneratedDiagnostic;
//# sourceMappingURL=diagnostics.d.ts.map