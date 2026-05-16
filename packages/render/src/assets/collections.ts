import {
  AssetRegistry,
  TypedAssetCollection,
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
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
  DebugNormalMaterialAsset,
  MaterialAsset,
  StandardMaterialAsset,
  UnlitMaterialAsset,
} from "../materials/types.js";
import type { MeshAsset } from "../mesh/types.js";

export interface RenderAssetCollectionsOptions {
  readonly registry?: AssetRegistry;
}

export interface RenderAssetCollections {
  readonly registry: AssetRegistry;
  readonly meshes: TypedAssetCollection<"mesh", MeshAsset>;
  readonly materials: MaterialAssetCollections;
}

export class MaterialAssetCollections {
  readonly #all: TypedAssetCollection<"material", MaterialAsset>;

  readonly unlit: TypedAssetCollection<"material", UnlitMaterialAsset>;
  readonly standard: TypedAssetCollection<"material", StandardMaterialAsset>;
  readonly debugNormal: TypedAssetCollection<
    "material",
    DebugNormalMaterialAsset
  >;

  constructor(registry: AssetRegistry) {
    this.#all = new TypedAssetCollection<"material", MaterialAsset>({
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
  }

  get registry(): AssetRegistry {
    return this.#all.registry;
  }

  add(
    asset: MaterialAsset,
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
  ): AssetRegistryEntry<"material", MaterialAsset> | undefined {
    return this.#all.get(handle);
  }

  getAsset(handle: MaterialHandle): MaterialAsset | undefined {
    return this.#all.getAsset(handle);
  }

  markLoading(
    handle: MaterialHandle,
  ): AssetRegistryEntry<"material", MaterialAsset> {
    return this.#all.markLoading(handle);
  }

  markReady(
    handle: MaterialHandle,
    asset: MaterialAsset,
    diagnostics?: readonly AssetDiagnostic[],
  ): AssetRegistryEntry<"material", MaterialAsset> {
    return diagnostics === undefined
      ? this.#all.markReady(handle, asset)
      : this.#all.markReady(handle, asset, diagnostics);
  }

  markFailed(
    handle: MaterialHandle,
    diagnostics: readonly AssetDiagnostic[],
  ): AssetRegistryEntry<"material", MaterialAsset> {
    return this.#all.markFailed(handle, diagnostics);
  }

  list(
    filter: Omit<AssetListFilter, "kind"> = {},
  ): AssetRegistryEntry<"material", MaterialAsset>[] {
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
  };
}

export function materialAssetDependencies(
  material: MaterialAsset,
): readonly AssetHandle[] {
  const dependencies: AssetHandle[] = [];
  const seen = new Set<string>();

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
  MaterialAsset
>;
export type UnlitMaterialAssetCollection = TypedAssetCollection<
  "material",
  UnlitMaterialAsset
>;
export type StandardMaterialAssetCollection = TypedAssetCollection<
  "material",
  StandardMaterialAsset
>;
export type DebugNormalMaterialAssetCollection = TypedAssetCollection<
  "material",
  DebugNormalMaterialAsset
>;
