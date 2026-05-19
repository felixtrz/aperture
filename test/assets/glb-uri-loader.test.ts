import { describe, expect, it } from "vitest";

import {
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
  loadGlbFromUri,
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

function glbDataUrl(bytes: Uint8Array): string {
  return `data:model/gltf-binary;base64,${Buffer.from(bytes).toString(
    "base64",
  )}`;
}

describe("GLB URI loader", () => {
  it("loads a base64 data URL through the no-fetch GLB facade", async () => {
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root" }],
      }),
    ]);
    const report = await loadGlbFromUri(glbDataUrl(source));

    expect(report.ok).toBe(true);
    expect(report.byteLength).toBe(source.byteLength);
    expect(report.loader?.status).toMatchObject({
      status: "loaded",
      sourceKind: "glb",
      diagnostics: [],
    });
    expect(report.loader?.glbImportReport.valid).toBe(true);
    expect(JSON.stringify(report)).not.toContain("Uint8Array");
  });

  it("reports a malformed URL without fetching", async () => {
    const report = await loadGlbFromUri("not a glb url");

    expect(report).toMatchObject({
      ok: false,
      byteLength: null,
      loader: null,
      diagnostics: [
        {
          code: "loadGlbFromUri.invalidUrl",
          severity: "error",
        },
      ],
    });
  });

  it("reports HTTP errors with typed diagnostics", async () => {
    const report = await loadGlbFromUri("https://example.test/missing.glb", {
      fetch: async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      loader: null,
      diagnostics: [
        {
          code: "loadGlbFromUri.httpError",
          severity: "error",
          status: 404,
          statusText: "Not Found",
        },
      ],
    });
  });
});
