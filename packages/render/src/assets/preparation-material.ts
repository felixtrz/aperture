import type {
  AssetRegistry,
  MaterialHandle,
} from "@aperture-engine/simulation";
import {
  createPreparedMaterialResourceDescriptor,
  isCustomWgslMaterialAsset,
  type MaterialAsset,
  type MaterialKind,
  type PreparedMaterialResourceDescriptor,
  type SourceMaterialAsset,
} from "../materials/index.js";
import {
  createCustomWgslMaterialRenderAssetAdapter,
  type PreparedCustomWgslMaterial,
} from "./custom-wgsl-material-preparation.js";
import { prepareRenderAsset } from "./preparation-core.js";
import { PreparedRenderAssetStore } from "./preparation-store.js";
import type {
  PreparedRenderAssetEntry,
  PreparedRenderAssetStoreRemoval,
  RenderAssetAdapter,
  RenderAssetPreparationDiagnostic,
  RenderAssetPreparationReport,
  RenderAssetPrepareInput,
} from "./preparation-types.js";

export interface PreparedMaterialAssetMetadata {
  readonly resourceFamily: PreparedMaterialResourceDescriptor["resourceFamily"];
  readonly sourceMaterialKey: PreparedMaterialResourceDescriptor["sourceMaterialKey"];
  readonly materialKey: PreparedMaterialResourceDescriptor["materialKey"];
  readonly label: PreparedMaterialResourceDescriptor["label"];
  readonly materialFamily: PreparedMaterialResourceDescriptor["materialFamily"];
  readonly materialKind: PreparedMaterialResourceDescriptor["materialKind"];
  readonly pipelineKey: PreparedMaterialResourceDescriptor["pipelineKey"];
  readonly pipelineKeyInput: PreparedMaterialResourceDescriptor["pipelineKeyInput"];
  readonly materialResourceKey: PreparedMaterialResourceDescriptor["materialResourceKey"];
  readonly bindGroupResourceKey: PreparedMaterialResourceDescriptor["bindGroupResourceKey"];
  readonly dependencies: PreparedMaterialResourceDescriptor["dependencies"];
  readonly textureBindings: PreparedMaterialResourceDescriptor["textureBindings"];
  readonly dependencyReadiness: PreparedMaterialResourceDescriptor["dependencyReadiness"];
}

export type PreparedSourceMaterialMetadata =
  | PreparedMaterialAssetMetadata
  | PreparedCustomWgslMaterial;

export type PreparedMaterialAssetStore = PreparedRenderAssetStore<
  "material",
  PreparedSourceMaterialMetadata
>;

export function createPreparedMaterialAssetStore(): PreparedMaterialAssetStore {
  return new PreparedRenderAssetStore<
    "material",
    PreparedSourceMaterialMetadata
  >();
}

export interface PreparedMaterialStore {
  readonly entries: PreparedMaterialAssetStore;
  get(
    handle: MaterialHandle,
  ):
    | PreparedRenderAssetEntry<"material", PreparedSourceMaterialMetadata>
    | undefined;
  list(): PreparedRenderAssetEntry<
    "material",
    PreparedSourceMaterialMetadata
  >[];
  prepare(
    options: PreparedMaterialStorePrepareOptions,
  ): RenderAssetPreparationReport<"material", PreparedSourceMaterialMetadata>;
  remove(
    handle: MaterialHandle,
  ): PreparedRenderAssetStoreRemoval<
    "material",
    PreparedSourceMaterialMetadata
  >;
  clear(): void;
}

export interface PreparedMaterialStorePrepareOptions {
  readonly registry: AssetRegistry;
  readonly handle: MaterialHandle;
}

export interface PreparedMaterialStoreFamilyJsonSummary {
  readonly entries: number;
}

export interface PreparedMaterialStoreEntryJsonValue {
  readonly assetKey: string;
  readonly sourceVersion: number;
  readonly label: string;
  readonly materialFamily: string;
  readonly materialKind?: MaterialKind;
  readonly pipelineKey: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly dependencyCount: number;
  readonly textureBindingCount: number;
  readonly diagnosticCount: number;
}

export interface PreparedMaterialStoreJsonValue {
  readonly totalEntries: number;
  readonly families: Record<string, PreparedMaterialStoreFamilyJsonSummary>;
  readonly entries: readonly PreparedMaterialStoreEntryJsonValue[];
}

export function createPreparedMaterialStore(
  options: {
    readonly entries?: PreparedMaterialAssetStore;
  } = {},
): PreparedMaterialStore {
  const entries = options.entries ?? createPreparedMaterialAssetStore();
  const builtInAdapter = createMaterialMetadataRenderAssetAdapter();

  return {
    entries,
    get(handle) {
      return entries.get(handle);
    },
    list() {
      return entries.list();
    },
    prepare(prepareOptions) {
      const entry = prepareOptions.registry.get<
        "material",
        SourceMaterialAsset
      >(prepareOptions.handle);
      const adapter =
        entry?.status === "ready" &&
        entry.asset !== null &&
        isCustomWgslMaterialAsset(entry.asset)
          ? createCustomWgslMaterialRenderAssetAdapter(entry.asset.familyKey)
          : builtInAdapter;

      return prepareRenderAsset({
        registry: prepareOptions.registry,
        adapter: adapter as RenderAssetAdapter<
          "material",
          SourceMaterialAsset,
          PreparedSourceMaterialMetadata
        >,
        store: entries,
        handle: prepareOptions.handle,
      });
    },
    remove(handle) {
      return entries.remove(handle);
    },
    clear() {
      entries.clear();
    },
  };
}

export function preparedMaterialStoreSummaryToJsonValue(
  store: PreparedMaterialStore,
): PreparedMaterialStoreJsonValue {
  const entries = store
    .list()
    .map((entry) => preparedMaterialStoreEntryToJsonValue(entry));
  const families = createEmptyPreparedMaterialFamilySummary();

  for (const entry of entries) {
    const summary = families[entry.materialFamily] ?? { entries: 0 };
    families[entry.materialFamily] = {
      entries: summary.entries + 1,
    };
  }

  return {
    totalEntries: entries.length,
    families,
    entries,
  };
}

export function createMaterialMetadataRenderAssetAdapter(): RenderAssetAdapter<
  "material",
  MaterialAsset,
  PreparedMaterialAssetMetadata
> {
  return {
    kind: "material",
    family: "material.metadata",
    prepare(input) {
      if (!input.dependencyState.ready) {
        return {
          status: "retry",
          diagnostics: dependencyDiagnostics(input),
        };
      }

      const descriptorResult = createPreparedMaterialResourceDescriptor({
        registry: input.registry,
        material: input.handle,
      });

      if (!descriptorResult.valid || descriptorResult.descriptor === null) {
        return {
          status: "failed",
          diagnostics: descriptorResult.diagnostics.map((diagnostic) => ({
            code: `renderAsset.${diagnostic.code}`,
            message: diagnostic.message,
            severity: "error",
            assetKey: input.assetKey,
            ...("dependencyKey" in diagnostic &&
            diagnostic.dependencyKey !== undefined
              ? { dependencyKey: diagnostic.dependencyKey }
              : {}),
          })),
        };
      }

      return {
        status: "prepared",
        prepared: descriptorResult.descriptor,
      };
    },
  };
}

function createEmptyPreparedMaterialFamilySummary(): Record<
  string,
  PreparedMaterialStoreFamilyJsonSummary
> {
  return {
    unlit: { entries: 0 },
    matcap: { entries: 0 },
    standard: { entries: 0 },
    "debug-normal": { entries: 0 },
  };
}

function preparedMaterialStoreEntryToJsonValue(
  entry: PreparedRenderAssetEntry<"material", PreparedSourceMaterialMetadata>,
): PreparedMaterialStoreEntryJsonValue {
  return {
    assetKey: entry.assetKey,
    sourceVersion: entry.sourceVersion,
    label: entry.prepared.label,
    materialFamily: entry.prepared.materialFamily,
    ...("materialKind" in entry.prepared
      ? { materialKind: entry.prepared.materialKind }
      : {}),
    pipelineKey: entry.prepared.pipelineKey,
    materialResourceKey: entry.prepared.materialResourceKey,
    bindGroupResourceKey: entry.prepared.bindGroupResourceKey,
    dependencyCount:
      "dependencies" in entry.prepared ? entry.prepared.dependencies.length : 0,
    textureBindingCount:
      "textureBindings" in entry.prepared
        ? entry.prepared.textureBindings.length
        : entry.prepared.bindGroup.entries.filter(
            (binding) => binding.kind === "texture",
          ).length,
    diagnosticCount: entry.diagnostics.length,
  };
}

function dependencyDiagnostics<TPrepared>(
  input: RenderAssetPrepareInput<"material", MaterialAsset, TPrepared>,
): readonly RenderAssetPreparationDiagnostic[] {
  return input.dependencyState.diagnostics.map((diagnostic) => ({
    code: `renderAsset.${diagnostic.code}`,
    message: diagnostic.message,
    severity: "warning",
    assetKey: input.assetKey,
    dependencyKey: diagnostic.dependencyKey,
  }));
}
