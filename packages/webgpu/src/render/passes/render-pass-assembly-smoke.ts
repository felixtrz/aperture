import {
  summarizeDiagnostics,
  type DiagnosticSummary,
} from "@aperture-engine/simulation";
import {
  executeRenderPassCommands,
  type RenderPassCommandExecutionReport,
  type RenderPassEncoderLike,
} from "./render-pass-command-executor.js";
import {
  planRenderPassCommands,
  type RenderPassCommandPlan,
} from "./render-pass-commands.js";
import type {
  RenderPassDrawListPlan,
  RenderPassDrawListRecord,
} from "./render-pass-draw-list.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";
import {
  resolveRenderPassResources,
  type ResolveRenderPassResourcesResult,
  type ResolvedRenderPassDraw,
} from "./render-pass-resources.js";
import type { UnlitBindGroupResource } from "../../materials/unlit/unlit-bind-group.js";

export type RenderPassAssemblySmokeSection =
  | "drawList"
  | "resources"
  | "commands"
  | "execution";

export type RenderPassAssemblySmokeDiagnosticCode =
  | "renderPassAssembly.missingDrawList"
  | "renderPassAssembly.drawListNotReady"
  | "renderPassAssembly.missingResolvedResources"
  | "renderPassAssembly.resourcesNotReady"
  | "renderPassAssembly.missingCommandPlan"
  | "renderPassAssembly.commandPlanNotReady"
  | "renderPassAssembly.missingExecutionReport"
  | "renderPassAssembly.executionFailed";

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
  readonly execution: Pick<
    RenderPassCommandExecutionReport,
    | "valid"
    | "commandCount"
    | "executedCommands"
    | "skippedCommands"
    | "drawCalls"
  > | null;
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
  readonly diagnostics: readonly (
    | RenderPassAssemblySmokeDiagnostic
    | RenderPassDrawListPlan["diagnostics"][number]
    | ResolveRenderPassResourcesResult["diagnostics"][number]
    | RenderPassCommandPlan["diagnostics"][number]
    | RenderPassCommandExecutionReport["diagnostics"][number]
  )[];
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

export function createRenderPassAssemblySmokeReport(
  input: RenderPassAssemblySmokeInput,
): RenderPassAssemblySmokeReport {
  const drawList = evaluateSection({
    section: "drawList",
    report: input.drawList,
    missingCode: "renderPassAssembly.missingDrawList",
    notReadyCode: "renderPassAssembly.drawListNotReady",
    missingMessage:
      "Render pass assembly smoke report is missing draw list planning output.",
    notReadyMessage: "Render pass draw list planning is not ready.",
  });
  const resources = evaluateSection({
    section: "resources",
    report: input.resources,
    missingCode: "renderPassAssembly.missingResolvedResources",
    notReadyCode: "renderPassAssembly.resourcesNotReady",
    missingMessage:
      "Render pass assembly smoke report is missing resolved resource output.",
    notReadyMessage: "Render pass resource resolution is not ready.",
  });
  const commands = evaluateSection({
    section: "commands",
    report: input.commands,
    missingCode: "renderPassAssembly.missingCommandPlan",
    notReadyCode: "renderPassAssembly.commandPlanNotReady",
    missingMessage:
      "Render pass assembly smoke report is missing command planning output.",
    notReadyMessage: "Render pass command planning is not ready.",
  });
  const execution = evaluateSection({
    section: "execution",
    report: input.execution,
    missingCode: "renderPassAssembly.missingExecutionReport",
    notReadyCode: "renderPassAssembly.executionFailed",
    missingMessage:
      "Render pass assembly smoke report is missing command execution output.",
    notReadyMessage: "Render pass command execution failed.",
  });
  const sections: RenderPassAssemblySmokeSections = {
    drawList: drawList.status,
    resources: resources.status,
    commands: commands.status,
    execution: execution.status,
  };

  return {
    ready: Object.values(sections).every((section) => section.ready),
    sections,
    diagnostics: [
      ...drawList.diagnostics,
      ...(input.drawList?.diagnostics ?? []),
      ...resources.diagnostics,
      ...(input.resources?.diagnostics ?? []),
      ...commands.diagnostics,
      ...(input.commands?.diagnostics ?? []),
      ...execution.diagnostics,
      ...(input.execution?.diagnostics ?? []),
    ],
    summary: {
      drawList:
        input.drawList === null
          ? null
          : { valid: input.drawList.valid, draws: input.drawList.draws },
      resources:
        input.resources === null
          ? null
          : {
              valid: input.resources.valid,
              draws: input.resources.draws.map(resolvedDrawToSummary),
            },
      commands:
        input.commands === null
          ? null
          : {
              valid: input.commands.valid,
              drawCount: input.commands.drawCount,
              commandCount: input.commands.commands.length,
              indexedDrawCount: input.commands.indexedDrawCount,
              nonIndexedDrawCount: input.commands.nonIndexedDrawCount,
            },
      execution:
        input.execution === null
          ? null
          : {
              valid: input.execution.valid,
              commandCount: input.execution.commandCount,
              executedCommands: input.execution.executedCommands,
              skippedCommands: input.execution.skippedCommands,
              drawCalls: input.execution.drawCalls,
            },
    },
  };
}

export function renderPassAssemblySmokeReportToJsonValue(
  report: RenderPassAssemblySmokeReport,
): RenderPassAssemblySmokeReportJsonValue {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: report.ready,
    sections: {
      drawList: sectionToJsonValue(report.sections.drawList),
      resources: sectionToJsonValue(report.sections.resources),
      commands: sectionToJsonValue(report.sections.commands),
      execution: sectionToJsonValue(report.sections.execution),
    },
    summary: {
      drawList:
        report.summary.drawList === null
          ? null
          : {
              valid: report.summary.drawList.valid,
              drawCount: report.summary.drawList.draws.length,
              renderIds: report.summary.drawList.draws.map(
                (draw) => draw.renderId,
              ),
            },
      resources:
        report.summary.resources === null
          ? null
          : {
              valid: report.summary.resources.valid,
              drawCount: report.summary.resources.draws.length,
              draws: report.summary.resources.draws.map((draw) => ({
                renderId: draw.renderId,
                pipelineKey: draw.pipelineKey,
                bindGroupKeys: [...draw.bindGroupKeys],
                vertexBufferKeys: [...draw.vertexBufferKeys],
                vertexCount: draw.vertexCount,
                indexBufferKey: draw.indexBufferKey,
                indexCount: draw.indexCount,
                instanceCount: draw.instanceCount,
                transformPackedOffset: draw.transformPackedOffset,
              })),
            },
      commands:
        report.summary.commands === null
          ? null
          : {
              valid: report.summary.commands.valid,
              drawCount: report.summary.commands.drawCount,
              commandCount: report.summary.commands.commandCount,
              indexedDrawCount: report.summary.commands.indexedDrawCount,
              nonIndexedDrawCount: report.summary.commands.nonIndexedDrawCount,
            },
      execution:
        report.summary.execution === null
          ? null
          : {
              valid: report.summary.execution.valid,
              commandCount: report.summary.execution.commandCount,
              executedCommands: report.summary.execution.executedCommands,
              skippedCommands: report.summary.execution.skippedCommands,
              drawCalls: report.summary.execution.drawCalls,
            },
    },
    diagnostics: {
      total: diagnostics.total,
      bySeverity: {
        info: diagnostics.bySeverity.info,
        warning: diagnostics.bySeverity.warning,
        error: diagnostics.bySeverity.error,
      },
      byCode: { ...diagnostics.byCode },
    },
  };
}

export function renderPassAssemblySmokeReportToJson(
  report: RenderPassAssemblySmokeReport,
): string {
  return JSON.stringify(renderPassAssemblySmokeReportToJsonValue(report));
}

export function summarizeRenderPassAssemblyDiagnosticsBySection(
  report: RenderPassAssemblySmokeReport,
): RenderPassAssemblyDiagnosticGroupReport {
  const diagnostics = summarizeDiagnostics(report.diagnostics);

  return {
    ready: diagnostics.total === 0,
    sections: {
      drawList: summarizeSectionDiagnostics("drawList", report),
      resources: summarizeSectionDiagnostics("resources", report),
      commands: summarizeSectionDiagnostics("commands", report),
      execution: summarizeSectionDiagnostics("execution", report),
    },
    diagnostics,
  };
}

export function runInjectedRenderPassAssembly(
  input: InjectedRenderPassAssemblyRunnerInput,
): InjectedRenderPassAssemblyRunnerReport {
  const resources = resolveRenderPassResources({
    drawList: input.drawList,
    pipelines: input.pipelines,
    bindGroups: input.bindGroups,
    meshResources: input.meshResources,
  });
  const commands = planRenderPassCommands({ draws: resources.draws });
  const execution = executeRenderPassCommands({
    pass: input.pass,
    commands: commands.commands,
  });
  const assembly = createRenderPassAssemblySmokeReport({
    drawList: {
      valid: input.drawListValid ?? true,
      draws: input.drawList,
      diagnostics: input.drawListDiagnostics ?? [],
    },
    resources,
    commands,
    execution,
  });

  return {
    resources,
    commands,
    execution,
    assembly,
  };
}

function summarizeSectionDiagnostics(
  section: RenderPassAssemblySmokeSection,
  report: RenderPassAssemblySmokeReport,
): RenderPassAssemblySectionDiagnosticSummary {
  return {
    section,
    diagnostics: summarizeDiagnostics(
      report.diagnostics.filter(
        (diagnostic) => diagnosticSection(diagnostic) === section,
      ),
    ),
  };
}

function diagnosticSection(diagnostic: {
  readonly code: string;
  readonly section?: string;
}): RenderPassAssemblySmokeSection {
  if (isRenderPassAssemblySection(diagnostic.section)) {
    return diagnostic.section;
  }

  if (
    diagnostic.code.startsWith("renderPassDrawList.") ||
    diagnostic.code.startsWith("drawCommand.")
  ) {
    return "drawList";
  }

  if (
    diagnostic.code.startsWith("renderPassResource.") ||
    diagnostic.code.startsWith("unlitBindGroupResource.")
  ) {
    return "resources";
  }

  if (diagnostic.code.startsWith("renderPassCommand.")) {
    return "commands";
  }

  return "execution";
}

function isRenderPassAssemblySection(
  section: string | undefined,
): section is RenderPassAssemblySmokeSection {
  return (
    section === "drawList" ||
    section === "resources" ||
    section === "commands" ||
    section === "execution"
  );
}

function sectionToJsonValue(
  section: RenderPassAssemblySmokeSectionStatus,
): RenderPassAssemblySmokeSectionJsonValue {
  return {
    present: section.present,
    ready: section.ready,
    diagnosticCodes: [...section.diagnosticCodes],
  };
}

function resolvedDrawToSummary(
  draw: ResolvedRenderPassDraw,
): RenderPassAssemblyResolvedDrawSummary {
  return {
    renderId: draw.renderId,
    pipelineKey: draw.pipelineKey,
    bindGroupKeys: draw.bindGroups.map((bindGroup) => bindGroup.resourceKey),
    vertexBufferKeys: draw.vertexBuffers.map(
      (vertexBuffer) => vertexBuffer.resourceKey,
    ),
    vertexCount: draw.vertexCount,
    indexBufferKey: draw.indexBuffer?.resourceKey ?? null,
    indexCount: draw.indexCount,
    instanceCount: draw.instanceCount,
    transformPackedOffset: draw.transformPackedOffset,
  };
}

interface SectionEvaluationInput {
  readonly section: RenderPassAssemblySmokeSection;
  readonly report: { readonly valid: boolean } | null;
  readonly missingCode: RenderPassAssemblySmokeDiagnosticCode;
  readonly notReadyCode: RenderPassAssemblySmokeDiagnosticCode;
  readonly missingMessage: string;
  readonly notReadyMessage: string;
}

interface SectionEvaluation {
  readonly status: RenderPassAssemblySmokeSectionStatus;
  readonly diagnostics: readonly RenderPassAssemblySmokeDiagnostic[];
}

function evaluateSection(input: SectionEvaluationInput): SectionEvaluation {
  if (input.report === null) {
    return sectionResult(input.section, false, [
      {
        code: input.missingCode,
        message: input.missingMessage,
        section: input.section,
        severity: "error",
      },
    ]);
  }

  if (!input.report.valid) {
    return sectionResult(input.section, true, [
      {
        code: input.notReadyCode,
        message: input.notReadyMessage,
        section: input.section,
        severity: "warning",
      },
    ]);
  }

  return sectionResult(input.section, true, []);
}

function sectionResult(
  section: RenderPassAssemblySmokeSection,
  present: boolean,
  diagnostics: readonly RenderPassAssemblySmokeDiagnostic[],
): SectionEvaluation {
  return {
    status: {
      section,
      present,
      ready: present && diagnostics.length === 0,
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
    },
    diagnostics,
  };
}
