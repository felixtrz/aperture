import type {
  DiagnosticSeverity,
  DiagnosticSummary,
} from "@aperture-engine/simulation";
import { summarizeDiagnostics } from "@aperture-engine/simulation";
import {
  packSnapshotTransforms,
  planRenderWorldDrawPackages,
  type MeshDrawPacket,
  type PackedSnapshotTransforms,
  type RenderDiagnostic,
  type RenderSnapshot,
  type RenderWorld,
  type RenderWorldApplyReport,
  type RenderWorldDrawPackage,
  type RenderWorldDrawPackagePlan,
  type RenderWorldDrawReadinessReport,
  type RenderWorldResourceBindingResult,
  type RenderWorldResourceBindingUpdate,
} from "@aperture-engine/render";
import type { CommandSubmissionMetricsReport } from "../../gpu/command-submission-metrics.js";
import {
  createDrawCommandDescriptors,
  type DrawCommandDescriptor,
  type DrawCommandDescriptorPlan,
} from "../draw/draw-command.js";
import type {
  AssembleFrameBoundaryOptions,
  FrameBoundaryAssemblyReport,
} from "./frame-boundary.js";
import type { FrameBoundaryValidationReport } from "./frame-boundary-validation.js";
import {
  frameExecutionReportToJsonValue,
  runInjectedFrameExecution,
  summarizeFrameExecutionDiagnosticsBySection,
  type FrameExecutionDiagnosticGroupReport,
  type FrameExecutionReport,
  type FrameExecutionReportJsonValue,
} from "./frame-execution-report.js";
import type { FrameSubmissionSmokeReport } from "./frame-submission-smoke.js";
import {
  createMvpFrameReadinessReport,
  type MvpFrameReadinessReport,
} from "../../diagnostics/mvp-frame-readiness.js";
import {
  planRenderPassDrawList,
  type RenderPassDrawListPlan,
} from "../passes/render-pass-draw-list.js";
import {
  renderPassAssemblySmokeReportToJsonValue,
  runInjectedRenderPassAssembly,
  summarizeRenderPassAssemblyDiagnosticsBySection,
  type InjectedRenderPassAssemblyRunnerInput,
  type InjectedRenderPassAssemblyRunnerReport,
  type RenderPassAssemblyDiagnosticGroupReport,
  type RenderPassAssemblySmokeReportJsonValue,
} from "../passes/render-pass-assembly-smoke.js";
import type { RenderPassAssemblySmokeReport } from "../passes/render-pass-assembly-smoke.js";
import type { RendererAssemblySmokeReport } from "./renderer-assembly-smoke.js";

export type RendererFrameSummarySection =
  | "rendererAssembly"
  | "renderPassAssembly"
  | "frameSubmission"
  | "frameBoundary"
  | "mvpFrameReadiness"
  | "commandSubmissionMetrics";

export type RendererFrameSummaryMissingDiagnosticCode =
  | "rendererFrameSummary.missingRendererAssembly"
  | "rendererFrameSummary.missingRenderPassAssembly"
  | "rendererFrameSummary.missingFrameSubmission"
  | "rendererFrameSummary.missingFrameBoundary"
  | "rendererFrameSummary.missingMvpFrameReadiness"
  | "rendererFrameSummary.missingCommandSubmissionMetrics";

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

export type InjectedRenderFrameSnapshotResourceKeyResolver = (
  draw: MeshDrawPacket,
) => string | null | undefined;

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

interface SectionReportLike {
  readonly ready: boolean;
  readonly diagnostics: readonly SourceDiagnosticLike[];
}

interface SourceDiagnosticLike {
  readonly code: string;
  readonly message?: string;
  readonly severity?: DiagnosticSeverity;
  readonly section?: string;
}

export function createRendererFrameSummaryReport(
  input: RendererFrameSummaryInput,
): RendererFrameSummaryReport {
  const renderer = evaluateSection({
    section: "rendererAssembly",
    report: input.renderer,
    missingCode: "rendererFrameSummary.missingRendererAssembly",
    missingMessage:
      "Renderer frame summary is missing renderer assembly report.",
  });
  const renderPass = evaluateSection({
    section: "renderPassAssembly",
    report: input.renderPass,
    missingCode: "rendererFrameSummary.missingRenderPassAssembly",
    missingMessage:
      "Renderer frame summary is missing render pass assembly report.",
  });
  const submission = evaluateSection({
    section: "frameSubmission",
    report: input.submission,
    missingCode: "rendererFrameSummary.missingFrameSubmission",
    missingMessage:
      "Renderer frame summary is missing frame submission report.",
  });
  const boundary = evaluateSection({
    section: "frameBoundary",
    report: input.boundary,
    missingCode: "rendererFrameSummary.missingFrameBoundary",
    missingMessage:
      "Renderer frame summary is missing frame boundary validation report.",
  });
  const mvp = evaluateSection({
    section: "mvpFrameReadiness",
    report: input.mvp,
    missingCode: "rendererFrameSummary.missingMvpFrameReadiness",
    missingMessage:
      "Renderer frame summary is missing MVP frame readiness report.",
  });
  const commandSubmission = evaluateSection({
    section: "commandSubmissionMetrics",
    report: input.commandSubmission,
    missingCode: "rendererFrameSummary.missingCommandSubmissionMetrics",
    missingMessage:
      "Renderer frame summary is missing command submission metrics report.",
  });
  const sections: RendererFrameSummarySections = {
    rendererAssembly: renderer.status,
    renderPassAssembly: renderPass.status,
    frameSubmission: submission.status,
    frameBoundary: boundary.status,
    mvpFrameReadiness: mvp.status,
    commandSubmissionMetrics: commandSubmission.status,
  };
  const diagnostics = [
    ...renderer.diagnostics,
    ...renderPass.diagnostics,
    ...submission.diagnostics,
    ...boundary.diagnostics,
    ...mvp.diagnostics,
    ...commandSubmission.diagnostics,
  ];

  return {
    ready: Object.values(sections).every((section) => section.ready),
    sections,
    counts: {
      plannedDraws: countPlannedDraws(input),
      drawCalls: countDrawCalls(input),
      commands: countCommands(input),
      executedCommands: countExecutedCommands(input),
      skippedCommands: countSkippedCommands(input),
      commandBuffers: countCommandBuffers(input),
      submittedCommandBuffers: countSubmittedCommandBuffers(input),
      skippedSubmissions: countSkippedSubmissions(input),
      diagnostics: diagnostics.length,
    },
    diagnostics,
    diagnosticSummary: summarizeDiagnostics(diagnostics),
  };
}

export function createRendererFrameSummaryFromExecutionReport(
  input: RendererFrameSummaryFromExecutionInput,
): RendererFrameSummaryReport {
  const mvp =
    input.renderer === null ||
    input.renderPass === null ||
    input.execution === null
      ? null
      : createMvpFrameReadinessReport({
          renderer: input.renderer,
          renderPass: input.renderPass,
          submission: input.execution.reports.submissionSmoke,
          boundary: input.execution.reports.boundaryValidation,
        });

  return createRendererFrameSummaryReport({
    renderer: input.renderer,
    renderPass: input.renderPass,
    submission: input.execution?.reports.submissionSmoke ?? null,
    boundary: input.execution?.reports.boundaryValidation ?? null,
    mvp,
    commandSubmission:
      input.execution?.reports.commandSubmissionMetrics ?? null,
  });
}

export function runInjectedRendererFrameSummary(
  input: InjectedRendererFrameSummaryRunnerInput,
): InjectedRendererFrameSummaryRunnerReport {
  const execution = runInjectedFrameExecution(input.frameExecution);
  const summary = createRendererFrameSummaryFromExecutionReport({
    renderer: input.renderer,
    renderPass: input.renderPass,
    execution: execution.execution,
  });

  return {
    assembly: execution.assembly,
    execution: execution.execution,
    summary,
    json: rendererFrameSummaryReportToJsonValue(summary),
  };
}

export function runInjectedRenderFrame(
  input: InjectedRenderFrameRunnerInput,
): InjectedRenderFrameRunnerReport {
  const renderPass = runInjectedRenderPassAssembly(input.renderPass);
  const frame = runInjectedRendererFrameSummary({
    renderer: input.renderer,
    renderPass: renderPass.assembly,
    frameExecution: {
      ...input.frameExecution,
      commands: renderPass.commands.commands,
    },
  });

  return {
    renderPass,
    assembly: frame.assembly,
    execution: frame.execution,
    summary: frame.summary,
    json: frame.json,
  };
}

export function runInjectedRenderFrameFromDrawCommands(
  input: InjectedRenderFrameDrawCommandRunnerInput,
): InjectedRenderFrameDrawCommandRunnerReport {
  const drawList = planRenderPassDrawList({
    drawCommands: input.drawCommands,
    pipelines: input.pipelines,
    bindGroups: input.bindGroups,
    ...(input.requiredBindGroupGroups === undefined
      ? {}
      : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
  });
  const frame = runInjectedRenderFrame({
    renderer: input.renderer,
    renderPass: {
      drawList: drawList.draws,
      drawListValid: drawList.valid,
      drawListDiagnostics: drawList.diagnostics,
      pipelines: input.pipelines,
      bindGroups: input.bindGroups,
      meshResources: input.meshResources,
      pass: input.pass,
    },
    frameExecution: input.frameExecution,
  });

  return {
    drawList,
    frame,
  };
}

export function runInjectedRenderFrameFromDrawPackages(
  input: InjectedRenderFrameDrawPackageRunnerInput,
): InjectedRenderFrameDrawPackageRunnerReport {
  const descriptors = createDrawCommandDescriptors(
    input.packages,
    input.meshResources,
  );
  const frame = runInjectedRenderFrameFromDrawCommands({
    renderer: input.renderer,
    drawCommands: descriptors.descriptors,
    pipelines: input.pipelines,
    bindGroups: input.bindGroups,
    meshResources: input.meshResources,
    ...(input.requiredBindGroupGroups === undefined
      ? {}
      : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
    pass: input.pass,
    frameExecution: input.frameExecution,
  });

  return {
    descriptors,
    frame,
  };
}

export function runInjectedRenderFrameFromRenderWorldPackages(
  input: InjectedRenderFrameRenderWorldPackageRunnerInput,
): InjectedRenderFrameRenderWorldPackageRunnerReport {
  const packages = planRenderWorldDrawPackages(
    input.readiness,
    input.transforms,
  );
  const frame = runInjectedRenderFrameFromDrawPackages({
    renderer: input.renderer,
    packages: packages.packages,
    meshResources: input.meshResources,
    pipelines: input.pipelines,
    bindGroups: input.bindGroups,
    ...(input.requiredBindGroupGroups === undefined
      ? {}
      : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
    pass: input.pass,
    frameExecution: input.frameExecution,
  });

  return {
    packages,
    frame,
  };
}

export function runInjectedRenderFrameFromSnapshot(
  input: InjectedRenderFrameSnapshotRunnerInput,
): InjectedRenderFrameSnapshotRunnerReport {
  const apply = input.renderWorld.applySnapshot(input.snapshot);
  const bindings = input.bindings.map((binding) => ({
    renderId: binding.renderId,
    result: input.renderWorld.updateResourceBindings(
      binding.renderId,
      binding.update,
    ),
  }));
  const transforms = packSnapshotTransforms(input.snapshot);
  const readiness = input.renderWorld.createDrawReadinessReport();
  const frame = runInjectedRenderFrameFromRenderWorldPackages({
    renderer: input.renderer,
    readiness,
    transforms,
    meshResources: input.meshResources,
    pipelines: input.pipelines,
    bindGroups: input.bindGroups,
    ...(input.requiredBindGroupGroups === undefined
      ? {}
      : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
    pass: input.pass,
    frameExecution: input.frameExecution,
  });

  return {
    apply,
    bindings,
    transforms,
    readiness,
    frame,
  };
}

export function planInjectedRenderFrameSnapshotResourceBindings(
  input: InjectedRenderFrameSnapshotResourceBindingPlanInput,
): InjectedRenderFrameSnapshotResourceBindingPlan {
  const scratch = createInjectedRenderFrameSnapshotResourceBindingPlanScratch();

  return writeInjectedRenderFrameSnapshotResourceBindings(input, scratch);
}

export function createInjectedRenderFrameSnapshotResourceBindingPlanScratch(
  capacity = 0,
): InjectedRenderFrameSnapshotResourceBindingPlanScratch {
  const bindings: InjectedRenderFrameSnapshotResourceBinding[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const bindingPool: InjectedRenderFrameSnapshotResourceBinding[] = [];

  for (let index = 0; index < capacity; index += 1) {
    bindingPool.push(createEmptySnapshotResourceBinding());
  }

  return {
    bindings,
    diagnostics,
    bindingPool,
    seenRenderIds: new Set(),
    plan: { bindings, diagnostics },
  };
}

export function writeInjectedRenderFrameSnapshotResourceBindings(
  input: InjectedRenderFrameSnapshotResourceBindingPlanInput,
  scratch: InjectedRenderFrameSnapshotResourceBindingPlanScratch,
): InjectedRenderFrameSnapshotResourceBindingPlan {
  scratch.bindings.length = 0;
  scratch.diagnostics.length = 0;
  scratch.seenRenderIds.clear();

  for (const draw of input.snapshot.meshDraws) {
    if (scratch.seenRenderIds.has(draw.renderId)) {
      scratch.diagnostics.push({
        code: "renderFrameSnapshotBinding.duplicateRenderId",
        message: `Duplicate render id ${draw.renderId} while planning snapshot resource bindings.`,
        severity: "error",
        entity: draw.entity,
      });
      continue;
    }

    scratch.seenRenderIds.add(draw.renderId);

    const meshResourceKey = input.resolveMeshResourceKey(draw);
    const materialResourceKey = input.resolveMaterialResourceKey(draw);

    if (meshResourceKey == null) {
      scratch.diagnostics.push({
        code: "renderFrameSnapshotBinding.missingMeshResource",
        message: `No mesh resource binding was resolved for render id ${draw.renderId}.`,
        severity: "warning",
        entity: draw.entity,
        assetKey: draw.mesh.id,
      });
    }

    if (materialResourceKey == null) {
      scratch.diagnostics.push({
        code: "renderFrameSnapshotBinding.missingMaterialResource",
        message: `No material resource binding was resolved for render id ${draw.renderId}.`,
        severity: "warning",
        entity: draw.entity,
        assetKey: draw.material.id,
      });
    }

    const binding = snapshotResourceBindingAt(scratch, scratch.bindings.length);

    binding.renderId = draw.renderId;
    const update = binding.update as MutableResourceBindingUpdate;

    if (meshResourceKey == null) {
      delete update.meshResourceKey;
    } else {
      update.meshResourceKey = meshResourceKey;
    }

    if (materialResourceKey == null) {
      delete update.materialResourceKey;
    } else {
      update.materialResourceKey = materialResourceKey;
    }

    scratch.bindings.push(binding);
  }

  scratch.bindings.sort((a, b) => a.renderId - b.renderId);

  return scratch.plan;
}

type MutableSnapshotResourceBinding = {
  -readonly [Key in keyof InjectedRenderFrameSnapshotResourceBinding]: InjectedRenderFrameSnapshotResourceBinding[Key];
};

type MutableResourceBindingUpdate = {
  -readonly [Key in keyof RenderWorldResourceBindingUpdate]: RenderWorldResourceBindingUpdate[Key];
};

function snapshotResourceBindingAt(
  scratch: InjectedRenderFrameSnapshotResourceBindingPlanScratch,
  index: number,
): MutableSnapshotResourceBinding & {
  readonly update: MutableResourceBindingUpdate;
} {
  const existing = scratch.bindingPool[index] as
    | (MutableSnapshotResourceBinding & {
        readonly update: MutableResourceBindingUpdate;
      })
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const binding = createEmptySnapshotResourceBinding();

  scratch.bindingPool.push(binding);
  return binding;
}

function createEmptySnapshotResourceBinding(): MutableSnapshotResourceBinding & {
  readonly update: MutableResourceBindingUpdate;
} {
  return {
    renderId: 0,
    update: {},
  };
}

export function injectedRenderFrameSnapshotRunnerReportToJsonValue(
  report: InjectedRenderFrameSnapshotRunnerReport,
): InjectedRenderFrameSnapshotRunnerReportJsonValue {
  const applyDiagnostics = summarizeDiagnostics(report.apply.diagnostics);
  const bindingDiagnostics = summarizeDiagnostics(
    collectSnapshotBindingDiagnostics(report.bindings),
  );
  const transformDiagnostics = summarizeDiagnostics(
    report.transforms.diagnostics,
  );
  const readinessDiagnostics = summarizeDiagnostics(
    report.readiness.diagnostics,
  );
  const frame = injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(
    report.frame,
  );

  return {
    ready:
      applyDiagnostics.total === 0 &&
      bindingDiagnostics.total === 0 &&
      transformDiagnostics.total === 0 &&
      readinessDiagnostics.total === 0 &&
      frame.ready,
    apply: {
      valid: applyDiagnostics.total === 0,
      created: report.apply.created,
      updated: report.apply.updated,
      unchanged: report.apply.unchanged,
      removed: report.apply.removed,
      active: report.apply.active,
      diagnostics: cloneDiagnosticSummary(applyDiagnostics),
    },
    bindings: {
      valid: bindingDiagnostics.total === 0,
      attemptedCount: report.bindings.length,
      succeededCount: report.bindings.filter((binding) => binding.result.ok)
        .length,
      failedCount: report.bindings.filter((binding) => !binding.result.ok)
        .length,
      renderIds: report.bindings.map((binding) => binding.renderId),
      failedRenderIds: report.bindings
        .filter((binding) => !binding.result.ok)
        .map((binding) => binding.renderId),
      diagnostics: cloneDiagnosticSummary(bindingDiagnostics),
    },
    transforms: {
      valid: transformDiagnostics.total === 0,
      floatCount: report.transforms.data.length,
      matrixCount: report.transforms.data.length / 16,
      offsetCount: report.transforms.offsets.length,
      renderIds: report.transforms.offsets.map((offset) => offset.renderId),
      diagnostics: cloneDiagnosticSummary(transformDiagnostics),
    },
    readiness: {
      valid: readinessDiagnostics.total === 0,
      readyDrawCount: report.readiness.ready.length,
      blockedDrawCount: report.readiness.blocked.length,
      readyRenderIds: report.readiness.ready.map((draw) => draw.renderId),
      blockedRenderIds: report.readiness.blocked.map((draw) => draw.renderId),
      diagnostics: cloneDiagnosticSummary(readinessDiagnostics),
    },
    frame,
  };
}

export function injectedRenderFrameSnapshotRunnerReportToJson(
  report: InjectedRenderFrameSnapshotRunnerReport,
): string {
  return JSON.stringify(
    injectedRenderFrameSnapshotRunnerReportToJsonValue(report),
  );
}

export function summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(
  report: InjectedRenderFrameSnapshotRunnerReport,
): InjectedRenderFrameSnapshotDiagnosticGroupReport {
  const applyDiagnostics = summarizeDiagnostics(report.apply.diagnostics);
  const bindingDiagnostics = summarizeDiagnostics(
    collectSnapshotBindingDiagnostics(report.bindings),
  );
  const transformDiagnostics = summarizeDiagnostics(
    report.transforms.diagnostics,
  );
  const readinessDiagnostics = summarizeDiagnostics(
    report.readiness.diagnostics,
  );
  const frame =
    summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
      report.frame,
    );

  return {
    ready:
      applyDiagnostics.total === 0 &&
      bindingDiagnostics.total === 0 &&
      transformDiagnostics.total === 0 &&
      readinessDiagnostics.total === 0 &&
      frame.ready,
    phases: {
      apply: {
        diagnostics: cloneDiagnosticSummary(applyDiagnostics),
      },
      bindings: {
        diagnostics: cloneDiagnosticSummary(bindingDiagnostics),
      },
      transforms: {
        diagnostics: cloneDiagnosticSummary(transformDiagnostics),
      },
      readiness: {
        diagnostics: cloneDiagnosticSummary(readinessDiagnostics),
      },
      frame,
    },
    diagnostics: mergeDiagnosticSummaries(
      applyDiagnostics,
      bindingDiagnostics,
      transformDiagnostics,
      readinessDiagnostics,
      frame.diagnostics,
    ),
  };
}

export function injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(
  report: InjectedRenderFrameRenderWorldPackageRunnerReport,
): InjectedRenderFrameRenderWorldPackageRunnerReportJsonValue {
  const packageDiagnostics = summarizeDiagnostics(report.packages.diagnostics);
  const frame = injectedRenderFrameDrawPackageRunnerReportToJsonValue(
    report.frame,
  );

  return {
    ready: packageDiagnostics.total === 0 && frame.ready,
    packages: {
      valid: packageDiagnostics.total === 0,
      packageCount: report.packages.packages.length,
      renderIds: report.packages.packages.map(
        (drawPackage) => drawPackage.renderId,
      ),
      diagnostics: cloneDiagnosticSummary(packageDiagnostics),
    },
    frame,
  };
}

export function injectedRenderFrameRenderWorldPackageRunnerReportToJson(
  report: InjectedRenderFrameRenderWorldPackageRunnerReport,
): string {
  return JSON.stringify(
    injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(report),
  );
}

export function summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
  report: InjectedRenderFrameRenderWorldPackageRunnerReport,
): InjectedRenderFrameRenderWorldPackageDiagnosticGroupReport {
  const packageDiagnostics = summarizeDiagnostics(report.packages.diagnostics);
  const frame = summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase(
    report.frame,
  );

  return {
    ready: packageDiagnostics.total === 0 && frame.ready,
    phases: {
      packages: {
        diagnostics: cloneDiagnosticSummary(packageDiagnostics),
      },
      frame,
    },
    diagnostics: mergeDiagnosticSummaries(
      packageDiagnostics,
      frame.diagnostics,
    ),
  };
}

export function injectedRenderFrameDrawPackageRunnerReportToJsonValue(
  report: InjectedRenderFrameDrawPackageRunnerReport,
): InjectedRenderFrameDrawPackageRunnerReportJsonValue {
  const descriptorDiagnostics = summarizeDiagnostics(
    report.descriptors.diagnostics,
  );
  const frame = injectedRenderFrameDrawCommandRunnerReportToJsonValue(
    report.frame,
  );

  return {
    ready: descriptorDiagnostics.total === 0 && frame.ready,
    descriptors: {
      valid: descriptorDiagnostics.total === 0,
      descriptorCount: report.descriptors.descriptors.length,
      renderIds: report.descriptors.descriptors.map(
        (descriptor) => descriptor.renderId,
      ),
      diagnostics: cloneDiagnosticSummary(descriptorDiagnostics),
    },
    frame,
  };
}

export function injectedRenderFrameDrawPackageRunnerReportToJson(
  report: InjectedRenderFrameDrawPackageRunnerReport,
): string {
  return JSON.stringify(
    injectedRenderFrameDrawPackageRunnerReportToJsonValue(report),
  );
}

export function summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase(
  report: InjectedRenderFrameDrawPackageRunnerReport,
): InjectedRenderFrameDrawPackageDiagnosticGroupReport {
  const descriptorDiagnostics = summarizeDiagnostics(
    report.descriptors.diagnostics,
  );
  const frame = summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(
    report.frame,
  );

  return {
    ready: descriptorDiagnostics.total === 0 && frame.ready,
    phases: {
      descriptors: {
        diagnostics: cloneDiagnosticSummary(descriptorDiagnostics),
      },
      frame,
    },
    diagnostics: mergeDiagnosticSummaries(
      descriptorDiagnostics,
      frame.diagnostics,
    ),
  };
}

export function injectedRenderFrameDrawCommandRunnerReportToJsonValue(
  report: InjectedRenderFrameDrawCommandRunnerReport,
): InjectedRenderFrameDrawCommandRunnerReportJsonValue {
  const drawListDiagnostics = summarizeDiagnostics(report.drawList.diagnostics);
  const frame = injectedRenderFrameRunnerReportToJsonValue(report.frame);

  return {
    ready: report.drawList.valid && frame.ready,
    drawList: {
      valid: report.drawList.valid,
      drawCount: report.drawList.draws.length,
      renderIds: report.drawList.draws.map((draw) => draw.renderId),
      diagnostics: {
        total: drawListDiagnostics.total,
        bySeverity: {
          info: drawListDiagnostics.bySeverity.info,
          warning: drawListDiagnostics.bySeverity.warning,
          error: drawListDiagnostics.bySeverity.error,
        },
        byCode: { ...drawListDiagnostics.byCode },
      },
    },
    frame,
  };
}

export function injectedRenderFrameDrawCommandRunnerReportToJson(
  report: InjectedRenderFrameDrawCommandRunnerReport,
): string {
  return JSON.stringify(
    injectedRenderFrameDrawCommandRunnerReportToJsonValue(report),
  );
}

export function summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(
  report: InjectedRenderFrameDrawCommandRunnerReport,
): InjectedRenderFrameDrawCommandDiagnosticGroupReport {
  const drawListDiagnostics = summarizeDiagnostics(report.drawList.diagnostics);
  const frame = summarizeInjectedRenderFrameDiagnosticsByPhase(report.frame);

  return {
    ready: drawListDiagnostics.total === 0 && frame.ready,
    phases: {
      drawList: {
        diagnostics: cloneDiagnosticSummary(drawListDiagnostics),
      },
      frame,
    },
    diagnostics: mergeDiagnosticSummaries(
      drawListDiagnostics,
      frame.diagnostics,
    ),
  };
}

export function injectedRenderFrameRunnerReportToJsonValue(
  report: InjectedRenderFrameRunnerReport,
): InjectedRenderFrameRunnerReportJsonValue {
  return {
    ready:
      report.assembly.valid &&
      report.renderPass.assembly.ready &&
      report.execution.ready &&
      report.summary.ready,
    boundary: {
      valid: report.assembly.valid,
    },
    renderPass: renderPassAssemblySmokeReportToJsonValue(
      report.renderPass.assembly,
    ),
    frameExecution: frameExecutionReportToJsonValue(report.execution),
    summary: rendererFrameSummaryReportToJsonValue(report.summary),
  };
}

export function injectedRenderFrameRunnerReportToJson(
  report: InjectedRenderFrameRunnerReport,
): string {
  return JSON.stringify(injectedRenderFrameRunnerReportToJsonValue(report));
}

export function summarizeInjectedRenderFrameDiagnosticsByPhase(
  report: InjectedRenderFrameRunnerReport,
): InjectedRenderFrameDiagnosticGroupReport {
  const renderPass = summarizeRenderPassAssemblyDiagnosticsBySection(
    report.renderPass.assembly,
  );
  const frameExecution = summarizeFrameExecutionDiagnosticsBySection(
    report.execution,
  );
  const rendererFrameSummary =
    summarizeRendererFrameSummaryDiagnosticsBySection(report.summary);

  return {
    ready:
      rendererFrameSummary.sections.rendererAssembly.diagnostics.total === 0 &&
      renderPass.ready &&
      frameExecution.ready &&
      rendererFrameSummary.ready,
    phases: {
      rendererAssembly: rendererFrameSummary.sections.rendererAssembly,
      renderPassAssembly: renderPass,
      frameExecution,
      rendererFrameSummary,
    },
    diagnostics: {
      total: report.summary.diagnosticSummary.total,
      bySeverity: {
        info: report.summary.diagnosticSummary.bySeverity.info,
        warning: report.summary.diagnosticSummary.bySeverity.warning,
        error: report.summary.diagnosticSummary.bySeverity.error,
      },
      byCode: { ...report.summary.diagnosticSummary.byCode },
    },
  };
}

export function rendererFrameSummaryReportToJsonValue(
  report: RendererFrameSummaryReport,
): RendererFrameSummaryReportJsonValue {
  return {
    ready: report.ready,
    sections: {
      rendererAssembly: sectionToJsonValue(report.sections.rendererAssembly),
      renderPassAssembly: sectionToJsonValue(
        report.sections.renderPassAssembly,
      ),
      frameSubmission: sectionToJsonValue(report.sections.frameSubmission),
      frameBoundary: sectionToJsonValue(report.sections.frameBoundary),
      mvpFrameReadiness: sectionToJsonValue(report.sections.mvpFrameReadiness),
      commandSubmissionMetrics: sectionToJsonValue(
        report.sections.commandSubmissionMetrics,
      ),
    },
    counts: {
      plannedDraws: report.counts.plannedDraws,
      drawCalls: report.counts.drawCalls,
      commands: report.counts.commands,
      executedCommands: report.counts.executedCommands,
      skippedCommands: report.counts.skippedCommands,
      commandBuffers: report.counts.commandBuffers,
      submittedCommandBuffers: report.counts.submittedCommandBuffers,
      skippedSubmissions: report.counts.skippedSubmissions,
      diagnostics: report.counts.diagnostics,
    },
    diagnostics: {
      total: report.diagnosticSummary.total,
      bySeverity: {
        info: report.diagnosticSummary.bySeverity.info,
        warning: report.diagnosticSummary.bySeverity.warning,
        error: report.diagnosticSummary.bySeverity.error,
      },
      byCode: { ...report.diagnosticSummary.byCode },
    },
  };
}

export function rendererFrameSummaryReportToJson(
  report: RendererFrameSummaryReport,
): string {
  return JSON.stringify(rendererFrameSummaryReportToJsonValue(report));
}

export function summarizeRendererFrameSummaryDiagnosticsBySection(
  report: RendererFrameSummaryReport,
): RendererFrameSummaryDiagnosticGroupReport {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: diagnostics.total === 0,
    sections: {
      rendererAssembly: summarizeSectionDiagnostics("rendererAssembly", report),
      renderPassAssembly: summarizeSectionDiagnostics(
        "renderPassAssembly",
        report,
      ),
      frameSubmission: summarizeSectionDiagnostics("frameSubmission", report),
      frameBoundary: summarizeSectionDiagnostics("frameBoundary", report),
      mvpFrameReadiness: summarizeSectionDiagnostics(
        "mvpFrameReadiness",
        report,
      ),
      commandSubmissionMetrics: summarizeSectionDiagnostics(
        "commandSubmissionMetrics",
        report,
      ),
    },
    diagnostics,
  };
}

interface SectionEvaluationInput {
  readonly section: RendererFrameSummarySection;
  readonly report: SectionReportLike | null;
  readonly missingCode: RendererFrameSummaryMissingDiagnosticCode;
  readonly missingMessage: string;
}

interface SectionEvaluation {
  readonly status: RendererFrameSummarySectionStatus;
  readonly diagnostics: readonly RendererFrameSummaryDiagnostic[];
}

function evaluateSection(input: SectionEvaluationInput): SectionEvaluation {
  if (input.report === null) {
    return {
      status: {
        section: input.section,
        present: false,
        ready: false,
        diagnosticCount: 1,
      },
      diagnostics: [
        {
          section: input.section,
          code: input.missingCode,
          message: input.missingMessage,
          severity: "error",
        },
      ],
    };
  }

  const diagnostics = copySourceDiagnostics(
    input.section,
    input.report.diagnostics,
  );

  return {
    status: {
      section: input.section,
      present: true,
      ready: input.report.ready,
      diagnosticCount: diagnostics.length,
    },
    diagnostics,
  };
}

function sectionToJsonValue(
  section: RendererFrameSummarySectionStatus,
): RendererFrameSummarySectionJsonValue {
  return {
    present: section.present,
    ready: section.ready,
    diagnosticCount: section.diagnosticCount,
  };
}

function summarizeSectionDiagnostics(
  section: RendererFrameSummarySection,
  report: RendererFrameSummaryReport,
): RendererFrameSummarySectionDiagnosticSummary {
  return {
    section,
    diagnostics: summarizeDiagnostics(
      report.diagnostics.filter((diagnostic) => diagnostic.section === section),
    ),
  };
}

function collectSnapshotBindingDiagnostics(
  bindings: readonly InjectedRenderFrameSnapshotBindingReport[],
): readonly SourceDiagnosticLike[] {
  return bindings.flatMap((binding) =>
    binding.result.ok ? [] : binding.result.diagnostics,
  );
}

function cloneDiagnosticSummary(summary: DiagnosticSummary): DiagnosticSummary {
  return {
    total: summary.total,
    bySeverity: {
      info: summary.bySeverity.info,
      warning: summary.bySeverity.warning,
      error: summary.bySeverity.error,
    },
    byCode: { ...summary.byCode },
  };
}

function mergeDiagnosticSummaries(
  ...summaries: readonly DiagnosticSummary[]
): DiagnosticSummary {
  const bySeverity: Record<DiagnosticSeverity, number> = {
    info: 0,
    warning: 0,
    error: 0,
  };
  const byCode: Record<string, number> = {};
  let total = 0;

  for (const summary of summaries) {
    total += summary.total;
    bySeverity.info += summary.bySeverity.info;
    bySeverity.warning += summary.bySeverity.warning;
    bySeverity.error += summary.bySeverity.error;

    for (const [code, count] of Object.entries(summary.byCode)) {
      byCode[code] = (byCode[code] ?? 0) + count;
    }
  }

  return { total, bySeverity, byCode };
}

function copySourceDiagnostics(
  section: RendererFrameSummarySection,
  diagnostics: readonly SourceDiagnosticLike[],
): readonly RendererFrameSummaryDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    section,
    code: diagnostic.code,
    message: diagnostic.message ?? diagnostic.code,
    severity: diagnostic.severity ?? "warning",
    ...(diagnostic.section === undefined
      ? {}
      : { sourceSection: diagnostic.section }),
  }));
}

function countPlannedDraws(input: RendererFrameSummaryInput): number {
  return (
    input.renderPass?.summary.commands?.drawCount ??
    input.renderer?.summary.frame?.draws ??
    0
  );
}

function countDrawCalls(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.drawCalls ??
    input.submission?.summary.execution?.drawCalls ??
    input.renderPass?.summary.execution?.drawCalls ??
    0
  );
}

function countCommands(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.commands ??
    input.renderPass?.summary.commands?.commandCount ??
    0
  );
}

function countExecutedCommands(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.executedCommands ??
    input.submission?.summary.execution?.executedCommands ??
    input.renderPass?.summary.execution?.executedCommands ??
    0
  );
}

function countSkippedCommands(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.skippedCommands ??
    input.submission?.summary.execution?.skippedCommands ??
    input.renderPass?.summary.execution?.skippedCommands ??
    0
  );
}

function countCommandBuffers(input: RendererFrameSummaryInput): number {
  if (input.commandSubmission !== null) {
    return input.commandSubmission.counts.commandBuffers;
  }

  const finish = input.submission?.summary.finish ?? null;
  return finish?.commandBufferKey === null || finish === null ? 0 : 1;
}

function countSubmittedCommandBuffers(
  input: RendererFrameSummaryInput,
): number {
  return (
    input.commandSubmission?.counts.submittedCommandBuffers ??
    input.submission?.summary.submit?.submitted ??
    0
  );
}

function countSkippedSubmissions(input: RendererFrameSummaryInput): number {
  return (
    input.commandSubmission?.counts.skippedSubmissions ??
    input.submission?.summary.submit?.skipped ??
    0
  );
}
