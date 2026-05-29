import {
  systemAssetReadyMetadata,
  type SystemAssetHandle,
  type SystemAssetKind,
} from "../systems.js";

export function createAssetSummary(
  handles: readonly SystemAssetHandle<SystemAssetKind>[],
): readonly Record<string, unknown>[] {
  return handles.map((handle) => ({
    id: handle.id,
    kind: handle.kind,
    url: handle.url,
    preload: handle.preload,
    ready: handle.ready.value,
    error: handle.error.value,
    ...systemAssetReadyMetadata(handle),
  }));
}
