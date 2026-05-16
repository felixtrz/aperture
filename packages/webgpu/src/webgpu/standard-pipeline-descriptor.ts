import type {
  BatchCompatibilityKey,
  MeshTopology,
} from "@aperture-engine/render";
import {
  createWebGpuRenderPipelineCacheKey,
  type WebGpuRenderPipelineCacheKeyInput,
  type WebGpuRenderPipelineCreateDescriptor,
} from "./pipeline-cache.js";
import {
  STANDARD_DIRECT_LIGHT_SHADER_VARIANT,
  STANDARD_MESH_SHADER,
  validateStandardShaderMetadata,
} from "./standard-shader.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

export const STANDARD_DEFERRED_PIPELINE_FEATURES = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
] as const;

export type StandardDeferredPipelineFeature =
  (typeof STANDARD_DEFERRED_PIPELINE_FEATURES)[number];

export type StandardPipelineDescriptorDiagnosticCode =
  | "standardPipeline.missingShaderMetadata"
  | "standardPipeline.missingColorFormat"
  | "standardPipeline.unsupportedTopology"
  | "standardPipeline.missingBatchKeyField"
  | "standardPipeline.unsupportedShaderFamily"
  | "standardPipeline.deferredFeature";

export interface StandardPipelineDescriptorDiagnostic {
  readonly code: StandardPipelineDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface StandardPipelineDescriptorInput {
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly topology?: MeshTopology;
  readonly batchKey: BatchCompatibilityKey;
}

export interface StandardPipelineDescriptorPlan {
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
  readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
  readonly cacheKey: string;
}

export interface StandardPipelineDescriptorResult {
  readonly valid: boolean;
  readonly plan: StandardPipelineDescriptorPlan | null;
  readonly diagnostics: readonly StandardPipelineDescriptorDiagnostic[];
}

interface StandardPipelineTokens {
  readonly family: string | null;
  readonly features: readonly string[];
  readonly alphaMode: string | null;
  readonly cullMode: string | null;
  readonly depthCompare: string | null;
  readonly blendPreset: string | null;
}

export function createStandardPipelineDescriptorPlan(
  input: StandardPipelineDescriptorInput,
): StandardPipelineDescriptorResult {
  const diagnostics: StandardPipelineDescriptorDiagnostic[] = [];
  const batchKey = input.batchKey as Partial<BatchCompatibilityKey> | null;
  const shader = input.shader ?? STANDARD_MESH_SHADER;
  const metadata = validateStandardShaderMetadata(shader);
  const topology = input.topology ?? batchKey?.topology;
  const tokens = parsePipelineTokens(batchKey?.pipelineKey);

  for (const diagnostic of metadata.diagnostics) {
    diagnostics.push({
      code: "standardPipeline.missingShaderMetadata",
      message: diagnostic.message,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    });
  }

  if (input.colorFormat.trim().length === 0) {
    diagnostics.push({
      code: "standardPipeline.missingColorFormat",
      field: "colorFormat",
      message: "Standard pipeline descriptor planning requires a color format.",
    });
  }

  if (topology !== "triangle-list") {
    diagnostics.push({
      code: "standardPipeline.unsupportedTopology",
      field: "topology",
      message: `StandardMaterial MVP pipeline supports triangle-list topology, not '${String(topology)}'.`,
    });
  }

  validateBatchKey(batchKey, diagnostics);
  validateStandardPipelineTokens(tokens, diagnostics);

  if (diagnostics.length > 0 || !isCompleteBatchKey(batchKey)) {
    return { valid: false, plan: null, diagnostics };
  }

  const resolvedTopology = topology ?? batchKey.topology;
  const depthStencil =
    input.depthFormat === undefined || input.depthFormat === null
      ? {
          format: null,
          depthWriteEnabled: false,
          depthCompare: "always",
        }
      : {
          format: input.depthFormat,
          depthWriteEnabled: true,
          depthCompare: tokens.depthCompare ?? "less",
        };
  const keyInput: WebGpuRenderPipelineCacheKeyInput = {
    shaderLabel: shader.label,
    shaderFamily: "standard",
    shaderVariantKey: STANDARD_DIRECT_LIGHT_SHADER_VARIANT,
    colorFormats: [input.colorFormat],
    depthFormat: input.depthFormat ?? null,
    stencilFormat: null,
    topology: resolvedTopology,
    vertexLayoutKey: batchKey.meshLayoutKey,
    bindGroupLayoutKeys: standardBindGroupLayoutKeys(),
    primitive: {
      topology: resolvedTopology,
      cullMode: tokens.cullMode ?? "back",
      frontFace: "ccw",
      stripIndexFormat: null,
    },
    depthStencil,
    blend: {
      alphaToCoverageEnabled: false,
      colorTargets: [
        {
          format: input.colorFormat,
          blend: tokens.blendPreset === "none" ? null : tokens.blendPreset,
          writeMask: "all",
        },
      ],
    },
    materialPipelineKey: batchKey.pipelineKey,
    materialVariantKey: batchKey.materialKey,
    batchKey,
  };
  const cacheKey = createWebGpuRenderPipelineCacheKey(keyInput);
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
    label: `${shader.label}:${input.colorFormat}:${resolvedTopology}`,
    layout: "auto",
    vertex: {
      moduleLabel: shader.label,
      entryPoint: shader.entryPoints.vertex,
      buffers: ["POSITION", "NORMAL", "TEXCOORD_0"],
    },
    fragment: {
      moduleLabel: shader.label,
      entryPoint: shader.entryPoints.fragment,
      targets: [{ format: input.colorFormat }],
    },
    primitive: {
      topology: resolvedTopology,
      cullMode: tokens.cullMode ?? "back",
      frontFace: "ccw",
    },
  };

  if (input.depthFormat !== undefined && input.depthFormat !== null) {
    return {
      valid: true,
      plan: {
        cacheKey,
        keyInput,
        descriptor: {
          ...descriptor,
          depthStencil: {
            format: input.depthFormat,
            depthWriteEnabled: true,
            depthCompare: tokens.depthCompare ?? "less",
          },
        },
      },
      diagnostics,
    };
  }

  return { valid: true, plan: { descriptor, keyInput, cacheKey }, diagnostics };
}

function standardBindGroupLayoutKeys(): readonly string[] {
  return [
    "standard/group-0:view-uniform@0",
    "standard/group-1:world-transforms@0",
    "standard/group-2:material@0",
    "lights/group-3:light-floats@0,light-metadata@1",
  ];
}

function validateStandardPipelineTokens(
  tokens: StandardPipelineTokens,
  diagnostics: StandardPipelineDescriptorDiagnostic[],
): void {
  if (tokens.family !== null && tokens.family !== "standard") {
    diagnostics.push({
      code: "standardPipeline.unsupportedShaderFamily",
      field: "batchKey.pipelineKey",
      message: `Standard pipeline descriptor planning requires a 'standard' material pipeline key, not '${tokens.family}'.`,
    });
  }

  for (const feature of tokens.features) {
    if (isDeferredPipelineFeature(feature)) {
      diagnostics.push({
        code: "standardPipeline.deferredFeature",
        field: `batchKey.pipelineKey.${feature}`,
        message: `${feature} is deferred for the direct-lit StandardMaterial MVP pipeline.`,
      });
    }
  }
}

function parsePipelineTokens(
  pipelineKey: string | undefined,
): StandardPipelineTokens {
  if (pipelineKey === undefined || pipelineKey.trim().length === 0) {
    return {
      family: null,
      features: [],
      alphaMode: null,
      cullMode: null,
      depthCompare: null,
      blendPreset: null,
    };
  }

  const parts = pipelineKey.split("|");
  const renderStateStart = Math.max(1, parts.length - 4);

  return {
    family: parts[0] ?? null,
    features: parts.slice(1, renderStateStart),
    alphaMode: parts[renderStateStart] ?? null,
    cullMode: parts[renderStateStart + 1] ?? null,
    depthCompare: parts[renderStateStart + 2] ?? null,
    blendPreset: parts[renderStateStart + 3] ?? null,
  };
}

function isDeferredPipelineFeature(
  feature: string,
): feature is StandardDeferredPipelineFeature {
  return STANDARD_DEFERRED_PIPELINE_FEATURES.includes(
    feature as StandardDeferredPipelineFeature,
  );
}

function validateBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
  diagnostics: StandardPipelineDescriptorDiagnostic[],
): void {
  if (batchKey === null) {
    diagnostics.push({
      code: "standardPipeline.missingBatchKeyField",
      field: "batchKey",
      message: "Standard pipeline descriptor planning requires a batch key.",
    });
    return;
  }

  for (const field of [
    "pipelineKey",
    "materialKey",
    "meshLayoutKey",
  ] satisfies readonly (keyof BatchCompatibilityKey)[]) {
    const value = batchKey[field];

    if (typeof value !== "string" || value.trim().length === 0) {
      diagnostics.push({
        code: "standardPipeline.missingBatchKeyField",
        field: `batchKey.${field}`,
        message: `Standard pipeline descriptor planning requires batchKey.${field}.`,
      });
    }
  }

  if (batchKey.topology === undefined) {
    diagnostics.push({
      code: "standardPipeline.missingBatchKeyField",
      field: "batchKey.topology",
      message:
        "Standard pipeline descriptor planning requires batchKey.topology.",
    });
  }
}

function isCompleteBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
): batchKey is BatchCompatibilityKey {
  return (
    batchKey !== null &&
    typeof batchKey.pipelineKey === "string" &&
    batchKey.pipelineKey.trim().length > 0 &&
    typeof batchKey.materialKey === "string" &&
    batchKey.materialKey.trim().length > 0 &&
    typeof batchKey.meshLayoutKey === "string" &&
    batchKey.meshLayoutKey.trim().length > 0 &&
    batchKey.topology !== undefined &&
    typeof batchKey.instanced === "boolean" &&
    typeof batchKey.skinned === "boolean" &&
    typeof batchKey.morphed === "boolean"
  );
}
