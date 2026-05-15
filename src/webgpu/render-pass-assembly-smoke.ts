import type { RenderPassCommandExecutionReport } from "./render-pass-command-executor.js";
import type { RenderPassCommandPlan } from "./render-pass-commands.js";
import type { RenderPassDrawListPlan } from "./render-pass-draw-list.js";
import type { ResolveRenderPassResourcesResult } from "./render-pass-resources.js";

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
  readonly resources: Pick<
    ResolveRenderPassResourcesResult,
    "valid" | "draws"
  > | null;
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

export interface RenderPassAssemblySmokeInput {
  readonly drawList: RenderPassDrawListPlan | null;
  readonly resources: ResolveRenderPassResourcesResult | null;
  readonly commands: RenderPassCommandPlan | null;
  readonly execution: RenderPassCommandExecutionReport | null;
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
          : { valid: input.resources.valid, draws: input.resources.draws },
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
