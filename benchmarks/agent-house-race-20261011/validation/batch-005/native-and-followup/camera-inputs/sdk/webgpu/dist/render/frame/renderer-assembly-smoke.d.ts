import { type DiagnosticSummary } from "@aperture-engine/simulation";
import type { RenderSnapshotInspectionReport } from "@aperture-engine/render";
import type { RenderPackageInspectionReport, RenderSnapshotCloneabilityResult } from "@aperture-engine/render/test-support";
import type { FrameReport } from "./frame-report.js";
import type { RenderResourceSummaryReport } from "../../resources/core/resource-summary.js";
export type RendererAssemblySmokeSection = "snapshot" | "cloneability" | "packages" | "resources" | "frame";
export type RendererAssemblySmokeDiagnosticCode = "rendererAssembly.missingSnapshotInspection" | "rendererAssembly.missingSnapshotViews" | "rendererAssembly.missingSnapshotDraws" | "rendererAssembly.missingCloneability" | "rendererAssembly.snapshotNotCloneable" | "rendererAssembly.missingPackageInspection" | "rendererAssembly.missingPackages" | "rendererAssembly.missingResourceSummary" | "rendererAssembly.missingResources" | "rendererAssembly.resourceErrors" | "rendererAssembly.missingFrameReport" | "rendererAssembly.frameNotReady";
export type RendererAssemblySmokeSeverity = "info" | "warning" | "error";
export interface RendererAssemblySmokeDiagnostic {
    readonly code: RendererAssemblySmokeDiagnosticCode;
    readonly message: string;
    readonly severity: RendererAssemblySmokeSeverity;
    readonly section: RendererAssemblySmokeSection;
}
export interface RendererAssemblySmokeSectionStatus {
    readonly section: RendererAssemblySmokeSection;
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCodes: readonly string[];
}
export interface RendererAssemblySmokeSections {
    readonly snapshot: RendererAssemblySmokeSectionStatus;
    readonly cloneability: RendererAssemblySmokeSectionStatus;
    readonly packages: RendererAssemblySmokeSectionStatus;
    readonly resources: RendererAssemblySmokeSectionStatus;
    readonly frame: RendererAssemblySmokeSectionStatus;
}
export interface RendererAssemblySmokeSummary {
    readonly snapshot: RenderSnapshotInspectionReport["counts"] | null;
    readonly cloneability: Pick<RenderSnapshotCloneabilityResult, "valid" | "diagnostics"> | null;
    readonly packages: Pick<RenderPackageInspectionReport, "packageCount" | "diagnostics"> | null;
    readonly resources: RenderResourceSummaryReport["counts"] | null;
    readonly frame: Pick<FrameReport, "frame" | "ready" | "draws" | "batches" | "diagnostics"> | null;
}
export interface RendererAssemblySmokeInput {
    readonly snapshot: RenderSnapshotInspectionReport | null;
    readonly cloneability: RenderSnapshotCloneabilityResult | null;
    readonly packages: RenderPackageInspectionReport | null;
    readonly resources: RenderResourceSummaryReport | null;
    readonly frame: FrameReport | null;
}
export interface RendererAssemblySmokeReport {
    readonly ready: boolean;
    readonly sections: RendererAssemblySmokeSections;
    readonly diagnostics: readonly RendererAssemblySmokeDiagnostic[];
    readonly summary: RendererAssemblySmokeSummary;
}
export interface RendererAssemblySmokeSectionJsonValue {
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCodes: readonly string[];
}
export interface RendererAssemblySmokeSectionsJsonValue {
    readonly snapshot: RendererAssemblySmokeSectionJsonValue;
    readonly cloneability: RendererAssemblySmokeSectionJsonValue;
    readonly packages: RendererAssemblySmokeSectionJsonValue;
    readonly resources: RendererAssemblySmokeSectionJsonValue;
    readonly frame: RendererAssemblySmokeSectionJsonValue;
}
export interface RendererAssemblySmokeSummaryJsonValue {
    readonly snapshot: RendererAssemblySmokeSummary["snapshot"];
    readonly cloneability: {
        readonly valid: boolean;
        readonly diagnostics: DiagnosticSummary;
    } | null;
    readonly packages: {
        readonly packageCount: number;
        readonly diagnostics: DiagnosticSummary;
    } | null;
    readonly resources: RendererAssemblySmokeSummary["resources"];
    readonly frame: RendererAssemblySmokeSummary["frame"];
}
export interface RendererAssemblySmokeReportJsonValue {
    readonly ready: boolean;
    readonly sections: RendererAssemblySmokeSectionsJsonValue;
    readonly summary: RendererAssemblySmokeSummaryJsonValue;
    readonly diagnostics: DiagnosticSummary;
}
export interface RendererAssemblySectionDiagnosticSummary {
    readonly section: RendererAssemblySmokeSection;
    readonly diagnostics: DiagnosticSummary;
}
export interface RendererAssemblyDiagnosticGroups {
    readonly snapshot: RendererAssemblySectionDiagnosticSummary;
    readonly cloneability: RendererAssemblySectionDiagnosticSummary;
    readonly packages: RendererAssemblySectionDiagnosticSummary;
    readonly resources: RendererAssemblySectionDiagnosticSummary;
    readonly frame: RendererAssemblySectionDiagnosticSummary;
}
export interface RendererAssemblyDiagnosticGroupReport {
    readonly ready: boolean;
    readonly sections: RendererAssemblyDiagnosticGroups;
    readonly diagnostics: DiagnosticSummary;
}
export declare function createRendererAssemblySmokeReport(input: RendererAssemblySmokeInput): RendererAssemblySmokeReport;
export declare function rendererAssemblySmokeReportToJsonValue(report: RendererAssemblySmokeReport): RendererAssemblySmokeReportJsonValue;
export declare function rendererAssemblySmokeReportToJson(report: RendererAssemblySmokeReport): string;
export declare function summarizeRendererAssemblyDiagnosticsBySection(report: RendererAssemblySmokeReport): RendererAssemblyDiagnosticGroupReport;
//# sourceMappingURL=renderer-assembly-smoke.d.ts.map