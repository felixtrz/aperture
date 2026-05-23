import type {
  DebugNormalMaterialAsset,
  MaterialUnsupportedFeature,
  MatcapMaterialAsset,
  RenderStateDescriptor,
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
  UnlitMaterialAsset,
} from "./types.js";

export function createDefaultRenderState(
  overrides: Partial<RenderStateDescriptor> = {},
): RenderStateDescriptor {
  return {
    alphaMode: overrides.alphaMode ?? "opaque",
    alphaCutoff: overrides.alphaCutoff ?? 0.5,
    cullMode: overrides.cullMode ?? "back",
    frontFace: overrides.frontFace ?? "ccw",
    depth: overrides.depth ?? {
      test: true,
      write: true,
      compare: "less",
    },
    blend: overrides.blend ?? { preset: "none" },
    colorWriteMask: overrides.colorWriteMask ?? "all",
  };
}

export function createUnlitMaterialAsset(
  input: Partial<Omit<UnlitMaterialAsset, "kind" | "label" | "renderState">> & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
  } = {},
): UnlitMaterialAsset {
  return {
    kind: "unlit",
    label: input.label ?? "Unlit Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: input.baseColorFactor ?? new Float32Array([1, 1, 1, 1]),
    baseColorTexture: input.baseColorTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createMatcapMaterialAsset(
  input: Partial<
    Omit<MatcapMaterialAsset, "kind" | "label" | "renderState">
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
  } = {},
): MatcapMaterialAsset {
  return {
    kind: "matcap",
    label: input.label ?? "Matcap Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: input.baseColorFactor ?? new Float32Array([1, 1, 1, 1]),
    matcapTexture: input.matcapTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createStandardMaterialAsset(
  input: Partial<
    Omit<StandardMaterialAsset, "kind" | "label" | "renderState">
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
  } = {},
): StandardMaterialAsset {
  return {
    kind: "standard",
    label: input.label ?? "Standard Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: input.baseColorFactor ?? new Float32Array([1, 1, 1, 1]),
    baseColorTexture: input.baseColorTexture ?? null,
    metallicFactor: input.metallicFactor ?? 1,
    roughnessFactor: input.roughnessFactor ?? 1,
    clearcoatFactor: input.clearcoatFactor ?? 0,
    clearcoatTexture: input.clearcoatTexture ?? null,
    clearcoatRoughnessFactor: input.clearcoatRoughnessFactor ?? 0,
    transmissionFactor: input.transmissionFactor ?? 0,
    transmissionTexture: input.transmissionTexture ?? null,
    sheenColorFactor: input.sheenColorFactor ?? [0, 0, 0],
    sheenColorTexture: input.sheenColorTexture ?? null,
    sheenRoughnessFactor: input.sheenRoughnessFactor ?? 0,
    iridescenceFactor: input.iridescenceFactor ?? 0,
    iridescenceTexture: input.iridescenceTexture ?? null,
    iridescenceIor: input.iridescenceIor ?? 1.3,
    iridescenceThicknessMinimum: input.iridescenceThicknessMinimum ?? 100,
    iridescenceThicknessMaximum: input.iridescenceThicknessMaximum ?? 400,
    metallicRoughnessTexture: input.metallicRoughnessTexture ?? null,
    normalTexture: input.normalTexture ?? null,
    normalScale: input.normalScale ?? 1,
    occlusionTexture: input.occlusionTexture ?? null,
    occlusionStrength: input.occlusionStrength ?? 1,
    emissiveFactor: input.emissiveFactor ?? [0, 0, 0],
    emissiveTexture: input.emissiveTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createDebugNormalMaterialAsset(
  input: {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly unsupportedFeatures?: readonly MaterialUnsupportedFeature[];
  } = {},
): DebugNormalMaterialAsset {
  return {
    kind: "debug-normal",
    label: input.label ?? "Debug Normal Material",
    renderState: createDefaultRenderState(input.renderState),
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createTextureAsset(
  input: Omit<
    TextureAsset,
    "kind" | "depthOrLayers" | "mipLevelCount" | "usage"
  > &
    Partial<Pick<TextureAsset, "depthOrLayers" | "mipLevelCount" | "usage">>,
): TextureAsset {
  return {
    kind: "texture",
    depthOrLayers: input.depthOrLayers ?? 1,
    mipLevelCount: input.mipLevelCount ?? 1,
    usage: input.usage ?? ["sampled"],
    ...input,
  };
}

export function createSamplerAsset(
  input: Partial<Omit<SamplerAsset, "kind" | "label">> & {
    readonly label?: string;
  } = {},
): SamplerAsset {
  return {
    kind: "sampler",
    label: input.label ?? "Sampler",
    addressModeU: input.addressModeU ?? "repeat",
    addressModeV: input.addressModeV ?? "repeat",
    addressModeW: input.addressModeW ?? "repeat",
    magFilter: input.magFilter ?? "linear",
    minFilter: input.minFilter ?? "linear",
    mipmapFilter: input.mipmapFilter ?? "linear",
    lodMinClamp: input.lodMinClamp ?? 0,
    lodMaxClamp: input.lodMaxClamp ?? 32,
    maxAnisotropy: input.maxAnisotropy ?? 1,
  };
}
