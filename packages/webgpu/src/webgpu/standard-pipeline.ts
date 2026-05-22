import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "./pipeline-cache.js";
import {
  createStandardPipelineDescriptorPlan,
  resolveStandardShaderForBatchKey,
  type StandardPipelineDescriptorDiagnostic,
} from "./standard-pipeline-descriptor.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "./material-render-state.js";
import {
  createStandardMeshShaderModuleDescriptor,
  STANDARD_MESH_SHADER,
} from "./standard-shader.js";
import {
  STANDARD_SKINNING_JOINTS_LOCATION,
  STANDARD_SKINNING_WEIGHTS_LOCATION,
} from "./standard-skinning-shader.js";
import {
  STANDARD_MORPH_TARGET_NORMAL_0_LOCATION,
  STANDARD_MORPH_TARGET_NORMAL_1_LOCATION,
  STANDARD_MORPH_TARGET_POSITION_0_LOCATION,
  STANDARD_MORPH_TARGET_POSITION_1_LOCATION,
} from "./standard-morph-target-shader.js";
import {
  applyOutputTonemapToStandardShader,
  DEFAULT_TONEMAP_OPERATOR,
  type TonemapOperator,
} from "./output-stage-tonemap.js";
import {
  DEFAULT_OUTPUT_COLOR_SPACE,
  type OutputColorSpace,
} from "./output-stage-color-space.js";
import { INSTANCE_TINT_VERTEX_BUFFER_LAYOUT } from "./instance-tint-buffer.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderDiagnostic,
  type WebGpuShaderFailureReason,
} from "./shader.js";
import {
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  vertexColorAttributeFormatFromBatchKey,
} from "./unlit-pipeline.js";
import type { BuiltInShaderSourceModule } from "./unlit-shader.js";

interface StandardVertexBufferAttributeLayout {
  readonly shaderLocation: number;
  readonly offset: number;
  readonly format: string;
}

export interface StandardPrimitiveVertexBufferLayout {
  readonly arrayStride: number;
  readonly stepMode: "vertex";
  readonly attributes: readonly StandardVertexBufferAttributeLayout[];
}

export type WebGpuSkinningJointAttributeFormat = "uint8x4" | "uint16x4";
export type WebGpuSkinningWeightAttributeFormat =
  | "float32x4"
  | "unorm8x4"
  | "unorm16x4";

export interface WebGpuSkinningAttributeFormats {
  readonly joints: WebGpuSkinningJointAttributeFormat;
  readonly weights: WebGpuSkinningWeightAttributeFormat;
}

interface StandardPrimitiveVertexFeatureNeeds {
  readonly needsTangents: boolean;
  readonly needsTexCoord1: boolean;
  readonly needsVertexColor: boolean;
  readonly needsSkinning: boolean;
  readonly needsMorphTargets: boolean;
}

interface ParsedStandardMeshLayout {
  readonly arrayStride: number;
  readonly attributes: ReadonlyMap<string, StandardVertexBufferAttributeLayout>;
}

export const STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 48,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 3, offset: 32, format: "float32x4" },
  ],
} as const;

export const STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 40,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 4, offset: 32, format: "float32x2" },
  ],
} as const;

export const STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 48,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "float32x4" },
  ],
} as const;

export const STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 44,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "float32x3" },
  ],
} as const;

export const STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 36,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "unorm8x4" },
  ],
} as const;

export const STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 40,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "unorm16x4" },
  ],
} as const;

export const STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 56,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    {
      shaderLocation: STANDARD_SKINNING_JOINTS_LOCATION,
      offset: 32,
      format: "uint16x4",
    },
    {
      shaderLocation: STANDARD_SKINNING_WEIGHTS_LOCATION,
      offset: 40,
      format: "float32x4",
    },
  ],
} as const;

export const STANDARD_MORPHED_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 80,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    {
      shaderLocation: STANDARD_MORPH_TARGET_POSITION_0_LOCATION,
      offset: 32,
      format: "float32x3",
    },
    {
      shaderLocation: STANDARD_MORPH_TARGET_NORMAL_0_LOCATION,
      offset: 44,
      format: "float32x3",
    },
    {
      shaderLocation: STANDARD_MORPH_TARGET_POSITION_1_LOCATION,
      offset: 56,
      format: "float32x3",
    },
    {
      shaderLocation: STANDARD_MORPH_TARGET_NORMAL_1_LOCATION,
      offset: 68,
      format: "float32x3",
    },
  ],
} as const;

export const STANDARD_SKINNED_MORPHED_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 104,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    {
      shaderLocation: STANDARD_SKINNING_JOINTS_LOCATION,
      offset: 32,
      format: "uint16x4",
    },
    {
      shaderLocation: STANDARD_SKINNING_WEIGHTS_LOCATION,
      offset: 40,
      format: "float32x4",
    },
    {
      shaderLocation: STANDARD_MORPH_TARGET_POSITION_0_LOCATION,
      offset: 56,
      format: "float32x3",
    },
    {
      shaderLocation: STANDARD_MORPH_TARGET_NORMAL_0_LOCATION,
      offset: 68,
      format: "float32x3",
    },
    {
      shaderLocation: STANDARD_MORPH_TARGET_POSITION_1_LOCATION,
      offset: 80,
      format: "float32x3",
    },
    {
      shaderLocation: STANDARD_MORPH_TARGET_NORMAL_1_LOCATION,
      offset: 92,
      format: "float32x3",
    },
  ],
} as const;

export const STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 56,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 3, offset: 32, format: "float32x4" },
    { shaderLocation: 4, offset: 48, format: "float32x2" },
  ],
} as const;

export type StandardRenderPipelineDiagnosticCode =
  | "standardRenderPipeline.shaderDiagnostic"
  | "standardRenderPipeline.shaderCreationFailed"
  | "standardRenderPipeline.descriptorPlanFailed"
  | "standardRenderPipeline.createRenderPipelineUnavailable"
  | "standardRenderPipeline.pipelineCreationFailed";

export interface StandardRenderPipelineDiagnostic {
  readonly code: StandardRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
  readonly field?: string;
}

export interface BrowserStandardRenderPipelineDescriptorInput {
  readonly shaderModule: unknown;
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly batchKey?: BatchCompatibilityKey;
}

export interface CreateStandardRenderPipelineResourceOptions {
  readonly device: StandardRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly depthFormat?: string | null;
  readonly batchKey: BatchCompatibilityKey;
  readonly shader?: BuiltInShaderSourceModule;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}

export interface StandardRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateStandardRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: StandardRenderPipelineResource | null;
  readonly diagnostics: readonly StandardRenderPipelineDiagnostic[];
}

export interface StandardRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createStandardRenderPipelineResource(
  options: CreateStandardRenderPipelineResourceOptions,
): Promise<CreateStandardRenderPipelineResourceResult> {
  const shader = applyOutputTonemapToStandardShader(
    resolveStandardShaderForBatchKey(options.batchKey, options.shader),
    options.tonemap ?? DEFAULT_TONEMAP_OPERATOR,
    options.outputColorSpace ?? DEFAULT_OUTPUT_COLOR_SPACE,
  );
  const descriptorPlan = createStandardPipelineDescriptorPlan({
    shader,
    colorFormat: options.colorFormat,
    batchKey: options.batchKey,
    ...(options.depthFormat === undefined
      ? {}
      : { depthFormat: options.depthFormat }),
  });

  if (!descriptorPlan.valid || descriptorPlan.plan === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: descriptorPlan.diagnostics.map(mapDescriptorDiagnostic),
    };
  }

  const shaderModule = await createWebGpuShaderModule({
    device: options.device,
    descriptor: createStandardMeshShaderModuleDescriptor(shader),
  });
  const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "standardRenderPipeline.shaderCreationFailed",
          reason: shaderModule.reason,
          message: shaderModule.message,
        },
      ],
    };
  }

  if (options.device.createRenderPipeline === undefined) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "standardRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create standard material pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserStandardRenderPipelineDescriptor({
    shader,
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
    batchKey: options.batchKey,
    ...(options.depthFormat === undefined
      ? {}
      : { depthFormat: options.depthFormat }),
  });

  try {
    return {
      valid: true,
      resource: {
        cacheKey: descriptorPlan.plan.cacheKey,
        shaderModule: shaderModule.module,
        pipeline: options.device.createRenderPipeline(descriptor),
        descriptor,
      },
      diagnostics: shaderDiagnostics,
    };
  } catch (error) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "standardRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU standard material render pipeline creation failed.",
        },
      ],
    };
  }
}

export function createBrowserStandardRenderPipelineDescriptor(
  input: BrowserStandardRenderPipelineDescriptorInput,
): WebGpuRenderPipelineCreateDescriptor {
  const shader = input.shader ?? STANDARD_MESH_SHADER;
  const renderState = resolveWebGpuPipelineRenderState(
    input.batchKey?.pipelineKey,
    input.depthFormat,
  );
  const colorTarget = createWebGpuColorTargetDescriptor(
    input.colorFormat,
    renderState,
  );
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
    label: `${shader.label}:${input.colorFormat}:triangle-list`,
    layout: "auto",
    vertex: {
      module: input.shaderModule,
      entryPoint: shader.entryPoints.vertex,
      buffers: standardVertexBufferLayouts(shader, input.batchKey),
    },
    fragment: {
      module: input.shaderModule,
      entryPoint: shader.entryPoints.fragment,
      targets: [colorTarget],
    },
    primitive: {
      topology: "triangle-list",
      frontFace: "ccw",
      cullMode: renderState.cullMode,
    },
  };
  const depthStencil = createWebGpuDepthStencilDescriptor(
    input.depthFormat,
    renderState,
  );

  if (depthStencil === null) {
    return descriptor;
  }

  return {
    ...descriptor,
    depthStencil,
  };
}

function standardPrimitiveVertexBufferLayout(
  shader: BuiltInShaderSourceModule,
  batchKey?: BatchCompatibilityKey,
): StandardPrimitiveVertexBufferLayout {
  const {
    needsTangents,
    needsTexCoord1,
    needsVertexColor,
    needsSkinning,
    needsMorphTargets,
  } = standardPrimitiveVertexFeatureNeeds(shader);

  if (
    needsSkinning &&
    needsMorphTargets &&
    !needsTangents &&
    !needsTexCoord1 &&
    !needsVertexColor
  ) {
    return resolveStandardSkinnedPrimitiveVertexBufferLayout(batchKey, true);
  }

  if (
    needsMorphTargets &&
    !needsSkinning &&
    !needsTangents &&
    !needsTexCoord1 &&
    !needsVertexColor
  ) {
    return STANDARD_MORPHED_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  if (needsSkinning && !needsTangents && !needsTexCoord1 && !needsVertexColor) {
    return resolveStandardSkinnedPrimitiveVertexBufferLayout(batchKey, false);
  }

  if (needsTangents && needsTexCoord1) {
    return STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  if (needsTangents) {
    return STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  if (needsTexCoord1) {
    return STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  if (needsVertexColor) {
    switch (vertexColorAttributeFormatFromBatchKey(batchKey)) {
      case "float32x3":
        return STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
      case "unorm8x4":
        return STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
      case "unorm16x4":
        return STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
      case "float32x4":
        return STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
    }
  }

  return UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
}

function standardPrimitiveVertexFeatureNeeds(
  shader: BuiltInShaderSourceModule,
): StandardPrimitiveVertexFeatureNeeds {
  return {
    needsTangents: shader.bindings.some(
      (binding) => binding.id === "normalTexture",
    ),
    needsTexCoord1: shader.code.includes("@location(4) uv1: vec2f"),
    needsVertexColor: shader.code.includes("@location(5) color: vec4f"),
    needsSkinning: shader.code.includes("@location(8) joints0: vec4u"),
    needsMorphTargets: shader.code.includes(
      "@location(10) morphPosition0: vec3f",
    ),
  };
}

function createStandardDynamicPrimitiveVertexBufferLayouts(
  batchKey: BatchCompatibilityKey | undefined,
  features: StandardPrimitiveVertexFeatureNeeds,
): readonly StandardPrimitiveVertexBufferLayout[] | null {
  const streams = parseStandardMeshLayoutKey(batchKey?.meshLayoutKey);

  if (streams === null) {
    return null;
  }

  const required = new Set(requiredStandardVertexSemantics(features));
  const streamAttributes = streams.map((stream) => {
    const attributes: StandardVertexBufferAttributeLayout[] = [];

    for (const semantic of required) {
      const attribute = stream.attributes.get(semantic);
      const shaderLocation = standardVertexShaderLocation(semantic);

      if (attribute !== undefined && shaderLocation !== null) {
        attributes.push({
          shaderLocation,
          offset: attribute.offset,
          format: attribute.format,
        });
      }
    }

    return attributes;
  });

  for (const attributes of streamAttributes) {
    for (const attribute of attributes) {
      for (const semantic of required) {
        if (
          standardVertexShaderLocation(semantic) === attribute.shaderLocation
        ) {
          required.delete(semantic);
          break;
        }
      }
    }
  }

  if (required.size > 0) {
    return null;
  }

  const lastUsedStreamIndex = findLastUsedStreamIndex(streamAttributes);
  if (lastUsedStreamIndex < 0) {
    return null;
  }

  for (let index = 0; index <= lastUsedStreamIndex; index += 1) {
    if ((streamAttributes[index]?.length ?? 0) === 0) {
      return null;
    }
  }

  return streams.slice(0, lastUsedStreamIndex + 1).map((stream, index) => ({
    arrayStride: stream.arrayStride,
    stepMode: "vertex",
    attributes: streamAttributes[index] ?? [],
  }));
}

function findLastUsedStreamIndex(
  streamAttributes: readonly (readonly StandardVertexBufferAttributeLayout[])[],
): number {
  for (let index = streamAttributes.length - 1; index >= 0; index -= 1) {
    if ((streamAttributes[index]?.length ?? 0) > 0) {
      return index;
    }
  }

  return -1;
}

function requiredStandardVertexSemantics(
  features: StandardPrimitiveVertexFeatureNeeds,
): readonly string[] {
  const semantics = ["POSITION", "NORMAL", "TEXCOORD_0"];

  if (features.needsTangents) {
    semantics.push("TANGENT");
  }

  if (features.needsTexCoord1) {
    semantics.push("TEXCOORD_1");
  }

  if (features.needsVertexColor) {
    semantics.push("COLOR_0");
  }

  if (features.needsSkinning) {
    semantics.push("JOINTS_0", "WEIGHTS_0");
  }

  if (features.needsMorphTargets) {
    semantics.push(
      "MORPH_POSITION_0",
      "MORPH_NORMAL_0",
      "MORPH_POSITION_1",
      "MORPH_NORMAL_1",
    );
  }

  return semantics;
}

function parseStandardMeshLayoutKey(
  meshLayoutKey: string | undefined,
): readonly ParsedStandardMeshLayout[] | null {
  if (meshLayoutKey === undefined || meshLayoutKey.trim().length === 0) {
    return null;
  }

  const streams: ParsedStandardMeshLayout[] = [];
  const seen = new Set<string>();

  for (const rawStream of meshLayoutKey.split("|")) {
    const stream = parseStandardMeshLayoutStream(rawStream, seen);

    if (stream === null) {
      return null;
    }

    streams.push(stream);
  }

  return streams.length > 0 ? streams : null;
}

function parseStandardMeshLayoutStream(
  rawStream: string,
  seen: Set<string>,
): ParsedStandardMeshLayout | null {
  const attributes = new Map<string, StandardVertexBufferAttributeLayout>();
  let explicitStride: number | null = null;
  let offset = 0;

  for (const rawToken of rawStream.split(",")) {
    const token = rawToken.trim();

    if (token.length === 0) {
      return null;
    }

    if (token.startsWith("stride=")) {
      const stride = parseExplicitMeshLayoutStride(token);

      if (stride === null || explicitStride !== null) {
        return null;
      }

      explicitStride = stride;
      continue;
    }

    const parsed = parseExplicitMeshLayoutAttributeOffset(token);
    const semantic = meshLayoutTokenSemantic(parsed.token);
    const format = standardMeshLayoutTokenFormat(parsed.token);

    if (
      semantic === null ||
      format === null ||
      attributes.has(semantic) ||
      seen.has(semantic)
    ) {
      return null;
    }

    const attributeOffset = parsed.offset ?? offset;
    const attributeEnd = attributeOffset + vertexFormatByteSize(format);

    seen.add(semantic);
    attributes.set(semantic, {
      shaderLocation: standardVertexShaderLocation(semantic) ?? 0,
      offset: attributeOffset,
      format,
    });
    offset =
      parsed.offset === null ? attributeEnd : Math.max(offset, attributeEnd);
  }

  const arrayStride = explicitStride ?? offset;

  return attributes.size > 0 && arrayStride >= offset
    ? { arrayStride, attributes }
    : null;
}

function meshLayoutTokenSemantic(token: string): string | null {
  const [semantic] = token.split(":");

  return semantic === undefined || semantic.length === 0 ? null : semantic;
}

function standardMeshLayoutTokenFormat(token: string): string | null {
  const [semantic, format] = token.split(":");

  switch (semantic) {
    case "POSITION":
    case "NORMAL":
    case "MORPH_POSITION_0":
    case "MORPH_NORMAL_0":
    case "MORPH_POSITION_1":
    case "MORPH_NORMAL_1":
      return format === undefined ? "float32x3" : null;
    case "TEXCOORD_0":
    case "TEXCOORD_1":
      return format === undefined ? "float32x2" : null;
    case "TANGENT":
      return format === undefined ? "float32x4" : null;
    case "COLOR_0":
      return format === undefined
        ? "float32x4"
        : isStandardColorFormat(format)
          ? format
          : null;
    case "JOINTS_0":
      return format === undefined
        ? "uint16x4"
        : format === "uint8x4" || format === "uint16x4"
          ? format
          : null;
    case "WEIGHTS_0":
      return format === undefined
        ? "float32x4"
        : isStandardWeightFormat(format)
          ? format
          : null;
    default:
      return null;
  }
}

function parseExplicitMeshLayoutStride(token: string): number | null {
  const rawStride = token.slice("stride=".length);
  const value = Number.parseInt(rawStride, 10);

  return Number.isInteger(value) && value > 0 && String(value) === rawStride
    ? value
    : null;
}

function parseExplicitMeshLayoutAttributeOffset(token: string): {
  readonly token: string;
  readonly offset: number | null;
} {
  const offsetSeparator = token.lastIndexOf("@");

  if (offsetSeparator < 0) {
    return { token, offset: null };
  }

  const baseToken = token.slice(0, offsetSeparator);
  const rawOffset = token.slice(offsetSeparator + 1);
  const offset = Number.parseInt(rawOffset, 10);

  return Number.isInteger(offset) &&
    offset >= 0 &&
    String(offset) === rawOffset &&
    baseToken.length > 0
    ? { token: baseToken, offset }
    : { token: "", offset: null };
}

function isStandardColorFormat(format: string): boolean {
  return (
    format === "float32x3" ||
    format === "float32x4" ||
    format === "unorm8x4" ||
    format === "unorm16x4"
  );
}

function isStandardWeightFormat(format: string): boolean {
  return (
    format === "float32x4" || format === "unorm8x4" || format === "unorm16x4"
  );
}

function standardVertexShaderLocation(semantic: string): number | null {
  switch (semantic) {
    case "POSITION":
      return 0;
    case "NORMAL":
      return 1;
    case "TEXCOORD_0":
      return 2;
    case "TANGENT":
      return 3;
    case "TEXCOORD_1":
      return 4;
    case "COLOR_0":
      return 5;
    case "JOINTS_0":
      return STANDARD_SKINNING_JOINTS_LOCATION;
    case "WEIGHTS_0":
      return STANDARD_SKINNING_WEIGHTS_LOCATION;
    case "MORPH_POSITION_0":
      return STANDARD_MORPH_TARGET_POSITION_0_LOCATION;
    case "MORPH_NORMAL_0":
      return STANDARD_MORPH_TARGET_NORMAL_0_LOCATION;
    case "MORPH_POSITION_1":
      return STANDARD_MORPH_TARGET_POSITION_1_LOCATION;
    case "MORPH_NORMAL_1":
      return STANDARD_MORPH_TARGET_NORMAL_1_LOCATION;
    default:
      return null;
  }
}

function resolveStandardSkinnedPrimitiveVertexBufferLayout(
  batchKey: BatchCompatibilityKey | undefined,
  morphed: boolean,
): StandardPrimitiveVertexBufferLayout {
  const formats = vertexSkinningAttributeFormatsFromBatchKey(batchKey);
  const usesDefaultFormats =
    formats.joints === "uint16x4" && formats.weights === "float32x4";

  if (usesDefaultFormats) {
    return morphed
      ? STANDARD_SKINNED_MORPHED_PRIMITIVE_VERTEX_BUFFER_LAYOUT
      : STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  return createStandardSkinnedPrimitiveVertexBufferLayout({
    formats,
    morphed,
  });
}

export function vertexSkinningAttributeFormatsFromBatchKey(
  batchKey?: Partial<BatchCompatibilityKey>,
): WebGpuSkinningAttributeFormats {
  const tokens =
    typeof batchKey?.meshLayoutKey === "string"
      ? batchKey.meshLayoutKey.split(/[|,]/)
      : [];
  const joints = tokens.find(
    (token) => token === "JOINTS_0" || token.startsWith("JOINTS_0:"),
  );
  const weights = tokens.find(
    (token) => token === "WEIGHTS_0" || token.startsWith("WEIGHTS_0:"),
  );

  return {
    joints: joints === "JOINTS_0:uint8x4" ? "uint8x4" : "uint16x4",
    weights:
      weights === "WEIGHTS_0:unorm8x4"
        ? "unorm8x4"
        : weights === "WEIGHTS_0:unorm16x4"
          ? "unorm16x4"
          : "float32x4",
  };
}

function createStandardSkinnedPrimitiveVertexBufferLayout(input: {
  readonly formats: WebGpuSkinningAttributeFormats;
  readonly morphed: boolean;
}): StandardPrimitiveVertexBufferLayout {
  const attributes: StandardVertexBufferAttributeLayout[] = [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
  ];
  let offset = 32;

  attributes.push({
    shaderLocation: STANDARD_SKINNING_JOINTS_LOCATION,
    offset,
    format: input.formats.joints,
  });
  offset += vertexFormatByteSize(input.formats.joints);
  attributes.push({
    shaderLocation: STANDARD_SKINNING_WEIGHTS_LOCATION,
    offset,
    format: input.formats.weights,
  });
  offset += vertexFormatByteSize(input.formats.weights);

  if (input.morphed) {
    for (const attribute of [
      {
        shaderLocation: STANDARD_MORPH_TARGET_POSITION_0_LOCATION,
        format: "float32x3",
      },
      {
        shaderLocation: STANDARD_MORPH_TARGET_NORMAL_0_LOCATION,
        format: "float32x3",
      },
      {
        shaderLocation: STANDARD_MORPH_TARGET_POSITION_1_LOCATION,
        format: "float32x3",
      },
      {
        shaderLocation: STANDARD_MORPH_TARGET_NORMAL_1_LOCATION,
        format: "float32x3",
      },
    ] as const) {
      attributes.push({ ...attribute, offset });
      offset += vertexFormatByteSize(attribute.format);
    }
  }

  return {
    arrayStride: offset,
    stepMode: "vertex",
    attributes,
  };
}

function vertexFormatByteSize(format: string): number {
  switch (format) {
    case "uint8x4":
    case "unorm8x4":
      return 4;
    case "uint16x4":
    case "unorm16x4":
      return 8;
    case "float32x2":
      return 8;
    case "float32x3":
      return 12;
    case "float32x4":
      return 16;
    default:
      return 0;
  }
}

function standardVertexBufferLayouts(
  shader: BuiltInShaderSourceModule,
  batchKey?: BatchCompatibilityKey,
): readonly (
  | StandardPrimitiveVertexBufferLayout
  | typeof INSTANCE_TINT_VERTEX_BUFFER_LAYOUT
)[] {
  const primitive = createStandardDynamicPrimitiveVertexBufferLayouts(
    batchKey,
    standardPrimitiveVertexFeatureNeeds(shader),
  ) ?? [standardPrimitiveVertexBufferLayout(shader, batchKey)];

  if (!shader.code.includes("@location(6) instanceTint: vec4f")) {
    return primitive;
  }

  return [...primitive, INSTANCE_TINT_VERTEX_BUFFER_LAYOUT];
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): StandardRenderPipelineDiagnostic {
  return {
    code: "standardRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}

function mapDescriptorDiagnostic(
  diagnostic: StandardPipelineDescriptorDiagnostic,
): StandardRenderPipelineDiagnostic {
  return {
    code: "standardRenderPipeline.descriptorPlanFailed",
    message: diagnostic.message,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
  };
}
