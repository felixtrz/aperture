export interface MaterialPipelineRenderStateTokens {
  readonly alphaMode: string | null;
  readonly cullMode: string | null;
  readonly depthCompare: string | null;
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
  readonly depthCompare: string;
  readonly depthWriteEnabled: boolean;
  readonly blend: WebGpuBlendState | null;
}

export function parseMaterialPipelineRenderStateTokens(
  pipelineKey: string | undefined,
): MaterialPipelineRenderStateTokens {
  if (pipelineKey === undefined || pipelineKey.trim().length === 0) {
    return {
      alphaMode: null,
      cullMode: null,
      depthCompare: null,
      blendPreset: null,
    };
  }

  const parts = pipelineKey.split("|");
  const renderStateStart = Math.max(1, parts.length - 4);

  return {
    alphaMode: parts[renderStateStart] ?? null,
    cullMode: parts[renderStateStart + 1] ?? null,
    depthCompare: parts[renderStateStart + 2] ?? null,
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
    depthCompare,
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
  };
}

export function createWebGpuDepthStencilDescriptor(
  depthFormat: string | null | undefined,
  renderState: WebGpuPipelineRenderState,
): {
  readonly format: string;
  readonly depthWriteEnabled: boolean;
  readonly depthCompare: string;
} | null {
  if (depthFormat === undefined || depthFormat === null) {
    return null;
  }

  return {
    format: depthFormat,
    depthWriteEnabled: renderState.depthWriteEnabled,
    depthCompare: renderState.depthCompare,
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
