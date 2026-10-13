export interface SystemDiagnostics {
    info(code: string, data?: Record<string, unknown>, message?: string): void;
    warn(code: string, data?: Record<string, unknown>, message?: string): void;
    error(code: string, data?: Record<string, unknown>, message?: string): void;
    list(): readonly ApertureSystemDiagnostic[];
}
export interface ApertureSystemDiagnostic {
    readonly code: string;
    readonly severity: "info" | "warning" | "error";
    readonly message: string;
    readonly data?: Readonly<Record<string, unknown>>;
    readonly suggestedFix?: string;
}
export declare function createDiagnostics(): SystemDiagnostics;
export declare function formatReportDiagnostics(diagnostics: readonly {
    readonly code?: string;
    readonly message?: string;
}[]): string;
//# sourceMappingURL=diagnostics.d.ts.map