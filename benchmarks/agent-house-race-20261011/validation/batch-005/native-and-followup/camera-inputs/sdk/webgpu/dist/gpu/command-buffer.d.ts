export type CommandBufferFinishDiagnosticCode = "commandBuffer.missingFinish";
export interface CommandBufferFinishDiagnostic {
    readonly code: CommandBufferFinishDiagnosticCode;
    readonly message: string;
}
export interface CommandEncoderFinishLike {
    finish?: () => unknown;
}
export interface CommandBufferResource {
    readonly resourceKey: string;
    readonly commandBuffer: unknown;
}
export interface FinishCommandEncoderOptions {
    readonly encoder: CommandEncoderFinishLike;
    readonly label: string;
}
export interface FinishCommandEncoderResult {
    readonly valid: boolean;
    readonly resource: CommandBufferResource | null;
    readonly diagnostics: readonly CommandBufferFinishDiagnostic[];
}
export declare function finishCommandEncoder(options: FinishCommandEncoderOptions): FinishCommandEncoderResult;
//# sourceMappingURL=command-buffer.d.ts.map