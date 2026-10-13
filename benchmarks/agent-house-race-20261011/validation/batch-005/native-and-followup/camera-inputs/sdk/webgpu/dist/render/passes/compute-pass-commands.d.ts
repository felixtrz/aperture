export type ComputePassCommandKind = "setComputePipeline" | "setComputeBindGroup" | "dispatchWorkgroups" | "dispatchWorkgroupsIndirect";
export type ComputePassStateCommandKind = "setComputePipeline" | "setComputeBindGroup";
export interface SetComputePipelineCommand {
    readonly kind: "setComputePipeline";
    readonly pipelineKey: string;
    readonly pipeline: unknown;
}
export interface SetComputeBindGroupCommand {
    readonly kind: "setComputeBindGroup";
    readonly index: number;
    readonly resourceKey: string;
    readonly bindGroup: unknown;
}
export interface DispatchWorkgroupsCommand {
    readonly kind: "dispatchWorkgroups";
    readonly workgroupCountX: number;
    readonly workgroupCountY: number;
    readonly workgroupCountZ: number;
}
export interface DispatchWorkgroupsIndirectCommand {
    readonly kind: "dispatchWorkgroupsIndirect";
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly offset: number;
}
export type ComputePassCommand = SetComputePipelineCommand | SetComputeBindGroupCommand | DispatchWorkgroupsCommand | DispatchWorkgroupsIndirectCommand;
export type ComputePassCommandDiagnosticCode = "computePassCommand.invalidWorkgroupCount" | "computePassCommand.missingPipeline";
export interface ComputePassCommandDiagnostic {
    readonly code: ComputePassCommandDiagnosticCode;
    readonly message: string;
}
/**
 * Validate a flat compute command list without touching the GPU. Used by the
 * graph compiler (headless-safe) to surface malformed dispatches before the
 * executor runs them. A list is valid when it begins by binding a pipeline
 * before any dispatch and every dispatch has positive integer workgroup counts.
 */
export declare function validateComputePassCommands(commands: readonly ComputePassCommand[]): readonly ComputePassCommandDiagnostic[];
export type ComputePassEncoderMethod = "setPipeline" | "setBindGroup" | "dispatchWorkgroups" | "dispatchWorkgroupsIndirect";
export interface ComputePassEncoderLike {
    setPipeline?: (pipeline: unknown) => void;
    setBindGroup?: (index: number, bindGroup: unknown) => void;
    dispatchWorkgroups?: (x: number, y: number, z: number) => void;
    dispatchWorkgroupsIndirect?: (buffer: unknown, offset: number) => void;
}
export type ComputePassCommandExecutorDiagnosticCode = "computePassCommandExecutor.missingMethod";
export interface ComputePassCommandExecutorDiagnostic {
    readonly code: ComputePassCommandExecutorDiagnosticCode;
    readonly message: string;
    readonly method: ComputePassEncoderMethod;
}
export interface ComputePassCommandExecutionReport {
    readonly valid: boolean;
    readonly commandCount: number;
    readonly executedCommands: number;
    readonly skippedCommands: number;
    readonly dispatchCount: number;
    readonly diagnostics: readonly ComputePassCommandExecutorDiagnostic[];
}
export interface ExecuteComputePassCommandsOptions {
    readonly pass: ComputePassEncoderLike;
    readonly commands: readonly ComputePassCommand[];
}
/**
 * Replay a flat ComputePassCommand list against a live GPUComputePassEncoder,
 * mirroring executeRenderPassCommands. A missing encoder method is a recorded
 * diagnostic (the command is skipped), never a throw, so a degraded encoder
 * still produces a JSON-safe report.
 */
export declare function executeComputePassCommands(options: ExecuteComputePassCommandsOptions): ComputePassCommandExecutionReport;
//# sourceMappingURL=compute-pass-commands.d.ts.map