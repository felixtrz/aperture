import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import type { ShadowCasterPipelineDescriptorReport } from "./shadow-caster-pipeline-descriptor.js";
import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";
export type ShadowCasterFrameResourceReadinessStatus = "ready" | "deferred" | "missing" | "not-required";
export type ShadowCasterFrameResourceReadinessDiagnosticCode = "shadowCasterFrameResource.missingPipelineDescriptor" | "shadowCasterFrameResource.missingMatrixBuffer" | "shadowCasterFrameResource.missingPreparedMesh" | "shadowCasterFrameResource.pipelineCreationDeferred" | "shadowCasterFrameResource.passSubmissionDeferred";
export interface ShadowCasterFrameResourceReadinessDiagnostic {
    readonly code: ShadowCasterFrameResourceReadinessDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly renderId?: number;
    readonly meshKey?: string;
}
export interface ShadowCasterPreparedMeshResourceView {
    readonly meshKey: string;
    readonly meshResourceKey: string;
    readonly vertexBufferResourceKeys: readonly string[];
    readonly indexBufferResourceKey: string | null;
}
export interface ShadowCasterFrameResourceRecord {
    readonly renderId: number;
    readonly meshKey: string;
    readonly meshLayoutKey: string;
    readonly passKey: string;
    readonly submesh: number;
    readonly vertexStart?: number;
    readonly vertexCount?: number;
    readonly indexStart?: number;
    readonly indexCount?: number;
    readonly meshResourceKey: string | null;
    readonly vertexBufferResourceKeys: readonly string[];
    readonly indexBufferResourceKey: string | null;
    readonly matrixResourceKey: string | null;
    readonly pipelineKey: string | null;
    readonly ready: boolean;
}
export interface ShadowCasterFrameResourceReadinessReport {
    readonly ready: boolean;
    readonly status: ShadowCasterFrameResourceReadinessStatus;
    readonly counts: {
        readonly casterDraws: number;
        readonly readyDraws: number;
        readonly missingMeshBuffers: number;
        readonly pipelineDescriptors: number;
        readonly matrixBuffers: number;
    };
    readonly sections: {
        readonly casterDrawLists: boolean;
        readonly preparedMeshBuffers: boolean;
        readonly matrixBufferResource: boolean;
        readonly pipelineDescriptor: boolean;
        readonly pipelineCreation: false;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly records: readonly ShadowCasterFrameResourceRecord[];
    readonly diagnostics: readonly ShadowCasterFrameResourceReadinessDiagnostic[];
}
export type ShadowCasterFrameResourceReadinessReportJsonValue = ShadowCasterFrameResourceReadinessReport;
export interface CreateShadowCasterFrameResourceReadinessReportOptions {
    readonly casterDrawList: ShadowCasterDrawListPlanReport;
    readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly pipelineDescriptor: ShadowCasterPipelineDescriptorReport;
}
export declare function createShadowCasterFrameResourceReadinessReport(options: CreateShadowCasterFrameResourceReadinessReportOptions): ShadowCasterFrameResourceReadinessReport;
export declare function shadowCasterFrameResourceReadinessReportToJsonValue(value: ShadowCasterFrameResourceReadinessReport): ShadowCasterFrameResourceReadinessReportJsonValue;
export declare function shadowCasterFrameResourceReadinessReportToJson(value: ShadowCasterFrameResourceReadinessReport): string;
//# sourceMappingURL=shadow-caster-frame-resource-readiness.d.ts.map