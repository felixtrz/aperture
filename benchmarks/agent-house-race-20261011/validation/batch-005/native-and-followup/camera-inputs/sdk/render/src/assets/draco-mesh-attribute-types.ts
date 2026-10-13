import type {
  DracoDecodedAttributeArray,
  DracoDecodedAttributeDataType,
  DracoMeshAttributeKind,
  DracoModule,
} from "./draco-types.js";

export function dracoAttributeKindValue(
  draco: DracoModule,
  kind: DracoMeshAttributeKind,
): number {
  switch (kind) {
    case "POSITION":
      return draco.POSITION;
    case "NORMAL":
      return draco.NORMAL;
    case "COLOR":
      return draco.COLOR;
    case "TEX_COORD":
      return draco.TEX_COORD;
    case "GENERIC":
      return draco.GENERIC;
  }
}

export function dataTypeName(
  draco: DracoModule,
  dataType: number,
): DracoDecodedAttributeDataType {
  switch (dataType) {
    case draco.DT_INT8:
      return "int8";
    case draco.DT_UINT8:
      return "uint8";
    case draco.DT_INT16:
      return "int16";
    case draco.DT_UINT16:
      return "uint16";
    case draco.DT_INT32:
      return "int32";
    case draco.DT_UINT32:
      return "uint32";
    case draco.DT_FLOAT32:
      return "float32";
    default:
      throw new Error(`Unsupported Draco attribute data type ${dataType}.`);
  }
}

export function dracoDataTypeValue(
  draco: DracoModule,
  dataType: DracoDecodedAttributeDataType,
): number {
  switch (dataType) {
    case "int8":
      return draco.DT_INT8;
    case "uint8":
      return draco.DT_UINT8;
    case "int16":
      return draco.DT_INT16;
    case "uint16":
      return draco.DT_UINT16;
    case "int32":
      return draco.DT_INT32;
    case "uint32":
      return draco.DT_UINT32;
    case "float32":
      return draco.DT_FLOAT32;
  }
}

export function arrayConstructorForDataType(
  dataType: DracoDecodedAttributeDataType,
):
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor {
  switch (dataType) {
    case "int8":
      return Int8Array;
    case "uint8":
      return Uint8Array;
    case "int16":
      return Int16Array;
    case "uint16":
      return Uint16Array;
    case "int32":
      return Int32Array;
    case "uint32":
      return Uint32Array;
    case "float32":
      return Float32Array;
  }
}

export function typedArrayFromHeap(
  draco: DracoModule,
  dataType: DracoDecodedAttributeDataType,
  pointer: number,
  byteLength: number,
): DracoDecodedAttributeArray {
  switch (dataType) {
    case "int8":
      return new Int8Array(draco.HEAP8.buffer, pointer, byteLength).slice();
    case "uint8":
      return new Uint8Array(draco.HEAPU8.buffer, pointer, byteLength).slice();
    case "int16":
      return new Int16Array(
        draco.HEAP16.buffer,
        pointer,
        byteLength / 2,
      ).slice();
    case "uint16":
      return new Uint16Array(
        draco.HEAPU16.buffer,
        pointer,
        byteLength / 2,
      ).slice();
    case "int32":
      return new Int32Array(
        draco.HEAP32.buffer,
        pointer,
        byteLength / 4,
      ).slice();
    case "uint32":
      return new Uint32Array(
        draco.HEAPU32.buffer,
        pointer,
        byteLength / 4,
      ).slice();
    case "float32":
      return new Float32Array(
        draco.HEAPF32.buffer,
        pointer,
        byteLength / 4,
      ).slice();
  }
}
