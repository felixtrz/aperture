import type { ShadowDepthTextureResourceReport } from "../../shadows/shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "../../shadows/shadow-matrix-buffer-resource.js";
import type { ShadowPassCommandBufferSubmissionReport } from "../../shadows/shadow-pass-command-buffer-submission-report.js";
import type { ShadowSamplerResourceReport, StandardMaterialShadowBindGroupResourceReport } from "./standard-material-shadow-bind-group.js";
export type StandardMaterialShadowReceiverBindingStatus = "ready" | "missing" | "not-required";
export type StandardMaterialShadowReceiverBindingDiagnosticCode = "standardMaterialShadowReceiverBinding.missingMatrixBufferResource" | "standardMaterialShadowReceiverBinding.missingDepthTextureResource" | "standardMaterialShadowReceiverBinding.missingSamplerResource" | "standardMaterialShadowReceiverBinding.missingBindGroupResource" | "standardMaterialShadowReceiverBinding.commandBufferNotReady";
export interface StandardMaterialShadowReceiverBindingDiagnostic {
    readonly code: StandardMaterialShadowReceiverBindingDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface StandardMaterialShadowReceiverBindingRecord {
    readonly receiverKey: string;
    readonly group: 5;
    readonly matrixResourceKey: string;
    readonly depthTextureResourceKey: string;
    readonly depthViewKey: string;
    readonly samplerResourceKey: string;
    readonly bindGroupResourceKey: string;
    readonly commandBufferStatus: ShadowPassCommandBufferSubmissionReport["status"];
}
export interface StandardMaterialShadowReceiverBindingReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialShadowReceiverBindingStatus;
    readonly standardMaterialCount: number;
    readonly receiverCount: number;
    readonly sections: {
        readonly matrixBufferResource: boolean;
        readonly depthTextureResource: boolean;
        readonly samplerResource: boolean;
        readonly bindGroupResource: boolean;
        readonly commandBufferSubmission: boolean;
        readonly shaderSampling: boolean;
    };
    readonly records: readonly StandardMaterialShadowReceiverBindingRecord[];
    readonly diagnostics: readonly StandardMaterialShadowReceiverBindingDiagnostic[];
}
export type StandardMaterialShadowReceiverBindingReadinessReportJsonValue = StandardMaterialShadowReceiverBindingReadinessReport;
export interface CreateStandardMaterialShadowReceiverBindingReadinessReportOptions {
    readonly standardMaterialCount: number;
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly samplerResource: ShadowSamplerResourceReport;
    readonly bindGroupResource: StandardMaterialShadowBindGroupResourceReport;
    readonly commandBufferSubmission: ShadowPassCommandBufferSubmissionReport;
}
export declare function createStandardMaterialShadowReceiverBindingReadinessReport(options: CreateStandardMaterialShadowReceiverBindingReadinessReportOptions): StandardMaterialShadowReceiverBindingReadinessReport;
export declare function standardMaterialShadowReceiverBindingReadinessReportToJsonValue(report: StandardMaterialShadowReceiverBindingReadinessReport): StandardMaterialShadowReceiverBindingReadinessReportJsonValue;
export declare function standardMaterialShadowReceiverBindingReadinessReportToJson(report: StandardMaterialShadowReceiverBindingReadinessReport): string;
//# sourceMappingURL=standard-material-shadow-receiver-binding-readiness.d.ts.map