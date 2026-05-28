import type {
  DracoAttribute,
  DracoAttributeDecodeRequest,
  DracoDecodedAttributeArray,
  DracoDecodedAttributeDataType,
  DracoDecodedIndexArray,
  DracoDecodedMeshAttribute,
  DracoDecodedMeshData,
  DracoDecodeOptions,
  DracoDecoderApi,
  DracoMesh,
  DracoMeshAttributeKind,
  DracoModule,
} from "./draco-types.js";
import { bytesView } from "./draco-utils.js";

const DEFAULT_ATTRIBUTE_REQUESTS: readonly DracoAttributeDecodeRequest[] = [
  { semantic: "POSITION", attribute: "POSITION", output: "float32" },
  { semantic: "NORMAL", attribute: "NORMAL", output: "float32" },
  { semantic: "COLOR", attribute: "COLOR", output: "float32" },
  { semantic: "TEXCOORD_0", attribute: "TEX_COORD", output: "float32" },
];

export function decodeDracoMeshData(
  source: ArrayBuffer | ArrayBufferView,
  draco: DracoModule,
  options: DracoDecodeOptions,
): DracoDecodedMeshData {
  const bytes = bytesView(source);
  const decoder = new draco.Decoder();
  const mesh = new draco.Mesh();

  try {
    const signedBytes = new Int8Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    if (decoder.GetEncodedGeometryType(signedBytes) !== draco.TRIANGULAR_MESH) {
      throw new Error("Draco payload is not a triangular mesh.");
    }

    const status = decoder.DecodeArrayToMesh(
      signedBytes,
      bytes.byteLength,
      mesh,
    );
    if (!status.ok() || mesh.ptr === 0) {
      throw new Error(`Draco mesh decode failed: ${status.error_msg()}`);
    }

    return {
      vertexCount: mesh.num_points(),
      faceCount: mesh.num_faces(),
      indices: decodeIndices(draco, decoder, mesh),
      attributes: decodeAttributes(
        draco,
        decoder,
        mesh,
        options.attributes ?? DEFAULT_ATTRIBUTE_REQUESTS,
      ),
    };
  } finally {
    draco.destroy(mesh);
    draco.destroy(decoder);
  }
}

function decodeIndices(
  draco: DracoModule,
  decoder: DracoDecoderApi,
  mesh: DracoMesh,
): DracoDecodedIndexArray {
  const indexCount = mesh.num_faces() * 3;
  const useUint16 = mesh.num_points() <= 0xffff;
  const byteLength = indexCount * (useUint16 ? 2 : 4);
  const pointer = draco._malloc(byteLength);

  try {
    const ok = useUint16
      ? decoder.GetTrianglesUInt16Array(mesh, byteLength, pointer)
      : decoder.GetTrianglesUInt32Array(mesh, byteLength, pointer);
    if (!ok) {
      throw new Error("Draco index decode failed.");
    }

    return useUint16
      ? new Uint16Array(draco.HEAPU16.buffer, pointer, indexCount).slice()
      : new Uint32Array(draco.HEAPU32.buffer, pointer, indexCount).slice();
  } finally {
    draco._free(pointer);
  }
}

function decodeAttributes(
  draco: DracoModule,
  decoder: DracoDecoderApi,
  mesh: DracoMesh,
  requests: readonly DracoAttributeDecodeRequest[],
): DracoDecodedMeshAttribute[] {
  const attributes: DracoDecodedMeshAttribute[] = [];

  for (const request of requests) {
    const attribute = resolveAttribute(draco, decoder, mesh, request);
    if (attribute === null || attribute.ptr === 0) {
      continue;
    }

    attributes.push(
      decodeAttribute(
        draco,
        decoder,
        mesh,
        attribute,
        request.semantic,
        request,
      ),
    );
  }

  if (attributes.length === 0) {
    throw new Error("Draco mesh did not contain any requested attributes.");
  }

  return attributes;
}

function resolveAttribute(
  draco: DracoModule,
  decoder: DracoDecoderApi,
  mesh: DracoMesh,
  request: DracoAttributeDecodeRequest,
): DracoAttribute | null {
  if (request.uniqueId !== undefined) {
    return decoder.GetAttributeByUniqueId(mesh, request.uniqueId);
  }

  if (request.attribute === undefined) {
    throw new Error(
      `Draco attribute request '${request.semantic}' must include uniqueId or attribute.`,
    );
  }

  const attributeId = decoder.GetAttributeId(
    mesh,
    dracoAttributeKindValue(draco, request.attribute),
  );
  return attributeId < 0 ? null : decoder.GetAttribute(mesh, attributeId);
}

function decodeAttribute(
  draco: DracoModule,
  decoder: DracoDecoderApi,
  mesh: DracoMesh,
  attribute: DracoAttribute,
  semantic: string,
  request: DracoAttributeDecodeRequest,
): DracoDecodedMeshAttribute {
  const itemSize = attribute.num_components();
  const dataType = request.output ?? dataTypeName(draco, attribute.data_type());
  const typedArray = arrayConstructorForDataType(dataType);
  const byteLength =
    mesh.num_points() * itemSize * typedArray.BYTES_PER_ELEMENT;
  const pointer = draco._malloc(byteLength);

  try {
    const ok = decoder.GetAttributeDataArrayForAllPoints(
      mesh,
      attribute,
      dracoDataTypeValue(draco, dataType),
      byteLength,
      pointer,
    );
    if (!ok) {
      throw new Error(`Draco attribute '${semantic}' decode failed.`);
    }

    return {
      semantic,
      uniqueId: attribute.unique_id(),
      itemSize,
      dataType,
      array: typedArrayFromHeap(draco, dataType, pointer, byteLength),
    };
  } finally {
    draco._free(pointer);
  }
}

function dracoAttributeKindValue(
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

function dataTypeName(
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

function dracoDataTypeValue(
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

function arrayConstructorForDataType(
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

function typedArrayFromHeap(
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
