import type {
  DebugNormalMaterialAsset,
  CustomMaterialDependencyDeclaration,
  CustomWgslMaterialAsset,
  CustomWgslMaterialPipelineKeyInput,
  CustomWgslShaderRef,
  MaterialUnsupportedFeature,
  MatcapMaterialAsset,
  RenderStateDescriptor,
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
  UnlitMaterialAsset,
  WgslShaderAsset,
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
    clearcoatRoughnessTexture: input.clearcoatRoughnessTexture ?? null,
    transmissionFactor: input.transmissionFactor ?? 0,
    transmissionTexture: input.transmissionTexture ?? null,
    // KHR_materials_ior default is 1.5; KHR_materials_volume defaults to no
    // bounded volume (thickness 0, white attenuation). attenuationDistance uses
    // 0 as the JSON-safe sentinel for "no Beer-Lambert absorption" (the glTF
    // default attenuationDistance is +Infinity, which is not JSON-serializable).
    ior: input.ior ?? 1.5,
    thickness: input.thickness ?? 0,
    attenuationColor: input.attenuationColor ?? [1, 1, 1],
    attenuationDistance: input.attenuationDistance ?? 0,
    sheenColorFactor: input.sheenColorFactor ?? [0, 0, 0],
    sheenColorTexture: input.sheenColorTexture ?? null,
    sheenRoughnessFactor: input.sheenRoughnessFactor ?? 0,
    sheenRoughnessTexture: input.sheenRoughnessTexture ?? null,
    iridescenceFactor: input.iridescenceFactor ?? 0,
    iridescenceTexture: input.iridescenceTexture ?? null,
    iridescenceThicknessTexture: input.iridescenceThicknessTexture ?? null,
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

export function createWgslShaderAsset(input: {
  readonly label?: string;
  readonly source: string;
  readonly url?: string;
  readonly virtualPath?: string;
}): WgslShaderAsset {
  return {
    kind: "shader",
    language: "wgsl",
    label: input.label ?? input.virtualPath ?? input.url ?? "WGSL Shader",
    source: input.source,
    ...(input.url === undefined ? {} : { url: input.url }),
    ...(input.virtualPath === undefined
      ? {}
      : { virtualPath: input.virtualPath }),
  };
}

export function createCustomWgslMaterialAsset(
  input: Omit<
    CustomWgslMaterialAsset,
    | "sourceDiscriminator"
    | "shaderLanguage"
    | "renderState"
    | "pipelineKey"
    | "bindings"
    | "dependencies"
  > & {
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly pipelineKey?: Partial<CustomWgslMaterialPipelineKeyInput>;
    readonly bindings?: CustomWgslMaterialAsset["bindings"];
    readonly dependencies?: CustomWgslMaterialAsset["dependencies"];
  },
): CustomWgslMaterialAsset {
  return {
    sourceDiscriminator: "custom-material-source",
    shaderLanguage: "wgsl",
    familyKey: input.familyKey,
    label: input.label,
    shader: input.shader,
    entryPoints: input.entryPoints,
    renderState: createDefaultRenderState(input.renderState),
    pipelineKey: {
      features: input.pipelineKey?.features ?? [],
      specialization: input.pipelineKey?.specialization ?? {},
    },
    bindings: input.bindings ?? [],
    dependencies: input.dependencies ?? customWgslMaterialDependencies(input),
    ...(input.instanceAttributes === undefined
      ? {}
      : { instanceAttributes: input.instanceAttributes }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  };
}

function customWgslMaterialDependencies(input: {
  readonly shader: CustomWgslShaderRef;
  readonly bindings?: CustomWgslMaterialAsset["bindings"];
}): readonly CustomMaterialDependencyDeclaration[] {
  const dependencies: CustomMaterialDependencyDeclaration[] = [];

  if (input.shader.kind === "shader-asset") {
    dependencies.push({ kind: "shader", handle: input.shader.handle });
  }

  for (const binding of input.bindings ?? []) {
    if (binding.kind === "texture") {
      dependencies.push({ kind: "texture", handle: binding.texture });
    }

    if (binding.kind === "sampler") {
      dependencies.push({ kind: "sampler", handle: binding.sampler });
    }
  }

  return dependencies;
}
