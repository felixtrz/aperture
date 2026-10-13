import { type DiagnosticSummary } from "@aperture-engine/simulation";
import { type RenderPassCommandExecutionReport, type RenderPassEncoderLike } from "./render-pass-command-executor.js";
import { type RenderPassCommandPlan } from "./render-pass-commands.js";
import type { RenderPassDrawListPlan, RenderPassDrawListRecord } from "./render-pass-draw-list.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import { type ResolveRenderPassResourcesResult } from "./render-pass-resources.js";
import type { UnlitBindGroupResource } from "../../materials/unlit/unlit-bind-group.js";
export type RenderPassAssemblySmokeSection = "drawList" | "resources" | "commands" | "execution";
export type RenderPassAssemblySmokeDiagnosticCode = "renderPassAssembly.missingDrawList" | "renderPassAssembly.drawListNotReady" | "renderPassAssembly.missingResolvedResources" | "renderPassAssembly.resourcesNotReady" | "renderPassAssembly.missingCommandPlan" | "renderPassAssembly.commandPlanNotReady" | "renderPassAssembly.missingExecutionReport" | "renderPassAssembly.executionFailed";
export interface RenderPassAssemblySmokeDiagnostic {
    readonly code: RenderPassAssemblySmokeDiagnosticCode;
    readonly message: string;
    readonly section: RenderPassAssemblySmokeSection;
    readonly severity: "warning" | "error";
}
export interface RenderPassAssemblySmokeSectionStatus {
    readonly section: RenderPassAssemblySmokeSection;
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCodes: readonly string[];
}
export interface RenderPassAssemblySmokeSections {
    readonly drawList: RenderPassAssemblySmokeSectionStatus;
    readonly resources: RenderPassAssemblySmokeSectionStatus;
    readonly commands: RenderPassAssemblySmokeSectionStatus;
    readonly execution: RenderPassAssemblySmokeSectionStatus;
}
export interface RenderPassAssemblySmokeSummary {
    readonly drawList: Pick<RenderPassDrawListPlan, "valid" | "draws"> | null;
    readonly resources: {
        readonly valid: boolean;
        readonly draws: readonly RenderPassAssemblyResolvedDrawSummary[];
    } | null;
    readonly commands: {
        readonly valid: boolean;
        readonly drawCount: number;
        readonly commandCount: number;
        readonly indexedDrawCount: number;
        readonly nonIndexedDrawCount: number;
    } | null;
    readonly execution: Pick<RenderPassCommandExecutionReport, "valid" | "commandCount" | "executedCommands" | "skippedCommands" | "drawCalls"> | null;
}
export interface RenderPassAssemblyResolvedDrawSummary {
    readonly renderId: number;
    readonly pipelineKey: string;
    readonly bindGroupKeys: readonly string[];
    readonly vertexBufferKeys: readonly string[];
    readonly vertexCount: number;
    readonly indexBufferKey: string | null;
    readonly indexCount: number | null;
    readonly instanceCount: number;
    readonly transformPackedOffset: number;
}
export interface RenderPassAssemblySmokeInput {
    readonly drawList: RenderPassDrawListPlan | null;
    readonly resources: ResolveRenderPassResourcesResult | null;
    readonly commands: RenderPassCommandPlan | null;
    readonly execution: RenderPassCommandExecutionReport | null;
}
export interface InjectedRenderPassAssemblyRunnerInput {
    readonly drawList: readonly RenderPassDrawListRecord[];
    readonly drawListValid?: boolean;
    readonly drawListDiagnostics?: RenderPassDrawListPlan["diagnostics"];
    readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
    readonly bindGroups: readonly UnlitBindGroupResource[];
    readonly meshResources: readonly MeshGpuBufferResource[];
    readonly pass: RenderPassEncoderLike;
}
export interface RenderPassAssemblySmokeReport {
    readonly ready: boolean;
    readonly sections: RenderPassAssemblySmokeSections;
    readonly diagnostics: readonly (RenderPassAssemblySmokeDiagnostic | RenderPassDrawListPlan["diagnostics"][number] | ResolveRenderPassResourcesResult["diagnostics"][number] | RenderPassCommandPlan["diagnostics"][number] | RenderPassCommandExecutionReport["diagnostics"][number])[];
    readonly summary: RenderPassAssemblySmokeSummary;
}
export interface InjectedRenderPassAssemblyRunnerReport {
    readonly resources: ResolveRenderPassResourcesResult;
    readonly commands: RenderPassCommandPlan;
    readonly execution: RenderPassCommandExecutionReport;
    readonly assembly: RenderPassAssemblySmokeReport;
}
export interface RenderPassAssemblySmokeSectionJsonValue {
    readonly present: boolean;
    readonly ready: boolean;
    readonly diagnosticCodes: readonly string[];
}
export interface RenderPassAssemblySmokeSectionsJsonValue {
    readonly drawList: RenderPassAssemblySmokeSectionJsonValue;
    readonly resources: RenderPassAssemblySmokeSectionJsonValue;
    readonly commands: RenderPassAssemblySmokeSectionJsonValue;
    readonly execution: RenderPassAssemblySmokeSectionJsonValue;
}
export interface RenderPassAssemblySmokeSummaryJsonValue {
    readonly drawList: {
        readonly valid: boolean;
        readonly drawCount: number;
        readonly renderIds: readonly number[];
    } | null;
    readonly resources: {
        readonly valid: boolean;
        readonly drawCount: number;
        readonly draws: readonly RenderPassAssemblyResolvedDrawSummary[];
    } | null;
    readonly commands: RenderPassAssemblySmokeSummary["commands"];
    readonly execution: RenderPassAssemblySmokeSummary["execution"];
}
export interface RenderPassAssemblySmokeReportJsonValue {
    readonly ready: boolean;
    readonly sections: RenderPassAssemblySmokeSectionsJsonValue;
    readonly summary: RenderPassAssemblySmokeSummaryJsonValue;
    readonly diagnostics: DiagnosticSummary;
}
export interface RenderPassAssemblySectionDiagnosticSummary {
    readonly section: RenderPassAssemblySmokeSection;
    readonly diagnostics: DiagnosticSummary;
}
export interface RenderPassAssemblyDiagnosticGroups {
    readonly drawList: RenderPassAssemblySectionDiagnosticSummary;
    readonly resources: RenderPassAssemblySectionDiagnosticSummary;
    readonly commands: RenderPassAssemblySectionDiagnosticSummary;
    readonly execution: RenderPassAssemblySectionDiagnosticSummary;
}
export interface RenderPassAssemblyDiagnosticGroupReport {
    readonly ready: boolean;
    readonly sections: RenderPassAssemblyDiagnosticGroups;
    readonly diagnostics: DiagnosticSummary;
}
export declare function createRenderPassAssemblySmokeReport(input: RenderPassAssemblySmokeInput): RenderPassAssemblySmokeReport;
export declare function renderPassAssemblySmokeReportToJsonValue(report: RenderPassAssemblySmokeReport): RenderPassAssemblySmokeReportJsonValue;
export declare function renderPassAssemblySmokeReportToJson(report: RenderPassAssemblySmokeReport): string;
export declare function summarizeRenderPassAssemblyDiagnosticsBySection(report: RenderPassAssemblySmokeReport): RenderPassAssemblyDiagnosticGroupReport;
export declare function runInjectedRenderPassAssembly(input: InjectedRenderPassAssemblyRunnerInput): InjectedRenderPassAssemblyRunnerReport;
//# sourceMappingURL=render-pass-assembly-smoke.d.ts.map