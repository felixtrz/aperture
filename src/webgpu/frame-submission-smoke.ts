import type {
  CommandBufferFinishDiagnostic,
  FinishCommandEncoderResult,
} from "./command-buffer.js";
import type {
  QueueSubmitDiagnostic,
  SubmitCommandBuffersReport,
} from "./queue-submit.js";
import type {
  CreateRenderPassAttachmentPlanResult,
  RenderPassAttachmentDiagnostic,
} from "./render-pass-attachments.js";
import type {
  RenderPassCommandExecutionReport,
  RenderPassCommandExecutorDiagnostic,
} from "./render-pass-command-executor.js";
import type {
  BeginRenderPassResult,
  EndRenderPassResult,
  RenderPassLifecycleDiagnostic,
} from "./render-pass-lifecycle.js";

export type FrameSubmissionSmokeSection =
  | "attachments"
  | "begin"
  | "execution"
  | "end"
  | "finish"
  | "submit";

export type FrameSubmissionSmokeDiagnosticCode =
  | "frameSubmission.missingAttachmentPlan"
  | "frameSubmission.attachmentsNotReady"
  | "frameSubmission.missingBeginReport"
  | "frameSubmission.beginFailed"
  | "frameSubmission.missingExecutionReport"
  | "frameSubmission.executionFailed"
  | "frameSubmission.missingEndReport"
  | "frameSubmission.endFailed"
  | "frameSubmission.missingFinishReport"
  | "frameSubmission.finishFailed"
  | "frameSubmission.missingSubmitReport"
  | "frameSubmission.submitFailed";

export interface FrameSubmissionSmokeDiagnostic {
  readonly code: FrameSubmissionSmokeDiagnosticCode;
  readonly message: string;
  readonly section: FrameSubmissionSmokeSection;
  readonly severity: "warning" | "error";
}

export interface FrameSubmissionSmokeSectionStatus {
  readonly section: FrameSubmissionSmokeSection;
  readonly present: boolean;
  readonly ready: boolean;
  readonly diagnosticCodes: readonly string[];
}

export interface FrameSubmissionSmokeSections {
  readonly attachments: FrameSubmissionSmokeSectionStatus;
  readonly begin: FrameSubmissionSmokeSectionStatus;
  readonly execution: FrameSubmissionSmokeSectionStatus;
  readonly end: FrameSubmissionSmokeSectionStatus;
  readonly finish: FrameSubmissionSmokeSectionStatus;
  readonly submit: FrameSubmissionSmokeSectionStatus;
}

export interface FrameSubmissionSmokeSummary {
  readonly attachments: {
    readonly valid: boolean;
    readonly colorTargets: number;
  } | null;
  readonly begin: { readonly valid: boolean; readonly hasPass: boolean } | null;
  readonly execution: Pick<
    RenderPassCommandExecutionReport,
    "valid" | "executedCommands" | "skippedCommands" | "drawCalls"
  > | null;
  readonly end: { readonly valid: boolean; readonly ended: boolean } | null;
  readonly finish: {
    readonly valid: boolean;
    readonly commandBufferKey: string | null;
  } | null;
  readonly submit: Pick<
    SubmitCommandBuffersReport,
    "valid" | "submitted" | "skipped"
  > | null;
}

export interface FrameSubmissionSmokeInput {
  readonly attachments: CreateRenderPassAttachmentPlanResult | null;
  readonly begin: BeginRenderPassResult | null;
  readonly execution: RenderPassCommandExecutionReport | null;
  readonly end: EndRenderPassResult | null;
  readonly finish: FinishCommandEncoderResult | null;
  readonly submit: SubmitCommandBuffersReport | null;
}

export interface FrameSubmissionSmokeReport {
  readonly ready: boolean;
  readonly sections: FrameSubmissionSmokeSections;
  readonly diagnostics: readonly (
    | FrameSubmissionSmokeDiagnostic
    | RenderPassAttachmentDiagnostic
    | RenderPassLifecycleDiagnostic
    | RenderPassCommandExecutorDiagnostic
    | CommandBufferFinishDiagnostic
    | QueueSubmitDiagnostic
  )[];
  readonly summary: FrameSubmissionSmokeSummary;
}

export function createFrameSubmissionSmokeReport(
  input: FrameSubmissionSmokeInput,
): FrameSubmissionSmokeReport {
  const attachments = evaluateSection({
    section: "attachments",
    report: input.attachments,
    missingCode: "frameSubmission.missingAttachmentPlan",
    notReadyCode: "frameSubmission.attachmentsNotReady",
    missingMessage:
      "Frame submission smoke report is missing attachment planning output.",
    notReadyMessage: "Render pass attachment planning is not ready.",
  });
  const begin = evaluateSection({
    section: "begin",
    report: input.begin,
    missingCode: "frameSubmission.missingBeginReport",
    notReadyCode: "frameSubmission.beginFailed",
    missingMessage:
      "Frame submission smoke report is missing pass begin output.",
    notReadyMessage: "Render pass begin failed.",
  });
  const execution = evaluateSection({
    section: "execution",
    report: input.execution,
    missingCode: "frameSubmission.missingExecutionReport",
    notReadyCode: "frameSubmission.executionFailed",
    missingMessage:
      "Frame submission smoke report is missing command execution output.",
    notReadyMessage: "Render pass command execution failed.",
  });
  const end = evaluateSection({
    section: "end",
    report: input.end,
    missingCode: "frameSubmission.missingEndReport",
    notReadyCode: "frameSubmission.endFailed",
    missingMessage: "Frame submission smoke report is missing pass end output.",
    notReadyMessage: "Render pass end failed.",
  });
  const finish = evaluateSection({
    section: "finish",
    report: input.finish,
    missingCode: "frameSubmission.missingFinishReport",
    notReadyCode: "frameSubmission.finishFailed",
    missingMessage:
      "Frame submission smoke report is missing command encoder finish output.",
    notReadyMessage: "Command encoder finish failed.",
  });
  const submit = evaluateSection({
    section: "submit",
    report: input.submit,
    missingCode: "frameSubmission.missingSubmitReport",
    notReadyCode: "frameSubmission.submitFailed",
    missingMessage:
      "Frame submission smoke report is missing queue submit output.",
    notReadyMessage: "Queue submission failed.",
  });
  const sections: FrameSubmissionSmokeSections = {
    attachments: attachments.status,
    begin: begin.status,
    execution: execution.status,
    end: end.status,
    finish: finish.status,
    submit: submit.status,
  };

  return {
    ready: Object.values(sections).every((section) => section.ready),
    sections,
    diagnostics: [
      ...attachments.diagnostics,
      ...(input.attachments?.diagnostics ?? []),
      ...begin.diagnostics,
      ...(input.begin?.diagnostics ?? []),
      ...execution.diagnostics,
      ...(input.execution?.diagnostics ?? []),
      ...end.diagnostics,
      ...(input.end?.diagnostics ?? []),
      ...finish.diagnostics,
      ...(input.finish?.diagnostics ?? []),
      ...submit.diagnostics,
      ...(input.submit?.diagnostics ?? []),
    ],
    summary: {
      attachments:
        input.attachments === null
          ? null
          : {
              valid: input.attachments.valid,
              colorTargets:
                input.attachments.plan?.colorAttachments.length ?? 0,
            },
      begin:
        input.begin === null
          ? null
          : { valid: input.begin.valid, hasPass: input.begin.pass !== null },
      execution:
        input.execution === null
          ? null
          : {
              valid: input.execution.valid,
              executedCommands: input.execution.executedCommands,
              skippedCommands: input.execution.skippedCommands,
              drawCalls: input.execution.drawCalls,
            },
      end:
        input.end === null
          ? null
          : { valid: input.end.valid, ended: input.end.ended },
      finish:
        input.finish === null
          ? null
          : {
              valid: input.finish.valid,
              commandBufferKey: input.finish.resource?.resourceKey ?? null,
            },
      submit:
        input.submit === null
          ? null
          : {
              valid: input.submit.valid,
              submitted: input.submit.submitted,
              skipped: input.submit.skipped,
            },
    },
  };
}

interface SectionEvaluationInput {
  readonly section: FrameSubmissionSmokeSection;
  readonly report: { readonly valid: boolean } | null;
  readonly missingCode: FrameSubmissionSmokeDiagnosticCode;
  readonly notReadyCode: FrameSubmissionSmokeDiagnosticCode;
  readonly missingMessage: string;
  readonly notReadyMessage: string;
}

interface SectionEvaluation {
  readonly status: FrameSubmissionSmokeSectionStatus;
  readonly diagnostics: readonly FrameSubmissionSmokeDiagnostic[];
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
  section: FrameSubmissionSmokeSection,
  present: boolean,
  diagnostics: readonly FrameSubmissionSmokeDiagnostic[],
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
