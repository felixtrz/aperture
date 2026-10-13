export declare class ApertureSystemError extends Error {
    readonly code: string;
    readonly suggestedFix: string;
    readonly detail: Readonly<Record<string, unknown>> | undefined;
    constructor(code: string, message: string, suggestedFix: string, detail?: Readonly<Record<string, unknown>>, options?: ErrorOptions);
}
//# sourceMappingURL=errors.d.ts.map