export type DracoDecodedIndexArray = Uint16Array | Uint32Array;

export type DracoDecodedAttributeArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array;

export type DracoMeshAttributeKind =
  | "POSITION"
  | "NORMAL"
  | "COLOR"
  | "TEX_COORD"
  | "GENERIC";

export type DracoDecodedAttributeDataType =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "float32";

export interface DracoMeshDecoderSource {
  readonly jsSource?: string;
  readonly jsUrl?: string;
  readonly wasmBinary?: ArrayBuffer | ArrayBufferView;
  readonly wasmUrl?: string;
  readonly fetchText?: (url: string) => PromiseLike<string>;
  readonly fetchBinary?: (
    url: string,
  ) => PromiseLike<ArrayBuffer | ArrayBufferView>;
}

export interface DracoAttributeDecodeRequest {
  readonly semantic: string;
  readonly uniqueId?: number;
  readonly attribute?: DracoMeshAttributeKind;
  readonly output?: DracoDecodedAttributeDataType;
}

export interface DracoDecodeOptions {
  readonly attributes?: readonly DracoAttributeDecodeRequest[];
}

export interface DracoDecodedMeshAttribute {
  readonly semantic: string;
  readonly uniqueId: number;
  readonly itemSize: number;
  readonly dataType: DracoDecodedAttributeDataType;
  readonly array: DracoDecodedAttributeArray;
}

export interface DracoDecodedMeshData {
  readonly vertexCount: number;
  readonly faceCount: number;
  readonly indices: DracoDecodedIndexArray;
  readonly attributes: readonly DracoDecodedMeshAttribute[];
}

export interface DracoMeshDecoder {
  readonly decode: (
    source: ArrayBuffer | ArrayBufferView,
    options?: DracoDecodeOptions,
  ) => DracoDecodedMeshData;
}

export interface DracoGltfPrimitiveAccessorsInput {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly decoded: DracoDecodedMeshData;
}

interface DracoModuleFactoryInput {
  readonly wasmBinary: ArrayBuffer;
}

export interface DracoModule {
  readonly Decoder: new () => DracoDecoderApi;
  readonly Mesh: new () => DracoMesh;
  readonly destroy: (value: object) => void;
  readonly _malloc: (byteLength: number) => number;
  readonly _free: (pointer: number) => void;
  readonly HEAPU8: Uint8Array;
  readonly HEAP8: Int8Array;
  readonly HEAPU16: Uint16Array;
  readonly HEAP16: Int16Array;
  readonly HEAPU32: Uint32Array;
  readonly HEAP32: Int32Array;
  readonly HEAPF32: Float32Array;
  readonly TRIANGULAR_MESH: number;
  readonly POSITION: number;
  readonly NORMAL: number;
  readonly COLOR: number;
  readonly TEX_COORD: number;
  readonly GENERIC: number;
  readonly DT_INT8: number;
  readonly DT_UINT8: number;
  readonly DT_INT16: number;
  readonly DT_UINT16: number;
  readonly DT_INT32: number;
  readonly DT_UINT32: number;
  readonly DT_FLOAT32: number;
}

export interface DracoDecoderApi {
  readonly GetEncodedGeometryType: (bytes: Int8Array) => number;
  readonly DecodeArrayToMesh: (
    bytes: Int8Array,
    byteLength: number,
    mesh: DracoMesh,
  ) => DracoStatus;
  readonly GetAttributeId: (mesh: DracoMesh, attribute: number) => number;
  readonly GetAttribute: (
    mesh: DracoMesh,
    attributeId: number,
  ) => DracoAttribute;
  readonly GetAttributeByUniqueId: (
    mesh: DracoMesh,
    uniqueId: number,
  ) => DracoAttribute;
  readonly GetTrianglesUInt16Array: (
    mesh: DracoMesh,
    byteLength: number,
    pointer: number,
  ) => boolean;
  readonly GetTrianglesUInt32Array: (
    mesh: DracoMesh,
    byteLength: number,
    pointer: number,
  ) => boolean;
  readonly GetAttributeDataArrayForAllPoints: (
    mesh: DracoMesh,
    attribute: DracoAttribute,
    dataType: number,
    byteLength: number,
    pointer: number,
  ) => boolean;
}

export interface DracoMesh {
  readonly ptr: number;
  readonly num_points: () => number;
  readonly num_faces: () => number;
}

interface DracoStatus {
  readonly ok: () => boolean;
  readonly error_msg: () => string;
}

export interface DracoAttribute {
  readonly ptr: number;
  readonly unique_id: () => number;
  readonly num_components: () => number;
  readonly data_type: () => number;
}

export type DracoModuleFactory = (
  input: DracoModuleFactoryInput,
) => PromiseLike<DracoModule>;
