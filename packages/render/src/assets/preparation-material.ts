import type {
  AssetRegistry,
  MaterialHandle,
} from "@aperture-engine/simulation";
import {
  createPreparedMaterialResourceDescriptor,
  type MaterialAsset,
  type MaterialKind,
  type PreparedMaterialResourceDescriptor,
} from "../materials/index.js";
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

export type PreparedMaterialAssetStore = PreparedRenderAssetStore<
  "material",
  PreparedMaterialAssetMetadata
>;

export function createPreparedMaterialAssetStore(): PreparedMaterialAssetStore {
  return new PreparedRenderAssetStore<
    "material",
    PreparedMaterialAssetMetadata
  >();
}

export interface PreparedMaterialStore {
  readonly entries: PreparedMaterialAssetStore;
  get(
    handle: MaterialHandle,
  ):
    | PreparedRenderAssetEntry<"material", PreparedMaterialAssetMetadata>
    | undefined;
  list(): PreparedRenderAssetEntry<"material", PreparedMaterialAssetMetadata>[];
  prepare(
    options: PreparedMaterialStorePrepareOptions,
  ): RenderAssetPreparationReport<"material", PreparedMaterialAssetMetadata>;
  remove(
    handle: MaterialHandle,
  ): PreparedRenderAssetStoreRemoval<"material", PreparedMaterialAssetMetadata>;
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
  readonly materialFamily: MaterialKind;
  readonly materialKind: MaterialKind;
  readonly pipelineKey: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly dependencyCount: number;
  readonly textureBindingCount: number;
  readonly diagnosticCount: number;
}

export interface PreparedMaterialStoreJsonValue {
  readonly totalEntries: number;
  readonly families: Record<
    MaterialKind,
    PreparedMaterialStoreFamilyJsonSummary
  >;
  readonly entries: readonly PreparedMaterialStoreEntryJsonValue[];
}

export function createPreparedMaterialStore(
  options: {
    readonly entries?: PreparedMaterialAssetStore;
  } = {},
): PreparedMaterialStore {
  const entries = options.entries ?? createPreparedMaterialAssetStore();
  const adapter = createMaterialMetadataRenderAssetAdapter();

  return {
    entries,
    get(handle) {
      return entries.get(handle);
    },
    list() {
      return entries.list();
    },
    prepare(prepareOptions) {
      return prepareRenderAsset({
        registry: prepareOptions.registry,
        adapter,
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
    families[entry.materialFamily] = {
      entries: families[entry.materialFamily].entries + 1,
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
  MaterialKind,
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
  entry: PreparedRenderAssetEntry<"material", PreparedMaterialAssetMetadata>,
): PreparedMaterialStoreEntryJsonValue {
  return {
    assetKey: entry.assetKey,
    sourceVersion: entry.sourceVersion,
    label: entry.prepared.label,
    materialFamily: entry.prepared.materialFamily,
    materialKind: entry.prepared.materialKind,
    pipelineKey: entry.prepared.pipelineKey,
    materialResourceKey: entry.prepared.materialResourceKey,
    bindGroupResourceKey: entry.prepared.bindGroupResourceKey,
    dependencyCount: entry.prepared.dependencies.length,
    textureBindingCount: entry.prepared.textureBindings.length,
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
