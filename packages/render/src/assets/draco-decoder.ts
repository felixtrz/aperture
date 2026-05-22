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

export async function createDracoMeshDecoder(
  source: DracoMeshDecoderSource,
): Promise<DracoMeshDecoder> {
  const [jsSource, wasmBinary] = await Promise.all([
    resolveDracoJsSource(source),
    resolveDracoWasmBinary(source),
  ]);
  const factory = compileDracoFactory(jsSource);
  const dracoModule = await factory({
    wasmBinary: arrayBufferFromBytes(wasmBinary),
  });

  if (typeof dracoModule.Decoder !== "function") {
    throw new Error("Draco decoder did not expose Decoder().");
  }
  if (typeof dracoModule.Mesh !== "function") {
    throw new Error("Draco decoder did not expose Mesh().");
  }

  return {
    decode(sourceBytes, options = {}) {
      return decodeDracoMeshData(sourceBytes, dracoModule, options);
    },
  };
}

interface DracoModuleFactoryInput {
  readonly wasmBinary: ArrayBuffer;
}

interface DracoModule {
  readonly Decoder: new () => DracoDecoder;
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

interface DracoDecoder {
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

interface DracoMesh {
  readonly ptr: number;
  readonly num_points: () => number;
  readonly num_faces: () => number;
}

interface DracoStatus {
  readonly ok: () => boolean;
  readonly error_msg: () => string;
}

interface DracoAttribute {
  readonly ptr: number;
  readonly unique_id: () => number;
  readonly num_components: () => number;
  readonly data_type: () => number;
}

type DracoModuleFactory = (
  input: DracoModuleFactoryInput,
) => PromiseLike<DracoModule>;

const DEFAULT_ATTRIBUTE_REQUESTS: readonly DracoAttributeDecodeRequest[] = [
  { semantic: "POSITION", attribute: "POSITION", output: "float32" },
  { semantic: "NORMAL", attribute: "NORMAL", output: "float32" },
  { semantic: "COLOR", attribute: "COLOR", output: "float32" },
  { semantic: "TEXCOORD_0", attribute: "TEX_COORD", output: "float32" },
];

function decodeDracoMeshData(
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
  decoder: DracoDecoder,
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
  decoder: DracoDecoder,
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
  decoder: DracoDecoder,
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
  decoder: DracoDecoder,
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

async function resolveDracoJsSource(
  source: DracoMeshDecoderSource,
): Promise<string> {
  if (source.jsSource !== undefined) {
    return source.jsSource;
  }
  if (source.jsUrl === undefined) {
    throw new Error("Draco decoder requires jsSource or jsUrl.");
  }

  if (source.fetchText !== undefined) {
    return source.fetchText(source.jsUrl);
  }
  if (typeof fetch !== "function") {
    throw new Error("No fetch implementation is available for Draco JS glue.");
  }

  const response = await fetch(source.jsUrl);
  if (!response.ok) {
    throw new Error(
      `Fetching Draco JS glue failed with HTTP ${response.status}.`,
    );
  }
  return response.text();
}

async function resolveDracoWasmBinary(
  source: DracoMeshDecoderSource,
): Promise<Uint8Array> {
  if (source.wasmBinary !== undefined) {
    return new Uint8Array(bytesView(source.wasmBinary));
  }
  if (source.wasmUrl === undefined) {
    throw new Error("Draco decoder requires wasmBinary or wasmUrl.");
  }

  if (source.fetchBinary !== undefined) {
    return new Uint8Array(bytesView(await source.fetchBinary(source.wasmUrl)));
  }
  if (typeof fetch !== "function") {
    throw new Error("No fetch implementation is available for Draco WASM.");
  }

  const response = await fetch(source.wasmUrl);
  if (!response.ok) {
    throw new Error(`Fetching Draco WASM failed with HTTP ${response.status}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function compileDracoFactory(jsSource: string): DracoModuleFactory {
  const moduleObject: { exports?: unknown } = {};
  const evaluator = new Function(
    "module",
    "exports",
    "process",
    "__filename",
    "__dirname",
    "window",
    "document",
    "importScripts",
    `${jsSource}\nreturn module.exports || DracoDecoderModule;`,
  ) as (
    module: { exports?: unknown },
    exports: Record<string, unknown>,
    processValue: undefined,
    filename: undefined,
    dirname: undefined,
    windowValue: Record<string, unknown>,
    documentValue: undefined,
    importScriptsValue: undefined,
  ) => unknown;
  const factory = evaluator(
    moduleObject,
    {},
    undefined,
    undefined,
    undefined,
    {},
    undefined,
    undefined,
  );

  if (typeof factory !== "function") {
    throw new Error("Draco JS glue did not expose a factory.");
  }

  return factory as DracoModuleFactory;
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

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function bytesView(source: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}
