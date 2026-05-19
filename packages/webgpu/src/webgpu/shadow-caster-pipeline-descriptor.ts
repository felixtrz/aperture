import type { MeshIndexFormat, MeshTopology } from "@aperture-engine/render";

import type { ShadowPassCommandEncodingReport } from "./shadow-pass-command-encoding-report.js";

export type ShadowCasterPipelineDescriptorStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "not-required";

export type ShadowCasterPipelineDescriptorDiagnosticCode =
  | "shadowCasterPipelineDescriptor.missingCommandEncoding"
  | "shadowCasterPipelineDescriptor.missingDepthFormat"
  | "shadowCasterPipelineDescriptor.unsupportedTopology"
  | "shadowCasterPipelineDescriptor.commandEncodingDeferred"
  | "shadowCasterPipelineDescriptor.passSubmissionDeferred";

export interface ShadowCasterPipelineDescriptorDiagnostic {
  readonly code: ShadowCasterPipelineDescriptorDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly field?: string;
}

export interface ShadowCasterPipelineDescriptorMetadata {
  readonly pipelineKey: string;
  readonly label: string;
  readonly shader: {
    readonly family: "shadow-caster";
    readonly label: "shadow-caster-depth-only";
    readonly entryPoints: {
      readonly vertex: "vs_main";
      readonly fragment: null;
    };
  };
  readonly vertex: {
    readonly buffers: readonly ["POSITION"];
    readonly matrixBufferLayoutKey: "shadow-caster/group-0:directional-shadow-matrices@0";
  };
  readonly index: {
    readonly required: true;
    readonly format: MeshIndexFormat;
  };
  readonly primitive: {
    readonly topology: "triangle-list";
    readonly cullMode: "back";
    readonly frontFace: "ccw";
  };
  readonly depthStencil: {
    readonly format: "depth24plus";
    readonly depthWriteEnabled: true;
    readonly depthCompare: "less-equal";
  };
  readonly colorTargets: readonly [];
}

export interface ShadowCasterPipelineDescriptorReport {
  readonly ready: boolean;
  readonly status: ShadowCasterPipelineDescriptorStatus;
  readonly commandRecordCount: number;
  readonly descriptorCount: number;
  readonly sections: {
    readonly commandEncoding: boolean;
    readonly vertexBufferLayout: boolean;
    readonly indexBuffer: boolean;
    readonly matrixBufferLayout: boolean;
    readonly depthStencil: boolean;
    readonly colorTargets: true;
    readonly pipelineCreation: false;
    readonly passSubmission: false;
    readonly shaderSampling: false;
  };
  readonly descriptor: ShadowCasterPipelineDescriptorMetadata | null;
  readonly diagnostics: readonly ShadowCasterPipelineDescriptorDiagnostic[];
}

export type ShadowCasterPipelineDescriptorReportJsonValue =
  ShadowCasterPipelineDescriptorReport;

export interface CreateShadowCasterPipelineDescriptorReportOptions {
  readonly commandEncoding: ShadowPassCommandEncodingReport;
  readonly topology?: MeshTopology;
  readonly depthFormat?: "depth24plus" | "";
  readonly indexFormat?: MeshIndexFormat;
}

export function createShadowCasterPipelineDescriptorReport(
  options: CreateShadowCasterPipelineDescriptorReportOptions,
): ShadowCasterPipelineDescriptorReport {
  if (options.commandEncoding.status === "not-required") {
    return report({
      status: "not-required",
      commandRecordCount: 0,
      descriptor: null,
      diagnostics: [],
    });
  }

  const diagnostics: ShadowCasterPipelineDescriptorDiagnostic[] = [];
  const topology = options.topology ?? "triangle-list";
  const depthFormat = options.depthFormat ?? "depth24plus";

  if (options.commandEncoding.records.length === 0) {
    diagnostics.push({
      code: "shadowCasterPipelineDescriptor.missingCommandEncoding",
      severity: "warning",
      message:
        "Shadow caster pipeline descriptor metadata requires shadow pass command records.",
    });
  }

  if (depthFormat.length === 0) {
    diagnostics.push({
      code: "shadowCasterPipelineDescriptor.missingDepthFormat",
      severity: "warning",
      field: "depthFormat",
      message:
        "Shadow caster pipeline descriptor metadata requires a depth format.",
    });
  }

  if (topology !== "triangle-list") {
    diagnostics.push({
      code: "shadowCasterPipelineDescriptor.unsupportedTopology",
      severity: "warning",
      field: "topology",
      message: `Shadow caster pipeline descriptor metadata supports triangle-list topology, not '${String(topology)}'.`,
    });
  }

  if (options.commandEncoding.status === "deferred") {
    diagnostics.push({
      code: "shadowCasterPipelineDescriptor.commandEncodingDeferred",
      severity: "warning",
      message:
        "Shadow caster pipeline descriptor metadata is planned, but shadow pass command encoding is still deferred upstream.",
    });
  }

  if (options.commandEncoding.records.length > 0) {
    diagnostics.push({
      code: "shadowCasterPipelineDescriptor.passSubmissionDeferred",
      severity: "warning",
      message:
        "Shadow caster pipeline descriptor metadata is planned, but shadow pass submission is deferred.",
    });
  }

  const hasBlockingDiagnostics = diagnostics.some(
    (diagnostic) =>
      diagnostic.code ===
        "shadowCasterPipelineDescriptor.missingCommandEncoding" ||
      diagnostic.code === "shadowCasterPipelineDescriptor.missingDepthFormat" ||
      diagnostic.code === "shadowCasterPipelineDescriptor.unsupportedTopology",
  );
  const descriptor =
    hasBlockingDiagnostics || depthFormat !== "depth24plus"
      ? null
      : createDescriptor(options.indexFormat ?? "uint32");
  const status = determineStatus(
    options.commandEncoding.status,
    hasBlockingDiagnostics,
  );

  return report({
    status,
    commandRecordCount: options.commandEncoding.records.length,
    descriptor,
    diagnostics,
  });
}

export function shadowCasterPipelineDescriptorReportToJsonValue(
  value: ShadowCasterPipelineDescriptorReport,
): ShadowCasterPipelineDescriptorReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    commandRecordCount: value.commandRecordCount,
    descriptorCount: value.descriptorCount,
    sections: { ...value.sections },
    descriptor:
      value.descriptor === null
        ? null
        : {
            pipelineKey: value.descriptor.pipelineKey,
            label: value.descriptor.label,
            shader: {
              family: value.descriptor.shader.family,
              label: value.descriptor.shader.label,
              entryPoints: { ...value.descriptor.shader.entryPoints },
            },
            vertex: {
              buffers: [...value.descriptor.vertex.buffers] as ["POSITION"],
              matrixBufferLayoutKey:
                value.descriptor.vertex.matrixBufferLayoutKey,
            },
            index: { ...value.descriptor.index },
            primitive: { ...value.descriptor.primitive },
            depthStencil: { ...value.descriptor.depthStencil },
            colorTargets: [],
          },
    diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowCasterPipelineDescriptorReportToJson(
  value: ShadowCasterPipelineDescriptorReport,
): string {
  return JSON.stringify(shadowCasterPipelineDescriptorReportToJsonValue(value));
}

function createDescriptor(
  indexFormat: MeshIndexFormat,
): ShadowCasterPipelineDescriptorMetadata {
  return {
    pipelineKey: "shadow-caster/depth-only/depth24plus/triangle-list/back",
    label: "shadow-caster-depth-only:depth24plus:triangle-list",
    shader: {
      family: "shadow-caster",
      label: "shadow-caster-depth-only",
      entryPoints: {
        vertex: "vs_main",
        fragment: null,
      },
    },
    vertex: {
      buffers: ["POSITION"],
      matrixBufferLayoutKey:
        "shadow-caster/group-0:directional-shadow-matrices@0",
    },
    index: {
      required: true,
      format: indexFormat,
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
      frontFace: "ccw",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less-equal",
    },
    colorTargets: [],
  };
}

function determineStatus(
  commandEncodingStatus: ShadowPassCommandEncodingReport["status"],
  hasBlockingDiagnostics: boolean,
): ShadowCasterPipelineDescriptorStatus {
  if (hasBlockingDiagnostics || commandEncodingStatus === "missing") {
    return "missing";
  }

  if (commandEncodingStatus === "deferred") {
    return "deferred";
  }

  return "ready";
}

function report(input: {
  readonly status: ShadowCasterPipelineDescriptorStatus;
  readonly commandRecordCount: number;
  readonly descriptor: ShadowCasterPipelineDescriptorMetadata | null;
  readonly diagnostics: readonly ShadowCasterPipelineDescriptorDiagnostic[];
}): ShadowCasterPipelineDescriptorReport {
  const descriptorAvailable = input.descriptor !== null;

  return {
    ready: input.status === "ready" || input.status === "not-required",
    status: input.status,
    commandRecordCount: input.commandRecordCount,
    descriptorCount: descriptorAvailable ? 1 : 0,
    sections: {
      commandEncoding: input.commandRecordCount > 0,
      vertexBufferLayout: descriptorAvailable,
      indexBuffer: descriptorAvailable,
      matrixBufferLayout: descriptorAvailable,
      depthStencil: descriptorAvailable,
      colorTargets: true,
      pipelineCreation: false,
      passSubmission: false,
      shaderSampling: false,
    },
    descriptor: input.descriptor,
    diagnostics: input.diagnostics,
  };
}
