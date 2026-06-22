import { assetHandleKey } from "./handles.js";
import type { AssetRegistry } from "./registry.js";
import type {
  AssetDiagnostic,
  AssetHandle,
  AssetKind,
  AssetListFilter,
  AssetRegistryEntry,
  RegisterAssetOptions,
} from "./types.js";

export interface TypedAssetCollectionOptions<TKind extends AssetKind, TAsset> {
  readonly registry: AssetRegistry;
  readonly kind: TKind;
  readonly createHandle: (id: string) => AssetHandle<TKind>;
  readonly idPrefix?: string;
  readonly label?: (asset: TAsset) => string | undefined;
  readonly dependencies?: (asset: TAsset) => readonly AssetHandle[];
}

export interface TypedAssetRegisterOptions<
  TKind extends AssetKind,
> extends RegisterAssetOptions {
  readonly id?: string;
  readonly handle?: AssetHandle<TKind>;
}

export type TypedAssetAddOptions<TKind extends AssetKind> =
  TypedAssetRegisterOptions<TKind>;

export class TypedAssetCollection<TKind extends AssetKind, TAsset> {
  readonly #registry: AssetRegistry;
  readonly #kind: TKind;
  readonly #createHandle: (id: string) => AssetHandle<TKind>;
  readonly #idPrefix: string;
  readonly #label: (asset: TAsset) => string | undefined;
  readonly #dependencies: (asset: TAsset) => readonly AssetHandle[];
  #nextId = 1;

  constructor(options: TypedAssetCollectionOptions<TKind, TAsset>) {
    this.#registry = options.registry;
    this.#kind = options.kind;
    this.#createHandle = options.createHandle;
    this.#idPrefix = options.idPrefix ?? options.kind;
    this.#label = options.label ?? (() => undefined);
    this.#dependencies = options.dependencies ?? (() => []);
  }

  get registry(): AssetRegistry {
    return this.#registry;
  }

  get kind(): TKind {
    return this.#kind;
  }

  register(options: TypedAssetRegisterOptions<TKind> = {}): AssetHandle<TKind> {
    const handle = this.resolveHandle(options);
    this.#registry.register<TKind, TAsset>(
      handle,
      this.toRegisterOptions(options),
    );
    return handle;
  }

  add(
    asset: TAsset,
    options: TypedAssetAddOptions<TKind> = {},
  ): AssetHandle<TKind> {
    const handle = this.resolveHandle(options);
    const dependencies = mergeAssetHandles(
      this.#dependencies(asset),
      options.dependencies ?? [],
    );
    const diagnostics = options.diagnostics ?? [];
    const label = options.label ?? this.#label(asset);

    this.#registry.register<TKind, TAsset>(
      handle,
      this.toRegisterOptions({
        ...(label !== undefined ? { label } : {}),
        dependencies,
        diagnostics,
      }),
    );
    this.#registry.markReady(handle, asset, diagnostics);
    return handle;
  }

  has(handle: AssetHandle<TKind>): boolean {
    this.assertHandleKind(handle);
    return this.#registry.has(handle);
  }

  unregister(
    handle: AssetHandle<TKind>,
  ): AssetRegistryEntry<TKind, TAsset> | undefined {
    this.assertHandleKind(handle);
    return this.#registry.unregister<TKind, TAsset>(handle);
  }

  get(
    handle: AssetHandle<TKind>,
  ): AssetRegistryEntry<TKind, TAsset> | undefined {
    this.assertHandleKind(handle);
    return this.#registry.get<TKind, TAsset>(handle);
  }

  getAsset(handle: AssetHandle<TKind>): TAsset | undefined {
    const entry = this.get(handle);
    return entry?.status === "ready" && entry.asset !== null
      ? entry.asset
      : undefined;
  }

  markLoading(handle: AssetHandle<TKind>): AssetRegistryEntry<TKind, TAsset> {
    this.assertHandleKind(handle);
    return this.#registry.markLoading<TKind, TAsset>(handle);
  }

  markReady(
    handle: AssetHandle<TKind>,
    asset: TAsset,
    diagnostics?: readonly AssetDiagnostic[],
  ): AssetRegistryEntry<TKind, TAsset> {
    this.assertHandleKind(handle);
    return diagnostics === undefined
      ? this.#registry.markReady(handle, asset)
      : this.#registry.markReady(handle, asset, diagnostics);
  }

  markFailed(
    handle: AssetHandle<TKind>,
    diagnostics: readonly AssetDiagnostic[],
  ): AssetRegistryEntry<TKind, TAsset> {
    this.assertHandleKind(handle);
    return this.#registry.markFailed<TKind, TAsset>(handle, diagnostics);
  }

  list(
    filter: Omit<AssetListFilter, "kind"> = {},
  ): AssetRegistryEntry<TKind, TAsset>[] {
    return this.#registry.list({
      ...filter,
      kind: this.#kind,
    }) as AssetRegistryEntry<TKind, TAsset>[];
  }

  private resolveHandle(
    options: TypedAssetRegisterOptions<TKind>,
  ): AssetHandle<TKind> {
    if (options.handle !== undefined) {
      this.assertHandleKind(options.handle);
      return options.handle;
    }

    if (options.id !== undefined) {
      return this.#createHandle(options.id);
    }

    return this.createAvailableHandle();
  }

  private createAvailableHandle(): AssetHandle<TKind> {
    let handle = this.#createHandle(`${this.#idPrefix}-${this.#nextId}`);

    while (this.#registry.has(handle)) {
      this.#nextId += 1;
      handle = this.#createHandle(`${this.#idPrefix}-${this.#nextId}`);
    }

    this.#nextId += 1;
    return handle;
  }

  private assertHandleKind(handle: AssetHandle<TKind>): void {
    if (handle.kind !== this.#kind) {
      throw new RangeError(
        `Expected ${this.#kind} asset handle, received '${assetHandleKey(
          handle,
        )}'.`,
      );
    }
  }

  private toRegisterOptions(
    options: RegisterAssetOptions,
  ): RegisterAssetOptions {
    return {
      ...(options.label !== undefined ? { label: options.label } : {}),
      ...(options.dependencies !== undefined
        ? { dependencies: options.dependencies }
        : {}),
      ...(options.diagnostics !== undefined
        ? { diagnostics: options.diagnostics }
        : {}),
    };
  }
}

function mergeAssetHandles(
  first: readonly AssetHandle[],
  second: readonly AssetHandle[],
): readonly AssetHandle[] {
  if (first.length === 0) {
    return [...second];
  }

  if (second.length === 0) {
    return [...first];
  }

  const handles: AssetHandle[] = [];
  const seen = new Set<string>();

  for (const handle of [...first, ...second]) {
    const key = assetHandleKey(handle);

    if (!seen.has(key)) {
      seen.add(key);
      handles.push(handle);
    }
  }

  return handles;
}
