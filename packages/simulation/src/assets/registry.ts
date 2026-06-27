import { assetHandleKey } from "./handles.js";
import { ASSET_KINDS } from "./types.js";
import type {
  AssetDependencyDiagnostic,
  AssetDependencyReport,
  AssetDiagnostic,
  AssetHandle,
  AssetKind,
  AssetListFilter,
  AssetManifestDependencyEdge,
  AssetManifestReport,
  AssetProvenance,
  AssetRegistryEntry,
  AssetStatus,
  RegisterAssetOptions,
} from "./types.js";

export class AssetRegistry {
  readonly #entries = new Map<string, AssetRegistryEntry>();

  register<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
    options: RegisterAssetOptions = {},
  ): AssetRegistryEntry<TKind, TAsset> {
    const key = assetHandleKey(handle);

    if (this.#entries.has(key)) {
      throw new Error(`Asset '${key}' is already registered.`);
    }

    const entry: AssetRegistryEntry<TKind, TAsset> = {
      handle,
      kind: handle.kind,
      label: options.label ?? handle.id,
      status: "registered",
      version: 0,
      asset: null,
      dependencies: [...(options.dependencies ?? [])],
      diagnostics: [...(options.diagnostics ?? [])],
    };

    this.#entries.set(key, entry as AssetRegistryEntry);
    return entry;
  }

  unregister<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
  ): AssetRegistryEntry<TKind, TAsset> | undefined {
    const key = assetHandleKey(handle);
    const entry = this.#entries.get(key) as
      | AssetRegistryEntry<TKind, TAsset>
      | undefined;

    if (entry === undefined) {
      return undefined;
    }

    this.#entries.delete(key);
    return entry;
  }

  has(handle: AssetHandle): boolean {
    return this.#entries.has(assetHandleKey(handle));
  }

  get<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
  ): AssetRegistryEntry<TKind, TAsset> | undefined {
    return this.#entries.get(assetHandleKey(handle)) as
      | AssetRegistryEntry<TKind, TAsset>
      | undefined;
  }

  getStatus(handle: AssetHandle): AssetStatus | undefined {
    return this.get(handle)?.status;
  }

  markLoading<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
  ): AssetRegistryEntry<TKind, TAsset> {
    return this.update<TKind, TAsset>(handle, {
      status: "loading",
      asset: null,
    });
  }

  markReady<TKind extends AssetKind, TAsset>(
    handle: AssetHandle<TKind>,
    asset: TAsset,
    diagnostics: readonly AssetDiagnostic[] = [],
    provenance: AssetProvenance = "loaded",
  ): AssetRegistryEntry<TKind, TAsset> {
    return this.update(handle, {
      status: "ready",
      asset,
      diagnostics,
      provenance,
    });
  }

  markFailed<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
    diagnostics: readonly AssetDiagnostic[],
  ): AssetRegistryEntry<TKind, TAsset> {
    return this.update<TKind, TAsset>(handle, {
      status: "failed",
      asset: null,
      diagnostics,
    });
  }

  list(filter: AssetListFilter = {}): AssetRegistryEntry[] {
    return [...this.#entries.values()].filter((entry) => {
      if (filter.kind !== undefined && entry.kind !== filter.kind) {
        return false;
      }

      if (filter.status !== undefined && entry.status !== filter.status) {
        return false;
      }

      return true;
    });
  }

  collectDiagnostics(handle?: AssetHandle): AssetDiagnostic[] {
    if (handle !== undefined) {
      return [...(this.get(handle)?.diagnostics ?? [])];
    }

    return this.list().flatMap((entry) => [...entry.diagnostics]);
  }

  inspectDependencies(handle: AssetHandle): AssetDependencyReport {
    return {
      handleKey: assetHandleKey(handle),
      diagnostics: this.collectDependencyDiagnostics(handle),
    };
  }

  createManifestReport(): AssetManifestReport {
    const byKind = emptyKindCounts();
    const byStatus = emptyStatusCounts();
    const dependencies: AssetManifestDependencyEdge[] = [];
    const diagnostics: AssetDependencyDiagnostic[] = [];
    const placeholderIds: string[] = [];

    for (const entry of this.list()) {
      byKind[entry.kind] += 1;
      byStatus[entry.status] += 1;

      if (entry.provenance === "placeholder") {
        placeholderIds.push(entry.handle.id);
      }

      for (const dependency of entry.dependencies) {
        dependencies.push({
          from: assetHandleKey(entry.handle),
          to: assetHandleKey(dependency),
        });
      }

      diagnostics.push(...this.collectDependencyDiagnostics(entry.handle));
    }

    return {
      total: this.#entries.size,
      byKind,
      byStatus,
      dependencies,
      diagnostics,
      placeholders: { count: placeholderIds.length, ids: placeholderIds },
    };
  }

  private update<TKind extends AssetKind, TAsset>(
    handle: AssetHandle<TKind>,
    patch: {
      readonly status: AssetStatus;
      readonly asset: TAsset | null;
      readonly diagnostics?: readonly AssetDiagnostic[];
      readonly provenance?: AssetProvenance;
    },
  ): AssetRegistryEntry<TKind, TAsset> {
    const current = this.get<TKind, TAsset>(handle);

    if (current === undefined) {
      throw new Error(`Asset '${assetHandleKey(handle)}' is not registered.`);
    }

    const next: AssetRegistryEntry<TKind, TAsset> = {
      ...current,
      status: patch.status,
      version: current.version + 1,
      asset: patch.asset,
      diagnostics:
        patch.diagnostics === undefined
          ? current.diagnostics
          : [...patch.diagnostics],
      ...(patch.provenance === undefined
        ? {}
        : { provenance: patch.provenance }),
    };

    this.#entries.set(assetHandleKey(handle), next as AssetRegistryEntry);
    return next;
  }

  private collectDependencyDiagnostics(
    handle: AssetHandle,
  ): AssetDependencyDiagnostic[] {
    const diagnostics: AssetDependencyDiagnostic[] = [];
    const rootKey = assetHandleKey(handle);
    const visit = (current: AssetHandle, path: string[]): void => {
      const currentEntry = this.get(current);

      if (currentEntry === undefined) {
        diagnostics.push({
          code: "asset.dependencyMissing",
          handleKey: rootKey,
          dependencyKey: assetHandleKey(current),
          path,
          message: `Missing dependency '${assetHandleKey(current)}'.`,
        });
        return;
      }

      for (const dependency of currentEntry.dependencies) {
        const dependencyKey = assetHandleKey(dependency);
        const nextPath = [...path, dependencyKey];
        const dependencyEntry = this.get(dependency);

        if (path.includes(dependencyKey)) {
          diagnostics.push({
            code: "asset.dependencyCycle",
            handleKey: rootKey,
            dependencyKey,
            path: nextPath,
            message: `Circular dependency detected at '${dependencyKey}'.`,
          });
          continue;
        }

        if (dependencyEntry === undefined) {
          diagnostics.push({
            code: "asset.dependencyMissing",
            handleKey: rootKey,
            dependencyKey,
            path: nextPath,
            message: `Missing dependency '${dependencyKey}'.`,
          });
          continue;
        }

        if (dependencyEntry.status === "loading") {
          diagnostics.push({
            code: "asset.dependencyLoading",
            handleKey: rootKey,
            dependencyKey,
            path: nextPath,
            message: `Dependency '${dependencyKey}' is still loading.`,
          });
        }

        if (dependencyEntry.status === "failed") {
          diagnostics.push({
            code: "asset.dependencyFailed",
            handleKey: rootKey,
            dependencyKey,
            path: nextPath,
            message: `Dependency '${dependencyKey}' failed.`,
          });
        }

        visit(dependency, nextPath);
      }
    };

    visit(handle, [rootKey]);
    return diagnostics;
  }
}

function emptyKindCounts(): Record<AssetKind, number> {
  return Object.fromEntries(ASSET_KINDS.map((kind) => [kind, 0])) as Record<
    AssetKind,
    number
  >;
}

function emptyStatusCounts(): Record<AssetStatus, number> {
  return {
    registered: 0,
    loading: 0,
    ready: 0,
    failed: 0,
  };
}
