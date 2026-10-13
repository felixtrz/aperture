import type { IblPreparationPassPlanReport } from "../../lighting/ibl-preparation-pass-plan.js";
import type { DirectionalShadowViewProjectionPlanReport } from "../../shadows/directional-shadow-view-projection-plan.js";
import type { ShadowCasterDrawListPlanReport } from "../../shadows/shadow-caster-draw-list-plan.js";
export type StandardMaterialIblShadowBindingStatus = "available" | "deferred" | "missing" | "not-required";
export type StandardMaterialIblShadowBindingDiagnosticCode = "standardMaterialIblShadowBinding.missingIblPlan" | "standardMaterialIblShadowBinding.missingShadowPlan";
export interface StandardMaterialIblShadowBindingSlot {
    readonly bindingKey: string;
    readonly resourceKey: string;
    readonly kind: "ibl-diffuse" | "ibl-specular" | "shadow-view-projection" | "shadow-map";
    readonly source: "ibl" | "shadow";
    readonly readiness: "deferred" | "available";
}
export interface StandardMaterialIblShadowBindingDiagnostic {
    readonly code: StandardMaterialIblShadowBindingDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface StandardMaterialIblShadowBindingReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialIblShadowBindingStatus;
    readonly standardMaterialCount: number;
    readonly slotCount: number;
    readonly sections: {
        readonly iblPassPlanning: boolean;
        readonly shadowPlanning: boolean;
    };
    readonly slots: readonly StandardMaterialIblShadowBindingSlot[];
    readonly diagnostics: readonly StandardMaterialIblShadowBindingDiagnostic[];
}
export type StandardMaterialIblShadowBindingReadinessReportJsonValue = StandardMaterialIblShadowBindingReadinessReport;
export interface StandardMaterialIblShadowBindingReadinessInput {
    readonly standardMaterialCount: number;
    readonly iblPassPlan: IblPreparationPassPlanReport;
    readonly shadowViewProjection: DirectionalShadowViewProjectionPlanReport;
    readonly shadowCasterDrawList: ShadowCasterDrawListPlanReport;
}
export declare function createStandardMaterialIblShadowBindingReadinessReport(input: StandardMaterialIblShadowBindingReadinessInput): StandardMaterialIblShadowBindingReadinessReport;
export declare function standardMaterialIblShadowBindingReadinessReportToJsonValue(report: StandardMaterialIblShadowBindingReadinessReport): StandardMaterialIblShadowBindingReadinessReportJsonValue;
export declare function standardMaterialIblShadowBindingReadinessReportToJson(report: StandardMaterialIblShadowBindingReadinessReport): string;
//# sourceMappingURL=standard-material-ibl-shadow-binding-readiness.d.ts.map