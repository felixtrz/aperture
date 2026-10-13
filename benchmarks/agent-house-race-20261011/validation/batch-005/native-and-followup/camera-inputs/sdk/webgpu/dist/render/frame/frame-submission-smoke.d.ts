import type { CommandBufferFinishDiagnostic, FinishCommandEncoderResult } from "../../gpu/command-buffer.js";
import type { QueueSubmitDiagnostic, SubmitCommandBuffersReport } from "../queues/queue-submit.js";
import type { CreateRenderPassAttachmentPlanResult, RenderPassAttachmentDiagnostic } from "../passes/render-pass-attachments.js";
import type { RenderPassCommandExecutionReport, RenderPassCommandExecutorDiagnostic } from "../passes/render-pass-command-executor.js";
import type { BeginRenderPassResult, EndRenderPassResult, RenderPassLifecycleDiagnostic } from "../passes/render-pass-lifecycle.js";
export type FrameSubmissionSmokeSection = "attachments" | "begin" | "execution" | "end" | "finish" | "submit";
export type FrameSubmissionSmokeDiagnosticCode = "frameSubmission.missingAttachmentPlan" | "frameSubmission.attachmentsNotReady" | "frameSubmission.missingBeginReport" | "frameSubmission.beginFailed" | "frameSubmission.missingExecutionReport" | "frameSubmission.executionFailed" | "frameSubmission.missingEndReport" | "frameSubmission.endFailed" | "frameSubmission.missingFinishReport" | "frameSubmission.finishFailed" | "frameSubmission.missingSubmitReport" | "frameSubmission.submitFailed";
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
    readonly begin: {
        readonly valid: boolean;
        readonly hasPass: boolean;
    } | null;
    readonly execution: Pick<RenderPassCommandExecutionReport, "valid" | "executedCommands" | "skippedCommands" | "drawCalls"> | null;
    readonly end: {
        readonly valid: boolean;
        readonly ended: boolean;
    } | null;
    readonly finish: {
        readonly valid: boolean;
        readonly commandBufferKey: string | null;
    } | null;
    readonly submit: Pick<SubmitCommandBuffersReport, "valid" | "submitted" | "skipped"> | null;
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
    readonly diagnostics: readonly (FrameSubmissionSmokeDiagnostic | RenderPassAttachmentDiagnostic | RenderPassLifecycleDiagnostic | RenderPassCommandExecutorDiagnostic | CommandBufferFinishDiagnostic | QueueSubmitDiagnostic)[];
    readonly summary: FrameSubmissionSmokeSummary;
}
export declare function createFrameSubmissionSmokeReport(input: FrameSubmissionSmokeInput): FrameSubmissionSmokeReport;
//# sourceMappingURL=frame-submission-smoke.d.ts.map