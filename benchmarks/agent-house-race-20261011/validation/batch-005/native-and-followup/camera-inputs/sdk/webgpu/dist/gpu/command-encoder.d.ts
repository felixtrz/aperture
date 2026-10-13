export type CommandEncoderCreationDiagnosticCode = "commandEncoder.missingCreateCommandEncoder";
export interface CommandEncoderCreationDiagnostic {
    readonly code: CommandEncoderCreationDiagnosticCode;
    readonly message: string;
}
export interface CommandEncoderDeviceLike {
    createCommandEncoder?: () => unknown;
}
export interface CommandEncoderResource {
    readonly resourceKey: string;
    readonly encoder: unknown;
}
export interface CreateCommandEncoderOptions {
    readonly device: CommandEncoderDeviceLike;
    readonly label: string;
}
export interface CreateCommandEncoderResult {
    readonly valid: boolean;
    readonly resource: CommandEncoderResource | null;
    readonly diagnostics: readonly CommandEncoderCreationDiagnostic[];
}
export declare function createCommandEncoderResource(options: CreateCommandEncoderOptions): CreateCommandEncoderResult;
//# sourceMappingURL=command-encoder.d.ts.map