import {
  AssetRegistry,
  TypedAssetCollection,
  assetHandleKey,
  createFontAtlasHandle,
  createMaterialHandle,
  createMeshHandle,
  createParticleEffectHandle,
  createShaderHandle,
  type AssetDiagnostic,
  type AssetHandle,
  type AssetListFilter,
  type AssetRegistryEntry,
  type MaterialHandle,
  type TypedAssetAddOptions,
  type TypedAssetRegisterOptions,
} from "@aperture-engine/simulation";
import { materialTextureBindings } from "../materials/bindings.js";
import type {
  CustomWgslMaterialAsset,
  DebugNormalMaterialAsset,
  MatcapMaterialAsset,
  SourceMaterialAsset,
  StandardMaterialAsset,
  UnlitMaterialAsset,
  WgslShaderAsset,
} from "../materials/types.js";
import { isCustomWgslMaterialAsset } from "../materials/family-key.js";
import type { MeshAsset } from "../mesh/types.js";
import {
  msdfFontAtlasDependencies,
  type MsdfFontAtlasAsset,
} from "../text/index.js";
import {
  particleEffectDependencies,
  type ParticleEffectAsset,
} from "./particles.js";

export interface RenderAssetCollectionsOptions {
  readonly registry?: AssetRegistry;
}

export interface RenderAssetCollections {
  readonly registry: AssetRegistry;
  readonly meshes: TypedAssetCollection<"mesh", MeshAsset>;
  readonly materials: MaterialAssetCollections;
  readonly shaders: TypedAssetCollection<"shader", WgslShaderAsset>;
  readonly fontAtlases: TypedAssetCollection<"font-atlas", MsdfFontAtlasAsset>;
  readonly particleEffects: TypedAssetCollection<
    "particle-effect",
    ParticleEffectAsset
  >;
}

export class MaterialAssetCollections {
  readonly #all: TypedAssetCollection<"material", SourceMaterialAsset>;

  readonly unlit: TypedAssetCollection<"material", UnlitMaterialAsset>;
  readonly matcap: TypedAssetCollection<"material", MatcapMaterialAsset>;
  readonly standard: TypedAssetCollection<"material", StandardMaterialAsset>;
  readonly debugNormal: TypedAssetCollection<
    "material",
    DebugNormalMaterialAsset
  >;
  readonly customWgsl: TypedAssetCollection<
    "material",
    CustomWgslMaterialAsset
  >;

  constructor(registry: AssetRegistry) {
    this.#all = new TypedAssetCollection<"material", SourceMaterialAsset>({
      registry,
      kind: "material",
      createHandle: createMaterialHandle,
      idPrefix: "material",
      label: (asset) => asset.label,
      dependencies: materialAssetDependencies,
    });
    this.unlit = new TypedAssetCollection<"material", UnlitMaterialAsset>({
      registry,
      kind: "material",
      createHandle: createMaterialHandle,
      idPrefix: "unlit-material",
      label: (asset) => asset.label,
      dependencies: materialAssetDependencies,
    });
    this.matcap = new TypedAssetCollection<"material", MatcapMaterialAsset>({
      registry,
      kind: "material",
      createHandle: createMaterialHandle,
      idPrefix: "matcap-material",
      label: (asset) => asset.label,
      dependencies: materialAssetDependencies,
    });
    this.standard = new TypedAssetCollection<"material", StandardMaterialAsset>(
      {
        registry,
        kind: "material",
        createHandle: createMaterialHandle,
        idPrefix: "standard-material",
        label: (asset) => asset.label,
        dependencies: materialAssetDependencies,
      },
    );
    this.debugNormal = new TypedAssetCollection<
      "material",
      DebugNormalMaterialAsset
    >({
      registry,
      kind: "material",
      createHandle: createMaterialHandle,
      idPrefix: "debug-normal-material",
      label: (asset) => asset.label,
      dependencies: materialAssetDependencies,
    });
    this.customWgsl = new TypedAssetCollection<
      "material",
      CustomWgslMaterialAsset
    >({
      registry,
      kind: "material",
      createHandle: createMaterialHandle,
      idPrefix: "custom-wgsl-material",
      label: (asset) => asset.label,
      dependencies: materialAssetDependencies,
    });
  }

  get registry(): AssetRegistry {
    return this.#all.registry;
  }

  add(
    asset: SourceMaterialAsset,
    options: TypedAssetAddOptions<"material"> = {},
  ): MaterialHandle {
    return this.#all.add(asset, options);
  }

  register(
    options: TypedAssetRegisterOptions<"material"> = {},
  ): MaterialHandle {
    return this.#all.register(options);
  }

  has(handle: MaterialHandle): boolean {
    return this.#all.has(handle);
  }

  get(
    handle: MaterialHandle,
  ): AssetRegistryEntry<"material", SourceMaterialAsset> | undefined {
    return this.#all.get(handle);
  }

  getAsset(handle: MaterialHandle): SourceMaterialAsset | undefined {
    return this.#all.getAsset(handle);
  }

  markLoading(
    handle: MaterialHandle,
  ): AssetRegistryEntry<"material", SourceMaterialAsset> {
    return this.#all.markLoading(handle);
  }

  markReady(
    handle: MaterialHandle,
    asset: SourceMaterialAsset,
    diagnostics?: readonly AssetDiagnostic[],
  ): AssetRegistryEntry<"material", SourceMaterialAsset> {
    return diagnostics === undefined
      ? this.#all.markReady(handle, asset)
      : this.#all.markReady(handle, asset, diagnostics);
  }

  markFailed(
    handle: MaterialHandle,
    diagnostics: readonly AssetDiagnostic[],
  ): AssetRegistryEntry<"material", SourceMaterialAsset> {
    return this.#all.markFailed(handle, diagnostics);
  }

  list(
    filter: Omit<AssetListFilter, "kind"> = {},
  ): AssetRegistryEntry<"material", SourceMaterialAsset>[] {
    return this.#all.list(filter);
  }
}

export function createRenderAssetCollections(
  options: RenderAssetCollectionsOptions = {},
): RenderAssetCollections {
  const registry = options.registry ?? new AssetRegistry();

  return {
    registry,
    meshes: new TypedAssetCollection<"mesh", MeshAsset>({
      registry,
      kind: "mesh",
      createHandle: createMeshHandle,
      idPrefix: "mesh",
      label: (asset) => asset.label,
    }),
    materials: new MaterialAssetCollections(registry),
    shaders: new TypedAssetCollection<"shader", WgslShaderAsset>({
      registry,
      kind: "shader",
      createHandle: createShaderHandle,
      idPrefix: "shader",
      label: (asset) => asset.label,
    }),
    fontAtlases: new TypedAssetCollection<"font-atlas", MsdfFontAtlasAsset>({
      registry,
      kind: "font-atlas",
      createHandle: createFontAtlasHandle,
      idPrefix: "font-atlas",
      label: (asset) => asset.label,
      dependencies: msdfFontAtlasDependencies,
    }),
    particleEffects: new TypedAssetCollection<
      "particle-effect",
      ParticleEffectAsset
    >({
      registry,
      kind: "particle-effect",
      createHandle: createParticleEffectHandle,
      idPrefix: "particle-effect",
      label: (asset) => asset.label,
      dependencies: particleEffectDependencies,
    }),
  };
}

export function materialAssetDependencies(
  material: SourceMaterialAsset,
): readonly AssetHandle[] {
  const dependencies: AssetHandle[] = [];
  const seen = new Set<string>();

  if (isCustomWgslMaterialAsset(material)) {
    for (const dependency of material.dependencies) {
      appendDependency(dependency.handle, dependencies, seen);
    }

    for (const binding of material.bindings) {
      if (binding.kind === "texture") {
        appendDependency(binding.texture, dependencies, seen);
      }

      if (binding.kind === "sampler") {
        appendDependency(binding.sampler, dependencies, seen);
      }
    }

    return dependencies;
  }

  for (const [, binding] of materialTextureBindings(material)) {
    appendDependency(binding.texture, dependencies, seen);
    appendDependency(binding.sampler, dependencies, seen);
  }

  return dependencies;
}

function appendDependency(
  handle: AssetHandle | null,
  dependencies: AssetHandle[],
  seen: Set<string>,
): void {
  if (handle === null) {
    return;
  }

  const key = assetHandleKey(handle);

  if (!seen.has(key)) {
    seen.add(key);
    dependencies.push(handle);
  }
}

export type MeshAssetCollection = TypedAssetCollection<"mesh", MeshAsset>;
export type MaterialAssetCollection = TypedAssetCollection<
  "material",
  SourceMaterialAsset
>;
export type UnlitMaterialAssetCollection = TypedAssetCollection<
  "material",
  UnlitMaterialAsset
>;
export type MatcapMaterialAssetCollection = TypedAssetCollection<
  "material",
  MatcapMaterialAsset
>;
export type StandardMaterialAssetCollection = TypedAssetCollection<
  "material",
  StandardMaterialAsset
>;
export type DebugNormalMaterialAssetCollection = TypedAssetCollection<
  "material",
  DebugNormalMaterialAsset
>;
export type CustomWgslMaterialAssetCollection = TypedAssetCollection<
  "material",
  CustomWgslMaterialAsset
>;
export type ShaderAssetCollection = TypedAssetCollection<
  "shader",
  WgslShaderAsset
>;
