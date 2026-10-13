import { type RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { ShadowCasterCommandPlanReadinessReport } from "./shadow-caster-command-plan-readiness.js";
import type { ShadowCasterFrameResourceReadinessReport } from "./shadow-caster-frame-resource-readiness.js";
export type ShadowCasterCommandRecordPlanStatus = "ready" | "missing" | "not-required";
export type ShadowCasterCommandRecordPlanDiagnosticCode = "shadowCasterCommandRecord.frameResourcesNotReady" | "shadowCasterCommandRecord.missingCommandPlan" | "shadowCasterCommandRecord.missingPipelineResource" | "shadowCasterCommandRecord.missingMatrixBindGroupResource" | "shadowCasterCommandRecord.missingMeshResource" | "shadowCasterCommandRecord.missingVertexBufferResource" | "shadowCasterCommandRecord.missingIndexBufferResource" | "shadowCasterCommandRecord.invalidMatrixOffset" | "shadowCasterCommandRecord.commandPlanningFailed" | "shadowCasterCommandRecord.passSubmissionDeferred" | "shadowCasterCommandRecord.shaderSamplingDeferred";
export interface ShadowCasterCommandRecordPlanDiagnostic {
    readonly code: ShadowCasterCommandRecordPlanDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly passKey?: string;
    readonly renderId?: number;
    readonly resourceKey?: string;
}
export interface ShadowCasterPipelineResourceView {
    readonly pipelineKey: string;
    readonly resourceKey: string;
    readonly pipeline: unknown;
}
export interface ShadowCasterMatrixBindGroupResourceView {
    readonly matrixResourceKey: string;
    readonly passKey?: string;
    readonly worldTransformResourceKey?: string;
    readonly resourceKey: string;
    readonly group: number;
    readonly bindGroup: unknown;
}
export interface ShadowCasterExecutableVertexBufferView {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly vertexCount: number;
}
export interface ShadowCasterExecutableIndexBufferView {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly format: string;
    readonly indexCount: number;
}
export interface ShadowCasterExecutableMeshResourceView {
    readonly meshKey: string;
    readonly meshResourceKey: string;
    readonly vertexBuffers: readonly ShadowCasterExecutableVertexBufferView[];
    readonly indexBuffer: ShadowCasterExecutableIndexBufferView | null;
}
export interface ShadowCasterExecutableCommandRecord {
    readonly passKey: string;
    readonly commandKey: string;
    readonly commands: readonly RenderPassCommand[];
}
export interface ShadowCasterCommandRecordPlanRecord {
    readonly passKey: string;
    readonly commandKey: string;
    readonly renderIds: readonly number[];
    readonly commandCount: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly pipelineKeys: readonly string[];
    readonly pipelineResourceKeys: readonly string[];
    readonly bindGroupResourceKeys: readonly string[];
    readonly vertexBufferResourceKeys: readonly string[];
    readonly indexBufferResourceKeys: readonly string[];
    readonly drawCommandKeys: readonly string[];
}
export interface ShadowCasterCommandRecordPlanReport {
    readonly ready: boolean;
    readonly status: ShadowCasterCommandRecordPlanStatus;
    readonly counts: {
        readonly frameResourceDraws: number;
        readonly readyFrameResourceDraws: number;
        readonly pipelineResources: number;
        readonly matrixBindGroups: number;
        readonly meshResources: number;
        readonly commandRecords: number;
        readonly commandCount: number;
        readonly drawCalls: number;
        readonly indexedDrawCalls: number;
    };
    readonly sections: {
        readonly frameResources: boolean;
        readonly commandPlans: boolean;
        readonly pipelineResources: boolean;
        readonly matrixBindGroups: boolean;
        readonly meshBuffers: boolean;
        readonly commandRecords: boolean;
        readonly commandBufferFinish: false;
        readonly queueSubmission: false;
        readonly shaderSampling: false;
    };
    readonly records: readonly ShadowCasterCommandRecordPlanRecord[];
    readonly commandRecords: readonly ShadowCasterExecutableCommandRecord[];
    readonly diagnostics: readonly ShadowCasterCommandRecordPlanDiagnostic[];
}
export type ShadowCasterCommandRecordPlanReportJsonValue = Omit<ShadowCasterCommandRecordPlanReport, "commandRecords"> & {
    readonly commandRecords: readonly {
        readonly passKey: string;
        readonly commandKey: string;
        readonly commandCount: number;
    }[];
};
export interface CreateShadowCasterCommandRecordPlanReportOptions {
    readonly frameResources: ShadowCasterFrameResourceReadinessReport;
    readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
    readonly pipelines?: readonly ShadowCasterPipelineResourceView[];
    readonly matrixBindGroups?: readonly ShadowCasterMatrixBindGroupResourceView[];
    readonly meshes?: readonly ShadowCasterExecutableMeshResourceView[];
    /** Legacy per-`${passKey}:${renderId}` baked-entry index fallback. */
    readonly bakedMatrixIndexByPassDraw?: ReadonlyMap<string, number>;
    /** Legacy group-0 bind group over the baked caster matrix fallback buffer. */
    readonly bakedMatrixBindGroup?: ShadowCasterMatrixBindGroupResourceView;
    /**
     * Per-`${passKey}:${renderId}` entry index into the shadow caster WORLD
     * transform buffer. When supplied with pass-keyed matrix bind groups, the
     * caster shader computes `passLightVP * worldTransforms[instance] * local`.
     */
    readonly worldTransformIndexByPassDraw?: ReadonlyMap<string, number>;
}
export declare function createShadowCasterCommandRecordPlanReport(options: CreateShadowCasterCommandRecordPlanReportOptions): ShadowCasterCommandRecordPlanReport;
export declare function shadowCasterCommandRecordPlanReportToJsonValue(value: ShadowCasterCommandRecordPlanReport): ShadowCasterCommandRecordPlanReportJsonValue;
export declare function shadowCasterCommandRecordPlanReportToJson(value: ShadowCasterCommandRecordPlanReport): string;
//# sourceMappingURL=shadow-caster-command-record-plan.d.ts.map