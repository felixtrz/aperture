import type { MeshMaterialSlot, MeshVertexAttributeDescriptor, MeshVertexStreamDescriptor } from "../mesh/index.js";
import type { MeshVertexDataArray } from "./mesh-merge-types.js";
export declare function required<T>(value: T | undefined): T;
export declare function requiredElementCount(stream: MeshVertexStreamDescriptor): number;
export declare function attributesMatch(a: readonly MeshVertexAttributeDescriptor[], b: readonly MeshVertexAttributeDescriptor[]): boolean;
export declare function dataConstructorsMatch(a: MeshVertexDataArray, b: MeshVertexDataArray): boolean;
export declare function createVertexDataArray(sample: MeshVertexDataArray, length: number): MeshVertexDataArray;
export declare function setVertexData(target: MeshVertexDataArray, source: MeshVertexDataArray, offset: number): void;
export declare function materialSlotsMatch(a: readonly MeshMaterialSlot[], b: readonly MeshMaterialSlot[]): boolean;
export declare function cloneMaterialSlots(materialSlots: readonly MeshMaterialSlot[]): readonly MeshMaterialSlot[];
//# sourceMappingURL=mesh-merge-utils.d.ts.map