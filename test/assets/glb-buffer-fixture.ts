import {
  GLB_BINARY_CHUNK_TYPE,
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
} from "@aperture-engine/render";

export interface TestGlbChunk {
  readonly typeCode: number;
  readonly data: Uint8Array;
}

export interface IndexedTriangleGlbFixture {
  readonly root: Record<string, unknown>;
  readonly bytes: Uint8Array;
  readonly source: Uint8Array;
}

export function jsonChunk(value: Record<string, unknown>): TestGlbChunk {
  return {
    typeCode: GLB_JSON_CHUNK_TYPE,
    data: padChunkData(new TextEncoder().encode(JSON.stringify(value)), 0x20),
  };
}

export function bytesChunk(
  typeCode: number,
  bytes: readonly number[],
): TestGlbChunk {
  return {
    typeCode,
    data: new Uint8Array(bytes),
  };
}

export function createGlb(chunks: readonly TestGlbChunk[]): Uint8Array {
  const byteLength =
    GLB_HEADER_BYTE_LENGTH +
    chunks.reduce(
      (total, chunk) =>
        total + GLB_CHUNK_HEADER_BYTE_LENGTH + chunk.data.byteLength,
      0,
    );
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = GLB_HEADER_BYTE_LENGTH;

  view.setUint32(0, GLB_CONTAINER_MAGIC, true);
  view.setUint32(4, GLB_CONTAINER_VERSION, true);
  view.setUint32(8, byteLength, true);

  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.byteLength, true);
    view.setUint32(offset + 4, chunk.typeCode, true);
    bytes.set(chunk.data, offset + GLB_CHUNK_HEADER_BYTE_LENGTH);
    offset += GLB_CHUNK_HEADER_BYTE_LENGTH + chunk.data.byteLength;
  }

  return bytes;
}

export function createIndexedTriangleGlbFixture(): IndexedTriangleGlbFixture {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);

  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    view.setFloat32(index * 4, value, true),
  );
  [0, 1, 2].forEach((value, index) =>
    view.setUint16(36 + index * 2, value, true),
  );

  const root = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "Indexed", mesh: 0 }],
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  };

  return {
    root,
    bytes,
    source: createGlb([
      jsonChunk(root),
      bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
    ]),
  };
}

function padChunkData(data: Uint8Array, padByte: number): Uint8Array {
  const paddedLength = Math.ceil(data.byteLength / 4) * 4;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded.fill(padByte, data.byteLength);
  return padded;
}
