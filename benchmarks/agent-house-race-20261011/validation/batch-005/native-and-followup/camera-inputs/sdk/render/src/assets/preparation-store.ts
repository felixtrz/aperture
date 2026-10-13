import {
  assetHandleKey,
  type AssetHandle,
  type AssetKind,
} from "@aperture-engine/simulation";
import type {
  PreparedRenderAssetEntry,
  PreparedRenderAssetStoreRemoval,
  PreparedRenderAssetStoreUpdate,
  RenderAssetDependencyState,
  RenderAssetPreparationDiagnostic,
} from "./preparation-types.js";

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
