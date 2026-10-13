import type { AssetRegistry, MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import { validateMeshAsset } from "../mesh/index.js";
import { prepareRenderAsset } from "./preparation-core.js";
import { PreparedRenderAssetStore } from "./preparation-store.js";
import type {
  PreparedRenderAssetEntry,
  PreparedRenderAssetStoreRemoval,
  RenderAssetAdapter,
  RenderAssetPreparationReport,
} from "./preparation-types.js";

export interface PreparedMeshAssetMetadata {
  readonly resourceFamily: "mesh";
  readonly sourceMeshKey: string;
  readonly meshResourceKey: string;
  readonly label: string;
  readonly vertexStreams: number;
  readonly submeshes: number;
  readonly hasIndexBuffer: boolean;
}

export type PreparedMeshAssetStore = PreparedRenderAssetStore<
  "mesh",
  PreparedMeshAssetMetadata
>;

export function createPreparedMeshAssetStore(): PreparedMeshAssetStore {
  return new PreparedRenderAssetStore<"mesh", PreparedMeshAssetMetadata>();
}

export interface PreparedMeshStore {
  readonly entries: PreparedMeshAssetStore;
  get(
    handle: MeshHandle,
  ): PreparedRenderAssetEntry<"mesh", PreparedMeshAssetMetadata> | undefined;
  list(): PreparedRenderAssetEntry<"mesh", PreparedMeshAssetMetadata>[];
  prepare(
    options: PreparedMeshStorePrepareOptions,
  ): RenderAssetPreparationReport<"mesh", PreparedMeshAssetMetadata>;
  remove(
    handle: MeshHandle,
  ): PreparedRenderAssetStoreRemoval<"mesh", PreparedMeshAssetMetadata>;
  clear(): void;
}

export interface PreparedMeshStorePrepareOptions {
  readonly registry: AssetRegistry;
  readonly handle: MeshHandle;
}

export interface PreparedMeshStoreEntryJsonValue {
  readonly assetKey: string;
  readonly sourceVersion: number;
  readonly label: string;
  readonly meshResourceKey: string;
  readonly vertexStreams: number;
  readonly submeshes: number;
  readonly hasIndexBuffer: boolean;
  readonly diagnosticCount: number;
}

export interface PreparedMeshStoreJsonValue {
  readonly totalEntries: number;
  readonly entries: readonly PreparedMeshStoreEntryJsonValue[];
}

export function createPreparedMeshStore(
  options: {
    readonly entries?: PreparedMeshAssetStore;
  } = {},
): PreparedMeshStore {
  const entries = options.entries ?? createPreparedMeshAssetStore();
  const adapter = createMeshMetadataRenderAssetAdapter();

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

export function preparedMeshStoreSummaryToJsonValue(
  store: PreparedMeshStore,
): PreparedMeshStoreJsonValue {
  return {
    totalEntries: store.entries.size,
    entries: store
      .list()
      .map((entry) => preparedMeshStoreEntryToJsonValue(entry)),
  };
}

export function createMeshMetadataRenderAssetAdapter(): RenderAssetAdapter<
  "mesh",
  MeshAsset,
  PreparedMeshAssetMetadata
> {
  return {
    kind: "mesh",
    family: "mesh.metadata",
    prepare(input) {
      const validation = validateMeshAsset(input.source);

      if (!validation.valid) {
        return {
          status: "failed",
          diagnostics: validation.diagnostics.map((diagnostic) => ({
            code: `renderAsset.${diagnostic.code}`,
            message: diagnostic.message,
            severity: "error",
            assetKey: input.assetKey,
          })),
        };
      }

      return {
        status: "prepared",
        prepared: {
          resourceFamily: "mesh",
          sourceMeshKey: input.assetKey,
          meshResourceKey: `prepared-mesh:${input.assetKey}`,
          label: input.source.label,
          vertexStreams: input.source.vertexStreams.length,
          submeshes: input.source.submeshes.length,
          hasIndexBuffer: input.source.indexBuffer !== undefined,
        },
      };
    },
  };
}

function preparedMeshStoreEntryToJsonValue(
  entry: PreparedRenderAssetEntry<"mesh", PreparedMeshAssetMetadata>,
): PreparedMeshStoreEntryJsonValue {
  return {
    assetKey: entry.assetKey,
    sourceVersion: entry.sourceVersion,
    label: entry.prepared.label,
    meshResourceKey: entry.prepared.meshResourceKey,
    vertexStreams: entry.prepared.vertexStreams,
    submeshes: entry.prepared.submeshes,
    hasIndexBuffer: entry.prepared.hasIndexBuffer,
    diagnosticCount: entry.diagnostics.length,
  };
}
