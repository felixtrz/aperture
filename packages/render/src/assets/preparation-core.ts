import {
  assetHandleKey,
  createRenderTargetHandle,
  type AssetDependencyDiagnostic,
  type AssetHandle,
  type AssetKind,
  type AssetRegistry,
  type AssetRegistryEntry,
} from "@aperture-engine/simulation";
import { isRenderTargetAsset } from "./render-target-asset.js";
import type { PreparedRenderAssetStore } from "./preparation-store.js";
import type {
  PreparedRenderAssetEntry,
  RenderAssetAdapter,
  RenderAssetDependencyState,
  RenderAssetPreparationDiagnostic,
  RenderAssetPreparationReport,
} from "./preparation-types.js";

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
    const unload = unloadPreparedRenderAsset({
      adapter: options.adapter,
      store: options.store,
      handle: options.handle,
    });
    return skippedReport(
      assetKey,
      {
        code: "renderAsset.sourceMissing",
        message: `Source asset '${assetKey}' is not registered.`,
        severity: "warning",
        assetKey,
      },
      unload.diagnostics,
    );
  }

  if (entry.status !== "ready" || entry.asset === null) {
    const unload = unloadPreparedRenderAsset({
      adapter: options.adapter,
      store: options.store,
      handle: options.handle,
    });
    return skippedReport(
      assetKey,
      {
        code: `renderAsset.source.${entry.status}`,
        message: `Source asset '${assetKey}' is ${entry.status}.`,
        severity: entry.status === "failed" ? "error" : "warning",
        assetKey,
      },
      unload.diagnostics,
    );
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

  const unload = unloadPreparedRenderAsset({
    adapter: options.adapter,
    store: options.store,
    handle: options.handle,
  });
  return {
    outcome: result.status,
    assetKey,
    diagnostics: [...result.diagnostics, ...unload.diagnostics],
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

export function createRenderAssetDependencyState<
  TKind extends AssetKind,
  TAsset,
>(
  registry: AssetRegistry,
  entry: AssetRegistryEntry<TKind, TAsset>,
): RenderAssetDependencyState {
  // B1: a missing texture dependency is satisfied by a ready, sampleable
  // facade render target registered under the same id — the renderer serves
  // the realized target color texture for the binding, so preparation must
  // not retry forever on the (intentionally unregistered) texture asset.
  const diagnostics = registry
    .inspectDependencies(entry.handle)
    .diagnostics.filter(
      (diagnostic) =>
        !(
          diagnostic.code === "asset.dependencyMissing" &&
          renderTargetSubstituteEntry(registry, diagnostic.dependencyKey) !==
            undefined
        ),
    );
  const dependencyStatuses = entry.dependencies.map((dependency) => {
    const dependencyEntry =
      registry.get(dependency) ??
      (dependency.kind === "texture"
        ? renderTargetSubstituteEntry(registry, assetHandleKey(dependency))
        : undefined);
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
  extraDiagnostics: readonly RenderAssetPreparationDiagnostic[] = [],
): RenderAssetPreparationReport<TKind, TPrepared> {
  return {
    outcome: "skipped",
    assetKey,
    diagnostics: [diagnostic, ...extraDiagnostics],
  };
}

const TEXTURE_DEPENDENCY_KEY_PREFIX = "texture:";

/**
 * B1: resolve the facade render-target entry that stands in for a missing
 * `texture:<id>` dependency (ready + sampleable), or undefined when none does.
 */
function renderTargetSubstituteEntry(
  registry: AssetRegistry,
  dependencyKey: string,
): AssetRegistryEntry | undefined {
  if (!dependencyKey.startsWith(TEXTURE_DEPENDENCY_KEY_PREFIX)) {
    return undefined;
  }

  const entry = registry.get(
    createRenderTargetHandle(
      dependencyKey.slice(TEXTURE_DEPENDENCY_KEY_PREFIX.length),
    ),
  );

  return entry !== undefined &&
    entry.status === "ready" &&
    isRenderTargetAsset(entry.asset) &&
    entry.asset.sampleable
    ? entry
    : undefined;
}

function diagnosticKey(diagnostic: AssetDependencyDiagnostic): string {
  return `${diagnostic.code}:${diagnostic.dependencyKey}:${diagnostic.path.join(">")}`;
}
