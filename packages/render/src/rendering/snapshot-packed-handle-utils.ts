import {
  assetHandleKey,
  type AssetHandle,
  type AssetKind,
} from "@aperture-engine/simulation";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";

export function readRequiredHandle<TKind extends AssetKind>(
  registry: SnapshotPacketEncodingRegistry,
  id: number,
  expectedKind: TKind,
): AssetHandle<TKind> {
  const handle = registry.handleValue(id);

  if (handle === null) {
    throw new RangeError(
      `Expected ${expectedKind} handle id, received null handle id.`,
    );
  }

  assertHandleKind(handle, [expectedKind]);

  return handle as AssetHandle<TKind>;
}

export function readNullableHandle<TKind extends AssetKind>(
  registry: SnapshotPacketEncodingRegistry,
  id: number,
  expectedKinds: readonly TKind[],
): AssetHandle<TKind> | null {
  const handle = registry.handleValue(id);

  if (handle === null) {
    return null;
  }

  assertHandleKind(handle, expectedKinds);

  return handle as AssetHandle<TKind>;
}

function assertHandleKind(
  handle: AssetHandle,
  expectedKinds: readonly AssetKind[],
): void {
  if (!expectedKinds.includes(handle.kind)) {
    throw new RangeError(
      `Expected ${expectedKinds.join(" or ")} handle, received '${assetHandleKey(
        handle,
      )}'.`,
    );
  }
}
