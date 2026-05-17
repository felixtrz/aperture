import { describe, expect, it } from "vitest";

import {
  GLB_BINARY_CHUNK_TYPE,
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
  parseGlbContainer,
} from "@aperture-engine/render";

interface TestGlbChunk {
  readonly typeCode: number;
  readonly data: Uint8Array;
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function padChunkData(data: Uint8Array, padByte: number): Uint8Array {
  const paddedLength = Math.ceil(data.byteLength / 4) * 4;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded.fill(padByte, data.byteLength);
  return padded;
}

function jsonChunk(value: Record<string, unknown>): TestGlbChunk {
  return {
    typeCode: GLB_JSON_CHUNK_TYPE,
    data: padChunkData(encodeText(JSON.stringify(value)), 0x20),
  };
}

function textChunk(typeCode: number, text: string): TestGlbChunk {
  return {
    typeCode,
    data: padChunkData(encodeText(text), 0x20),
  };
}

function bytesChunk(typeCode: number, bytes: readonly number[]): TestGlbChunk {
  return {
    typeCode,
    data: new Uint8Array(bytes),
  };
}

function createGlb(chunks: readonly TestGlbChunk[]): Uint8Array {
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

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function createHeaderOnlyGlb(byteLength: number): Uint8Array {
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  view.setUint32(0, GLB_CONTAINER_MAGIC, true);
  view.setUint32(4, GLB_CONTAINER_VERSION, true);
  view.setUint32(8, byteLength, true);

  return new Uint8Array(buffer);
}

describe("GLB container parser", () => {
  it("parses a JSON-only GLB container as renderer-independent source data", () => {
    const source = createGlb([
      jsonChunk({ asset: { version: "2.0" }, scene: 0 }),
    ]);

    const result = parseGlbContainer(copyToArrayBuffer(source));

    expect(result).toMatchObject({
      ok: true,
      diagnostics: [],
      container: {
        version: 2,
        byteLength: source.byteLength,
        binaryChunk: null,
        chunks: [
          {
            type: "json",
            typeCode: GLB_JSON_CHUNK_TYPE,
            byteOffset: 20,
            byteLength: source.byteLength - 20,
          },
        ],
      },
    });
    expect(result.container?.json).toEqual({
      asset: { version: "2.0" },
      scene: 0,
    });
    expect(result.container?.jsonText.trim()).toBe(
      '{"asset":{"version":"2.0"},"scene":0}',
    );
  });

  it("parses BIN chunks from Uint8Array subranges and warns for unknown chunks", () => {
    const unknownType = 0x12345678;
    const glb = createGlb([
      jsonChunk({ asset: { version: "2.0" } }),
      bytesChunk(GLB_BINARY_CHUNK_TYPE, [1, 2, 3, 4]),
      bytesChunk(unknownType, [9, 8, 7, 6]),
    ]);
    const wrapped = new Uint8Array(glb.byteLength + 4);
    wrapped.set([0xaa, 0xbb], 0);
    wrapped.set(glb, 2);
    const subrange = wrapped.subarray(2, 2 + glb.byteLength);

    const result = parseGlbContainer(subrange);

    expect(result.ok).toBe(true);
    expect(Array.from(result.container?.binaryChunk ?? [])).toEqual([
      1, 2, 3, 4,
    ]);
    expect(result.container?.chunks.map((chunk) => chunk.type)).toEqual([
      "json",
      "bin",
      "unknown",
    ]);
    expect(result.diagnostics).toEqual([
      {
        code: "glb.unknownChunk",
        message:
          "GLB contains an unknown chunk type; preserving metadata only.",
        severity: "warning",
        byteOffset: 60,
        byteLength: 12,
        chunkType: unknownType,
      },
    ]);
  });

  it("diagnoses invalid header fields without throwing", () => {
    const tooShort = parseGlbContainer(new Uint8Array(8));
    const invalidMagic = createGlb([jsonChunk({ asset: { version: "2.0" } })]);
    const invalidVersion = createGlb([
      jsonChunk({ asset: { version: "2.0" } }),
    ]);
    const lengthMismatch = createGlb([
      jsonChunk({ asset: { version: "2.0" } }),
    ]);

    new DataView(invalidMagic.buffer).setUint32(0, 0, true);
    new DataView(invalidVersion.buffer).setUint32(4, 1, true);
    new DataView(lengthMismatch.buffer).setUint32(
      8,
      lengthMismatch.byteLength + 4,
      true,
    );

    expect(tooShort).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.tooShort", severity: "error" }],
    });
    expect(parseGlbContainer(invalidMagic)).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.invalidMagic", severity: "error" }],
    });
    expect(parseGlbContainer(invalidVersion)).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.unsupportedVersion", severity: "error" }],
    });
    expect(parseGlbContainer(lengthMismatch)).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.lengthMismatch", severity: "error" }],
    });
  });

  it("diagnoses missing JSON and malformed chunk ranges", () => {
    const missingJson = parseGlbContainer(
      createGlb([bytesChunk(GLB_BINARY_CHUNK_TYPE, [1, 2, 3, 4])]),
    );
    const truncatedChunkHeader = parseGlbContainer(createHeaderOnlyGlb(15));
    const chunkOutOfBounds = createHeaderOnlyGlb(24);
    const outOfBoundsView = new DataView(chunkOutOfBounds.buffer);

    outOfBoundsView.setUint32(12, 8, true);
    outOfBoundsView.setUint32(16, GLB_JSON_CHUNK_TYPE, true);

    expect(missingJson).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.missingJsonChunk", severity: "error" }],
    });
    expect(truncatedChunkHeader).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.invalidChunkHeader", severity: "error" }],
    });
    expect(parseGlbContainer(chunkOutOfBounds)).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.chunkOutOfBounds", severity: "error" }],
    });
  });

  it("diagnoses empty, invalid, and non-object JSON chunks", () => {
    const emptyJson = parseGlbContainer(
      createGlb([bytesChunk(GLB_JSON_CHUNK_TYPE, [])]),
    );
    const invalidUtf8 = parseGlbContainer(
      createGlb([bytesChunk(GLB_JSON_CHUNK_TYPE, [0xff, 0xff, 0xff, 0xff])]),
    );
    const invalidJson = parseGlbContainer(
      createGlb([textChunk(GLB_JSON_CHUNK_TYPE, "{")]),
    );
    const nonObjectJson = parseGlbContainer(
      createGlb([textChunk(GLB_JSON_CHUNK_TYPE, "[]")]),
    );

    expect(emptyJson).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.emptyJsonChunk", severity: "error" }],
    });
    expect(invalidUtf8).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.invalidJson", severity: "error" }],
    });
    expect(invalidJson).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.invalidJson", severity: "error" }],
    });
    expect(nonObjectJson).toMatchObject({
      ok: false,
      container: null,
      diagnostics: [{ code: "glb.invalidJson", severity: "error" }],
    });
  });
});
