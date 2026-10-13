export type DiagnosticSeverity = "info" | "warning" | "error";
export interface DiagnosticLike {
    readonly code: string;
    readonly severity?: DiagnosticSeverity;
}
export interface DiagnosticSummaryOptions {
    readonly defaultSeverity?: DiagnosticSeverity;
}
export interface DiagnosticSummary {
    readonly total: number;
    readonly bySeverity: Readonly<Record<DiagnosticSeverity, number>>;
    readonly byCode: Readonly<Record<string, number>>;
}
export declare function summarizeDiagnostics(diagnostics: readonly DiagnosticLike[], options?: DiagnosticSummaryOptions): DiagnosticSummary;
//# sourceMappingURL=index.d.ts.map