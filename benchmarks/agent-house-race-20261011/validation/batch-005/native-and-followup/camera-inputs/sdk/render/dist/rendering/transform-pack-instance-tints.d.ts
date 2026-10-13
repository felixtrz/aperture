import type { RenderSnapshot } from "./snapshot.js";
import type { PackedSnapshotInstanceTints, PackedSnapshotInstanceTintsScratch, PackedSnapshotTransforms } from "./transform-pack-types.js";
export declare function packSnapshotInstanceTints(snapshot: Pick<RenderSnapshot, "meshDraws" | "instanceTints">): PackedSnapshotInstanceTints;
export declare function packSnapshotInstanceTintsForVertexBuffer(snapshot: Pick<RenderSnapshot, "meshDraws" | "instanceTints">, transforms: PackedSnapshotTransforms): PackedSnapshotInstanceTints;
export declare function writePackedSnapshotInstanceTintsForVertexBuffer(snapshot: Pick<RenderSnapshot, "meshDraws" | "instanceTints">, transforms: PackedSnapshotTransforms, scratch: PackedSnapshotInstanceTintsScratch): PackedSnapshotInstanceTints;
//# sourceMappingURL=transform-pack-instance-tints.d.ts.map