import type { InstanceAttributePacket, MeshDrawPacket, RenderDiagnostic } from "./snapshot.js";
import type { PackedSnapshotTransforms } from "./transform-pack-types.js";
export declare function findTransformPackedOffset(transforms: PackedSnapshotTransforms, renderId: number): number | undefined;
export declare function hasTransform(transforms: Float32Array, offset: number): boolean;
export declare function hasTransformRange(floatCount: number, offset: number): boolean;
export declare function hasVec4(values: Float32Array, offset: number): boolean;
export declare function findInstanceAttributeField(packet: InstanceAttributePacket, name: string): InstanceAttributePacket["fields"][number] | undefined;
export declare function hasInstanceAttributeValues(values: Float32Array, field: InstanceAttributePacket["fields"][number]): boolean;
export declare function missingTransformDiagnostic(draw: MeshDrawPacket, transforms: Float32Array): RenderDiagnostic;
//# sourceMappingURL=transform-pack-guards.d.ts.map