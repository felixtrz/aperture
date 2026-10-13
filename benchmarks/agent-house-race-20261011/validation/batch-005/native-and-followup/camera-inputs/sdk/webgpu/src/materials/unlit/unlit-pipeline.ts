import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderFailureReason,
  type WebGpuShaderDiagnostic,
} from "../../gpu/shader.js";
import {
  createUnlitPipelineDescriptorPlan,
  hasUnlitVertexColorFeature,
  isColor0LayoutToken,
  resolveUnlitShaderForBatchKey,
  type UnlitPipelineDescriptorDiagnostic,
} from "./unlit-pipeline-descriptor.js";
import {
  createUnlitMeshShaderModuleDescriptor,
  UNLIT_MESH_SHADER,
  type BuiltInShaderSourceModule,
} from "./unlit-shader.js";
import {
  createWebGpuColorTargetDescriptor,
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "../core/material-render-state.js";
import { createMotionVectorBuiltInShaderVariant } from "../../render/motion/motion-vector-shader.js";
import {
  applyOutputStageToBuiltInShader,
  type TonemapOperator,
} from "../../output/output-stage-tonemap.js";
import type { OutputColorSpace } from "../../output/output-stage-color-space.js";
import type {
  WebGpuRenderPipelineCreateDescriptor,
  WebGpuRenderPipelineDeviceLike,
} from "../../gpu/pipeline-cache.js";

export const UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 32,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
  ],
} as const;

export const UNLIT_VERTEX_COLOR_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 48,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "float32x4" },
  ],
} as const;

export const UNLIT_VERTEX_COLOR_FLOAT32X3_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 44,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "float32x3" },
  ],
} as const;

export const UNLIT_VERTEX_COLOR_UNORM8_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 36,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "unorm8x4" },
  ],
} as const;

export const UNLIT_VERTEX_COLOR_UNORM16_VERTEX_BUFFER_LAYOUT = {
  arrayStride: 40,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x2" },
    { shaderLocation: 5, offset: 32, format: "unorm16x4" },
  ],
} as const;

export type WebGpuVertexColorAttributeFormat =
  | "float32x3"
  | "float32x4"
  | "unorm8x4"
  | "unorm16x4";

interface UnlitVertexBufferAttributeLayout {
  readonly shaderLocation: number;
  readonly offset: number;
  readonly format: string;
}

export interface UnlitPrimitiveVertexBufferLayout {
  readonly arrayStride: number;
  readonly stepMode: "vertex";
  readonly attributes: readonly UnlitVertexBufferAttributeLayout[];
}

interface ParsedUnlitMeshLayout {
  readonly arrayStride: number;
  readonly attributes: ReadonlyMap<string, UnlitVertexBufferAttributeLayout>;
}

export type UnlitRenderPipelineDiagnosticCode =
  | "unlitRenderPipeline.shaderDiagnostic"
  | "unlitRenderPipeline.shaderCreationFailed"
  | "unlitRenderPipeline.descriptorPlanFailed"
  | "unlitRenderPipeline.createRenderPipelineUnavailable"
  | "unlitRenderPipeline.pipelineCreationFailed";

export interface UnlitRenderPipelineDiagnostic {
  readonly code: UnlitRenderPipelineDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
  readonly field?: string;
}

export interface BrowserUnlitRenderPipelineDescriptorInput {
  readonly shaderModule: unknown;
  readonly shader?: BuiltInShaderSourceModule;
  readonly colorFormat: string;
  readonly motionVectorColorFormat?: string | null;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly batchKey?: BatchCompatibilityKey;
}

export interface CreateUnlitRenderPipelineResourceOptions {
  readonly device: UnlitRenderPipelineDeviceLike;
  readonly colorFormat: string;
  readonly motionVectorColorFormat?: string | null;
  readonly depthFormat?: string | null;
  readonly sampleCount?: number;
  readonly batchKey: BatchCompatibilityKey;
  readonly shader?: BuiltInShaderSourceModule;
  readonly tonemap?: TonemapOperator;
  readonly outputColorSpace?: OutputColorSpace;
}

export interface UnlitRenderPipelineResource {
  readonly cacheKey: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
  readonly descriptor: WebGpuRenderPipelineCreateDescriptor;
}

export interface CreateUnlitRenderPipelineResourceResult {
  readonly valid: boolean;
  readonly resource: UnlitRenderPipelineResource | null;
  readonly diagnostics: readonly UnlitRenderPipelineDiagnostic[];
}

export interface UnlitRenderPipelineDeviceLike
  extends WebGpuShaderDeviceLike, WebGpuRenderPipelineDeviceLike {}

export async function createUnlitRenderPipelineResource(
  options: CreateUnlitRenderPipelineResourceOptions,
): Promise<CreateUnlitRenderPipelineResourceResult> {
  // AI-17: apply the shared output stage to the base color shader BEFORE the
  // motion-vector variant, so the MV path (which renames fs_main -> fs_main_color
  // and adds the motion output) wraps the tonemapped color. No-op on none + linear
  // (HDR-scene-buffer path), so it stays byte-identical there.
  const baseShader = applyOutputStageToBuiltInShader(
    resolveUnlitShaderForBatchKey(options.batchKey, options.shader),
    options.tonemap ?? "none",
    options.outputColorSpace ?? "linear",
  );
  const shader =
    options.motionVectorColorFormat === undefined ||
    options.motionVectorColorFormat === null
      ? baseShader
      : createMotionVectorBuiltInShaderVariant(baseShader);
  const descriptorPlan = createUnlitPipelineDescriptorPlan({
    shader,
    colorFormat: options.colorFormat,
    batchKey: options.batchKey,
    ...(options.motionVectorColorFormat === undefined
      ? {}
      : { motionVectorColorFormat: options.motionVectorColorFormat }),
    ...(options.sampleCount === undefined
      ? {}
      : { sampleCount: options.sampleCount }),
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
    descriptor: createUnlitMeshShaderModuleDescriptor(shader),
  });
  const shaderDiagnostics = shaderModule.diagnostics.map(mapShaderDiagnostic);

  if (!shaderModule.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...shaderDiagnostics,
        {
          code: "unlitRenderPipeline.shaderCreationFailed",
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
          code: "unlitRenderPipeline.createRenderPipelineUnavailable",
          message: "WebGPU device cannot create render pipelines.",
        },
      ],
    };
  }

  const descriptor = createBrowserUnlitRenderPipelineDescriptor({
    shader,
    shaderModule: shaderModule.module,
    colorFormat: options.colorFormat,
    batchKey: options.batchKey,
    ...(options.motionVectorColorFormat === undefined
      ? {}
      : { motionVectorColorFormat: options.motionVectorColorFormat }),
    ...(options.sampleCount === undefined
      ? {}
      : { sampleCount: options.sampleCount }),
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
          code: "unlitRenderPipeline.pipelineCreationFailed",
          message:
            error instanceof Error
              ? error.message
              : "WebGPU render pipeline creation failed.",
        },
      ],
    };
  }
}

export function createBrowserUnlitRenderPipelineDescriptor(
  input: BrowserUnlitRenderPipelineDescriptorInput,
): WebGpuRenderPipelineCreateDescriptor {
  const shader = input.shader ?? UNLIT_MESH_SHADER;
  const topology = input.batchKey?.topology ?? "triangle-list";
  const renderState = resolveWebGpuPipelineRenderState(
    input.batchKey?.pipelineKey,
    input.depthFormat,
  );
  const colorTarget = createWebGpuColorTargetDescriptor(
    input.colorFormat,
    renderState,
  );
  const targets =
    input.motionVectorColorFormat === undefined ||
    input.motionVectorColorFormat === null
      ? [colorTarget]
      : [colorTarget, { format: input.motionVectorColorFormat }];
  const descriptor: WebGpuRenderPipelineCreateDescriptor = {
    label: `${shader.label}:${input.colorFormat}:${topology}`,
    layout: "auto",
    vertex: {
      module: input.shaderModule,
      entryPoint: shader.entryPoints.vertex,
      buffers: resolveUnlitVertexBufferLayouts(input.batchKey),
    },
    fragment: {
      module: input.shaderModule,
      entryPoint: shader.entryPoints.fragment,
      targets,
    },
    primitive: {
      topology,
      frontFace: renderState.frontFace,
      cullMode: renderState.cullMode,
    },
    multisample: {
      count: input.sampleCount ?? 1,
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

export function resolveUnlitVertexBufferLayout(
  batchKey?: BatchCompatibilityKey,
): UnlitPrimitiveVertexBufferLayout {
  return (
    resolveUnlitVertexBufferLayouts(batchKey)[0] ??
    UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT
  );
}

export function resolveUnlitVertexBufferLayouts(
  batchKey?: BatchCompatibilityKey,
): readonly UnlitPrimitiveVertexBufferLayout[] {
  return (
    createUnlitDynamicVertexBufferLayouts(batchKey) ?? [
      resolveUnlitStaticVertexBufferLayout(batchKey),
    ]
  );
}

function resolveUnlitStaticVertexBufferLayout(
  batchKey?: BatchCompatibilityKey,
): UnlitPrimitiveVertexBufferLayout {
  if (!hasUnlitVertexColorFeature(batchKey ?? null)) {
    return UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
  }

  switch (vertexColorAttributeFormatFromBatchKey(batchKey)) {
    case "float32x3":
      return UNLIT_VERTEX_COLOR_FLOAT32X3_VERTEX_BUFFER_LAYOUT;
    case "unorm8x4":
      return UNLIT_VERTEX_COLOR_UNORM8_VERTEX_BUFFER_LAYOUT;
    case "unorm16x4":
      return UNLIT_VERTEX_COLOR_UNORM16_VERTEX_BUFFER_LAYOUT;
    case "float32x4":
      return UNLIT_VERTEX_COLOR_VERTEX_BUFFER_LAYOUT;
  }
}

function createUnlitDynamicVertexBufferLayouts(
  batchKey: BatchCompatibilityKey | undefined,
): readonly UnlitPrimitiveVertexBufferLayout[] | null {
  const streams = parseUnlitMeshLayoutKey(batchKey?.meshLayoutKey);

  if (streams === null) {
    return null;
  }

  const required = new Set(requiredUnlitVertexSemantics(batchKey));
  const streamAttributes = streams.map((stream) => {
    const attributes: UnlitVertexBufferAttributeLayout[] = [];

    for (const semantic of required) {
      const attribute = stream.attributes.get(semantic);
      const shaderLocation = unlitVertexShaderLocation(semantic);

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
        if (unlitVertexShaderLocation(semantic) === attribute.shaderLocation) {
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
  streamAttributes: readonly (readonly UnlitVertexBufferAttributeLayout[])[],
): number {
  for (let index = streamAttributes.length - 1; index >= 0; index -= 1) {
    if ((streamAttributes[index]?.length ?? 0) > 0) {
      return index;
    }
  }

  return -1;
}

function requiredUnlitVertexSemantics(
  batchKey: Partial<BatchCompatibilityKey> | undefined,
): readonly string[] {
  const semantics = ["POSITION", "NORMAL", "TEXCOORD_0"];

  if (hasUnlitVertexColorFeature(batchKey ?? null)) {
    semantics.push("COLOR_0");
  }

  return semantics;
}

function parseUnlitMeshLayoutKey(
  meshLayoutKey: string | undefined,
): readonly ParsedUnlitMeshLayout[] | null {
  if (meshLayoutKey === undefined || meshLayoutKey.trim().length === 0) {
    return null;
  }

  const streams: ParsedUnlitMeshLayout[] = [];
  const seen = new Set<string>();

  for (const rawStream of meshLayoutKey.split("|")) {
    const stream = parseUnlitMeshLayoutStream(rawStream, seen);

    if (stream === null) {
      return null;
    }

    streams.push(stream);
  }

  return streams.length > 0 ? streams : null;
}

function parseUnlitMeshLayoutStream(
  rawStream: string,
  seen: Set<string>,
): ParsedUnlitMeshLayout | null {
  const attributes = new Map<string, UnlitVertexBufferAttributeLayout>();
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
    const format = unlitMeshLayoutTokenFormat(parsed.token);

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
      shaderLocation: unlitVertexShaderLocation(semantic) ?? 0,
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

function unlitMeshLayoutTokenFormat(token: string): string | null {
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
        : isUnlitColorFormat(format)
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
        : isUnlitWeightFormat(format)
          ? format
          : null;
    default:
      return null;
  }
}

function parseExplicitMeshLayoutStride(token: string): number | null {
  const value = Number.parseInt(token.slice("stride=".length), 10);

  return Number.isInteger(value) &&
    value > 0 &&
    String(value) === token.slice("stride=".length)
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

function isUnlitColorFormat(format: string): boolean {
  return (
    format === "float32x3" ||
    format === "float32x4" ||
    format === "unorm8x4" ||
    format === "unorm16x4"
  );
}

function isUnlitWeightFormat(format: string): boolean {
  return (
    format === "float32x4" || format === "unorm8x4" || format === "unorm16x4"
  );
}

function unlitVertexShaderLocation(semantic: string): number | null {
  switch (semantic) {
    case "POSITION":
      return 0;
    case "NORMAL":
      return 1;
    case "TEXCOORD_0":
      return 2;
    case "COLOR_0":
      return 5;
    default:
      return null;
  }
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

export function vertexColorAttributeFormatFromBatchKey(
  batchKey?: Partial<BatchCompatibilityKey>,
): WebGpuVertexColorAttributeFormat {
  const token =
    typeof batchKey?.meshLayoutKey === "string"
      ? batchKey.meshLayoutKey.split(/[|,]/).find(isColor0LayoutToken)
      : undefined;
  const normalized = stripMeshLayoutOffsetSuffix(token);

  if (normalized === "COLOR_0:unorm8x4") {
    return "unorm8x4";
  }

  if (normalized === "COLOR_0:unorm16x4") {
    return "unorm16x4";
  }

  if (normalized === "COLOR_0:float32x3") {
    return "float32x3";
  }

  return "float32x4";
}

function stripMeshLayoutOffsetSuffix(
  token: string | undefined,
): string | undefined {
  return token?.split("@")[0];
}

function mapShaderDiagnostic(
  diagnostic: WebGpuShaderDiagnostic,
): UnlitRenderPipelineDiagnostic {
  return {
    code: "unlitRenderPipeline.shaderDiagnostic",
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}

function mapDescriptorDiagnostic(
  diagnostic: UnlitPipelineDescriptorDiagnostic,
): UnlitRenderPipelineDiagnostic {
  return {
    code: "unlitRenderPipeline.descriptorPlanFailed",
    message: diagnostic.message,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
  };
}
