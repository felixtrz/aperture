import type {
  BatchCompatibilityKey,
  MeshTopology,
} from "@aperture-engine/render";
import {
  DEBUG_NORMAL_MESH_SHADER,
  DEBUG_NORMAL_SHADER_VARIANT,
  validateDebugNormalShaderMetadata,
} from "./debug-normal-shader.js";
import {
  createWebGpuRenderPipelineCacheKey,
  type WebGpuRenderPipelineCacheKeyInput,
  type WebGpuRenderPipelineCreateDescriptor,
} from "./pipeline-cache.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

export type DebugNormalPipelineDescriptorDiagnosticCode =
  | "debugNormalPipeline.missingShaderMetadata"
  | "debugNormalPipeline.missingColorFormat"
  | "debugNormalPipeline.unsupportedTopology"
  | "debugNormalPipeline.missingBatchKeyField"
  | "debugNormalPipeline.unsupportedShaderFamily"
  | "debugNormalPipeline.unsupportedFeature"
  | "debugNormalPipeline.missingVertexAttribute";

export interface DebugNormalPipelineDescriptorDiagnostic {
  readonly code: DebugNormalPipelineDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface DebugNormalPipelineDescriptorInput {
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly topology?: MeshTopology;
  readonly batchKey: BatchCompatibilityKey;
}

export interface DebugNormalPipelineDescriptorPlan {
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
  readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
  readonly cacheKey: string;
}

export interface DebugNormalPipelineDescriptorResult {
  readonly valid: boolean;
  readonly plan: DebugNormalPipelineDescriptorPlan | null;
  readonly diagnostics: readonly DebugNormalPipelineDescriptorDiagnostic[];
}

interface DebugNormalPipelineTokens {
  readonly family: string | null;
  readonly features: readonly string[];
  readonly alphaMode: string | null;
  readonly cullMode: string | null;
  readonly depthCompare: string | null;
  readonly blendPreset: string | null;
}

export function createDebugNormalPipelineDescriptorPlan(
  input: DebugNormalPipelineDescriptorInput,
): DebugNormalPipelineDescriptorResult {
  const diagnostics: DebugNormalPipelineDescriptorDiagnostic[] = [];
  const batchKey = input.batchKey as Partial<BatchCompatibilityKey> | null;
  const shader = input.shader ?? DEBUG_NORMAL_MESH_SHADER;
  const metadata = validateDebugNormalShaderMetadata(shader);
  const topology = input.topology ?? batchKey?.topology;
  const tokens = parsePipelineTokens(batchKey?.pipelineKey);

  for (const diagnostic of metadata.diagnostics) {
    diagnostics.push({
      code: "debugNormalPipeline.missingShaderMetadata",
      message: diagnostic.message,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    });
  }

  if (input.colorFormat.trim().length === 0) {
    diagnostics.push({
      code: "debugNormalPipeline.missingColorFormat",
      field: "colorFormat",
      message:
        "DebugNormalMaterial pipeline descriptor planning requires a color format.",
    });
  }

  if (topology !== "triangle-list") {
    diagnostics.push({
      code: "debugNormalPipeline.unsupportedTopology",
      field: "topology",
      message: `DebugNormalMaterial pipeline supports triangle-list topology, not '${String(topology)}'.`,
    });
  }

  validateBatchKey(batchKey, diagnostics);
  validateDebugNormalPipelineTokens(tokens, diagnostics);
  validateDebugNormalVertexLayout(batchKey, diagnostics);

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
    shaderFamily: "debug-normal",
    shaderVariantKey: DEBUG_NORMAL_SHADER_VARIANT,
    colorFormats: [input.colorFormat],
    depthFormat: input.depthFormat ?? null,
    stencilFormat: null,
    topology: resolvedTopology,
    vertexLayoutKey: batchKey.meshLayoutKey,
    bindGroupLayoutKeys: debugNormalBindGroupLayoutKeys(),
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
      buffers: ["POSITION", "NORMAL"],
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

function debugNormalBindGroupLayoutKeys(): readonly string[] {
  return [
    "debug-normal/group-0:view-uniform@0",
    "debug-normal/group-1:world-transforms@0",
    "debug-normal/group-2:material@0",
  ];
}

function validateDebugNormalPipelineTokens(
  tokens: DebugNormalPipelineTokens,
  diagnostics: DebugNormalPipelineDescriptorDiagnostic[],
): void {
  if (tokens.family !== null && tokens.family !== "debug-normal") {
    diagnostics.push({
      code: "debugNormalPipeline.unsupportedShaderFamily",
      field: "batchKey.pipelineKey",
      message: `DebugNormalMaterial pipeline descriptor planning requires a 'debug-normal' material pipeline key, not '${tokens.family}'.`,
    });
  }

  for (const feature of tokens.features) {
    diagnostics.push({
      code: "debugNormalPipeline.unsupportedFeature",
      field: `batchKey.pipelineKey.${feature}`,
      message: `DebugNormalMaterial pipeline does not support feature '${feature}'.`,
    });
  }
}

function validateDebugNormalVertexLayout(
  batchKey: Partial<BatchCompatibilityKey> | null,
  diagnostics: DebugNormalPipelineDescriptorDiagnostic[],
): void {
  const layout = batchKey?.meshLayoutKey;

  if (typeof layout !== "string" || layout.trim().length === 0) {
    return;
  }

  const attributes = new Set(layout.split(",").filter((part) => part !== ""));

  for (const semantic of ["POSITION", "NORMAL"] as const) {
    if (!attributes.has(semantic)) {
      diagnostics.push({
        code: "debugNormalPipeline.missingVertexAttribute",
        field: `batchKey.meshLayoutKey.${semantic}`,
        message: `DebugNormalMaterial pipeline requires '${semantic}' vertex attribute data.`,
      });
    }
  }
}

function parsePipelineTokens(
  pipelineKey: string | undefined,
): DebugNormalPipelineTokens {
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

function validateBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
  diagnostics: DebugNormalPipelineDescriptorDiagnostic[],
): void {
  if (batchKey === null) {
    diagnostics.push({
      code: "debugNormalPipeline.missingBatchKeyField",
      field: "batchKey",
      message:
        "DebugNormalMaterial pipeline descriptor planning requires a batch key.",
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
        code: "debugNormalPipeline.missingBatchKeyField",
        field: `batchKey.${field}`,
        message: `DebugNormalMaterial pipeline descriptor planning requires batchKey.${field}.`,
      });
    }
  }

  if (batchKey.topology === undefined) {
    diagnostics.push({
      code: "debugNormalPipeline.missingBatchKeyField",
      field: "batchKey.topology",
      message:
        "DebugNormalMaterial pipeline descriptor planning requires batchKey.topology.",
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
