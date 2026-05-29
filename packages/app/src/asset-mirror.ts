import {
  assetHandleKey,
  deserializeAssetHandle,
  serializeAssetHandle,
  type AssetDiagnostic,
  type AssetHandle,
  type AssetKind,
  type AssetRegistry,
  type AssetRegistryEntry,
  type AssetStatus,
  type SerializedAssetHandle,
} from "@aperture-engine/simulation";

export interface SerializedSourceAssetEntry {
  readonly handle: SerializedAssetHandle;
  readonly label: string;
  readonly status: AssetStatus;
  readonly version: number;
  readonly asset: unknown;
  readonly dependencies: readonly SerializedAssetHandle[];
  readonly diagnostics: readonly AssetDiagnostic[];
}

export interface SerializedSourceAssetRegistry {
  readonly entries: readonly SerializedSourceAssetEntry[];
}

export interface SourceAssetMirrorReport {
  readonly mirrored: number;
  readonly skipped: number;
}

export interface SourceAssetSerializationState {
  readonly versionsByHandle: Map<string, number>;
}

export function createSourceAssetSerializationState(): SourceAssetSerializationState {
  return {
    versionsByHandle: new Map(),
  };
}

export function serializeSourceAssetRegistry(
  registry: AssetRegistry,
  options: {
    readonly state?: SourceAssetSerializationState;
  } = {},
): SerializedSourceAssetRegistry {
  return {
    entries: registry
      .list()
      .filter((entry) => shouldSerializeSourceAssetEntry(entry, options.state))
      .map(serializeSourceAssetEntry),
  };
}

export function mirrorSourceAssetRegistryFromMessage(
  registry: AssetRegistry,
  message: unknown,
): SourceAssetMirrorReport {
  const sourceAssets = readSourceAssetRegistry(message);

  if (sourceAssets === null) {
    return { mirrored: 0, skipped: 0 };
  }

  let mirrored = 0;
  let skipped = 0;

  for (const entry of sourceAssets.entries) {
    const handle = deserializeAssetHandle(entry.handle);
    const current = registry.get(handle);

    if (current !== undefined && current.version >= entry.version) {
      skipped += 1;
      continue;
    }

    ensureRegistered(registry, handle, entry);
    writeEntryStatus(registry, handle, entry);
    mirrored += 1;
  }

  return { mirrored, skipped };
}

function serializeSourceAssetEntry(
  entry: AssetRegistryEntry,
): SerializedSourceAssetEntry {
  return {
    handle: serializeAssetHandle(entry.handle),
    label: entry.label,
    status: entry.status,
    version: entry.version,
    asset: entry.asset,
    dependencies: entry.dependencies.map(serializeAssetHandle),
    diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

function shouldSerializeSourceAssetEntry(
  entry: AssetRegistryEntry,
  state: SourceAssetSerializationState | undefined,
): boolean {
  if (state === undefined) {
    return true;
  }

  const key = assetHandleKey(entry.handle);
  const sentVersion = state.versionsByHandle.get(key);

  if (sentVersion !== undefined && sentVersion >= entry.version) {
    return false;
  }

  state.versionsByHandle.set(key, entry.version);
  return true;
}

function readSourceAssetRegistry(
  message: unknown,
): SerializedSourceAssetRegistry | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const value = (message as { readonly sourceAssets?: unknown }).sourceAssets;

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const entries = (value as { readonly entries?: unknown }).entries;

  if (!Array.isArray(entries)) {
    return null;
  }

  return {
    entries: entries.filter(isSerializedSourceAssetEntry),
  };
}

function isSerializedSourceAssetEntry(
  value: unknown,
): value is SerializedSourceAssetEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as SerializedSourceAssetEntry;

  return (
    isSerializedHandle(entry.handle) &&
    typeof entry.label === "string" &&
    isAssetStatus(entry.status) &&
    typeof entry.version === "number" &&
    Array.isArray(entry.dependencies) &&
    entry.dependencies.every(isSerializedHandle) &&
    Array.isArray(entry.diagnostics)
  );
}

function isSerializedHandle(value: unknown): value is SerializedAssetHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly kind?: unknown }).kind === "string" &&
    typeof (value as { readonly id?: unknown }).id === "string"
  );
}

function isAssetStatus(value: unknown): value is AssetStatus {
  return (
    value === "registered" ||
    value === "loading" ||
    value === "ready" ||
    value === "failed"
  );
}

function ensureRegistered(
  registry: AssetRegistry,
  handle: AssetHandle,
  entry: SerializedSourceAssetEntry,
): void {
  if (registry.has(handle)) {
    return;
  }

  registry.register(handle, {
    label: entry.label,
    dependencies: entry.dependencies.map(deserializeAssetHandle),
    diagnostics: entry.diagnostics,
  });
}

function writeEntryStatus(
  registry: AssetRegistry,
  handle: AssetHandle<AssetKind>,
  entry: SerializedSourceAssetEntry,
): void {
  if (entry.status === "registered") {
    return;
  }

  if (entry.status === "loading") {
    registry.markLoading(handle);
    return;
  }

  if (entry.status === "failed") {
    registry.markFailed(handle, entry.diagnostics);
    return;
  }

  registry.markReady(handle, entry.asset);
}

export function sourceAssetMirrorKey(
  entry: SerializedSourceAssetEntry,
): string {
  return assetHandleKey(deserializeAssetHandle(entry.handle));
}
