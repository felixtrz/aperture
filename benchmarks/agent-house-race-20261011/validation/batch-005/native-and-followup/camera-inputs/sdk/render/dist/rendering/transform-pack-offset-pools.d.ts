import type { MutablePackedInstanceAttributeOffset, MutablePackedInstanceTintOffset, MutablePackedTransformOffset, PackedSnapshotInstanceAttributesScratch, PackedSnapshotInstanceTintsScratch, PackedSnapshotPreviousTransformsScratch, PackedSnapshotTransformsScratch } from "./transform-pack-types.js";
export declare function offsetAt(scratch: PackedSnapshotTransformsScratch, index: number): MutablePackedTransformOffset;
export declare function previousOffsetAt(scratch: PackedSnapshotPreviousTransformsScratch, index: number): MutablePackedTransformOffset;
export declare function instanceTintOffsetAt(scratch: PackedSnapshotInstanceTintsScratch, index: number): MutablePackedInstanceTintOffset;
export declare function instanceAttributeOffsetAt(scratch: PackedSnapshotInstanceAttributesScratch, index: number): MutablePackedInstanceAttributeOffset;
export declare function createEmptyOffset(): MutablePackedTransformOffset;
export declare function createEmptyInstanceTintOffset(): MutablePackedInstanceTintOffset;
export declare function createEmptyInstanceAttributeOffset(): MutablePackedInstanceAttributeOffset;
//# sourceMappingURL=transform-pack-offset-pools.d.ts.map