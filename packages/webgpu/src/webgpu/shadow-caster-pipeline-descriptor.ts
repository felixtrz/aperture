import type { MeshIndexFormat, MeshTopology } from "@aperture-engine/render";

import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
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
      readonly fragment: "fs_main";
    };
  };
  readonly vertex: {
    readonly buffers: readonly ["POSITION"];
    readonly meshLayoutKey: string | null;
    readonly matrixBufferLayoutKey: "shadow-caster/group-0:directional-shadow-matrices@0";
  };
  readonly index: {
    readonly required: true;
    readonly format: MeshIndexFormat;
  };
  readonly primitive: {
    readonly topology: "triangle-list";
    readonly cullMode: "none";
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
  readonly descriptors: readonly ShadowCasterPipelineDescriptorMetadata[];
  readonly diagnostics: readonly ShadowCasterPipelineDescriptorDiagnostic[];
}

export type ShadowCasterPipelineDescriptorReportJsonValue =
  ShadowCasterPipelineDescriptorReport;

export interface CreateShadowCasterPipelineDescriptorReportOptions {
  readonly commandEncoding: ShadowPassCommandEncodingReport;
  readonly casterDrawList?: ShadowCasterDrawListPlanReport;
  readonly meshLayoutKeys?: readonly string[];
  readonly topology?: MeshTopology;
  readonly depthFormat?: "depth24plus" | "";
  readonly indexFormat?: MeshIndexFormat;
}

const SHADOW_CASTER_DEPTH_ONLY_PIPELINE_KEY =
  "shadow-caster/depth-only/depth24plus/triangle-list/none";

export function createShadowCasterPipelineDescriptorReport(
  options: CreateShadowCasterPipelineDescriptorReportOptions,
): ShadowCasterPipelineDescriptorReport {
  if (options.commandEncoding.status === "not-required") {
    return report({
      status: "not-required",
      commandRecordCount: 0,
      descriptor: null,
      descriptors: [],
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
  const descriptors =
    hasBlockingDiagnostics || depthFormat !== "depth24plus"
      ? []
      : collectMeshLayoutKeys(options).map((meshLayoutKey) =>
          createDescriptor(options.indexFormat ?? "uint32", meshLayoutKey),
        );
  const status = determineStatus(
    options.commandEncoding.status,
    hasBlockingDiagnostics,
  );

  return report({
    status,
    commandRecordCount: options.commandEncoding.records.length,
    descriptor: descriptors[0] ?? null,
    descriptors,
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
    descriptor: descriptorToJsonValue(value.descriptor),
    descriptors: value.descriptors.map(descriptorMetadataToJsonValue),
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
  meshLayoutKey: string | null,
): ShadowCasterPipelineDescriptorMetadata {
  return {
    pipelineKey: shadowCasterPipelineKeyForMeshLayoutKey(meshLayoutKey),
    label: shadowCasterPipelineLabelForMeshLayoutKey(meshLayoutKey),
    shader: {
      family: "shadow-caster",
      label: "shadow-caster-depth-only",
      entryPoints: {
        vertex: "vs_main",
        fragment: "fs_main",
      },
    },
    vertex: {
      buffers: ["POSITION"],
      meshLayoutKey,
      matrixBufferLayoutKey:
        "shadow-caster/group-0:directional-shadow-matrices@0",
    },
    index: {
      required: true,
      format: indexFormat,
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
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

export function shadowCasterPipelineKeyForMeshLayoutKey(
  meshLayoutKey?: string | null,
): string {
  const normalized = normalizeMeshLayoutKey(meshLayoutKey);

  return normalized === null
    ? SHADOW_CASTER_DEPTH_ONLY_PIPELINE_KEY
    : `${SHADOW_CASTER_DEPTH_ONLY_PIPELINE_KEY}/mesh-layout:${encodeURIComponent(normalized)}`;
}

function shadowCasterPipelineLabelForMeshLayoutKey(
  meshLayoutKey: string | null,
): string {
  const normalized = normalizeMeshLayoutKey(meshLayoutKey);

  return normalized === null
    ? "shadow-caster-depth-only:depth24plus:triangle-list"
    : `shadow-caster-depth-only:depth24plus:triangle-list:${normalized}`;
}

function collectMeshLayoutKeys(
  options: CreateShadowCasterPipelineDescriptorReportOptions,
): readonly (string | null)[] {
  const sourceKeys =
    options.meshLayoutKeys ??
    options.casterDrawList?.lists.flatMap((list) =>
      list.draws.map((draw) => draw.meshLayoutKey),
    ) ??
    [];
  const normalizedKeys = unique(
    sourceKeys.flatMap((key) => {
      const normalized = normalizeMeshLayoutKey(key);

      return normalized === null ? [] : [normalized];
    }),
  );

  return normalizedKeys.length > 0 ? normalizedKeys : [null];
}

function normalizeMeshLayoutKey(meshLayoutKey?: string | null): string | null {
  if (meshLayoutKey === undefined || meshLayoutKey === null) {
    return null;
  }

  const trimmed = meshLayoutKey.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function descriptorToJsonValue(
  descriptor: ShadowCasterPipelineDescriptorMetadata | null,
): ShadowCasterPipelineDescriptorMetadata | null {
  return descriptor === null ? null : descriptorMetadataToJsonValue(descriptor);
}

function descriptorMetadataToJsonValue(
  descriptor: ShadowCasterPipelineDescriptorMetadata,
): ShadowCasterPipelineDescriptorMetadata {
  return {
    pipelineKey: descriptor.pipelineKey,
    label: descriptor.label,
    shader: {
      family: descriptor.shader.family,
      label: descriptor.shader.label,
      entryPoints: { ...descriptor.shader.entryPoints },
    },
    vertex: {
      buffers: [...descriptor.vertex.buffers] as ["POSITION"],
      meshLayoutKey: descriptor.vertex.meshLayoutKey,
      matrixBufferLayoutKey: descriptor.vertex.matrixBufferLayoutKey,
    },
    index: { ...descriptor.index },
    primitive: { ...descriptor.primitive },
    depthStencil: { ...descriptor.depthStencil },
    colorTargets: [],
  };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
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
  readonly descriptors: readonly ShadowCasterPipelineDescriptorMetadata[];
  readonly diagnostics: readonly ShadowCasterPipelineDescriptorDiagnostic[];
}): ShadowCasterPipelineDescriptorReport {
  const descriptorAvailable = input.descriptors.length > 0;

  return {
    ready: input.status === "ready" || input.status === "not-required",
    status: input.status,
    commandRecordCount: input.commandRecordCount,
    descriptorCount: input.descriptors.length,
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
    descriptors: input.descriptors,
    diagnostics: input.diagnostics,
  };
}
