export interface MaterialPipelineRenderStateTokens {
  readonly alphaMode: string | null;
  readonly cullMode: string | null;
  readonly frontFace: string | null;
  readonly depthCompare: string | null;
  readonly depthBias: number | null;
  readonly depthBiasSlopeScale: number | null;
  readonly blendPreset: string | null;
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
}

export function parseMaterialPipelineRenderStateTokens(
  pipelineKey: string | undefined,
): MaterialPipelineRenderStateTokens {
  if (pipelineKey === undefined || pipelineKey.trim().length === 0) {
    return {
      alphaMode: null,
      cullMode: null,
      frontFace: null,
      depthCompare: null,
      depthBias: null,
      depthBiasSlopeScale: null,
      blendPreset: null,
    };
  }

  const parts = pipelineKey.split("|");
  const renderStateStart = Math.max(1, parts.length - 4);
  const featureTokens = parts.slice(1, renderStateStart);
  const depthBias = parseDepthBiasToken(featureTokens);

  return {
    alphaMode: parts[renderStateStart] ?? null,
    cullMode: parts[renderStateStart + 1] ?? null,
    frontFace: parseFrontFaceToken(featureTokens),
    depthCompare: parts[renderStateStart + 2] ?? null,
    depthBias: depthBias.depthBias,
    depthBiasSlopeScale: depthBias.depthBiasSlopeScale,
    blendPreset: parts[renderStateStart + 3] ?? null,
  };
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
  };
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
} | null {
  if (depthFormat === undefined || depthFormat === null) {
    return null;
  }

  return {
    format: depthFormat,
    depthWriteEnabled: renderState.depthWriteEnabled,
    depthCompare: renderState.depthCompare,
    ...depthBiasFields(renderState),
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
