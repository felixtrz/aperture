import type { RenderSnapshotFamilyChangeCounts, RenderSnapshotFamilyChangeKeys } from "./snapshot-change-set-types.js";
export type PacketSnapshotKey = string | number;
export interface PacketSnapshot<TPacket> {
    readonly packets: readonly TPacket[];
    readonly signature?: (packet: TPacket) => string;
    readonly equals?: (previous: TPacket, next: TPacket, previousState: unknown, nextState: unknown) => boolean;
    readonly key: (packet: TPacket) => PacketSnapshotKey;
    readonly formatKey?: (key: PacketSnapshotKey) => string;
    readonly state?: unknown;
}
export interface PacketFamilyComparison {
    readonly counts: RenderSnapshotFamilyChangeCounts;
    readonly keys?: RenderSnapshotFamilyChangeKeys;
    readonly rawUnchangedKeys?: readonly PacketSnapshotKey[];
}
export interface ComparePacketFamilyOptions {
    readonly includeKeys?: boolean;
    readonly includeRawUnchangedKeys?: boolean;
    /**
     * Allows the ordered fast path to skip duplicate-key detection for packet
     * families whose keys are already unique by extraction/render-world contract.
     */
    readonly assumeUniqueKeys?: boolean;
    /**
     * Allows the ordered fast path to compare same-key duplicate packets by slot.
     * This is conservative for stable ordered families such as bounds: duplicate
     * reorders can over-report changes, but cannot hide changed or removed work.
     */
    readonly allowOrderedDuplicateKeys?: boolean;
}
export declare function comparePacketFamily<TPacket>(previous: PacketSnapshot<TPacket>, next: PacketSnapshot<TPacket>, options?: ComparePacketFamilyOptions): PacketFamilyComparison;
export declare function totalCounts(counts: readonly RenderSnapshotFamilyChangeCounts[]): RenderSnapshotFamilyChangeCounts;
//# sourceMappingURL=snapshot-change-set-compare.d.ts.map