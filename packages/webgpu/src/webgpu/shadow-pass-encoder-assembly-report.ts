import {
  executeRenderPassCommands,
  type RenderPassCommandExecutionReport,
} from "./render-pass-command-executor.js";
import {
  writeGpuTimestampQuery,
  type GpuTimestampCommandEncoderLike,
  type GpuTimestampCommandReport,
  type GpuTimestampQueryResources,
} from "./gpu-timing.js";
import type { RenderPassCommand } from "./render-pass-commands.js";
import {
  beginPlannedRenderPass,
  endPlannedRenderPass,
  type RenderPassCommandEncoderLike,
} from "./render-pass-lifecycle.js";
import type { RenderPassAttachmentDescriptorPlan } from "./render-pass-attachments.js";
import type { ShadowCasterFrameResourceReadinessReport } from "./shadow-caster-frame-resource-readiness.js";
import type {
  ShadowPassAttachmentDescriptorReport,
  ShadowPassDepthAttachmentDescriptor,
} from "./shadow-pass-attachment-descriptor.js";
import type { ShadowPassCommandEncodingReport } from "./shadow-pass-command-encoding-report.js";

export type ShadowPassEncoderAssemblyStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "not-required";

export type ShadowPassEncoderAssemblyDiagnosticCode =
  | "shadowPassEncoderAssembly.missingAttachmentDescriptors"
  | "shadowPassEncoderAssembly.frameResourcesNotReady"
  | "shadowPassEncoderAssembly.missingCommandRecords"
  | "shadowPassEncoderAssembly.missingCommandEncoder"
  | "shadowPassEncoderAssembly.missingDepthView"
  | "shadowPassEncoderAssembly.beginFailed"
  | "shadowPassEncoderAssembly.commandExecutionFailed"
  | "shadowPassEncoderAssembly.endFailed"
  | "shadowPassEncoderAssembly.commandBufferSubmissionDeferred"
  | "shadowPassEncoderAssembly.shaderSamplingDeferred";

export interface ShadowPassEncoderAssemblyDiagnostic {
  readonly code: ShadowPassEncoderAssemblyDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly passKey?: string;
  readonly shadowId?: number;
  readonly lightId?: number;
}

export interface ShadowPassEncoderCommandRecord {
  readonly passKey: string;
  readonly commands: readonly RenderPassCommand[];
}

export interface ShadowPassEncoderAssemblyRecord {
  readonly passKey: string;
  readonly shadowId: number;
  readonly lightId: number;
  readonly depthTextureKey: string;
  readonly depthViewKey: string;
  readonly commandCount: number;
  readonly executedCommands: number;
  readonly drawCalls: number;
  readonly indexedDrawCalls: number;
  readonly begun: boolean;
  readonly ended: boolean;
}

export interface ShadowPassGpuTimingOptions {
  readonly resources: GpuTimestampQueryResources;
  readonly startQuery?: number;
}

export interface ShadowPassGpuTimingCommandRecord {
  readonly passKey: string;
  readonly startQuery: number;
  readonly endQuery: number;
  readonly writeStart: GpuTimestampCommandReport | null;
  readonly writeEnd: GpuTimestampCommandReport | null;
  readonly diagnostics: readonly GpuTimestampCommandReport["diagnostics"][number][];
}

export interface ShadowPassGpuTimingCommandReport {
  readonly queryCount: number;
  readonly records: readonly ShadowPassGpuTimingCommandRecord[];
  readonly diagnostics: readonly GpuTimestampCommandReport["diagnostics"][number][];
}

export interface ShadowPassEncoderAssemblyReport {
  readonly ready: boolean;
  readonly status: ShadowPassEncoderAssemblyStatus;
  readonly counts: {
    readonly passes: number;
    readonly attachments: number;
    readonly frameResourceDraws: number;
    readonly commandRecords: number;
    readonly assembledPasses: number;
    readonly commandCount: number;
    readonly executedCommands: number;
    readonly drawCalls: number;
  };
  readonly sections: {
    readonly attachmentDescriptors: boolean;
    readonly frameResources: boolean;
    readonly commandRecords: boolean;
    readonly passBegin: boolean;
    readonly commandExecution: boolean;
    readonly passEnd: boolean;
    readonly commandBufferFinish: false;
    readonly queueSubmission: false;
    readonly shaderSampling: false;
  };
  readonly records: readonly ShadowPassEncoderAssemblyRecord[];
  readonly gpuTiming?: ShadowPassGpuTimingCommandReport;
  readonly diagnostics: readonly ShadowPassEncoderAssemblyDiagnostic[];
}

export type ShadowPassEncoderAssemblyReportJsonValue =
  ShadowPassEncoderAssemblyReport;

export interface CreateShadowPassEncoderAssemblyReportOptions {
  readonly attachments: ShadowPassAttachmentDescriptorReport;
  readonly frameResources: ShadowCasterFrameResourceReadinessReport;
  readonly commandEncoding: ShadowPassCommandEncodingReport;
  readonly commands: readonly ShadowPassEncoderCommandRecord[];
  readonly encoder?: RenderPassCommandEncoderLike;
  readonly resolveDepthView?: (
    attachment: ShadowPassDepthAttachmentDescriptor,
  ) => unknown | null;
  readonly gpuTiming?: ShadowPassGpuTimingOptions;
}

export function createShadowPassEncoderAssemblyReport(
  options: CreateShadowPassEncoderAssemblyReportOptions,
): ShadowPassEncoderAssemblyReport {
  if (options.attachments.passCount === 0) {
    return report({
      status: "not-required",
      attachments: options.attachments,
      frameResources: options.frameResources,
      commandEncoding: options.commandEncoding,
      records: [],
      diagnostics: [],
    });
  }

  const diagnostics: ShadowPassEncoderAssemblyDiagnostic[] = [];
  const commandRecords = new Map(
    options.commands.map((record) => [record.passKey, record.commands]),
  );
  const records: ShadowPassEncoderAssemblyRecord[] = [];
  const gpuTimingRecords: ShadowPassGpuTimingCommandRecord[] = [];

  if (options.attachments.attachmentCount === 0) {
    diagnostics.push({
      code: "shadowPassEncoderAssembly.missingAttachmentDescriptors",
      severity: "warning",
      message:
        "Shadow pass encoder assembly requires depth attachment descriptors.",
    });
  }

  if (!options.frameResources.ready) {
    diagnostics.push({
      code: "shadowPassEncoderAssembly.frameResourcesNotReady",
      severity: "warning",
      message:
        "Shadow pass encoder assembly requires ready caster frame resources.",
    });
  }

  if (options.commandEncoding.records.length === 0) {
    diagnostics.push({
      code: "shadowPassEncoderAssembly.missingCommandRecords",
      severity: "warning",
      message:
        "Shadow pass encoder assembly requires shadow pass command records.",
    });
  }

  if (options.encoder === undefined) {
    diagnostics.push({
      code: "shadowPassEncoderAssembly.missingCommandEncoder",
      severity: "warning",
      message:
        "Shadow pass encoder assembly requires an injected command encoder.",
    });
  }

  for (const attachment of options.attachments.attachments) {
    const commands = commandRecords.get(attachment.passKey) ?? [];
    const depthView =
      options.resolveDepthView?.(attachment) ?? attachment.viewKey;

    if (commands.length === 0) {
      diagnostics.push({
        code: "shadowPassEncoderAssembly.missingCommandRecords",
        severity: "warning",
        passKey: attachment.passKey,
        shadowId: attachment.shadowId,
        lightId: attachment.lightId,
        message: `Shadow pass '${attachment.passKey}' has no executable caster command records.`,
      });
    }

    if (depthView === null) {
      diagnostics.push({
        code: "shadowPassEncoderAssembly.missingDepthView",
        severity: "warning",
        passKey: attachment.passKey,
        shadowId: attachment.shadowId,
        lightId: attachment.lightId,
        message: `Shadow pass '${attachment.passKey}' has no live depth view for encoder assembly.`,
      });
    }

    const assembled =
      options.encoder === undefined || depthView === null
        ? null
        : assemblePass(
            options.encoder,
            attachment,
            depthView,
            commands,
            createShadowPassGpuTimingRecordOptions(
              options.gpuTiming,
              records.length,
            ),
          );

    diagnostics.push(...(assembled?.diagnostics ?? []));
    if (assembled?.gpuTiming !== undefined) {
      gpuTimingRecords.push(assembled.gpuTiming);
    }
    records.push({
      passKey: attachment.passKey,
      shadowId: attachment.shadowId,
      lightId: attachment.lightId,
      depthTextureKey: attachment.textureKey,
      depthViewKey: attachment.viewKey,
      commandCount: commands.length,
      executedCommands: assembled?.execution.executedCommands ?? 0,
      drawCalls: assembled?.execution.drawCalls ?? 0,
      indexedDrawCalls: assembled?.execution.indexedDrawCalls ?? 0,
      begun: assembled?.begun ?? false,
      ended: assembled?.ended ?? false,
    });
  }

  if (records.length > 0 && records.every((record) => record.ended)) {
    diagnostics.push({
      code: "shadowPassEncoderAssembly.commandBufferSubmissionDeferred",
      severity: "warning",
      message:
        "Shadow pass encoders are assembled, but command-buffer finish and queue submission are deferred.",
    });
    diagnostics.push({
      code: "shadowPassEncoderAssembly.shaderSamplingDeferred",
      severity: "warning",
      message:
        "Shadow pass encoders are assembled, but StandardMaterial shadow sampling remains deferred.",
    });
  }

  const hasBlockingDiagnostics = diagnostics.some(
    (diagnostic) =>
      diagnostic.code !==
        "shadowPassEncoderAssembly.commandBufferSubmissionDeferred" &&
      diagnostic.code !== "shadowPassEncoderAssembly.shaderSamplingDeferred",
  );

  return report({
    status: hasBlockingDiagnostics
      ? "missing"
      : records.some((record) => record.ended)
        ? "ready"
        : "deferred",
    attachments: options.attachments,
    frameResources: options.frameResources,
    commandEncoding: options.commandEncoding,
    records,
    ...(options.gpuTiming === undefined
      ? {}
      : {
          gpuTiming: createShadowPassGpuTimingCommandReport(
            gpuTimingRecords,
            options.gpuTiming.resources.queryCount,
          ),
        }),
    diagnostics,
  });
}

export function shadowPassEncoderAssemblyReportToJsonValue(
  value: ShadowPassEncoderAssemblyReport,
): ShadowPassEncoderAssemblyReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    counts: { ...value.counts },
    sections: { ...value.sections },
    records: value.records.map((record) => ({ ...record })),
    ...(value.gpuTiming === undefined
      ? {}
      : {
          gpuTiming: {
            queryCount: value.gpuTiming.queryCount,
            records: value.gpuTiming.records.map((record) => ({ ...record })),
            diagnostics: value.gpuTiming.diagnostics.map((diagnostic) => ({
              ...diagnostic,
            })),
          },
        }),
    diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowPassEncoderAssemblyReportToJson(
  value: ShadowPassEncoderAssemblyReport,
): string {
  return JSON.stringify(shadowPassEncoderAssemblyReportToJsonValue(value));
}

function assemblePass(
  encoder: RenderPassCommandEncoderLike & GpuTimestampCommandEncoderLike,
  attachment: ShadowPassDepthAttachmentDescriptor,
  depthView: unknown,
  commands: readonly RenderPassCommand[],
  gpuTiming: ShadowPassGpuTimingRecordOptions | null,
): {
  readonly begun: boolean;
  readonly ended: boolean;
  readonly execution: RenderPassCommandExecutionReport;
  readonly gpuTiming?: ShadowPassGpuTimingCommandRecord;
  readonly diagnostics: readonly ShadowPassEncoderAssemblyDiagnostic[];
} | null {
  const plan: RenderPassAttachmentDescriptorPlan = {
    colorAttachments: [],
    depthStencilAttachment: {
      view: depthView,
      depthClearValue: attachment.depthClearValue,
      depthLoadOp: attachment.depthLoadOp,
      depthStoreOp: attachment.depthStoreOp,
    },
  };
  const writeStart =
    gpuTiming === null
      ? null
      : writeGpuTimestampQuery(
          encoder,
          gpuTiming.resources,
          gpuTiming.startQuery,
        );
  const begin = beginPlannedRenderPass({ encoder, plan });

  if (begin.pass === null) {
    return {
      begun: false,
      ended: false,
      execution: emptyExecution(),
      ...(gpuTiming === null
        ? {}
        : {
            gpuTiming: createShadowPassGpuTimingRecord(
              attachment.passKey,
              gpuTiming,
              writeStart,
              null,
            ),
          }),
      diagnostics: begin.diagnostics.map((diagnostic) => ({
        code: "shadowPassEncoderAssembly.beginFailed",
        severity: "warning",
        passKey: attachment.passKey,
        shadowId: attachment.shadowId,
        lightId: attachment.lightId,
        message: diagnostic.message,
      })),
    };
  }

  const execution = executeRenderPassCommands({
    pass: begin.pass,
    commands,
  });
  const end = endPlannedRenderPass(begin.pass);
  const writeEnd =
    gpuTiming === null
      ? null
      : writeGpuTimestampQuery(
          encoder,
          gpuTiming.resources,
          gpuTiming.endQuery,
        );
  const diagnostics: ShadowPassEncoderAssemblyDiagnostic[] = [
    ...execution.diagnostics.map((diagnostic) => ({
      code: "shadowPassEncoderAssembly.commandExecutionFailed" as const,
      severity: "warning" as const,
      passKey: attachment.passKey,
      shadowId: attachment.shadowId,
      lightId: attachment.lightId,
      message: diagnostic.message,
    })),
    ...end.diagnostics.map((diagnostic) => ({
      code: "shadowPassEncoderAssembly.endFailed" as const,
      severity: "warning" as const,
      passKey: attachment.passKey,
      shadowId: attachment.shadowId,
      lightId: attachment.lightId,
      message: diagnostic.message,
    })),
  ];

  return {
    begun: begin.valid,
    ended: end.ended,
    execution,
    ...(gpuTiming === null
      ? {}
      : {
          gpuTiming: createShadowPassGpuTimingRecord(
            attachment.passKey,
            gpuTiming,
            writeStart,
            writeEnd,
          ),
        }),
    diagnostics,
  };
}

function emptyExecution(): RenderPassCommandExecutionReport {
  return {
    valid: false,
    commandCount: 0,
    executedCommands: 0,
    skippedCommands: 0,
    drawCalls: 0,
    indexedDrawCalls: 0,
    nonIndexedDrawCalls: 0,
    diagnostics: [],
  };
}

function report(input: {
  readonly status: ShadowPassEncoderAssemblyStatus;
  readonly attachments: ShadowPassAttachmentDescriptorReport;
  readonly frameResources: ShadowCasterFrameResourceReadinessReport;
  readonly commandEncoding: ShadowPassCommandEncodingReport;
  readonly records: readonly ShadowPassEncoderAssemblyRecord[];
  readonly gpuTiming?: ShadowPassGpuTimingCommandReport;
  readonly diagnostics: readonly ShadowPassEncoderAssemblyDiagnostic[];
}): ShadowPassEncoderAssemblyReport {
  const commandCount = input.records.reduce(
    (sum, record) => sum + record.commandCount,
    0,
  );
  const executedCommands = input.records.reduce(
    (sum, record) => sum + record.executedCommands,
    0,
  );
  const drawCalls = input.records.reduce(
    (sum, record) => sum + record.drawCalls,
    0,
  );

  return {
    ready: input.status === "ready" || input.status === "not-required",
    status: input.status,
    counts: {
      passes: input.attachments.passCount,
      attachments: input.attachments.attachmentCount,
      frameResourceDraws: input.frameResources.counts.readyDraws,
      commandRecords: input.commandEncoding.records.length,
      assembledPasses: input.records.filter((record) => record.ended).length,
      commandCount,
      executedCommands,
      drawCalls,
    },
    sections: {
      attachmentDescriptors: input.attachments.attachmentCount > 0,
      frameResources: input.frameResources.ready,
      commandRecords: input.commandEncoding.records.length > 0,
      passBegin: input.records.some((record) => record.begun),
      commandExecution: executedCommands === commandCount && commandCount > 0,
      passEnd: input.records.some((record) => record.ended),
      commandBufferFinish: false,
      queueSubmission: false,
      shaderSampling: false,
    },
    records: input.records,
    ...(input.gpuTiming === undefined ? {} : { gpuTiming: input.gpuTiming }),
    diagnostics: input.diagnostics,
  };
}

interface ShadowPassGpuTimingRecordOptions {
  readonly resources: GpuTimestampQueryResources;
  readonly startQuery: number;
  readonly endQuery: number;
}

function createShadowPassGpuTimingRecordOptions(
  options: ShadowPassGpuTimingOptions | undefined,
  passIndex: number,
): ShadowPassGpuTimingRecordOptions | null {
  if (options === undefined) {
    return null;
  }

  const startQuery = (options.startQuery ?? 0) + passIndex * 2;

  return {
    resources: options.resources,
    startQuery,
    endQuery: startQuery + 1,
  };
}

function createShadowPassGpuTimingRecord(
  passKey: string,
  options: ShadowPassGpuTimingRecordOptions,
  writeStart: GpuTimestampCommandReport | null,
  writeEnd: GpuTimestampCommandReport | null,
): ShadowPassGpuTimingCommandRecord {
  return {
    passKey,
    startQuery: options.startQuery,
    endQuery: options.endQuery,
    writeStart,
    writeEnd,
    diagnostics: [
      ...(writeStart?.diagnostics ?? []),
      ...(writeEnd?.diagnostics ?? []),
    ],
  };
}

function createShadowPassGpuTimingCommandReport(
  records: readonly ShadowPassGpuTimingCommandRecord[],
  queryCount: number,
): ShadowPassGpuTimingCommandReport {
  return {
    queryCount,
    records,
    diagnostics: records.flatMap((record) => record.diagnostics),
  };
}
