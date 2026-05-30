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
    readonly label: "shadow-caster-depth-only" | "shadow-caster-alpha-test";
    readonly entryPoints: {
      readonly vertex: "vs_main";
      readonly fragment: "fs_main";
    };
  };
  readonly vertex: {
    readonly buffers: readonly ("POSITION" | "TEXCOORD_0")[];
    readonly meshLayoutKey: string | null;
    readonly matrixBufferLayoutKey: "shadow-caster/group-0:directional-shadow-matrices@0";
  };
  /**
   * Alpha-test caster metadata (M4-T8). Present only on the alpha-test pipeline
   * variant: a second bind group binds the material baseColor texture + sampler
   * + alpha cutoff so the fragment can discard cutout fragments. Absent on the
   * opaque (position-only, empty-fragment) variant.
   */
  readonly alphaTest?: {
    readonly alphaCutoff: number;
    readonly baseColorTextureKey: string;
    readonly baseColorSamplerKey: string;
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
    /** Constant depth bias in depth-buffer units (M4-T5). */
    readonly depthBias: number;
    /** Slope-scaled depth bias factor (M4-T5). */
    readonly depthBiasSlopeScale: number;
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
  /** Authored constant depth bias for the caster pipeline (M4-T5). */
  readonly depthBias?: number;
  /** Authored slope-scaled depth bias for the caster pipeline (M4-T5). */
  readonly slopeBias?: number;
  /**
   * Alpha-tested casters (M4-T8): each entry produces an additional alpha-test
   * pipeline variant (TEXCOORD_0 + baseColor discard) distinct from the opaque
   * position-only variant. Deduplicated by (meshLayoutKey, cutoff, textures).
   */
  readonly alphaTestCasters?: readonly AlphaTestCasterDescriptorInput[];
}

export interface AlphaTestCasterDescriptorInput {
  readonly meshLayoutKey: string | null;
  readonly alphaCutoff: number;
  readonly baseColorTextureKey: string;
  readonly baseColorSamplerKey: string;
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
  const bias = {
    depthBias: Math.trunc(options.depthBias ?? 0),
    depthBiasSlopeScale: Math.max(0, options.slopeBias ?? 0),
  };
  const descriptors =
    hasBlockingDiagnostics || depthFormat !== "depth24plus"
      ? []
      : [
          ...collectMeshLayoutKeys(options).map((meshLayoutKey) =>
            createDescriptor(
              options.indexFormat ?? "uint32",
              meshLayoutKey,
              bias,
            ),
          ),
          ...dedupeAlphaTestCasters(options.alphaTestCasters ?? []).map(
            (alphaTest) =>
              createDescriptor(
                options.indexFormat ?? "uint32",
                alphaTest.meshLayoutKey,
                bias,
                alphaTest,
              ),
          ),
        ];
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
  bias: { readonly depthBias: number; readonly depthBiasSlopeScale: number },
  alphaTest?: AlphaTestCasterDescriptorInput,
): ShadowCasterPipelineDescriptorMetadata {
  const base = {
    index: {
      required: true as const,
      format: indexFormat,
    },
    primitive: {
      topology: "triangle-list" as const,
      cullMode: "none" as const,
      frontFace: "ccw" as const,
    },
    depthStencil: {
      format: "depth24plus" as const,
      depthWriteEnabled: true as const,
      depthCompare: "less-equal" as const,
      depthBias: bias.depthBias,
      depthBiasSlopeScale: bias.depthBiasSlopeScale,
    },
    colorTargets: [] as const,
  };

  if (alphaTest !== undefined) {
    return {
      ...base,
      pipelineKey: shadowCasterAlphaTestPipelineKey(meshLayoutKey, alphaTest),
      label: shadowCasterAlphaTestPipelineLabel(meshLayoutKey),
      shader: {
        family: "shadow-caster",
        label: "shadow-caster-alpha-test",
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      },
      vertex: {
        buffers: ["POSITION", "TEXCOORD_0"],
        meshLayoutKey,
        matrixBufferLayoutKey:
          "shadow-caster/group-0:directional-shadow-matrices@0",
      },
      alphaTest: {
        alphaCutoff: alphaTest.alphaCutoff,
        baseColorTextureKey: alphaTest.baseColorTextureKey,
        baseColorSamplerKey: alphaTest.baseColorSamplerKey,
      },
    };
  }

  return {
    ...base,
    pipelineKey: shadowCasterPipelineKeyForMeshLayoutKey(meshLayoutKey),
    label: shadowCasterPipelineLabelForMeshLayoutKey(meshLayoutKey),
    shader: {
      family: "shadow-caster",
      label: "shadow-caster-depth-only",
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    },
    vertex: {
      buffers: ["POSITION"],
      meshLayoutKey,
      matrixBufferLayoutKey:
        "shadow-caster/group-0:directional-shadow-matrices@0",
    },
  };
}

function dedupeAlphaTestCasters(
  casters: readonly AlphaTestCasterDescriptorInput[],
): readonly AlphaTestCasterDescriptorInput[] {
  const byKey = new Map<string, AlphaTestCasterDescriptorInput>();

  for (const caster of casters) {
    byKey.set(shadowCasterAlphaTestPipelineKey(caster.meshLayoutKey, caster), {
      ...caster,
    });
  }

  return [...byKey.values()];
}

function shadowCasterAlphaTestPipelineKey(
  meshLayoutKey: string | null,
  alphaTest: AlphaTestCasterDescriptorInput,
): string {
  const base = shadowCasterPipelineKeyForMeshLayoutKey(meshLayoutKey);
  const cutoff = Number.isFinite(alphaTest.alphaCutoff)
    ? alphaTest.alphaCutoff.toFixed(3)
    : "0.000";
  return `${base}/alpha-test:cutoff:${cutoff}:tex:${encodeURIComponent(
    alphaTest.baseColorTextureKey,
  )}`;
}

function shadowCasterAlphaTestPipelineLabel(
  meshLayoutKey: string | null,
): string {
  const base = shadowCasterPipelineLabelForMeshLayoutKey(meshLayoutKey).replace(
    "shadow-caster-depth-only",
    "shadow-caster-alpha-test",
  );
  return base;
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
