import { type AssetHandle, type SerializedAssetHandle } from "@aperture-engine/simulation";
export interface SnapshotPacketRegistrySnapshot {
    readonly strings: readonly string[];
    readonly handles: readonly SerializedAssetHandle[];
}
/**
 * Thrown when packet words reference a string/handle id the registry has not
 * interned. Typed (rather than a bare RangeError) so readers can distinguish
 * a transient registry-message lag — packets newer than the last received
 * registry snapshot, safe to skip — from genuine packet-buffer corruption
 * (truncated words, bad magic), which must surface as an error. Extends
 * RangeError so existing `instanceof RangeError` handling keeps working.
 */
export declare class SnapshotPacketRegistryMissError extends RangeError {
    readonly kind: "string" | "handle";
    readonly id: number;
    constructor(kind: "string" | "handle", id: number);
}
export interface SnapshotPacketEncodingRegistry extends SnapshotPacketRegistrySnapshot {
    stringId(value: string): number;
    stringValue(id: number): string;
    handleId(handle: AssetHandle | null): number;
    handleValue(id: number): AssetHandle | null;
    snapshot(): SnapshotPacketRegistrySnapshot;
}
export interface CreateSnapshotPacketRegistryOptions {
    readonly strings?: readonly string[];
    readonly handles?: readonly SerializedAssetHandle[];
}
export declare function createSnapshotPacketRegistry(options?: CreateSnapshotPacketRegistryOptions): SnapshotPacketEncodingRegistry;
//# sourceMappingURL=snapshot-packed-registry.d.ts.map