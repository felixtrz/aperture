import { type MaterialValidationDiagnostic, type StandardMaterialAsset } from "@aperture-engine/render";
import { type MaterialPipelineRenderStateTokens } from "../core/material-render-state.js";
export type StandardMaterialRenderStateSummaryDiagnosticCode = "standardMaterialRenderState.validation" | "standardMaterialRenderState.alphaModeMismatch" | "standardMaterialRenderState.cullModeMismatch" | "standardMaterialRenderState.depthWriteMismatch" | "standardMaterialRenderState.blendPresetMismatch" | "standardMaterialRenderState.renderPhaseMismatch";
export interface StandardMaterialRenderStateSummaryDiagnostic {
    readonly code: StandardMaterialRenderStateSummaryDiagnosticCode;
    readonly message: string;
    readonly severity: "warning";
    readonly field?: string;
    readonly sourceCode?: MaterialValidationDiagnostic["code"];
    readonly sourceValue?: string | number | boolean | null;
    readonly derivedValue?: string | number | boolean | null;
}
export interface StandardMaterialRenderStateSummarySource {
    readonly alphaMode: StandardMaterialAsset["renderState"]["alphaMode"];
    readonly alphaCutoff: number;
    readonly cullMode: StandardMaterialAsset["renderState"]["cullMode"];
    readonly frontFace: StandardMaterialAsset["renderState"]["frontFace"];
    readonly depth: {
        readonly test: boolean;
        readonly write: boolean;
        readonly compare: StandardMaterialAsset["renderState"]["depth"]["compare"];
    };
    readonly blendPreset: StandardMaterialAsset["renderState"]["blend"]["preset"];
    readonly colorWriteMask: StandardMaterialAsset["renderState"]["colorWriteMask"];
}
export interface StandardMaterialRenderStateSummaryFlags {
    readonly alphaMask: boolean;
    readonly alphaBlend: boolean;
    readonly doubleSided: boolean;
}
export interface StandardMaterialRenderStatePipelineSummary {
    readonly pipelineKey: string | null;
    readonly tokens: MaterialPipelineRenderStateTokens;
    readonly resolved: {
        readonly alphaMode: string;
        readonly cullMode: string;
        readonly frontFace: string;
        readonly depthCompare: string;
        readonly depthWriteEnabled: boolean;
        readonly blendPreset: string;
        readonly blendEnabled: boolean;
    };
}
export interface StandardMaterialRenderStateSummary {
    readonly materialKey: string | null;
    readonly materialKind: "standard";
    readonly renderPhase: string | null;
    readonly source: StandardMaterialRenderStateSummarySource;
    readonly flags: StandardMaterialRenderStateSummaryFlags;
    readonly pipeline: StandardMaterialRenderStatePipelineSummary;
    readonly diagnostics: readonly StandardMaterialRenderStateSummaryDiagnostic[];
}
export interface CreateStandardMaterialRenderStateSummaryInput {
    readonly material: StandardMaterialAsset;
    readonly materialKey?: string;
    readonly pipelineKey?: string;
    readonly renderPhase?: string;
    readonly depthFormat?: string | null;
}
export declare function createStandardMaterialRenderStateSummary(input: CreateStandardMaterialRenderStateSummaryInput): StandardMaterialRenderStateSummary;
//# sourceMappingURL=standard-render-state-summary.d.ts.map