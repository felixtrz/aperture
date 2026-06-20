import { vec4 } from "@aperture-engine/simulation";
import type { Vec3Like, Vec4, Vec4Like } from "@aperture-engine/simulation";
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
  input: Partial<
    Omit<
      UnlitMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): UnlitMaterialAsset {
  return {
    kind: "unlit",
    label: input.label ?? "Unlit Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: (input.baseColorFactor ?? vec4(1, 1, 1, 1)) as Vec4,
    baseColorTexture: input.baseColorTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createMatcapMaterialAsset(
  input: Partial<
    Omit<
      MatcapMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): MatcapMaterialAsset {
  return {
    kind: "matcap",
    label: input.label ?? "Matcap Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: (input.baseColorFactor ?? vec4(1, 1, 1, 1)) as Vec4,
    matcapTexture: input.matcapTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createStandardMaterialAsset(
  input: Partial<
    Omit<
      StandardMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): StandardMaterialAsset {
  return {
    kind: "standard",
    label: input.label ?? "Standard Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: (input.baseColorFactor ?? vec4(1, 1, 1, 1)) as Vec4,
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

// M7-T6: runtime material parameter mutation. Each patch* returns a NEW frozen
// asset with the provided scalar/color uniform fields merged over `prev` — `prev`
// is never mutated. Scoped to same-variant uniform-level fields (color/scalar
// factors); fields that flip a shader variant (e.g. enabling clearcoat) are out
// of scope. Mutation flows through the versioned asset registry (markReady), not
// GPU state, so the existing version-gated mirror re-prepares the GPU material.

const COLOR4_PATCH_FIELDS = new Set<string>(["baseColorFactor"]);
const VEC3_PATCH_FIELDS = new Set<string>([
  "emissiveFactor",
  "attenuationColor",
  "sheenColorFactor",
]);

export interface StandardMaterialPatch {
  readonly baseColorFactor?: Vec4Like;
  readonly renderState?: Partial<RenderStateDescriptor>;
  readonly metallicFactor?: number;
  readonly roughnessFactor?: number;
  readonly emissiveFactor?: Vec3Like;
  readonly occlusionStrength?: number;
  readonly normalScale?: number;
  readonly ior?: number;
  readonly transmissionFactor?: number;
  readonly thickness?: number;
  readonly attenuationColor?: Vec3Like;
  readonly attenuationDistance?: number;
  readonly sheenColorFactor?: Vec3Like;
  readonly sheenRoughnessFactor?: number;
  readonly iridescenceFactor?: number;
  readonly label?: string;
}

export interface UnlitMaterialPatch {
  readonly baseColorFactor?: Vec4Like;
  readonly renderState?: Partial<RenderStateDescriptor>;
  readonly label?: string;
}

export interface MatcapMaterialPatch {
  readonly baseColorFactor?: Vec4Like;
  readonly renderState?: Partial<RenderStateDescriptor>;
  readonly label?: string;
}

export function patchStandardMaterial(
  prev: StandardMaterialAsset,
  patch: StandardMaterialPatch,
): StandardMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

export function patchUnlitMaterial(
  prev: UnlitMaterialAsset,
  patch: UnlitMaterialPatch,
): UnlitMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

export function patchMatcapMaterial(
  prev: MatcapMaterialAsset,
  patch: MatcapMaterialPatch,
): MatcapMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

function mergeMaterialAsset<T extends object>(prev: T, patch: object): T {
  const next: Record<string, unknown> = {
    ...(prev as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(patch)) {
    // Only update fields the asset already has, so a cross-kind patch (e.g. a
    // metallicFactor aimed at an unlit asset) never grows a spurious field.
    if (value === undefined || !(key in prev)) {
      continue;
    }
    if (COLOR4_PATCH_FIELDS.has(key)) {
      next[key] = new Float32Array(value as ArrayLike<number>);
    } else if (VEC3_PATCH_FIELDS.has(key)) {
      next[key] = Array.from(value as ArrayLike<number>);
    } else if (key === "renderState") {
      next[key] = mergeRenderState(
        (prev as { readonly renderState?: RenderStateDescriptor }).renderState,
        value as Partial<RenderStateDescriptor>,
      );
    } else {
      next[key] = value;
    }
  }
  return Object.freeze(next) as T;
}

function mergeRenderState(
  previous: RenderStateDescriptor | undefined,
  patch: Partial<RenderStateDescriptor>,
): RenderStateDescriptor {
  const fallback = createDefaultRenderState();

  return createDefaultRenderState({
    ...(previous ?? fallback),
    ...patch,
    depth:
      patch.depth === undefined
        ? (previous?.depth ?? fallback.depth)
        : { ...(previous?.depth ?? fallback.depth), ...patch.depth },
    blend:
      patch.blend === undefined
        ? (previous?.blend ?? fallback.blend)
        : { ...(previous?.blend ?? fallback.blend), ...patch.blend },
  });
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
