import {
  assetHandleKey,
  type AssetDependencyDiagnostic,
  type AssetHandle,
  type AssetKind,
  type AssetRegistry,
  type AssetRegistryEntry,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import {
  createPreparedMaterialResourceDescriptor,
  type MaterialAsset,
  type MaterialKind,
  type PreparedMaterialResourceDescriptor,
} from "../materials/index.js";
import { type MeshAsset, validateMeshAsset } from "../mesh/index.js";

export type RenderAssetPreparationSeverity = "info" | "warning" | "error";

export interface RenderAssetPreparationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: RenderAssetPreparationSeverity;
  readonly assetKey?: string;
  readonly dependencyKey?: string;
}

export interface RenderAssetDependencyState {
  readonly key: string;
  readonly ready: boolean;
  readonly dependencies: readonly AssetHandle[];
  readonly diagnostics: readonly AssetDependencyDiagnostic[];
}

export interface RenderAssetPrepareInput<
  TKind extends AssetKind,
  TSource,
  TPrepared,
> {
  readonly registry: AssetRegistry;
  readonly handle: AssetHandle<TKind>;
  readonly assetKey: string;
  readonly source: TSource;
  readonly sourceVersion: number;
  readonly dependencyState: RenderAssetDependencyState;
  readonly previous: PreparedRenderAssetEntry<TKind, TPrepared> | undefined;
}

export interface RenderAssetPrepareSuccess<TPrepared> {
  readonly status: "prepared";
  readonly prepared: TPrepared;
  readonly diagnostics?: readonly RenderAssetPreparationDiagnostic[];
}

export interface RenderAssetPrepareRetry {
  readonly status: "retry";
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}

export interface RenderAssetPrepareFailure {
  readonly status: "failed";
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}

export type RenderAssetPrepareResult<TPrepared> =
  | RenderAssetPrepareSuccess<TPrepared>
  | RenderAssetPrepareRetry
  | RenderAssetPrepareFailure;

export interface RenderAssetUnloadInput<TKind extends AssetKind, TPrepared> {
  readonly handle: AssetHandle<TKind>;
  readonly assetKey: string;
  readonly prepared: PreparedRenderAssetEntry<TKind, TPrepared>;
}

export interface RenderAssetUnloadResult {
  readonly diagnostics?: readonly RenderAssetPreparationDiagnostic[];
}

export interface RenderAssetAdapter<
  TKind extends AssetKind,
  TSource,
  TPrepared,
> {
  readonly kind: TKind;
  readonly family: string;
  prepare(
    input: RenderAssetPrepareInput<TKind, TSource, TPrepared>,
  ): RenderAssetPrepareResult<TPrepared>;
  unload?(
    input: RenderAssetUnloadInput<TKind, TPrepared>,
  ): RenderAssetUnloadResult | void;
}

export interface PreparedRenderAssetEntry<TKind extends AssetKind, TPrepared> {
  readonly handle: AssetHandle<TKind>;
  readonly assetKey: string;
  readonly family: string;
  readonly sourceVersion: number;
  readonly dependencyState: RenderAssetDependencyState;
  readonly prepared: TPrepared;
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}

export type PreparedRenderAssetStoreAction = "created" | "updated";

export interface PreparedRenderAssetStoreUpdate<
  TKind extends AssetKind,
  TPrepared,
> {
  readonly action: PreparedRenderAssetStoreAction;
  readonly entry: PreparedRenderAssetEntry<TKind, TPrepared>;
}

export interface PreparedRenderAssetStoreRemoval<
  TKind extends AssetKind,
  TPrepared,
> {
  readonly removed: boolean;
  readonly entry?: PreparedRenderAssetEntry<TKind, TPrepared>;
}

export class PreparedRenderAssetStore<TKind extends AssetKind, TPrepared> {
  readonly #entries = new Map<
    string,
    PreparedRenderAssetEntry<TKind, TPrepared>
  >();

  get size(): number {
    return this.#entries.size;
  }

  has(handle: AssetHandle<TKind>): boolean {
    return this.#entries.has(assetHandleKey(handle));
  }

  get(
    handle: AssetHandle<TKind>,
  ): PreparedRenderAssetEntry<TKind, TPrepared> | undefined {
    return this.#entries.get(assetHandleKey(handle));
  }

  list(): PreparedRenderAssetEntry<TKind, TPrepared>[] {
    return [...this.#entries.values()].sort((a, b) =>
      a.assetKey.localeCompare(b.assetKey),
    );
  }

  upsert(input: {
    readonly handle: AssetHandle<TKind>;
    readonly family: string;
    readonly sourceVersion: number;
    readonly dependencyState: RenderAssetDependencyState;
    readonly prepared: TPrepared;
    readonly diagnostics?: readonly RenderAssetPreparationDiagnostic[];
  }): PreparedRenderAssetStoreUpdate<TKind, TPrepared> {
    const assetKey = assetHandleKey(input.handle);
    const action = this.#entries.has(assetKey) ? "updated" : "created";
    const entry: PreparedRenderAssetEntry<TKind, TPrepared> = {
      handle: input.handle,
      assetKey,
      family: input.family,
      sourceVersion: input.sourceVersion,
      dependencyState: input.dependencyState,
      prepared: input.prepared,
      diagnostics: [...(input.diagnostics ?? [])],
    };

    this.#entries.set(assetKey, entry);
    return { action, entry };
  }

  remove(
    handle: AssetHandle<TKind>,
  ): PreparedRenderAssetStoreRemoval<TKind, TPrepared> {
    const assetKey = assetHandleKey(handle);
    const entry = this.#entries.get(assetKey);

    if (entry === undefined) {
      return { removed: false };
    }

    this.#entries.delete(assetKey);
    return { removed: true, entry };
  }

  clear(): void {
    this.#entries.clear();
  }
}

export type RenderAssetPreparationOutcome =
  | "prepared"
  | "unchanged"
  | "retry"
  | "failed"
  | "skipped";

export interface RenderAssetPreparationReport<
  TKind extends AssetKind,
  TPrepared,
> {
  readonly outcome: RenderAssetPreparationOutcome;
  readonly assetKey: string;
  readonly action?: PreparedRenderAssetStoreAction;
  readonly entry?: PreparedRenderAssetEntry<TKind, TPrepared>;
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}

export interface PrepareRenderAssetOptions<
  TKind extends AssetKind,
  TSource,
  TPrepared,
> {
  readonly registry: AssetRegistry;
  readonly adapter: RenderAssetAdapter<TKind, TSource, TPrepared>;
  readonly store: PreparedRenderAssetStore<TKind, TPrepared>;
  readonly handle: AssetHandle<TKind>;
}

export function prepareRenderAsset<TKind extends AssetKind, TSource, TPrepared>(
  options: PrepareRenderAssetOptions<TKind, TSource, TPrepared>,
): RenderAssetPreparationReport<TKind, TPrepared> {
  const assetKey = assetHandleKey(options.handle);
  const entry = options.registry.get<TKind, TSource>(options.handle);

  if (entry === undefined) {
    options.store.remove(options.handle);
    return skippedReport(assetKey, {
      code: "renderAsset.sourceMissing",
      message: `Source asset '${assetKey}' is not registered.`,
      severity: "warning",
      assetKey,
    });
  }

  if (entry.status !== "ready" || entry.asset === null) {
    options.store.remove(options.handle);
    return skippedReport(assetKey, {
      code: `renderAsset.source.${entry.status}`,
      message: `Source asset '${assetKey}' is ${entry.status}.`,
      severity: entry.status === "failed" ? "error" : "warning",
      assetKey,
    });
  }

  const dependencyState = createRenderAssetDependencyState(
    options.registry,
    entry,
  );
  const previous = options.store.get(options.handle);

  if (
    previous !== undefined &&
    previous.sourceVersion === entry.version &&
    previous.dependencyState.key === dependencyState.key
  ) {
    return {
      outcome: "unchanged",
      assetKey,
      entry: previous,
      diagnostics: [],
    };
  }

  const result = options.adapter.prepare({
    registry: options.registry,
    handle: options.handle,
    assetKey,
    source: entry.asset,
    sourceVersion: entry.version,
    dependencyState,
    previous,
  });

  if (result.status === "prepared") {
    const update = options.store.upsert({
      handle: options.handle,
      family: options.adapter.family,
      sourceVersion: entry.version,
      dependencyState,
      prepared: result.prepared,
      ...(result.diagnostics !== undefined
        ? { diagnostics: result.diagnostics }
        : {}),
    });

    return {
      outcome: "prepared",
      assetKey,
      action: update.action,
      entry: update.entry,
      diagnostics: result.diagnostics ?? [],
    };
  }

  options.store.remove(options.handle);
  return {
    outcome: result.status,
    assetKey,
    diagnostics: result.diagnostics,
  };
}

export interface UnloadPreparedRenderAssetOptions<
  TKind extends AssetKind,
  TPrepared,
> {
  readonly adapter: Pick<
    RenderAssetAdapter<TKind, unknown, TPrepared>,
    "unload"
  >;
  readonly store: PreparedRenderAssetStore<TKind, TPrepared>;
  readonly handle: AssetHandle<TKind>;
}

export interface UnloadPreparedRenderAssetReport<
  TKind extends AssetKind,
  TPrepared,
> {
  readonly removed: boolean;
  readonly assetKey: string;
  readonly entry?: PreparedRenderAssetEntry<TKind, TPrepared>;
  readonly diagnostics: readonly RenderAssetPreparationDiagnostic[];
}

export function unloadPreparedRenderAsset<TKind extends AssetKind, TPrepared>(
  options: UnloadPreparedRenderAssetOptions<TKind, TPrepared>,
): UnloadPreparedRenderAssetReport<TKind, TPrepared> {
  const assetKey = assetHandleKey(options.handle);
  const removal = options.store.remove(options.handle);

  if (!removal.removed || removal.entry === undefined) {
    return { removed: false, assetKey, diagnostics: [] };
  }

  const unload = options.adapter.unload?.({
    handle: options.handle,
    assetKey,
    prepared: removal.entry,
  });

  return {
    removed: true,
    assetKey,
    entry: removal.entry,
    diagnostics: unload?.diagnostics ?? [],
  };
}

export interface PreparedMeshAssetMetadata {
  readonly resourceFamily: "mesh";
  readonly label: string;
  readonly vertexStreams: number;
  readonly submeshes: number;
  readonly hasIndexBuffer: boolean;
}

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

export type PreparedMeshAssetStore = PreparedRenderAssetStore<
  "mesh",
  PreparedMeshAssetMetadata
>;
export type PreparedMaterialAssetStore = PreparedRenderAssetStore<
  "material",
  PreparedMaterialAssetMetadata
>;

export function createPreparedMeshAssetStore(): PreparedMeshAssetStore {
  return new PreparedRenderAssetStore<"mesh", PreparedMeshAssetMetadata>();
}

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
          label: input.source.label,
          vertexStreams: input.source.vertexStreams.length,
          submeshes: input.source.submeshes.length,
          hasIndexBuffer: input.source.indexBuffer !== undefined,
        },
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

export function createRenderAssetDependencyState<
  TKind extends AssetKind,
  TAsset,
>(
  registry: AssetRegistry,
  entry: AssetRegistryEntry<TKind, TAsset>,
): RenderAssetDependencyState {
  const diagnostics = registry.inspectDependencies(entry.handle).diagnostics;
  const dependencyStatuses = entry.dependencies.map((dependency) => {
    const dependencyEntry = registry.get(dependency);
    return `${assetHandleKey(dependency)}:${dependencyEntry?.status ?? "missing"}:${dependencyEntry?.version ?? -1}`;
  });

  return {
    key: [...dependencyStatuses, ...diagnostics.map(diagnosticKey)]
      .sort()
      .join("|"),
    ready: diagnostics.length === 0,
    dependencies: [...entry.dependencies],
    diagnostics,
  };
}

function skippedReport<TKind extends AssetKind, TPrepared>(
  assetKey: string,
  diagnostic: RenderAssetPreparationDiagnostic,
): RenderAssetPreparationReport<TKind, TPrepared> {
  return {
    outcome: "skipped",
    assetKey,
    diagnostics: [diagnostic],
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

function diagnosticKey(diagnostic: AssetDependencyDiagnostic): string {
  return `${diagnostic.code}:${diagnostic.dependencyKey}:${diagnostic.path.join(">")}`;
}
