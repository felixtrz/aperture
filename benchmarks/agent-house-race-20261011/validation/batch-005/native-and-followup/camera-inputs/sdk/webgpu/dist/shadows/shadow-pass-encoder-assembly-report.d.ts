import { type GpuTimestampCommandReport, type GpuTimestampQueryResources } from "../gpu/gpu-timing.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import { type RenderPassCommandEncoderLike } from "../render/passes/render-pass-lifecycle.js";
import type { ShadowCasterFrameResourceReadinessReport } from "./shadow-caster-frame-resource-readiness.js";
import type { ShadowPassAttachmentDescriptorReport, ShadowPassDepthAttachmentDescriptor } from "./shadow-pass-attachment-descriptor.js";
import type { ShadowPassCommandEncodingReport } from "./shadow-pass-command-encoding-report.js";
export type ShadowPassEncoderAssemblyStatus = "ready" | "deferred" | "missing" | "not-required";
export type ShadowPassEncoderAssemblyDiagnosticCode = "shadowPassEncoderAssembly.missingAttachmentDescriptors" | "shadowPassEncoderAssembly.frameResourcesNotReady" | "shadowPassEncoderAssembly.missingCommandRecords" | "shadowPassEncoderAssembly.missingCommandEncoder" | "shadowPassEncoderAssembly.missingDepthView" | "shadowPassEncoderAssembly.beginFailed" | "shadowPassEncoderAssembly.commandExecutionFailed" | "shadowPassEncoderAssembly.endFailed" | "shadowPassEncoderAssembly.commandBufferSubmissionDeferred";
export interface ShadowPassEncoderAssemblyDiagnostic {
    readonly code: ShadowPassEncoderAssemblyDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly passKey?: string;
    readonly shadowId?: number;
    readonly lightId?: number;
}
export interface ShadowPassEncoderCommandRecord {
    readonly passKey: string;
    readonly commands: readonly RenderPassCommand[];
}
export interface ShadowPassEncoderAssemblyRecord {
    readonly passKey: string;
    readonly shadowId: number;
    readonly lightId: number;
    readonly depthTextureKey: string;
    readonly depthViewKey: string;
    readonly commandCount: number;
    readonly executedCommands: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly begun: boolean;
    readonly ended: boolean;
}
export interface ShadowPassGpuTimingOptions {
    readonly resources: GpuTimestampQueryResources;
    readonly startQuery?: number;
}
export interface ShadowPassGpuTimingCommandRecord {
    readonly passKey: string;
    readonly startQuery: number;
    readonly endQuery: number;
    readonly writeStart: GpuTimestampCommandReport | null;
    readonly writeEnd: GpuTimestampCommandReport | null;
    readonly diagnostics: readonly GpuTimestampCommandReport["diagnostics"][number][];
}
export interface ShadowPassGpuTimingCommandReport {
    readonly queryCount: number;
    readonly records: readonly ShadowPassGpuTimingCommandRecord[];
    readonly diagnostics: readonly GpuTimestampCommandReport["diagnostics"][number][];
}
export interface ShadowPassEncoderAssemblyReport {
    readonly ready: boolean;
    readonly status: ShadowPassEncoderAssemblyStatus;
    readonly counts: {
        readonly passes: number;
        readonly attachments: number;
        readonly frameResourceDraws: number;
        readonly commandRecords: number;
        readonly assembledPasses: number;
        readonly commandCount: number;
        readonly executedCommands: number;
        readonly drawCalls: number;
    };
    readonly sections: {
        readonly attachmentDescriptors: boolean;
        readonly frameResources: boolean;
        readonly commandRecords: boolean;
        readonly passBegin: boolean;
        readonly commandExecution: boolean;
        readonly passEnd: boolean;
        readonly commandBufferFinish: false;
        readonly queueSubmission: false;
        readonly shaderSampling: boolean;
    };
    readonly records: readonly ShadowPassEncoderAssemblyRecord[];
    readonly gpuTiming?: ShadowPassGpuTimingCommandReport;
    readonly diagnostics: readonly ShadowPassEncoderAssemblyDiagnostic[];
}
export type ShadowPassEncoderAssemblyReportJsonValue = ShadowPassEncoderAssemblyReport;
export interface CreateShadowPassEncoderAssemblyReportOptions {
    readonly attachments: ShadowPassAttachmentDescriptorReport;
    readonly frameResources: ShadowCasterFrameResourceReadinessReport;
    readonly commandEncoding: ShadowPassCommandEncodingReport;
    readonly commands: readonly ShadowPassEncoderCommandRecord[];
    readonly encoder?: RenderPassCommandEncoderLike;
    readonly deferEncoding?: boolean;
    readonly resolveDepthView?: (attachment: ShadowPassDepthAttachmentDescriptor) => unknown | null;
    readonly gpuTiming?: ShadowPassGpuTimingOptions;
}
export declare function createShadowPassEncoderAssemblyReport(options: CreateShadowPassEncoderAssemblyReportOptions): ShadowPassEncoderAssemblyReport;
export declare function shadowPassEncoderAssemblyReportToJsonValue(value: ShadowPassEncoderAssemblyReport): ShadowPassEncoderAssemblyReportJsonValue;
export declare function shadowPassEncoderAssemblyReportToJson(value: ShadowPassEncoderAssemblyReport): string;
//# sourceMappingURL=shadow-pass-encoder-assembly-report.d.ts.map