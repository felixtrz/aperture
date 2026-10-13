import type { EnvironmentPacket, RenderSnapshot } from "@aperture-engine/render";
export type EnvironmentMapReadinessDiagnosticCode = "environmentMapReadiness.missingResource";
export interface EnvironmentMapReadinessDiagnostic {
    readonly code: EnvironmentMapReadinessDiagnosticCode;
    readonly message: string;
    readonly severity: "warning" | "error";
    readonly resourceKey: string;
    readonly environmentIds: readonly number[];
}
export interface EnvironmentMapReadinessRequirement {
    readonly resourceKey: string;
    readonly environmentIds: readonly number[];
    readonly ready: boolean | null;
}
export interface EnvironmentMapReadinessResourceState {
    readonly environmentMapResourceKeys: readonly string[];
}
export interface EnvironmentMapReadinessInput {
    readonly snapshot: Pick<RenderSnapshot, "environments"> | readonly EnvironmentPacket[];
    readonly resources?: EnvironmentMapReadinessResourceState | null;
}
export interface EnvironmentMapReadinessReport {
    readonly ready: boolean;
    readonly environmentCount: number;
    readonly nullHandleCount: number;
    readonly requiredEnvironmentMapCount: number;
    readonly sections: {
        readonly environmentResourcePlanning: boolean;
        readonly environmentMapResources: boolean | null;
    };
    readonly requirements: readonly EnvironmentMapReadinessRequirement[];
    readonly diagnostics: readonly EnvironmentMapReadinessDiagnostic[];
}
export type EnvironmentMapReadinessReportJsonValue = EnvironmentMapReadinessReport;
export declare function createEnvironmentMapReadinessReport(input: EnvironmentMapReadinessInput): EnvironmentMapReadinessReport;
export declare function environmentMapReadinessReportToJsonValue(report: EnvironmentMapReadinessReport): EnvironmentMapReadinessReportJsonValue;
export declare function environmentMapReadinessReportToJson(report: EnvironmentMapReadinessReport): string;
//# sourceMappingURL=environment-map-readiness.d.ts.map