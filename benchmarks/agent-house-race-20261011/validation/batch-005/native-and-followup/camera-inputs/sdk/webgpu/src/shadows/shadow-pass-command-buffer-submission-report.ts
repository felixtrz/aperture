import {
  finishCommandEncoder,
  type CommandBufferResource,
  type CommandEncoderFinishLike,
} from "../gpu/command-buffer.js";
import {
  resolveGpuTimestampQueries,
  type GpuTimestampCommandEncoderLike,
  type GpuTimestampCommandReport,
  type GpuTimestampQueryResources,
} from "../gpu/gpu-timing.js";
import {
  submitCommandBuffers,
  type QueueSubmitLike,
} from "../render/queues/queue-submit.js";
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
    readonly shaderSampling: boolean;
  };
  readonly commandBufferKeys: readonly string[];
  readonly gpuTiming?: ShadowPassCommandBufferGpuTimingReport;
  readonly diagnostics: readonly ShadowPassCommandBufferSubmissionDiagnostic[];
}

export interface ShadowPassCommandBufferGpuTimingOptions {
  readonly resources: GpuTimestampQueryResources;
  readonly queryCount?: number;
}

export interface ShadowPassCommandBufferGpuTimingReport {
  readonly queryCount: number;
  readonly resolve: GpuTimestampCommandReport | null;
  readonly diagnostics: readonly GpuTimestampCommandReport["diagnostics"][number][];
}

export type ShadowPassCommandBufferSubmissionReportJsonValue =
  ShadowPassCommandBufferSubmissionReport;

export interface CreateShadowPassCommandBufferSubmissionReportOptions {
  readonly assembly: ShadowPassEncoderAssemblyReport;
  readonly encoder?: CommandEncoderFinishLike;
  readonly queue?: QueueSubmitLike;
  readonly label?: string;
  readonly submit?: boolean;
  readonly deferEncoding?: boolean;
  readonly gpuTiming?: ShadowPassCommandBufferGpuTimingOptions;
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

  if (options.deferEncoding === true && options.assembly.ready) {
    return report({
      status: "ready",
      assembly: options.assembly,
      commandBuffers: [],
      submittedCommandBuffers: 0,
      skippedSubmissions: 0,
      diagnostics: [],
    });
  }

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

  const gpuTiming = resolveShadowPassCommandBufferGpuTiming(
    options.encoder,
    options.gpuTiming,
  );
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
      ...(gpuTiming === undefined ? {} : { gpuTiming }),
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
      ...(gpuTiming === undefined ? {} : { gpuTiming }),
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
      ...(gpuTiming === undefined ? {} : { gpuTiming }),
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
    ...(gpuTiming === undefined ? {} : { gpuTiming }),
    diagnostics: [],
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
    ...(value.gpuTiming === undefined
      ? {}
      : {
          gpuTiming: {
            queryCount: value.gpuTiming.queryCount,
            resolve: value.gpuTiming.resolve,
            diagnostics: value.gpuTiming.diagnostics.map((diagnostic) => ({
              ...diagnostic,
            })),
          },
        }),
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
  readonly gpuTiming?: ShadowPassCommandBufferGpuTimingReport;
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
      shaderSampling: input.status === "submitted",
    },
    commandBufferKeys: input.commandBuffers.map((buffer) => buffer.resourceKey),
    ...(input.gpuTiming === undefined ? {} : { gpuTiming: input.gpuTiming }),
    diagnostics: input.diagnostics,
  };
}

function resolveShadowPassCommandBufferGpuTiming(
  encoder: CommandEncoderFinishLike & GpuTimestampCommandEncoderLike,
  options: ShadowPassCommandBufferGpuTimingOptions | undefined,
): ShadowPassCommandBufferGpuTimingReport | undefined {
  if (options === undefined) {
    return undefined;
  }

  const queryCount = options.queryCount ?? options.resources.queryCount;
  const resolve = resolveGpuTimestampQueries(
    encoder,
    options.resources,
    queryCount,
  );

  return {
    queryCount,
    resolve,
    diagnostics: resolve.diagnostics,
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
