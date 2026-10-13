export interface SnapshotPacketHeaderCounts {
    readonly views: number;
    readonly meshDraws: number;
    readonly shadowCasterDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly particleEmitters: number;
    readonly audioEmitters: number;
    readonly audioListeners: number;
    readonly shadowRequests: number;
    readonly bounds: number;
    readonly quadBatches: number;
    readonly fogs: number;
    readonly proceduralSkies: number;
}
export declare function writeSnapshotPacketHeader(words: Uint32Array, counts: SnapshotPacketHeaderCounts): void;
export declare function readSnapshotPacketHeaderCounts(words: Uint32Array): SnapshotPacketHeaderCounts;
//# sourceMappingURL=snapshot-packed-encoding-header.d.ts.map