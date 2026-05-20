import type { MeshTopology } from "@aperture-engine/render";
import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  UNLIT_MESH_SHADER,
  UNLIT_TEXTURED_MESH_SHADER,
  UNLIT_VERTEX_COLOR_MESH_SHADER,
  validateBuiltInShaderMetadata,
  type BuiltInShaderSourceModule,
} from "./unlit-shader.js";
import {
  createWebGpuRenderPipelineCacheKey,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuRenderPipelineCacheKeyInput,
} from "./pipeline-cache.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuColorTargetStateKey,
  createWebGpuDepthStencilDescriptor,
  createWebGpuDepthStencilStateKey,
  resolveWebGpuPipelineRenderState,
} from "./material-render-state.js";

export const UNLIT_BASE_COLOR_TEXTURE_FEATURE = "baseColorTexture";
export const UNLIT_VERTEX_COLOR_FEATURE = "vertexColor";

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
  const renderState = resolveWebGpuPipelineRenderState(
    batchKey.pipelineKey,
    input.depthFormat,
  );
  const depthStencil = createWebGpuDepthStencilStateKey(
    input.depthFormat,
    renderState,
  );
  const colorTarget = createWebGpuColorTargetDescriptor(
    input.colorFormat,
    renderState,
  );
  const keyInput: WebGpuRenderPipelineCacheKeyInput = {
    shaderLabel: shader.label,
    shaderFamily: "unlit",
    shaderVariantKey: unlitShaderVariantKey(batchKey),
    colorFormats: [input.colorFormat],
    depthFormat: input.depthFormat ?? null,
    stencilFormat: null,
    topology: resolvedTopology,
    vertexLayoutKey: batchKey.meshLayoutKey,
    bindGroupLayoutKeys: unlitBindGroupLayoutKeys(batchKey),
    primitive: {
      topology: resolvedTopology,
      cullMode: renderState.cullMode,
      frontFace: "ccw",
      stripIndexFormat: null,
    },
    depthStencil,
    blend: {
      alphaToCoverageEnabled: false,
      colorTargets: [
        createWebGpuColorTargetStateKey(input.colorFormat, renderState),
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
      buffers: unlitVertexBufferSemantics(batchKey),
    },
    fragment: {
      moduleLabel: shader.label,
      entryPoint: shader.entryPoints.fragment,
      targets: [colorTarget],
    },
    primitive: {
      topology: resolvedTopology,
      cullMode: renderState.cullMode,
      frontFace: "ccw",
    },
  };
  const depthStencilDescriptor = createWebGpuDepthStencilDescriptor(
    input.depthFormat,
    renderState,
  );

  if (depthStencilDescriptor !== null) {
    return {
      valid: true,
      plan: {
        cacheKey,
        keyInput,
        descriptor: {
          ...descriptor,
          depthStencil: depthStencilDescriptor,
        },
      },
      diagnostics,
    };
  }

  return { valid: true, plan: { descriptor, keyInput, cacheKey }, diagnostics };
}

function unlitBindGroupLayoutKeys(
  batchKey: BatchCompatibilityKey,
): readonly string[] {
  return [
    "unlit/group-0:view-uniform@0",
    "unlit/group-1:world-transforms@0",
    hasBaseColorTextureFeature(batchKey)
      ? "unlit/group-2:material-textured@0,1,2"
      : "unlit/group-2:material@0",
  ];
}

export function resolveUnlitShaderForBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
  shader?: BuiltInShaderSourceModule,
): BuiltInShaderSourceModule {
  if (shader !== undefined) {
    return shader;
  }

  if (hasBaseColorTextureFeature(batchKey)) {
    return UNLIT_TEXTURED_MESH_SHADER;
  }

  if (hasUnlitVertexColorFeature(batchKey)) {
    return UNLIT_VERTEX_COLOR_MESH_SHADER;
  }

  return UNLIT_MESH_SHADER;
}

export function hasUnlitVertexColorFeature(
  batchKey: Partial<BatchCompatibilityKey> | null,
): boolean {
  return (
    typeof batchKey?.meshLayoutKey === "string" &&
    batchKey.meshLayoutKey.split(",").includes("COLOR_0")
  );
}

function unlitShaderVariantKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
): string {
  if (hasBaseColorTextureFeature(batchKey)) {
    return UNLIT_BASE_COLOR_TEXTURE_FEATURE;
  }

  return hasUnlitVertexColorFeature(batchKey)
    ? UNLIT_VERTEX_COLOR_FEATURE
    : "baseColorFactor";
}

function unlitVertexBufferSemantics(
  batchKey: Partial<BatchCompatibilityKey> | null,
): readonly string[] {
  return hasUnlitVertexColorFeature(batchKey)
    ? ["POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0"]
    : ["POSITION", "NORMAL", "TEXCOORD_0"];
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
