import {
  finishCommandEncoder,
  type CommandBufferResource,
  type CommandEncoderFinishLike,
} from "./command-buffer.js";
import { submitCommandBuffers, type QueueSubmitLike } from "./queue-submit.js";
import type { ShadowPassEncoderAssemblyReport } from "./shadow-pass-encoder-assembly-report.js";

export type ShadowPassCommandBufferSubmissionStatus =
  | "ready"
  | "submitted"
  | "missing"
  | "not-required";

export type ShadowPassCommandBufferSubmissionDiagnosticCode =
  | "shadowPassCommandBufferSubmission.missingEncoderAssembly"
  | "shadowPassCommandBufferSubmission.missingCommandEncoder"
  | "shadowPassCommandBufferSubmission.finishFailed"
  | "shadowPassCommandBufferSubmission.submitFailed"
  | "shadowPassCommandBufferSubmission.queueSubmissionDeferred"
  | "shadowPassCommandBufferSubmission.shaderSamplingDeferred";

export interface ShadowPassCommandBufferSubmissionDiagnostic {
  readonly code: ShadowPassCommandBufferSubmissionDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface ShadowPassCommandBufferSubmissionReport {
  readonly ready: boolean;
  readonly status: ShadowPassCommandBufferSubmissionStatus;
  readonly counts: {
    readonly assembledPasses: number;
    readonly commandCount: number;
    readonly drawCalls: number;
    readonly commandBuffers: number;
    readonly submittedCommandBuffers: number;
    readonly skippedSubmissions: number;
  };
  readonly sections: {
    readonly encoderAssembly: boolean;
    readonly commandBufferFinish: boolean;
    readonly queueSubmission: boolean;
    readonly shaderSampling: false;
  };
  readonly commandBufferKeys: readonly string[];
  readonly diagnostics: readonly ShadowPassCommandBufferSubmissionDiagnostic[];
}

export type ShadowPassCommandBufferSubmissionReportJsonValue =
  ShadowPassCommandBufferSubmissionReport;

export interface CreateShadowPassCommandBufferSubmissionReportOptions {
  readonly assembly: ShadowPassEncoderAssemblyReport;
  readonly encoder?: CommandEncoderFinishLike;
  readonly queue?: QueueSubmitLike;
  readonly label?: string;
  readonly submit?: boolean;
}

export function createShadowPassCommandBufferSubmissionReport(
  options: CreateShadowPassCommandBufferSubmissionReportOptions,
): ShadowPassCommandBufferSubmissionReport {
  if (options.assembly.counts.passes === 0) {
    return report({
      status: "not-required",
      assembly: options.assembly,
      commandBuffers: [],
      submittedCommandBuffers: 0,
      skippedSubmissions: 0,
      diagnostics: [],
    });
  }

  const diagnostics: ShadowPassCommandBufferSubmissionDiagnostic[] = [];

  if (options.assembly.counts.assembledPasses === 0) {
    diagnostics.push({
      code: "shadowPassCommandBufferSubmission.missingEncoderAssembly",
      severity: "warning",
      message:
        "Shadow command-buffer submission requires at least one assembled shadow pass.",
    });
  }

  if (options.encoder === undefined) {
    diagnostics.push({
      code: "shadowPassCommandBufferSubmission.missingCommandEncoder",
      severity: "warning",
      message:
        "Shadow command-buffer submission requires the command encoder used for shadow pass assembly.",
    });
  }

  if (
    diagnostics.length > 0 ||
    options.assembly.counts.assembledPasses === 0 ||
    options.encoder === undefined
  ) {
    return report({
      status: "missing",
      assembly: options.assembly,
      commandBuffers: [],
      submittedCommandBuffers: 0,
      skippedSubmissions: 0,
      diagnostics,
    });
  }

  const finish = finishCommandEncoder({
    encoder: options.encoder,
    label: options.label ?? "shadow-pass:command-buffer",
  });

  if (!finish.valid || finish.resource === null) {
    return report({
      status: "missing",
      assembly: options.assembly,
      commandBuffers: [],
      submittedCommandBuffers: 0,
      skippedSubmissions: 0,
      diagnostics: [
        {
          code: "shadowPassCommandBufferSubmission.finishFailed",
          severity: "warning",
          message:
            finish.diagnostics[0]?.message ??
            "Shadow command-buffer finish failed.",
        },
      ],
    });
  }

  const commandBuffers = [finish.resource];

  if (options.submit !== true) {
    return report({
      status: "ready",
      assembly: options.assembly,
      commandBuffers,
      submittedCommandBuffers: 0,
      skippedSubmissions: commandBuffers.length,
      diagnostics: [
        {
          code: "shadowPassCommandBufferSubmission.queueSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow command buffer is finished, but queue submission is deferred.",
        },
        shaderSamplingDeferredDiagnostic(),
      ],
    });
  }

  const submit = submitCommandBuffers({
    queue: options.queue ?? {},
    commandBuffers,
  });

  if (!submit.valid) {
    return report({
      status: "missing",
      assembly: options.assembly,
      commandBuffers,
      submittedCommandBuffers: submit.submitted,
      skippedSubmissions: submit.skipped,
      diagnostics: [
        {
          code: "shadowPassCommandBufferSubmission.submitFailed",
          severity: "warning",
          message:
            submit.diagnostics[0]?.message ??
            "Shadow command-buffer queue submission failed.",
        },
      ],
    });
  }

  return report({
    status: "submitted",
    assembly: options.assembly,
    commandBuffers,
    submittedCommandBuffers: submit.submitted,
    skippedSubmissions: submit.skipped,
    diagnostics: [shaderSamplingDeferredDiagnostic()],
  });
}

export function shadowPassCommandBufferSubmissionReportToJsonValue(
  value: ShadowPassCommandBufferSubmissionReport,
): ShadowPassCommandBufferSubmissionReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    counts: { ...value.counts },
    sections: { ...value.sections },
    commandBufferKeys: [...value.commandBufferKeys],
    diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowPassCommandBufferSubmissionReportToJson(
  value: ShadowPassCommandBufferSubmissionReport,
): string {
  return JSON.stringify(
    shadowPassCommandBufferSubmissionReportToJsonValue(value),
  );
}

function report(input: {
  readonly status: ShadowPassCommandBufferSubmissionStatus;
  readonly assembly: ShadowPassEncoderAssemblyReport;
  readonly commandBuffers: readonly CommandBufferResource[];
  readonly submittedCommandBuffers: number;
  readonly skippedSubmissions: number;
  readonly diagnostics: readonly ShadowPassCommandBufferSubmissionDiagnostic[];
}): ShadowPassCommandBufferSubmissionReport {
  return {
    ready:
      input.status === "ready" ||
      input.status === "submitted" ||
      input.status === "not-required",
    status: input.status,
    counts: {
      assembledPasses: input.assembly.counts.assembledPasses,
      commandCount: input.assembly.counts.commandCount,
      drawCalls: input.assembly.counts.drawCalls,
      commandBuffers: input.commandBuffers.length,
      submittedCommandBuffers: input.submittedCommandBuffers,
      skippedSubmissions: input.skippedSubmissions,
    },
    sections: {
      encoderAssembly: input.assembly.counts.assembledPasses > 0,
      commandBufferFinish: input.commandBuffers.length > 0,
      queueSubmission: input.submittedCommandBuffers > 0,
      shaderSampling: false,
    },
    commandBufferKeys: input.commandBuffers.map((buffer) => buffer.resourceKey),
    diagnostics: input.diagnostics,
  };
}

function shaderSamplingDeferredDiagnostic(): ShadowPassCommandBufferSubmissionDiagnostic {
  return {
    code: "shadowPassCommandBufferSubmission.shaderSamplingDeferred",
    severity: "warning",
    message:
      "Shadow command buffer submission does not enable StandardMaterial shadow sampling.",
  };
}
