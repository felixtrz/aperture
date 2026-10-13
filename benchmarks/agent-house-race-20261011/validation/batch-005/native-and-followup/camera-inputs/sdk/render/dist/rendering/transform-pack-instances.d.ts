import type { InstanceAttributeLayout } from "../materials/index.js";
import type { RenderSnapshot } from "./snapshot.js";
import type { PackedSnapshotInstanceAttributes, PackedSnapshotInstanceAttributesScratch, PackedSnapshotTransforms } from "./transform-pack-types.js";
export { packSnapshotInstanceTints, packSnapshotInstanceTintsForVertexBuffer, writePackedSnapshotInstanceTintsForVertexBuffer, } from "./transform-pack-instance-tints.js";
export declare function packSnapshotInstanceAttributesForVertexBuffer(snapshot: Pick<RenderSnapshot, "meshDraws" | "instanceAttributes" | "instanceAttributePackets">, transforms: PackedSnapshotTransforms, layout: InstanceAttributeLayout, options?: {
    readonly materialKind?: string;
}): PackedSnapshotInstanceAttributes;
export declare function writePackedSnapshotInstanceAttributesForVertexBuffer(snapshot: Pick<RenderSnapshot, "meshDraws" | "instanceAttributes" | "instanceAttributePackets">, transforms: PackedSnapshotTransforms, layout: InstanceAttributeLayout, scratch: PackedSnapshotInstanceAttributesScratch, options?: {
    readonly materialKind?: string;
}): PackedSnapshotInstanceAttributes;
//# sourceMappingURL=transform-pack-instances.d.ts.map