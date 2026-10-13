import type { PackedSnapshotInstanceAttributesScratch, PackedSnapshotInstanceTintsScratch, PackedSnapshotPreviousTransformsScratch, PackedSnapshotTransformsScratch } from "./transform-pack-types.js";
export { ensureInstanceAttributeDataCapacity, ensureInstanceTintDataCapacity, ensurePreviousTransformDataCapacity, ensureTransformDataCapacity, ensureTransformNextDataCapacity, } from "./transform-pack-scratch-capacity.js";
export { instanceAttributeOffsetAt, instanceTintOffsetAt, offsetAt, previousOffsetAt, } from "./transform-pack-offset-pools.js";
export declare function createPackedSnapshotTransformsScratch(floatCapacity?: number, offsetCapacity?: number): PackedSnapshotTransformsScratch;
export declare function createPackedSnapshotPreviousTransformsScratch(floatCapacity?: number, offsetCapacity?: number): PackedSnapshotPreviousTransformsScratch;
export declare function createPackedSnapshotInstanceTintsScratch(floatCapacity?: number, offsetCapacity?: number): PackedSnapshotInstanceTintsScratch;
export declare function createPackedSnapshotInstanceAttributesScratch(floatCapacity?: number, offsetCapacity?: number): PackedSnapshotInstanceAttributesScratch;
//# sourceMappingURL=transform-pack-scratch.d.ts.map