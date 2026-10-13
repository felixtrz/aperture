import type { CommandBufferResource } from "../../gpu/command-buffer.js";
export type QueueSubmitDiagnosticCode = "queueSubmit.missingSubmit" | "queueSubmit.emptyCommandBuffers";
export interface QueueSubmitDiagnostic {
    readonly code: QueueSubmitDiagnosticCode;
    readonly message: string;
}
export interface QueueSubmitLike {
    submit?: (commandBuffers: readonly unknown[]) => void;
}
export interface SubmitCommandBuffersOptions {
    readonly queue: QueueSubmitLike;
    readonly commandBuffers: readonly CommandBufferResource[];
}
export interface SubmitCommandBuffersReport {
    readonly valid: boolean;
    readonly submitted: number;
    readonly skipped: number;
    readonly commandBufferKeys: readonly string[];
    readonly diagnostics: readonly QueueSubmitDiagnostic[];
}
export declare function submitCommandBuffers(options: SubmitCommandBuffersOptions): SubmitCommandBuffersReport;
//# sourceMappingURL=queue-submit.d.ts.map