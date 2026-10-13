import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";
export type ShadowPassAttachmentDescriptorStatus = "ready" | "deferred" | "missing" | "not-required";
export type ShadowPassAttachmentDescriptorDiagnosticCode = "shadowPassAttachmentDescriptor.missingPassPlan" | "shadowPassAttachmentDescriptor.missingDepthView" | "shadowPassAttachmentDescriptor.passSubmissionDeferred";
export interface ShadowPassAttachmentDescriptorDiagnostic {
    readonly code: ShadowPassAttachmentDescriptorDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly passKey?: string;
    readonly shadowId?: number;
    readonly lightId?: number;
    readonly resourceKey?: string;
}
export interface ShadowPassDepthAttachmentDescriptor {
    readonly passKey: string;
    readonly shadowId: number;
    readonly lightId: number;
    readonly textureKey: string;
    readonly viewKey: string;
    readonly width: number;
    readonly height: number;
    readonly depthFormat: "depth24plus";
    readonly depthLoadOp: "clear" | "load";
    readonly depthStoreOp: "store";
    readonly depthClearValue: 0 | 1;
}
export interface ShadowPassAttachmentDescriptorReport {
    readonly ready: boolean;
    readonly status: ShadowPassAttachmentDescriptorStatus;
    readonly passCount: number;
    readonly attachmentCount: number;
    readonly sections: {
        readonly passPlans: boolean;
        readonly depthTextureResources: boolean;
        readonly depthAttachments: boolean;
        readonly commandEncoder: false;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly attachments: readonly ShadowPassDepthAttachmentDescriptor[];
    readonly diagnostics: readonly ShadowPassAttachmentDescriptorDiagnostic[];
}
export type ShadowPassAttachmentDescriptorReportJsonValue = ShadowPassAttachmentDescriptorReport;
export interface CreateShadowPassAttachmentDescriptorReportOptions {
    readonly shadowPassPlan: ShadowPassPlanReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
}
export declare function createShadowPassAttachmentDescriptorReport(options: CreateShadowPassAttachmentDescriptorReportOptions): ShadowPassAttachmentDescriptorReport;
export declare function shadowPassAttachmentDescriptorReportToJsonValue(report: ShadowPassAttachmentDescriptorReport): ShadowPassAttachmentDescriptorReportJsonValue;
export declare function shadowPassAttachmentDescriptorReportToJson(report: ShadowPassAttachmentDescriptorReport): string;
//# sourceMappingURL=shadow-pass-attachment-descriptor.d.ts.map