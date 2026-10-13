import type { DracoDecodedAttributeArray, DracoDecodedAttributeDataType, DracoMeshAttributeKind, DracoModule } from "./draco-types.js";
export declare function dracoAttributeKindValue(draco: DracoModule, kind: DracoMeshAttributeKind): number;
export declare function dataTypeName(draco: DracoModule, dataType: number): DracoDecodedAttributeDataType;
export declare function dracoDataTypeValue(draco: DracoModule, dataType: DracoDecodedAttributeDataType): number;
export declare function arrayConstructorForDataType(dataType: DracoDecodedAttributeDataType): Int8ArrayConstructor | Uint8ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor;
export declare function typedArrayFromHeap(draco: DracoModule, dataType: DracoDecodedAttributeDataType, pointer: number, byteLength: number): DracoDecodedAttributeArray;
//# sourceMappingURL=draco-mesh-attribute-types.d.ts.map