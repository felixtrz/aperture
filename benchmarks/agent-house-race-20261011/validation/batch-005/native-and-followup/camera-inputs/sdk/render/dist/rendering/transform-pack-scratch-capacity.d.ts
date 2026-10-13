import type { PackedSnapshotInstanceAttributesScratch, PackedSnapshotInstanceTintsScratch, PackedSnapshotPreviousTransformsScratch, PackedSnapshotTransformsScratch } from "./transform-pack-types.js";
export declare function ensureTransformDataCapacity(scratch: PackedSnapshotTransformsScratch, required: number): void;
export declare function ensureTransformNextDataCapacity(scratch: PackedSnapshotTransformsScratch, required: number): void;
export declare function ensurePreviousTransformDataCapacity(scratch: PackedSnapshotPreviousTransformsScratch, required: number): void;
export declare function ensureInstanceTintDataCapacity(scratch: PackedSnapshotInstanceTintsScratch, required: number): void;
export declare function ensureInstanceAttributeDataCapacity(scratch: PackedSnapshotInstanceAttributesScratch, required: number): void;
//# sourceMappingURL=transform-pack-scratch-capacity.d.ts.map