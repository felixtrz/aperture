import { type CommandEncoderFinishLike } from "../gpu/command-buffer.js";
import { type GpuTimestampCommandReport, type GpuTimestampQueryResources } from "../gpu/gpu-timing.js";
import { type QueueSubmitLike } from "../render/queues/queue-submit.js";
import type { ShadowPassEncoderAssemblyReport } from "./shadow-pass-encoder-assembly-report.js";
export type ShadowPassCommandBufferSubmissionStatus = "ready" | "submitted" | "missing" | "not-required";
export type ShadowPassCommandBufferSubmissionDiagnosticCode = "shadowPassCommandBufferSubmission.missingEncoderAssembly" | "shadowPassCommandBufferSubmission.missingCommandEncoder" | "shadowPassCommandBufferSubmission.finishFailed" | "shadowPassCommandBufferSubmission.submitFailed" | "shadowPassCommandBufferSubmission.queueSubmissionDeferred" | "shadowPassCommandBufferSubmission.shaderSamplingDeferred";
export interface ShadowPassCommandBufferSubmissionDiagnostic {
    readonly code: ShadowPassCommandBufferSubmissionDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface ShadowPassCommandBufferSubmissionReport {
    readonly ready: boolean;
    readonly status: ShadowPassCommandBufferSubmissionStatus;
    readonly counts: {
        readonly assembledPasses: number;
        readonly commandCount: number;
        readonly drawCalls: number;
        readonly commandBuffers: number;
        readonly submittedCommandBuffers: number;
        readonly skippedSubmissions: number;
    };
    readonly sections: {
        readonly encoderAssembly: boolean;
        readonly commandBufferFinish: boolean;
        readonly queueSubmission: boolean;
        readonly shaderSampling: boolean;
    };
    readonly commandBufferKeys: readonly string[];
    readonly gpuTiming?: ShadowPassCommandBufferGpuTimingReport;
    readonly diagnostics: readonly ShadowPassCommandBufferSubmissionDiagnostic[];
}
export interface ShadowPassCommandBufferGpuTimingOptions {
    readonly resources: GpuTimestampQueryResources;
    readonly queryCount?: number;
}
export interface ShadowPassCommandBufferGpuTimingReport {
    readonly queryCount: number;
    readonly resolve: GpuTimestampCommandReport | null;
    readonly diagnostics: readonly GpuTimestampCommandReport["diagnostics"][number][];
}
export type ShadowPassCommandBufferSubmissionReportJsonValue = ShadowPassCommandBufferSubmissionReport;
export interface CreateShadowPassCommandBufferSubmissionReportOptions {
    readonly assembly: ShadowPassEncoderAssemblyReport;
    readonly encoder?: CommandEncoderFinishLike;
    readonly queue?: QueueSubmitLike;
    readonly label?: string;
    readonly submit?: boolean;
    readonly deferEncoding?: boolean;
    readonly gpuTiming?: ShadowPassCommandBufferGpuTimingOptions;
}
export declare function createShadowPassCommandBufferSubmissionReport(options: CreateShadowPassCommandBufferSubmissionReportOptions): ShadowPassCommandBufferSubmissionReport;
export declare function shadowPassCommandBufferSubmissionReportToJsonValue(value: ShadowPassCommandBufferSubmissionReport): ShadowPassCommandBufferSubmissionReportJsonValue;
export declare function shadowPassCommandBufferSubmissionReportToJson(value: ShadowPassCommandBufferSubmissionReport): string;
//# sourceMappingURL=shadow-pass-command-buffer-submission-report.d.ts.map