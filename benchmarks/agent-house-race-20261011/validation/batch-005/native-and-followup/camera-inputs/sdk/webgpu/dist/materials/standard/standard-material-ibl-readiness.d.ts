import type { IblResourceDescriptorDiagnostic, IblResourceDescriptorReport } from "../../lighting/ibl-resource-descriptor.js";
import type { IblTexturePreparationReport } from "../../lighting/ibl-texture-preparation.js";
import type { StandardMaterialIblBindGroupResourceReport } from "./standard-material-ibl-bind-group.js";
export type StandardMaterialIblStatus = "not-required" | "not-requested" | "source-missing" | "preparation-pending" | "preparation-failed" | "diffuse-ready" | "diffuse-specular-ready" | "pipeline-active";
export type StandardMaterialIblReadinessDiagnosticCode = "standardMaterialIbl.missingDescriptors" | "standardMaterialIbl.preparationPending" | "standardMaterialIbl.preparationFailed" | "standardMaterialIbl.pipelineInactive" | "standardMaterialIbl.pipelineResourceMismatch";
export interface StandardMaterialIblReadinessDiagnostic {
    readonly code: StandardMaterialIblReadinessDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly descriptorDiagnostics: readonly IblResourceDescriptorDiagnostic[];
}
export interface StandardMaterialIblReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialIblStatus;
    readonly standardMaterialCount: number;
    readonly descriptorCount: number;
    readonly submittedStandardPipelineCount: number;
    readonly activeIblPipelineCount: number;
    readonly sections: {
        readonly environmentRequested: boolean;
        readonly environmentSource: boolean;
        readonly iblDescriptors: boolean;
        readonly diffuseIrradiance: boolean | null;
        readonly specularPrefilter: boolean | null;
        readonly bindGroupResource: boolean | null;
        readonly pipelineActive: boolean;
        /** Derived from the executable submitted pipeline, never a static flag. */
        readonly shaderSampling: boolean;
    };
    readonly diagnostics: readonly StandardMaterialIblReadinessDiagnostic[];
}
export type StandardMaterialIblReadinessReportJsonValue = StandardMaterialIblReadinessReport;
export interface StandardMaterialIblReadinessInput {
    readonly standardMaterialCount: number;
    readonly iblDescriptors: IblResourceDescriptorReport;
    readonly texturePreparation?: IblTexturePreparationReport;
    readonly bindGroupResource?: StandardMaterialIblBindGroupResourceReport;
    /** Pipeline keys actually selected for submitted StandardMaterial draws. */
    readonly submittedPipelineKeys?: readonly string[];
}
export declare function createStandardMaterialIblReadinessReport(input: StandardMaterialIblReadinessInput): StandardMaterialIblReadinessReport;
export declare function standardMaterialIblReadinessReportToJsonValue(value: StandardMaterialIblReadinessReport): StandardMaterialIblReadinessReportJsonValue;
export declare function standardMaterialIblReadinessReportToJson(value: StandardMaterialIblReadinessReport): string;
//# sourceMappingURL=standard-material-ibl-readiness.d.ts.map