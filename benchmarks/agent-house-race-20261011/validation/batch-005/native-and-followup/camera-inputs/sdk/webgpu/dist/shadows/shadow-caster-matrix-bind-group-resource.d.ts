import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";
export declare const SHADOW_CASTER_MATRIX_BIND_GROUP = 0;
export declare const SHADOW_CASTER_MATRIX_BIND_GROUP_LAYOUT_KEY = "shadow-caster/group-0:directional-shadow-matrices@0";
export type ShadowCasterMatrixBindGroupResourceStatus = "available" | "missing" | "not-required";
export type ShadowCasterMatrixBindGroupResourceDiagnosticCode = "shadowCasterMatrixBindGroupResource.missingMatrixBufferResource" | "shadowCasterMatrixBindGroupResource.missingPassMatrixResource" | "shadowCasterMatrixBindGroupResource.missingWorldTransformResource" | "shadowCasterMatrixBindGroupResource.createBindGroupLayoutUnavailable" | "shadowCasterMatrixBindGroupResource.createBindGroupUnavailable" | "shadowCasterMatrixBindGroupResource.creationFailed" | "shadowCasterMatrixBindGroupResource.passSubmissionDeferred" | "shadowCasterMatrixBindGroupResource.shaderSamplingDeferred";
export interface ShadowCasterMatrixBindGroupResourceDiagnostic {
    readonly code: ShadowCasterMatrixBindGroupResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly resourceKey?: string;
}
export interface ShadowCasterMatrixBindGroupResource {
    readonly group: 0;
    readonly matrixResourceKey: string;
    readonly passKey?: string;
    readonly worldTransformResourceKey?: string;
    readonly resourceKey: string;
    readonly layoutKey: string;
    readonly layout: unknown;
    readonly bindGroup: unknown;
    readonly entryResourceKeys: readonly string[];
}
export interface ShadowCasterMatrixBindGroupResourceReport {
    readonly ready: boolean;
    readonly status: ShadowCasterMatrixBindGroupResourceStatus;
    readonly matrixBufferCount: number;
    readonly createdBindGroupCount: number;
    readonly reusedBindGroupCount: number;
    readonly sections: {
        readonly matrixBufferResource: boolean;
        readonly bindGroupLayout: boolean;
        readonly bindGroupResource: boolean;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly resource: ShadowCasterMatrixBindGroupResource | null;
    readonly resources: readonly ShadowCasterMatrixBindGroupResource[];
    readonly diagnostics: readonly ShadowCasterMatrixBindGroupResourceDiagnostic[];
}
export type ShadowCasterMatrixBindGroupResourceReportJsonValue = Omit<ShadowCasterMatrixBindGroupResourceReport, "resource" | "resources"> & {
    readonly resource: {
        readonly group: 0;
        readonly matrixResourceKey: string;
        readonly passKey?: string;
        readonly worldTransformResourceKey?: string;
        readonly resourceKey: string;
        readonly layoutKey: string;
        readonly entryResourceKeys: readonly string[];
    } | null;
    readonly resources: readonly {
        readonly group: 0;
        readonly matrixResourceKey: string;
        readonly passKey?: string;
        readonly worldTransformResourceKey?: string;
        readonly resourceKey: string;
        readonly layoutKey: string;
        readonly entryResourceKeys: readonly string[];
    }[];
};
export interface ShadowCasterMatrixBindGroupDeviceLike {
    readonly createBindGroupLayout?: (descriptor: unknown) => unknown;
    readonly createBindGroup?: (descriptor: unknown) => unknown;
}
export interface ShadowCasterPassMatrixResourceView {
    readonly passKey: string;
    readonly matrixResourceKey: string;
    readonly buffer: unknown;
}
export interface ShadowCasterWorldTransformResourceView {
    readonly resourceKey: string;
    readonly buffer: unknown;
}
export interface CreateShadowCasterMatrixBindGroupResourceReportOptions {
    readonly device: ShadowCasterMatrixBindGroupDeviceLike;
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly passMatrixResources?: readonly ShadowCasterPassMatrixResourceView[];
    readonly worldTransformResource?: ShadowCasterWorldTransformResourceView | null;
    readonly layout?: unknown;
    readonly cache?: Map<string, ShadowCasterMatrixBindGroupResource>;
}
export declare function createShadowCasterMatrixBindGroupResourceReport(options: CreateShadowCasterMatrixBindGroupResourceReportOptions): ShadowCasterMatrixBindGroupResourceReport;
export declare function createShadowCasterMatrixBindGroupLayoutDescriptor(): {
    label: string;
    entries: {
        binding: number;
        visibility: number;
        buffer: {
            type: string;
        };
    }[];
};
export declare function shadowCasterMatrixBindGroupResourceKey(matrixResourceKey: string): string;
export declare function shadowCasterMatrixBindGroupResourceReportToJsonValue(value: ShadowCasterMatrixBindGroupResourceReport): ShadowCasterMatrixBindGroupResourceReportJsonValue;
export declare function shadowCasterMatrixBindGroupResourceReportToJson(value: ShadowCasterMatrixBindGroupResourceReport): string;
//# sourceMappingURL=shadow-caster-matrix-bind-group-resource.d.ts.map