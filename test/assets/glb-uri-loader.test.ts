import { describe, expect, it } from "vitest";

import {
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_BINARY_CHUNK_TYPE,
  GLB_JSON_CHUNK_TYPE,
  createGlbUriLoadCache,
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

function binaryChunk(data: Uint8Array): TestGlbChunk {
  return {
    typeCode: GLB_BINARY_CHUNK_TYPE,
    data: padChunkData(data, 0),
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

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function decodedImage() {
  return {
    width: 1,
    height: 1,
    sourceData: {
      bytes: new Uint8Array([255, 0, 0, 255]),
      bytesPerRow: 4,
      rowsPerImage: 1,
    },
  };
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

  it("decodes GLB bufferView images in the URI loader", async () => {
    const imageBytes = new Uint8Array([1, 2, 3, 4]);
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [] }],
        nodes: [],
        buffers: [{ byteLength: imageBytes.byteLength }],
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: imageBytes.byteLength },
        ],
        images: [{ bufferView: 0, mimeType: "image/png" }],
        textures: [{ source: 0 }],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
      }),
      binaryChunk(imageBytes),
    ]);
    const decodedInputs: number[][] = [];
    const sourceBuffer = arrayBufferFromBytes(source);
    const decodedInput: { current: Uint8Array | null } = { current: null };
    const decoded = decodedImage();
    const report = await loadGlbFromUri(
      "https://example.test/assets/buffer-view-image.glb",
      {
        fetch: async () => ({
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => sourceBuffer,
        }),
        createAssetMapping: true,
        decodeImageData: async (input) => {
          decodedInput.current = input.bytes;
          decodedInputs.push([...input.bytes]);
          return decoded;
        },
      },
    );

    expect(report.ok).toBe(true);
    expect(decodedInputs).toEqual([[1, 2, 3, 4]]);
    expect(decodedInput.current?.buffer).toBe(sourceBuffer);
    expect(decodedInput.current?.byteLength).toBe(4);
    expect(report.externalImages).toEqual([
      expect.objectContaining({
        imageIndex: 0,
        sourceKind: "buffer-view",
        status: "loaded",
        uri: "bufferView:0",
        byteLength: 4,
        width: 1,
        height: 1,
      }),
    ]);
    expect(report.loader?.glbImportReport.importReport?.assetMapping).not.toBe(
      null,
    );
    const sourceData =
      report.loader?.glbImportReport.importReport?.assetMapping?.textures[0]
        ?.texture?.sourceData;
    expect(sourceData?.bytes).toBe(decoded.sourceData.bytes);
  });

  it("fetches external image URI bytes in the GLB URI loader", async () => {
    const glbUrl = "https://example.test/assets/model.glb";
    const imageUrl = "https://example.test/assets/base.png";
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [] }],
        nodes: [],
        images: [{ uri: "base.png" }],
        textures: [{ source: 0 }],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
      }),
    ]);
    const imageBytes = new Uint8Array([5, 6, 7, 8]).buffer;
    const fetched: string[] = [];
    const report = await loadGlbFromUri(glbUrl, {
      createAssetMapping: true,
      decodeImageData: async (input) => {
        expect([...input.bytes]).toEqual([5, 6, 7, 8]);
        return decodedImage();
      },
      fetch: async (url) => {
        fetched.push(url);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () =>
            url === glbUrl ? arrayBufferFromBytes(source) : imageBytes,
        };
      },
    });

    expect(report.ok).toBe(true);
    expect(fetched).toEqual([glbUrl, imageUrl]);
    expect(report.externalImages).toEqual([
      expect.objectContaining({
        imageIndex: 0,
        sourceKind: "uri",
        status: "loaded",
        uri: "base.png",
        url: imageUrl,
        byteLength: 4,
      }),
    ]);
  });

  it("reuses cached source bytes, external image bytes, and decoded images", async () => {
    const glbUrl = "https://example.test/assets/model.glb";
    const imageUrl = "https://example.test/assets/base.png";
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [] }],
        nodes: [],
        images: [{ uri: "base.png" }],
        textures: [{ source: 0 }],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
      }),
    ]);
    const imageBytes = new Uint8Array([9, 10, 11, 12]).buffer;
    const fetched: string[] = [];
    const decodedInputs: number[][] = [];
    const cache = createGlbUriLoadCache();
    const options = {
      cache,
      createAssetMapping: true,
      decodeImageData: async (input: { readonly bytes: Uint8Array }) => {
        decodedInputs.push([...input.bytes]);
        return decodedImage();
      },
      fetch: async (url: string) => {
        fetched.push(url);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () =>
            url === glbUrl ? arrayBufferFromBytes(source) : imageBytes,
        };
      },
    };

    const first = await loadGlbFromUri(glbUrl, options);
    const second = await loadGlbFromUri(glbUrl, options);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetched).toEqual([glbUrl, imageUrl]);
    expect(decodedInputs).toEqual([[9, 10, 11, 12]]);
  });

  it("coalesces in-flight cached GLB URI loads", async () => {
    const glbUrl = "https://example.test/assets/model.glb";
    const imageUrl = "https://example.test/assets/base.png";
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [] }],
        nodes: [],
        images: [{ uri: "base.png" }],
        textures: [{ source: 0 }],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
      }),
    ]);
    const imageBytes = new Uint8Array([13, 14, 15, 16]).buffer;
    const fetched: string[] = [];
    const decodedInputs: number[][] = [];
    const cache = createGlbUriLoadCache();

    const [first, second] = await Promise.all([
      loadGlbFromUri(glbUrl, {
        cache,
        createAssetMapping: true,
        decodeImageData: async (input) => {
          decodedInputs.push([...input.bytes]);
          return decodedImage();
        },
        fetch: async (url) => {
          fetched.push(url);
          await Promise.resolve();
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () =>
              url === glbUrl ? arrayBufferFromBytes(source) : imageBytes,
          };
        },
      }),
      loadGlbFromUri(glbUrl, {
        cache,
        createAssetMapping: true,
        decodeImageData: async (input) => {
          decodedInputs.push([...input.bytes]);
          return decodedImage();
        },
        fetch: async (url) => {
          fetched.push(url);
          await Promise.resolve();
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () =>
              url === glbUrl ? arrayBufferFromBytes(source) : imageBytes,
          };
        },
      }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetched.sort()).toEqual([glbUrl, imageUrl].sort());
    expect(decodedInputs).toEqual([[13, 14, 15, 16]]);
  });

  it("does not pin failed cached GLB fetches", async () => {
    const glbUrl = "https://example.test/assets/model.glb";
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [] }],
        nodes: [],
      }),
    ]);
    const cache = createGlbUriLoadCache();
    let fetchCount = 0;

    const first = await loadGlbFromUri(glbUrl, {
      cache,
      fetch: async () => {
        fetchCount += 1;
        throw new Error("temporary outage");
      },
    });
    const second = await loadGlbFromUri(glbUrl, {
      cache,
      fetch: async () => {
        fetchCount += 1;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => arrayBufferFromBytes(source),
        };
      },
    });

    expect(first.ok).toBe(false);
    expect(first.diagnostics[0]?.code).toBe("loadGlbFromUri.fetchFailed");
    expect(second.ok).toBe(true);
    expect(fetchCount).toBe(2);
  });
});
