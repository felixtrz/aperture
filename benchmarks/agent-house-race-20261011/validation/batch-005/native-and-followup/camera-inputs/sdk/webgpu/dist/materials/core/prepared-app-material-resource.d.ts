type PreparedAppMaterialResourceStatus = "created" | "reused";
type PreparedAppMaterialCacheSummaryFamily = "unlit" | "matcap" | "standard" | "debug-normal";
export interface PreparedAppMaterialResourceUse<TResource> {
    readonly status: PreparedAppMaterialResourceStatus;
    readonly resource: TResource;
}
export interface PreparedAppMaterialResourceReuseCounters {
    materialBuffersCreated: number;
    materialBuffersReused: number;
    preparedMaterialBuffersCreated: number;
    preparedMaterialBuffersReused: number;
    preparedMaterialBindGroupsCreated: number;
    preparedMaterialBindGroupsReused: number;
    bindGroupsCreated: number;
    bindGroupsReused: number;
}
interface PreparedAppMaterialCacheLike {
    readonly resources: ReadonlyMap<string, unknown>;
}
interface PreparedAppMaterialCacheSummaryFamilyReport {
    entries: number;
}
export interface PreparedAppMaterialCacheSummary {
    totalEntries: number;
    families: Record<PreparedAppMaterialCacheSummaryFamily, PreparedAppMaterialCacheSummaryFamilyReport>;
}
export interface PreparedAppMaterialCacheSummaryInput {
    readonly unlit: PreparedAppMaterialCacheLike;
    readonly matcap: PreparedAppMaterialCacheLike;
    readonly standard: PreparedAppMaterialCacheLike;
    readonly debugNormal: PreparedAppMaterialCacheLike;
}
type PreparedAppMaterialFallbackReason = "missing-layout" | "missing-prepared-dependency" | "helper-failed" | "adapter-mismatch";
type PreparedAppMaterialFallbackJsonValue = null | boolean | number | string | readonly PreparedAppMaterialFallbackJsonValue[] | {
    readonly [key: string]: PreparedAppMaterialFallbackJsonValue;
};
export interface PreparedAppMaterialFallbackDiagnostic {
    readonly code: "webGpuApp.preparedMaterialFallback";
    readonly materialFamily: PreparedAppMaterialCacheSummaryFamily;
    readonly materialKey: string;
    readonly reason: PreparedAppMaterialFallbackReason;
    readonly diagnostics: readonly PreparedAppMaterialFallbackJsonValue[];
    readonly message: string;
}
export interface CreatePreparedAppMaterialFallbackDiagnosticOptions {
    readonly materialFamily: PreparedAppMaterialCacheSummaryFamily;
    readonly materialKey: string;
    readonly status: string;
    readonly diagnostics: readonly unknown[];
}
export declare function recordPreparedAppMaterialResourceUse(counters: PreparedAppMaterialResourceReuseCounters, use: PreparedAppMaterialResourceUse<unknown>, totalBindGroupCount: number): void;
export declare function createPreparedAppMaterialCacheSummary(): PreparedAppMaterialCacheSummary;
export declare function writePreparedAppMaterialCacheSummary(summary: PreparedAppMaterialCacheSummary, input: PreparedAppMaterialCacheSummaryInput): PreparedAppMaterialCacheSummary;
export declare function createPreparedAppMaterialFallbackDiagnostic(options: CreatePreparedAppMaterialFallbackDiagnosticOptions): PreparedAppMaterialFallbackDiagnostic | null;
export {};
//# sourceMappingURL=prepared-app-material-resource.d.ts.map