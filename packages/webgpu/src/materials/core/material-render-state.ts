import { isStencilCapableDepthFormat } from "../../resources/textures/depth-texture-resource.js";

// D1 (stencil support). One face's parsed stencil state; the WebGPU
// `GPUStencilFaceState` shape.
export interface WebGpuStencilFaceState {
  readonly compare: string;
  readonly failOp: string;
  readonly depthFailOp: string;
  readonly passOp: string;
}

// D1: the full parsed stencil state reconstructed from a material pipeline
// key's `stencil:…` feature token. `reference` is applied dynamically at encode
// time via `setStencilReference` (it is not part of the GPU pipeline
// descriptor); the masks + per-face states ARE baked into the pipeline.
export interface WebGpuStencilState {
  readonly readMask: number;
  readonly writeMask: number;
  readonly reference: number;
  readonly front: WebGpuStencilFaceState;
  readonly back: WebGpuStencilFaceState;
}

export interface MaterialPipelineRenderStateTokens {
  readonly alphaMode: string | null;
  readonly cullMode: string | null;
  readonly frontFace: string | null;
  readonly depthCompare: string | null;
  readonly depthBias: number | null;
  readonly depthBiasSlopeScale: number | null;
  readonly blendPreset: string | null;
  // D1: parsed stencil state, or null when the key declares no stencil token.
  readonly stencil: WebGpuStencilState | null;
}

export interface WebGpuBlendComponentState {
  readonly srcFactor: string;
  readonly dstFactor: string;
  readonly operation: string;
}

export interface WebGpuBlendState {
  readonly color: WebGpuBlendComponentState;
  readonly alpha: WebGpuBlendComponentState;
}

export interface WebGpuPipelineRenderState {
  readonly alphaMode: string;
  readonly cullMode: string;
  readonly frontFace: "ccw" | "cw";
  readonly depthCompare: string;
  readonly depthWriteEnabled: boolean;
  readonly depthBias: number;
  readonly depthBiasSlopeScale: number;
  readonly blend: WebGpuBlendState | null;
  // D1: parsed stencil state, or null for a non-stencil material.
  readonly stencil: WebGpuStencilState | null;
}

const EMPTY_MATERIAL_PIPELINE_RENDER_STATE_TOKENS: MaterialPipelineRenderStateTokens =
  {
    alphaMode: null,
    cullMode: null,
    frontFace: null,
    depthCompare: null,
    depthBias: null,
    depthBiasSlopeScale: null,
    blendPreset: null,
    stencil: null,
  };

const MATERIAL_PIPELINE_RENDER_STATE_TOKEN_CACHE_LIMIT = 2048;
const materialPipelineRenderStateTokenCache = new Map<
  string,
  MaterialPipelineRenderStateTokens
>();

export function parseMaterialPipelineRenderStateTokens(
  pipelineKey: string | undefined,
): MaterialPipelineRenderStateTokens {
  if (pipelineKey === undefined || pipelineKey.trim().length === 0) {
    return EMPTY_MATERIAL_PIPELINE_RENDER_STATE_TOKENS;
  }

  const cached = materialPipelineRenderStateTokenCache.get(pipelineKey);

  if (cached !== undefined) {
    return cached;
  }

  const parts = pipelineKey.split("|");
  const renderStateStart = Math.max(1, parts.length - 4);
  const featureTokens = parts.slice(1, renderStateStart);
  const depthBias = parseDepthBiasToken(featureTokens);
  const tokens = {
    alphaMode: parts[renderStateStart] ?? null,
    cullMode: parts[renderStateStart + 1] ?? null,
    frontFace: parseFrontFaceToken(featureTokens),
    depthCompare: parts[renderStateStart + 2] ?? null,
    depthBias: depthBias.depthBias,
    depthBiasSlopeScale: depthBias.depthBiasSlopeScale,
    blendPreset: parts[renderStateStart + 3] ?? null,
    stencil: parseStencilToken(featureTokens),
  };

  if (
    materialPipelineRenderStateTokenCache.size >=
    MATERIAL_PIPELINE_RENDER_STATE_TOKEN_CACHE_LIMIT
  ) {
    materialPipelineRenderStateTokenCache.clear();
  }

  materialPipelineRenderStateTokenCache.set(pipelineKey, tokens);
  return tokens;
}

export function resolveWebGpuPipelineRenderState(
  pipelineKey: string | undefined,
  depthFormat: string | null | undefined,
): WebGpuPipelineRenderState {
  const tokens = parseMaterialPipelineRenderStateTokens(pipelineKey);
  const alphaMode = tokens.alphaMode ?? "opaque";
  const depthCompare = tokens.depthCompare ?? "less";

  return {
    alphaMode,
    cullMode: tokens.cullMode ?? "back",
    frontFace: tokens.frontFace === "cw" ? "cw" : "ccw",
    depthCompare,
    depthBias: tokens.depthBias ?? 0,
    depthBiasSlopeScale: tokens.depthBiasSlopeScale ?? 0,
    depthWriteEnabled:
      depthFormat !== undefined &&
      depthFormat !== null &&
      alphaMode !== "blend",
    blend: createBlendState(tokens.blendPreset ?? "none"),
    stencil: tokens.stencil,
  };
}

// D1: parse the `stencil:…` feature token (12 `:`-separated fields) emitted by
// the render package's `materialStencilPipelineToken`. Returns null when the
// key declares no stencil, so non-stencil materials produce no stencil state.
function parseStencilToken(
  features: readonly string[],
): WebGpuStencilState | null {
  const token = features.find((feature) => feature.startsWith("stencil:"));
  if (token === undefined) {
    return null;
  }

  const parts = token.split(":");
  if (parts.length !== 12) {
    return null;
  }

  return {
    readMask: parseStencilMask(parts[1]),
    writeMask: parseStencilMask(parts[2]),
    reference: parseStencilMask(parts[3]),
    front: {
      compare: parts[4] ?? "always",
      failOp: parts[5] ?? "keep",
      depthFailOp: parts[6] ?? "keep",
      passOp: parts[7] ?? "keep",
    },
    back: {
      compare: parts[8] ?? "always",
      failOp: parts[9] ?? "keep",
      depthFailOp: parts[10] ?? "keep",
      passOp: parts[11] ?? "keep",
    },
  };
}

function parseStencilMask(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value >>> 0 : 0;
}

/**
 * D1: the dynamic stencil reference value declared by a material pipeline key,
 * or null when the key uses no stencil. The render-pass encoder applies it via
 * `setStencilReference` when it binds the pipeline (the reference is not part
 * of the GPU pipeline descriptor).
 */
export function stencilReferenceFromPipelineKey(
  pipelineKey: string | undefined,
): number | null {
  const stencil = parseMaterialPipelineRenderStateTokens(pipelineKey).stencil;
  return stencil === null ? null : stencil.reference;
}

/** D1: true when a material pipeline key declares a stencil feature token. */
export function pipelineKeyDeclaresStencil(
  pipelineKey: string | undefined,
): boolean {
  return parseMaterialPipelineRenderStateTokens(pipelineKey).stencil !== null;
}

export function createWebGpuDepthStencilStateKey(
  depthFormat: string | null | undefined,
  renderState: WebGpuPipelineRenderState,
): {
  readonly format: string | null;
  readonly depthWriteEnabled: boolean;
  readonly depthCompare: string;
  readonly depthBias?: number;
  readonly depthBiasSlopeScale?: number;
  readonly stencilReadMask?: number;
  readonly stencilWriteMask?: number;
} {
  if (depthFormat === undefined || depthFormat === null) {
    return {
      format: null,
      depthWriteEnabled: false,
      depthCompare: "always",
    };
  }

  return {
    format: depthFormat,
    depthWriteEnabled: renderState.depthWriteEnabled,
    depthCompare: renderState.depthCompare,
    ...depthBiasFields(renderState),
    ...stencilStateKeyFields(depthFormat, renderState),
  };
}

export function createWebGpuDepthStencilDescriptor(
  depthFormat: string | null | undefined,
  renderState: WebGpuPipelineRenderState,
): {
  readonly format: string;
  readonly depthWriteEnabled: boolean;
  readonly depthCompare: string;
  readonly depthBias?: number;
  readonly depthBiasSlopeScale?: number;
  readonly stencilFront?: WebGpuStencilFaceState;
  readonly stencilBack?: WebGpuStencilFaceState;
  readonly stencilReadMask?: number;
  readonly stencilWriteMask?: number;
} | null {
  if (depthFormat === undefined || depthFormat === null) {
    return null;
  }

  return {
    format: depthFormat,
    depthWriteEnabled: renderState.depthWriteEnabled,
    depthCompare: renderState.depthCompare,
    ...depthBiasFields(renderState),
    ...stencilDescriptorFields(depthFormat, renderState),
  };
}

// D1: stencil fields are emitted ONLY when the material declares stencil AND
// the attachment format carries a stencil aspect. A stencil declaration on a
// depth-only format is dropped here (so the GPU pipeline is never invalid) and
// surfaced through {@link stencilDepthFormatDiagnostic}. Absent stencil ⇒ no
// fields, so non-stencil descriptors stay byte-identical.
function stencilDescriptorFields(
  depthFormat: string,
  renderState: WebGpuPipelineRenderState,
): {
  readonly stencilFront?: WebGpuStencilFaceState;
  readonly stencilBack?: WebGpuStencilFaceState;
  readonly stencilReadMask?: number;
  readonly stencilWriteMask?: number;
} {
  const stencil = renderState.stencil;
  if (stencil === null || !isStencilCapableDepthFormat(depthFormat)) {
    return {};
  }

  return {
    stencilFront: stencil.front,
    stencilBack: stencil.back,
    stencilReadMask: stencil.readMask,
    stencilWriteMask: stencil.writeMask,
  };
}

function stencilStateKeyFields(
  depthFormat: string,
  renderState: WebGpuPipelineRenderState,
): { readonly stencilReadMask?: number; readonly stencilWriteMask?: number } {
  const stencil = renderState.stencil;
  if (stencil === null || !isStencilCapableDepthFormat(depthFormat)) {
    return {};
  }

  return {
    stencilReadMask: stencil.readMask,
    stencilWriteMask: stencil.writeMask,
  };
}

export type StencilDepthFormatDiagnosticCode =
  "material.stencilRequiresStencilFormat";

export interface StencilDepthFormatDiagnostic {
  readonly code: StencilDepthFormatDiagnosticCode;
  readonly message: string;
}

/**
 * D1 validation: a material whose render state enables stencil but whose target
 * depth attachment format has no stencil aspect. Returns a structured
 * diagnostic (loud-over-silent) or null when the pairing is valid — including
 * the no-stencil case (no diagnostic) and the depth-only+no-stencil case.
 */
export function stencilDepthFormatDiagnostic(
  renderState: WebGpuPipelineRenderState,
  depthFormat: string | null | undefined,
): StencilDepthFormatDiagnostic | null {
  if (renderState.stencil === null) {
    return null;
  }

  if (isStencilCapableDepthFormat(depthFormat)) {
    return null;
  }

  return {
    code: "material.stencilRequiresStencilFormat",
    message: `Material declares stencil state but its depth attachment format '${String(
      depthFormat ?? "none",
    )}' has no stencil aspect; select a stencil-capable format (e.g. 'depth24plus-stencil8').`,
  };
}

export function createWebGpuColorTargetStateKey(
  colorFormat: string,
  renderState: WebGpuPipelineRenderState,
): {
  readonly format: string;
  readonly blend: WebGpuBlendState | null;
  readonly writeMask: "all";
} {
  return {
    format: colorFormat,
    blend: renderState.blend,
    writeMask: "all",
  };
}

export function createWebGpuColorTargetDescriptor(
  colorFormat: string,
  renderState: WebGpuPipelineRenderState,
): { readonly format: string; readonly blend?: WebGpuBlendState } {
  if (renderState.blend === null) {
    return { format: colorFormat };
  }

  return {
    format: colorFormat,
    blend: renderState.blend,
  };
}

function createBlendState(preset: string): WebGpuBlendState | null {
  switch (preset) {
    case "alpha":
      return {
        color: {
          srcFactor: "src-alpha",
          dstFactor: "one-minus-src-alpha",
          operation: "add",
        },
        alpha: {
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
          operation: "add",
        },
      };
    case "premultiplied-alpha":
      return {
        color: {
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
          operation: "add",
        },
        alpha: {
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
          operation: "add",
        },
      };
    case "additive":
      return {
        color: {
          srcFactor: "src-alpha",
          dstFactor: "one",
          operation: "add",
        },
        alpha: {
          srcFactor: "one",
          dstFactor: "one",
          operation: "add",
        },
      };
    case "none":
    default:
      return null;
  }
}

function parseFrontFaceToken(features: readonly string[]): "cw" | null {
  return features.includes("front-face:cw") ? "cw" : null;
}

function parseDepthBiasToken(features: readonly string[]): {
  readonly depthBias: number | null;
  readonly depthBiasSlopeScale: number | null;
} {
  const token = features.find((feature) => feature.startsWith("depth-bias:"));
  if (token === undefined) {
    return { depthBias: null, depthBiasSlopeScale: null };
  }

  const [, depthBiasRaw, depthBiasSlopeScaleRaw] = token.split(":");
  const depthBias = Number(depthBiasRaw);
  const depthBiasSlopeScale = Number(depthBiasSlopeScaleRaw);

  return {
    depthBias: Number.isFinite(depthBias) ? Math.round(depthBias) : 0,
    depthBiasSlopeScale: Number.isFinite(depthBiasSlopeScale)
      ? depthBiasSlopeScale
      : 0,
  };
}

function depthBiasFields(renderState: WebGpuPipelineRenderState): {
  readonly depthBias?: number;
  readonly depthBiasSlopeScale?: number;
} {
  return {
    ...(renderState.depthBias === 0
      ? {}
      : { depthBias: renderState.depthBias }),
    ...(renderState.depthBiasSlopeScale === 0
      ? {}
      : { depthBiasSlopeScale: renderState.depthBiasSlopeScale }),
  };
}
