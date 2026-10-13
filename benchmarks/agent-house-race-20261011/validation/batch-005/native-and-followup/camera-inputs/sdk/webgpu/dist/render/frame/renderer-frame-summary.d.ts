import type { DiagnosticSeverity, DiagnosticSummary } from "@aperture-engine/simulation";
import { type MeshDrawPacket, type PackedSnapshotTransforms, type RenderDiagnostic, type RenderSnapshot, type RenderWorld, type RenderWorldApplyReport, type RenderWorldDrawPackage, type RenderWorldDrawPackagePlan, type RenderWorldDrawReadinessReport, type RenderWorldResourceBindingResult, type RenderWorldResourceBindingUpdate } from "@aperture-engine/render";
import type { CommandSubmissionMetricsReport } from "../../gpu/command-submission-metrics.js";
import { type DrawCommandDescriptor, type DrawCommandDescriptorPlan } from "../draw/draw-command.js";
import type { AssembleFrameBoundaryOptions, FrameBoundaryAssemblyReport } from "./frame-boundary.js";
import type { FrameBoundaryValidationReport } from "./frame-boundary-validation.js";
import { type FrameExecutionDiagnosticGroupReport, type FrameExecutionReport, type FrameExecutionReportJsonValue } from "./frame-execution-report.js";
import type { FrameSubmissionSmokeReport } from "./frame-submission-smoke.js";
import { type MvpFrameReadinessReport } from "../../diagnostics/mvp-frame-readiness.js";
import { type RenderPassDrawListPlan } from "../passes/render-pass-draw-list.js";
import { type InjectedRenderPassAssemblyRunnerInput, type InjectedRenderPassAssemblyRunnerReport, type RenderPassAssemblyDiagnosticGroupReport, type RenderPassAssemblySmokeReportJsonValue } from "../passes/render-pass-assembly-smoke.js";
import type { RenderPassAssemblySmokeReport } from "../passes/render-pass-assembly-smoke.js";
import type { RendererAssemblySmokeReport } from "./renderer-assembly-smoke.js";
export type RendererFrameSummarySection = "rendererAssembly" | "renderPassAssembly" | "frameSubmission" | "frameBoundary" | "mvpFrameReadiness" | "commandSubmissionMetrics";
export type RendererFrameSummaryMissingDiagnosticCode = "rendererFrameSummary.missingRendererAssembly" | "rendererFrameSummary.missingRenderPassAssembly" | "rendererFrameSummary.missingFrameSubmission" | "rendererFrameSummary.missingFrameBoundary" | "rendererFrameSummary.missingMvpFrameReadiness" | "rendererFrameSummary.missingCommandSubmissionMetrics";
export interface RendererFrameSummaryDiagnostic {
    readonly section: RendererFrameSummarySection;
    readonly code: string;
    readonly message: string;
    readonly severity: DiagnosticSeverity;
    readonly sourceSection?: string;
}
export interface RendererFrameSummarySectionStatus {
    readonly section: RendererFrameSummarySection;
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCount: number;
}
export interface RendererFrameSummarySections {
    readonly rendererAssembly: RendererFrameSummarySectionStatus;
    readonly renderPassAssembly: RendererFrameSummarySectionStatus;
    readonly frameSubmission: RendererFrameSummarySectionStatus;
    readonly frameBoundary: RendererFrameSummarySectionStatus;
    readonly mvpFrameReadiness: RendererFrameSummarySectionStatus;
    readonly commandSubmissionMetrics: RendererFrameSummarySectionStatus;
}
export interface RendererFrameSummaryCounts {
    readonly plannedDraws: number;
    readonly drawCalls: number;
    readonly commands: number;
    readonly executedCommands: number;
    readonly skippedCommands: number;
    readonly commandBuffers: number;
    readonly submittedCommandBuffers: number;
    readonly skippedSubmissions: number;
    readonly diagnostics: number;
}
export interface RendererFrameSummaryInput {
    readonly renderer: RendererAssemblySmokeReport | null;
    readonly renderPass: RenderPassAssemblySmokeReport | null;
    readonly submission: FrameSubmissionSmokeReport | null;
    readonly boundary: FrameBoundaryValidationReport | null;
    readonly mvp: MvpFrameReadinessReport | null;
    readonly commandSubmission: CommandSubmissionMetricsReport | null;
}
export interface RendererFrameSummaryFromExecutionInput {
    readonly renderer: RendererAssemblySmokeReport | null;
    readonly renderPass: RenderPassAssemblySmokeReport | null;
    readonly execution: FrameExecutionReport | null;
}
export interface InjectedRendererFrameSummaryRunnerInput {
    readonly renderer: RendererAssemblySmokeReport | null;
    readonly renderPass: RenderPassAssemblySmokeReport | null;
    readonly frameExecution: AssembleFrameBoundaryOptions;
}
export interface InjectedRenderFrameRunnerInput {
    readonly renderer: RendererAssemblySmokeReport | null;
    readonly renderPass: InjectedRenderPassAssemblyRunnerInput;
    readonly frameExecution: Omit<AssembleFrameBoundaryOptions, "commands">;
}
export interface InjectedRenderFrameDrawCommandRunnerInput {
    readonly renderer: RendererAssemblySmokeReport | null;
    readonly drawCommands: readonly DrawCommandDescriptor[];
    readonly pipelines: InjectedRenderPassAssemblyRunnerInput["pipelines"];
    readonly bindGroups: InjectedRenderPassAssemblyRunnerInput["bindGroups"];
    readonly meshResources: InjectedRenderPassAssemblyRunnerInput["meshResources"];
    readonly requiredBindGroupGroups?: readonly number[];
    readonly pass: InjectedRenderPassAssemblyRunnerInput["pass"];
    readonly frameExecution: Omit<AssembleFrameBoundaryOptions, "commands">;
}
export interface InjectedRenderFrameDrawPackageRunnerInput {
    readonly renderer: RendererAssemblySmokeReport | null;
    readonly packages: readonly RenderWorldDrawPackage[];
    readonly meshResources: InjectedRenderFrameDrawCommandRunnerInput["meshResources"];
    readonly pipelines: InjectedRenderFrameDrawCommandRunnerInput["pipelines"];
    readonly bindGroups: InjectedRenderFrameDrawCommandRunnerInput["bindGroups"];
    readonly requiredBindGroupGroups?: readonly number[];
    readonly pass: InjectedRenderFrameDrawCommandRunnerInput["pass"];
    readonly frameExecution: Omit<AssembleFrameBoundaryOptions, "commands">;
}
export interface InjectedRenderFrameRenderWorldPackageRunnerInput {
    readonly renderer: RendererAssemblySmokeReport | null;
    readonly readiness: RenderWorldDrawReadinessReport;
    readonly transforms: PackedSnapshotTransforms;
    readonly meshResources: InjectedRenderFrameDrawPackageRunnerInput["meshResources"];
    readonly pipelines: InjectedRenderFrameDrawPackageRunnerInput["pipelines"];
    readonly bindGroups: InjectedRenderFrameDrawPackageRunnerInput["bindGroups"];
    readonly requiredBindGroupGroups?: readonly number[];
    readonly pass: InjectedRenderFrameDrawPackageRunnerInput["pass"];
    readonly frameExecution: Omit<AssembleFrameBoundaryOptions, "commands">;
}
export interface InjectedRenderFrameSnapshotResourceBinding {
    readonly renderId: number;
    readonly update: RenderWorldResourceBindingUpdate;
}
export type InjectedRenderFrameSnapshotResourceKeyResolver = (draw: MeshDrawPacket) => string | null | undefined;
export interface InjectedRenderFrameSnapshotResourceBindingPlanInput {
    readonly snapshot: RenderSnapshot;
    readonly resolveMeshResourceKey: InjectedRenderFrameSnapshotResourceKeyResolver;
    readonly resolveMaterialResourceKey: InjectedRenderFrameSnapshotResourceKeyResolver;
}
export interface InjectedRenderFrameSnapshotResourceBindingPlan {
    readonly bindings: readonly InjectedRenderFrameSnapshotResourceBinding[];
    readonly diagnostics: readonly RenderDiagnostic[];
}
export interface InjectedRenderFrameSnapshotResourceBindingPlanScratch {
    readonly bindings: InjectedRenderFrameSnapshotResourceBinding[];
    readonly diagnostics: RenderDiagnostic[];
    readonly bindingPool: InjectedRenderFrameSnapshotResourceBinding[];
    readonly seenRenderIds: Set<number>;
    readonly plan: InjectedRenderFrameSnapshotResourceBindingPlan;
}
export interface InjectedRenderFrameSnapshotRunnerInput {
    readonly renderer: RendererAssemblySmokeReport | null;
    readonly renderWorld: RenderWorld;
    readonly snapshot: RenderSnapshot;
    readonly bindings: readonly InjectedRenderFrameSnapshotResourceBinding[];
    readonly meshResources: InjectedRenderFrameRenderWorldPackageRunnerInput["meshResources"];
    readonly pipelines: InjectedRenderFrameRenderWorldPackageRunnerInput["pipelines"];
    readonly bindGroups: InjectedRenderFrameRenderWorldPackageRunnerInput["bindGroups"];
    readonly requiredBindGroupGroups?: readonly number[];
    readonly pass: InjectedRenderFrameRenderWorldPackageRunnerInput["pass"];
    readonly frameExecution: Omit<AssembleFrameBoundaryOptions, "commands">;
}
export interface InjectedRenderFrameSnapshotBindingReport {
    readonly renderId: number;
    readonly result: RenderWorldResourceBindingResult;
}
export interface RendererFrameSummaryReport {
    readonly ready: boolean;
    readonly sections: RendererFrameSummarySections;
    readonly counts: RendererFrameSummaryCounts;
    readonly diagnostics: readonly RendererFrameSummaryDiagnostic[];
    readonly diagnosticSummary: DiagnosticSummary;
}
export interface RendererFrameSummarySectionJsonValue {
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCount: number;
}
export interface RendererFrameSummarySectionsJsonValue {
    readonly rendererAssembly: RendererFrameSummarySectionJsonValue;
    readonly renderPassAssembly: RendererFrameSummarySectionJsonValue;
    readonly frameSubmission: RendererFrameSummarySectionJsonValue;
    readonly frameBoundary: RendererFrameSummarySectionJsonValue;
    readonly mvpFrameReadiness: RendererFrameSummarySectionJsonValue;
    readonly commandSubmissionMetrics: RendererFrameSummarySectionJsonValue;
}
export interface RendererFrameSummaryReportJsonValue {
    readonly ready: boolean;
    readonly sections: RendererFrameSummarySectionsJsonValue;
    readonly counts: RendererFrameSummaryCounts;
    readonly diagnostics: DiagnosticSummary;
}
export interface InjectedRendererFrameSummaryRunnerReport {
    readonly assembly: FrameBoundaryAssemblyReport;
    readonly execution: FrameExecutionReport;
    readonly summary: RendererFrameSummaryReport;
    readonly json: RendererFrameSummaryReportJsonValue;
}
export interface InjectedRenderFrameRunnerReport {
    readonly renderPass: InjectedRenderPassAssemblyRunnerReport;
    readonly assembly: FrameBoundaryAssemblyReport;
    readonly execution: FrameExecutionReport;
    readonly summary: RendererFrameSummaryReport;
    readonly json: RendererFrameSummaryReportJsonValue;
}
export interface InjectedRenderFrameDrawCommandRunnerReport {
    readonly drawList: RenderPassDrawListPlan;
    readonly frame: InjectedRenderFrameRunnerReport;
}
export interface InjectedRenderFrameDrawPackageRunnerReport {
    readonly descriptors: DrawCommandDescriptorPlan;
    readonly frame: InjectedRenderFrameDrawCommandRunnerReport;
}
export interface InjectedRenderFrameRenderWorldPackageRunnerReport {
    readonly packages: RenderWorldDrawPackagePlan;
    readonly frame: InjectedRenderFrameDrawPackageRunnerReport;
}
export interface InjectedRenderFrameSnapshotRunnerReport {
    readonly apply: RenderWorldApplyReport;
    readonly bindings: readonly InjectedRenderFrameSnapshotBindingReport[];
    readonly transforms: PackedSnapshotTransforms;
    readonly readiness: RenderWorldDrawReadinessReport;
    readonly frame: InjectedRenderFrameRenderWorldPackageRunnerReport;
}
export interface InjectedRenderFrameSnapshotRunnerReportJsonValue {
    readonly ready: boolean;
    readonly apply: {
        readonly valid: boolean;
        readonly created: number;
        readonly updated: number;
        readonly unchanged: number;
        readonly removed: number;
        readonly active: number;
        readonly diagnostics: DiagnosticSummary;
    };
    readonly bindings: {
        readonly valid: boolean;
        readonly attemptedCount: number;
        readonly succeededCount: number;
        readonly failedCount: number;
        readonly renderIds: readonly number[];
        readonly failedRenderIds: readonly number[];
        readonly diagnostics: DiagnosticSummary;
    };
    readonly transforms: {
        readonly valid: boolean;
        readonly floatCount: number;
        readonly matrixCount: number;
        readonly offsetCount: number;
        readonly renderIds: readonly number[];
        readonly diagnostics: DiagnosticSummary;
    };
    readonly readiness: {
        readonly valid: boolean;
        readonly readyDrawCount: number;
        readonly blockedDrawCount: number;
        readonly readyRenderIds: readonly number[];
        readonly blockedRenderIds: readonly number[];
        readonly diagnostics: DiagnosticSummary;
    };
    readonly frame: InjectedRenderFrameRenderWorldPackageRunnerReportJsonValue;
}
export interface InjectedRenderFrameSnapshotDiagnosticGroupReport {
    readonly ready: boolean;
    readonly phases: {
        readonly apply: {
            readonly diagnostics: DiagnosticSummary;
        };
        readonly bindings: {
            readonly diagnostics: DiagnosticSummary;
        };
        readonly transforms: {
            readonly diagnostics: DiagnosticSummary;
        };
        readonly readiness: {
            readonly diagnostics: DiagnosticSummary;
        };
        readonly frame: InjectedRenderFrameRenderWorldPackageDiagnosticGroupReport;
    };
    readonly diagnostics: DiagnosticSummary;
}
export interface InjectedRenderFrameRenderWorldPackageRunnerReportJsonValue {
    readonly ready: boolean;
    readonly packages: {
        readonly valid: boolean;
        readonly packageCount: number;
        readonly renderIds: readonly number[];
        readonly diagnostics: DiagnosticSummary;
    };
    readonly frame: InjectedRenderFrameDrawPackageRunnerReportJsonValue;
}
export interface InjectedRenderFrameRenderWorldPackageDiagnosticGroupReport {
    readonly ready: boolean;
    readonly phases: {
        readonly packages: {
            readonly diagnostics: DiagnosticSummary;
        };
        readonly frame: InjectedRenderFrameDrawPackageDiagnosticGroupReport;
    };
    readonly diagnostics: DiagnosticSummary;
}
export interface InjectedRenderFrameDrawPackageRunnerReportJsonValue {
    readonly ready: boolean;
    readonly descriptors: {
        readonly valid: boolean;
        readonly descriptorCount: number;
        readonly renderIds: readonly number[];
        readonly diagnostics: DiagnosticSummary;
    };
    readonly frame: InjectedRenderFrameDrawCommandRunnerReportJsonValue;
}
export interface InjectedRenderFrameDrawPackageDiagnosticGroupReport {
    readonly ready: boolean;
    readonly phases: {
        readonly descriptors: {
            readonly diagnostics: DiagnosticSummary;
        };
        readonly frame: InjectedRenderFrameDrawCommandDiagnosticGroupReport;
    };
    readonly diagnostics: DiagnosticSummary;
}
export interface InjectedRenderFrameDrawCommandRunnerReportJsonValue {
    readonly ready: boolean;
    readonly drawList: {
        readonly valid: boolean;
        readonly drawCount: number;
        readonly renderIds: readonly number[];
        readonly diagnostics: DiagnosticSummary;
    };
    readonly frame: InjectedRenderFrameRunnerReportJsonValue;
}
export interface InjectedRenderFrameDrawCommandDiagnosticGroupReport {
    readonly ready: boolean;
    readonly phases: {
        readonly drawList: {
            readonly diagnostics: DiagnosticSummary;
        };
        readonly frame: InjectedRenderFrameDiagnosticGroupReport;
    };
    readonly diagnostics: DiagnosticSummary;
}
export interface InjectedRenderFrameRunnerReportJsonValue {
    readonly ready: boolean;
    readonly boundary: {
        readonly valid: boolean;
    };
    readonly renderPass: RenderPassAssemblySmokeReportJsonValue;
    readonly frameExecution: FrameExecutionReportJsonValue;
    readonly summary: RendererFrameSummaryReportJsonValue;
}
export interface InjectedRenderFrameDiagnosticGroups {
    readonly rendererAssembly: RendererFrameSummarySectionDiagnosticSummary;
    readonly renderPassAssembly: RenderPassAssemblyDiagnosticGroupReport;
    readonly frameExecution: FrameExecutionDiagnosticGroupReport;
    readonly rendererFrameSummary: RendererFrameSummaryDiagnosticGroupReport;
}
export interface InjectedRenderFrameDiagnosticGroupReport {
    readonly ready: boolean;
    readonly phases: InjectedRenderFrameDiagnosticGroups;
    readonly diagnostics: DiagnosticSummary;
}
export interface RendererFrameSummarySectionDiagnosticSummary {
    readonly section: RendererFrameSummarySection;
    readonly diagnostics: DiagnosticSummary;
}
export interface RendererFrameSummaryDiagnosticGroups {
    readonly rendererAssembly: RendererFrameSummarySectionDiagnosticSummary;
    readonly renderPassAssembly: RendererFrameSummarySectionDiagnosticSummary;
    readonly frameSubmission: RendererFrameSummarySectionDiagnosticSummary;
    readonly frameBoundary: RendererFrameSummarySectionDiagnosticSummary;
    readonly mvpFrameReadiness: RendererFrameSummarySectionDiagnosticSummary;
    readonly commandSubmissionMetrics: RendererFrameSummarySectionDiagnosticSummary;
}
export interface RendererFrameSummaryDiagnosticGroupReport {
    readonly ready: boolean;
    readonly sections: RendererFrameSummaryDiagnosticGroups;
    readonly diagnostics: DiagnosticSummary;
}
export declare function createRendererFrameSummaryReport(input: RendererFrameSummaryInput): RendererFrameSummaryReport;
export declare function createRendererFrameSummaryFromExecutionReport(input: RendererFrameSummaryFromExecutionInput): RendererFrameSummaryReport;
export declare function runInjectedRendererFrameSummary(input: InjectedRendererFrameSummaryRunnerInput): InjectedRendererFrameSummaryRunnerReport;
export declare function runInjectedRenderFrame(input: InjectedRenderFrameRunnerInput): InjectedRenderFrameRunnerReport;
export declare function runInjectedRenderFrameFromDrawCommands(input: InjectedRenderFrameDrawCommandRunnerInput): InjectedRenderFrameDrawCommandRunnerReport;
export declare function runInjectedRenderFrameFromDrawPackages(input: InjectedRenderFrameDrawPackageRunnerInput): InjectedRenderFrameDrawPackageRunnerReport;
export declare function runInjectedRenderFrameFromRenderWorldPackages(input: InjectedRenderFrameRenderWorldPackageRunnerInput): InjectedRenderFrameRenderWorldPackageRunnerReport;
export declare function runInjectedRenderFrameFromSnapshot(input: InjectedRenderFrameSnapshotRunnerInput): InjectedRenderFrameSnapshotRunnerReport;
export declare function planInjectedRenderFrameSnapshotResourceBindings(input: InjectedRenderFrameSnapshotResourceBindingPlanInput): InjectedRenderFrameSnapshotResourceBindingPlan;
export declare function createInjectedRenderFrameSnapshotResourceBindingPlanScratch(capacity?: number): InjectedRenderFrameSnapshotResourceBindingPlanScratch;
export declare function writeInjectedRenderFrameSnapshotResourceBindings(input: InjectedRenderFrameSnapshotResourceBindingPlanInput, scratch: InjectedRenderFrameSnapshotResourceBindingPlanScratch): InjectedRenderFrameSnapshotResourceBindingPlan;
export declare function injectedRenderFrameSnapshotRunnerReportToJsonValue(report: InjectedRenderFrameSnapshotRunnerReport): InjectedRenderFrameSnapshotRunnerReportJsonValue;
export declare function injectedRenderFrameSnapshotRunnerReportToJson(report: InjectedRenderFrameSnapshotRunnerReport): string;
export declare function summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(report: InjectedRenderFrameSnapshotRunnerReport): InjectedRenderFrameSnapshotDiagnosticGroupReport;
export declare function injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(report: InjectedRenderFrameRenderWorldPackageRunnerReport): InjectedRenderFrameRenderWorldPackageRunnerReportJsonValue;
export declare function injectedRenderFrameRenderWorldPackageRunnerReportToJson(report: InjectedRenderFrameRenderWorldPackageRunnerReport): string;
export declare function summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(report: InjectedRenderFrameRenderWorldPackageRunnerReport): InjectedRenderFrameRenderWorldPackageDiagnosticGroupReport;
export declare function injectedRenderFrameDrawPackageRunnerReportToJsonValue(report: InjectedRenderFrameDrawPackageRunnerReport): InjectedRenderFrameDrawPackageRunnerReportJsonValue;
export declare function injectedRenderFrameDrawPackageRunnerReportToJson(report: InjectedRenderFrameDrawPackageRunnerReport): string;
export declare function summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase(report: InjectedRenderFrameDrawPackageRunnerReport): InjectedRenderFrameDrawPackageDiagnosticGroupReport;
export declare function injectedRenderFrameDrawCommandRunnerReportToJsonValue(report: InjectedRenderFrameDrawCommandRunnerReport): InjectedRenderFrameDrawCommandRunnerReportJsonValue;
export declare function injectedRenderFrameDrawCommandRunnerReportToJson(report: InjectedRenderFrameDrawCommandRunnerReport): string;
export declare function summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(report: InjectedRenderFrameDrawCommandRunnerReport): InjectedRenderFrameDrawCommandDiagnosticGroupReport;
export declare function injectedRenderFrameRunnerReportToJsonValue(report: InjectedRenderFrameRunnerReport): InjectedRenderFrameRunnerReportJsonValue;
export declare function injectedRenderFrameRunnerReportToJson(report: InjectedRenderFrameRunnerReport): string;
export declare function summarizeInjectedRenderFrameDiagnosticsByPhase(report: InjectedRenderFrameRunnerReport): InjectedRenderFrameDiagnosticGroupReport;
export declare function rendererFrameSummaryReportToJsonValue(report: RendererFrameSummaryReport): RendererFrameSummaryReportJsonValue;
export declare function rendererFrameSummaryReportToJson(report: RendererFrameSummaryReport): string;
export declare function summarizeRendererFrameSummaryDiagnosticsBySection(report: RendererFrameSummaryReport): RendererFrameSummaryDiagnosticGroupReport;
//# sourceMappingURL=renderer-frame-summary.d.ts.map