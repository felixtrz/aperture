/** JSON/structured-clone-safe error attribution without arbitrary thrown properties. */
export interface ApertureDiagnosticErrorDetails {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
    readonly cause?: ApertureDiagnosticErrorDetails;
    /** True when text/depth limits or a circular cause omit original detail. */
    readonly truncated?: true;
}
/** String limits count JavaScript string characters; causeRecords includes the root error. */
export declare const APERTURE_DIAGNOSTIC_ERROR_LIMITS: Readonly<{
    readonly nameCharacters: 256;
    readonly messageCharacters: 2048;
    readonly stackCharacters: 8192;
    readonly causeRecords: 4;
}>;
export declare function diagnosticErrorDetails(value: unknown): ApertureDiagnosticErrorDetails;
export declare function normalizedDiagnosticError(value: unknown): ApertureDiagnosticErrorDetails | undefined;
//# sourceMappingURL=diagnostic-error.d.ts.map