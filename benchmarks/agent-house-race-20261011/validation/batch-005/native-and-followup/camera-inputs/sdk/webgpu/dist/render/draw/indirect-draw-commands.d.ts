import { type WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
import type { RenderPassCommand } from "../passes/render-pass-commands.js";
export type IndirectDrawCommandStatus = "disabled" | "skipped" | "created" | "updated" | "fallback";
export type IndirectDrawFallbackReason = "no-candidates" | "first-instance-unsupported" | "create-buffer-unavailable" | "queue-write-buffer-unavailable" | "buffer-creation-failed";
export type IndirectDrawCommandDiagnosticCode = "indirectDraw.firstInstanceUnsupported" | "indirectDraw.createBufferUnavailable" | "indirectDraw.queueWriteBufferUnavailable" | "indirectDraw.bufferCreationFailed";
export interface IndirectDrawCommandDiagnostic {
    readonly code: IndirectDrawCommandDiagnosticCode;
    readonly message: string;
    readonly reason?: IndirectDrawFallbackReason;
}
export interface IndirectDrawBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly capacity: number;
    readonly byteLength: number;
}
export interface IndirectDrawCommandCache {
    resource: IndirectDrawBufferResource | null;
    readonly args: Uint32Array;
    readonly signedArgs: Int32Array;
    readonly commands: RenderPassCommand[];
}
export interface PrepareIndirectDrawCommandsOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly cache: IndirectDrawCommandCache;
    readonly commands: readonly RenderPassCommand[];
    readonly label: string;
    readonly supportsIndirectFirstInstance: boolean;
    readonly enabled?: boolean;
    readonly minInstanceCount?: number;
}
export interface IndirectDrawCommandReport {
    readonly valid: boolean;
    readonly status: IndirectDrawCommandStatus;
    readonly candidates: number;
    readonly indirectDraws: number;
    readonly directDraws: number;
    readonly indexedIndirectDraws: number;
    readonly nonIndexedIndirectDraws: number;
    readonly bufferResourceKey: string | null;
    readonly bufferBytes: number;
    readonly fallbackReason: IndirectDrawFallbackReason | null;
    readonly diagnostics: readonly IndirectDrawCommandDiagnostic[];
}
export interface PrepareIndirectDrawCommandsResult {
    readonly commands: readonly RenderPassCommand[];
    readonly report: IndirectDrawCommandReport;
}
export declare function createIndirectDrawCommandCache(capacity?: number): IndirectDrawCommandCache;
export declare function prepareIndirectDrawCommands(options: PrepareIndirectDrawCommandsOptions): PrepareIndirectDrawCommandsResult;
//# sourceMappingURL=indirect-draw-commands.d.ts.map