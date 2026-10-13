import type { RenderPassCommand } from "./render-pass-commands.js";
export type RenderPassCommandExecutorDiagnosticCode = "renderPassCommandExecutor.missingMethod";
export type RenderPassEncoderMethod = "setPipeline" | "setBindGroup" | "setVertexBuffer" | "setIndexBuffer" | "beginOcclusionQuery" | "endOcclusionQuery" | "draw" | "drawIndexed" | "drawIndirect" | "drawIndexedIndirect";
export interface RenderPassCommandExecutorDiagnostic {
    readonly code: RenderPassCommandExecutorDiagnosticCode;
    readonly message: string;
    readonly method: RenderPassEncoderMethod;
    readonly renderId: number;
}
export interface RenderPassEncoderLike {
    setPipeline?: (pipeline: unknown) => void;
    setBindGroup?: (index: number, bindGroup: unknown) => void;
    setVertexBuffer?: (slot: number, buffer: unknown) => void;
    setIndexBuffer?: (buffer: unknown, format: string) => void;
    beginOcclusionQuery?: (queryIndex: number) => void;
    endOcclusionQuery?: () => void;
    draw?: (vertexCount: number, instanceCount: number, firstVertex: number, firstInstance: number) => void;
    drawIndexed?: (indexCount: number, instanceCount: number, firstIndex: number, baseVertex: number, firstInstance: number) => void;
    drawIndirect?: (buffer: unknown, offset: number) => void;
    drawIndexedIndirect?: (buffer: unknown, offset: number) => void;
}
export interface ExecuteRenderPassCommandsOptions {
    readonly pass: RenderPassEncoderLike;
    readonly commands: readonly RenderPassCommand[];
}
export interface RenderPassCommandExecutionReport {
    readonly valid: boolean;
    readonly commandCount: number;
    readonly executedCommands: number;
    readonly skippedCommands: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly nonIndexedDrawCalls: number;
    readonly diagnostics: readonly RenderPassCommandExecutorDiagnostic[];
}
export declare function executeRenderPassCommands(options: ExecuteRenderPassCommandsOptions): RenderPassCommandExecutionReport;
//# sourceMappingURL=render-pass-command-executor.d.ts.map