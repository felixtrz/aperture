import type { MutablePackedSnapshotViewUniformRecord, PackedSnapshotViewUniformsScratch } from "./view-pack-types.js";
export declare function createPackedSnapshotViewUniformsScratch(floatCapacity?: number, viewCapacity?: number): PackedSnapshotViewUniformsScratch;
export declare function ensureViewUniformDataCapacity(scratch: PackedSnapshotViewUniformsScratch, required: number): void;
export declare function viewRecordAt(scratch: PackedSnapshotViewUniformsScratch, index: number): MutablePackedSnapshotViewUniformRecord;
//# sourceMappingURL=view-pack-scratch.d.ts.map