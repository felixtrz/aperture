import type { MeshTopology } from "@aperture-engine/render";
import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  UNLIT_MESH_SHADER,
  UNLIT_TEXTURED_MESH_SHADER,
  validateBuiltInShaderMetadata,
  type BuiltInShaderSourceModule,
} from "./unlit-shader.js";
import {
  createWebGpuRenderPipelineCacheKey,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuRenderPipelineCacheKeyInput,
} from "./pipeline-cache.js";

export const UNLIT_BASE_COLOR_TEXTURE_FEATURE = "baseColorTexture";

export type UnlitPipelineDescriptorDiagnosticCode =
  | "unlitPipeline.missingShaderMetadata"
  | "unlitPipeline.missingColorFormat"
  | "unlitPipeline.unsupportedTopology"
  | "unlitPipeline.missingBatchKeyField";

export interface UnlitPipelineDescriptorDiagnostic {
  readonly code: UnlitPipelineDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface UnlitPipelineDescriptorInput {
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly topology?: MeshTopology;
  readonly batchKey: BatchCompatibilityKey;
}

export interface UnlitPipelineDescriptorPlan {
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
  readonly keyInput: WebGpuRenderPipelineCacheKeyInput;
  readonly cacheKey: string;
}

export interface UnlitPipelineDescriptorResult {
  readonly valid: boolean;
  readonly plan: UnlitPipelineDescriptorPlan | null;
  readonly diagnostics: readonly UnlitPipelineDescriptorDiagnostic[];
}

export function createUnlitPipelineDescriptorPlan(
  input: UnlitPipelineDescriptorInput,
): UnlitPipelineDescriptorResult {
  const diagnostics: UnlitPipelineDescriptorDiagnostic[] = [];
  const batchKey = input.batchKey as Partial<BatchCompatibilityKey> | null;
  const shader = resolveUnlitShaderForBatchKey(batchKey, input.shader);
  const metadata = validateBuiltInShaderMetadata(shader);
  const topology = input.topology ?? batchKey?.topology;

  for (const diagnostic of metadata.diagnostics) {
    diagnostics.push({
      code: "unlitPipeline.missingShaderMetadata",
      message: diagnostic.message,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    });
  }

  if (input.colorFormat.trim().length === 0) {
    diagnostics.push({
      code: "unlitPipeline.missingColorFormat",
      field: "colorFormat",
      message: "Unlit pipeline descriptor planning requires a color format.",
    });
  }

  if (topology !== "triangle-list") {
    diagnostics.push({
      code: "unlitPipeline.unsupportedTopology",
      field: "topology",
      message: `Unlit MVP pipeline supports triangle-list topology, not '${String(topology)}'.`,
    });
  }

  validateBatchKey(batchKey, diagnostics);

  if (diagnostics.length > 0 || !isCompleteBatchKey(batchKey)) {
    return { valid: false, plan: null, diagnostics };
  }

  const resolvedTopology = topology ?? batchKey.topology;
  const keyInput: WebGpuRenderPipelineCacheKeyInput = {
    shaderLabel: shader.label,
    colorFormats: [input.colorFormat],
    depthFormat: input.depthFormat ?? null,
    topology: resolvedTopology,
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
    primitive: { topology: resolvedTopology },
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
            depthCompare: "less",
          },
        },
      },
      diagnostics,
    };
  }

  return { valid: true, plan: { descriptor, keyInput, cacheKey }, diagnostics };
}

export function resolveUnlitShaderForBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
  shader?: BuiltInShaderSourceModule,
): BuiltInShaderSourceModule {
  if (shader !== undefined) {
    return shader;
  }

  return hasBaseColorTextureFeature(batchKey)
    ? UNLIT_TEXTURED_MESH_SHADER
    : UNLIT_MESH_SHADER;
}

function hasBaseColorTextureFeature(
  batchKey: Partial<BatchCompatibilityKey> | null,
): boolean {
  return (
    typeof batchKey?.pipelineKey === "string" &&
    batchKey.pipelineKey.split("|").includes(UNLIT_BASE_COLOR_TEXTURE_FEATURE)
  );
}

function validateBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
  diagnostics: UnlitPipelineDescriptorDiagnostic[],
): void {
  if (batchKey === null) {
    diagnostics.push({
      code: "unlitPipeline.missingBatchKeyField",
      field: "batchKey",
      message: "Unlit pipeline descriptor planning requires a batch key.",
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
        code: "unlitPipeline.missingBatchKeyField",
        field: `batchKey.${field}`,
        message: `Unlit pipeline descriptor planning requires batchKey.${field}.`,
      });
    }
  }

  if (batchKey.topology === undefined) {
    diagnostics.push({
      code: "unlitPipeline.missingBatchKeyField",
      field: "batchKey.topology",
      message: "Unlit pipeline descriptor planning requires batchKey.topology.",
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
