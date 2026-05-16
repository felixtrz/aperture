import type {
  BatchCompatibilityKey,
  MeshTopology,
} from "@aperture-engine/render";
import {
  MATCAP_MATERIAL_SHADER_VARIANT,
  MATCAP_MESH_SHADER,
  validateMatcapShaderMetadata,
} from "./matcap-shader.js";
import {
  createWebGpuRenderPipelineCacheKey,
  type WebGpuRenderPipelineCacheKeyInput,
  type WebGpuRenderPipelineCreateDescriptor,
} from "./pipeline-cache.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

export type MatcapPipelineDescriptorDiagnosticCode =
  | "matcapPipeline.missingShaderMetadata"
  | "matcapPipeline.missingColorFormat"
  | "matcapPipeline.unsupportedTopology"
  | "matcapPipeline.missingBatchKeyField"
  | "matcapPipeline.unsupportedShaderFamily";

export interface MatcapPipelineDescriptorDiagnostic {
  readonly code: MatcapPipelineDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface MatcapPipelineDescriptorInput {
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly topology?: MeshTopology;
  readonly batchKey: BatchCompatibilityKey;
}

export interface MatcapPipelineDescriptorPlan {
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
  readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
  readonly cacheKey: string;
}

export interface MatcapPipelineDescriptorResult {
  readonly valid: boolean;
  readonly plan: MatcapPipelineDescriptorPlan | null;
  readonly diagnostics: readonly MatcapPipelineDescriptorDiagnostic[];
}

interface MatcapPipelineTokens {
  readonly family: string | null;
  readonly features: readonly string[];
  readonly alphaMode: string | null;
  readonly cullMode: string | null;
  readonly depthCompare: string | null;
  readonly blendPreset: string | null;
}

export function createMatcapPipelineDescriptorPlan(
  input: MatcapPipelineDescriptorInput,
): MatcapPipelineDescriptorResult {
  const diagnostics: MatcapPipelineDescriptorDiagnostic[] = [];
  const batchKey = input.batchKey as Partial<BatchCompatibilityKey> | null;
  const shader = input.shader ?? MATCAP_MESH_SHADER;
  const metadata = validateMatcapShaderMetadata(shader);
  const topology = input.topology ?? batchKey?.topology;
  const tokens = parsePipelineTokens(batchKey?.pipelineKey);

  for (const diagnostic of metadata.diagnostics) {
    diagnostics.push({
      code: "matcapPipeline.missingShaderMetadata",
      message: diagnostic.message,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    });
  }

  if (input.colorFormat.trim().length === 0) {
    diagnostics.push({
      code: "matcapPipeline.missingColorFormat",
      field: "colorFormat",
      message: "Matcap pipeline descriptor planning requires a color format.",
    });
  }

  if (topology !== "triangle-list") {
    diagnostics.push({
      code: "matcapPipeline.unsupportedTopology",
      field: "topology",
      message: `MatcapMaterial pipeline supports triangle-list topology, not '${String(topology)}'.`,
    });
  }

  validateBatchKey(batchKey, diagnostics);
  validateMatcapPipelineTokens(tokens, diagnostics);

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
    shaderFamily: "matcap",
    shaderVariantKey: MATCAP_MATERIAL_SHADER_VARIANT,
    colorFormats: [input.colorFormat],
    depthFormat: input.depthFormat ?? null,
    stencilFormat: null,
    topology: resolvedTopology,
    vertexLayoutKey: batchKey.meshLayoutKey,
    bindGroupLayoutKeys: matcapBindGroupLayoutKeys(),
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

function matcapBindGroupLayoutKeys(): readonly string[] {
  return [
    "matcap/group-0:view-uniform@0",
    "matcap/group-1:world-transforms@0",
    "matcap/group-2:material-texture-sampler@0,1,2",
  ];
}

function validateMatcapPipelineTokens(
  tokens: MatcapPipelineTokens,
  diagnostics: MatcapPipelineDescriptorDiagnostic[],
): void {
  if (tokens.family !== null && tokens.family !== "matcap") {
    diagnostics.push({
      code: "matcapPipeline.unsupportedShaderFamily",
      field: "batchKey.pipelineKey",
      message: `Matcap pipeline descriptor planning requires a 'matcap' material pipeline key, not '${tokens.family}'.`,
    });
  }
}

function parsePipelineTokens(
  pipelineKey: string | undefined,
): MatcapPipelineTokens {
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
  diagnostics: MatcapPipelineDescriptorDiagnostic[],
): void {
  if (batchKey === null) {
    diagnostics.push({
      code: "matcapPipeline.missingBatchKeyField",
      field: "batchKey",
      message: "Matcap pipeline descriptor planning requires a batch key.",
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
        code: "matcapPipeline.missingBatchKeyField",
        field: `batchKey.${field}`,
        message: `Matcap pipeline descriptor planning requires batchKey.${field}.`,
      });
    }
  }

  if (batchKey.topology === undefined) {
    diagnostics.push({
      code: "matcapPipeline.missingBatchKeyField",
      field: "batchKey.topology",
      message:
        "Matcap pipeline descriptor planning requires batchKey.topology.",
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
