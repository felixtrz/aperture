import { type AssetHandle, type AssetKind } from "@aperture-engine/simulation";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
export declare function readRequiredHandle<TKind extends AssetKind>(registry: SnapshotPacketEncodingRegistry, id: number, expectedKind: TKind): AssetHandle<TKind>;
export declare function readNullableHandle<TKind extends AssetKind>(registry: SnapshotPacketEncodingRegistry, id: number, expectedKinds: readonly TKind[]): AssetHandle<TKind> | null;
//# sourceMappingURL=snapshot-packed-handle-utils.d.ts.map