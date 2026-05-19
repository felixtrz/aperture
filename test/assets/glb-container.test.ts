import { describe, expect, it } from "vitest";

import {
  GLB_BINARY_CHUNK_TYPE,
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
  createGltfReportDrivenImportReportFromGlb,
  gltfReportDrivenGlbImportReportToJsonValue,
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

describe("GLB report-driven import fixture path", () => {
  it("feeds uncompressed JSON and BIN chunks into the mesh import contract", () => {
    const { root, bytes } = rootWithTriangleMesh();
    const source = createGlb([
      jsonChunk(root),
      bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
    ]);

    const report = createGltfReportDrivenImportReportFromGlb({
      source,
      createMeshAssets: true,
    });

    expect(report.valid).toBe(true);
    expect(report.container.ok).toBe(true);
    expect(report.importReport?.valid).toBe(true);
    expect(report.importReport?.meshConstruction?.meshes[0]).toMatchObject({
      registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
      meshIndex: 0,
      primitiveIndex: 0,
    });
    expect(
      report.importReport?.accessorDecoding?.primitives[0]?.attributes[0],
    ).toMatchObject({
      semantic: "POSITION",
      bufferIndex: 0,
      itemSize: 3,
    });
    expect(
      report.importReport?.accessorDecoding?.primitives[0]?.vertexCount,
    ).toBe(3);
  });

  it("does not run import stages when the GLB header is invalid", () => {
    const source = createGlb([jsonChunk({ asset: { version: "2.0" } })]);

    new DataView(source.buffer).setUint32(0, 0, true);

    const report = createGltfReportDrivenImportReportFromGlb({
      source,
      createMeshAssets: true,
    });

    expect(report).toMatchObject({
      valid: false,
      importReport: null,
      container: {
        ok: false,
        container: null,
        diagnostics: [{ code: "glb.invalidMagic", severity: "error" }],
      },
    });
  });

  it("preserves structured missing JSON diagnostics at the GLB boundary", () => {
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([bytesChunk(GLB_BINARY_CHUNK_TYPE, [1, 2, 3, 4])]),
      createMeshAssets: true,
    });

    expect(report).toMatchObject({
      valid: false,
      importReport: null,
      container: {
        ok: false,
        container: null,
        diagnostics: [{ code: "glb.missingJsonChunk", severity: "error" }],
      },
    });
  });

  it("reports a missing BIN chunk before mesh decoding fails", () => {
    const { root } = rootWithTriangleMesh();
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([jsonChunk(root)]),
      createMeshAssets: true,
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "glbImport.missingBinaryChunk",
        severity: "error",
        bufferIndex: 0,
      },
    ]);
    expect(report.importReport?.accessorDecoding?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "gltfDecode.missingBufferBytes",
          bufferIndex: 0,
        }),
      ]),
    );
  });

  it("reports unsupported external buffers without resolving them implicitly", () => {
    const { root } = rootWithTriangleMesh({
      buffer: { byteLength: 36, uri: "mesh.bin" },
    });
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([jsonChunk(root)]),
      createMeshAssets: true,
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "glbImport.externalBufferUnsupported",
        severity: "error",
        bufferIndex: 0,
        uri: "mesh.bin",
      },
    ]);
    expect(report.importReport?.accessorDecoding?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "gltfDecode.missingBufferBytes",
          bufferIndex: 0,
        }),
      ]),
    );
  });

  it("serializes GLB import reports without raw binary payloads", () => {
    const { root, bytes } = rootWithTriangleMesh();
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([
        jsonChunk(root),
        bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
      ]),
      createMeshAssets: true,
    });

    const json = gltfReportDrivenGlbImportReportToJsonValue(report);
    const serialized = JSON.stringify(json);

    expect(json.valid).toBe(true);
    expect(json.container.chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "json" }),
        expect.objectContaining({ type: "bin" }),
      ]),
    );
    expect("binaryChunk" in json.container).toBe(false);
    expect("jsonText" in json.container).toBe(false);
    expect(serialized).not.toContain("ArrayBuffer");
    expect(serialized).not.toContain("Uint8Array");
  });

  it("feeds GLB bufferView images through the asset-mapping contract", () => {
    const { root, bytes } = rootWithBufferViewImage();
    let resolvedSourceKind = "";
    let resolvedBufferView = -1;
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([
        jsonChunk(root),
        bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
      ]),
      createAssetMapping: true,
      resolveImageData: (input) => {
        resolvedSourceKind = input.source.kind;
        resolvedBufferView =
          input.source.kind === "bufferView" ? input.source.bufferView : -1;
        return decodedImage;
      },
    });

    expect(report.valid).toBe(true);
    expect(resolvedSourceKind).toBe("bufferView");
    expect(resolvedBufferView).toBe(0);
    expect(report.importReport?.assetMapping?.textures).toMatchObject([
      {
        textureIndex: 0,
        slot: "baseColorTexture",
        texture: {
          semantic: "base-color",
          colorSpace: "srgb",
        },
      },
    ]);
    expect(report.importReport?.assetMapping?.materials[0]).toMatchObject({
      material: {
        kind: "standard",
        baseColorTexture: {
          texture: { kind: "texture", id: "gltf:texture:0:baseColorTexture" },
        },
      },
    });
  });

  it("preserves missing GLB bufferView image data as an asset-mapping diagnostic", () => {
    const { root, bytes } = rootWithBufferViewImage();
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([
        jsonChunk(root),
        bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
      ]),
      createAssetMapping: true,
      resolveImageData: () => null,
    });

    expect(report.valid).toBe(false);
    expect(report.importReport?.assetMapping?.diagnostics).toMatchObject([
      {
        layer: "texture",
        code: "gltfTexture.imageResolverFailed",
        severity: "error",
        textureIndex: 0,
        slot: "baseColorTexture",
      },
      {
        layer: "material",
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        textureIndex: 0,
        slot: "baseColorTexture",
      },
    ]);
  });

  it("decodes GLB POSITION and unsigned-short index accessors", () => {
    const { root, bytes } = rootWithIndexedTriangleMesh();
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([
        jsonChunk(root),
        bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
      ]),
      createMeshAssets: true,
    });

    expect(report.valid).toBe(true);
    expect(report.importReport?.accessorDecoding?.primitives[0]).toMatchObject({
      vertexCount: 3,
      indices: {
        semantic: "INDICES",
        bufferIndex: 0,
        itemSize: 1,
      },
    });
    expect(
      report.importReport?.meshConstruction?.meshes[0]?.mesh?.submeshes[0],
    ).toMatchObject({
      vertexCount: 3,
      indexCount: 3,
    });
    const json = gltfReportDrivenGlbImportReportToJsonValue(report);

    expect("binaryChunk" in json.container).toBe(false);
    expect(JSON.stringify(json)).not.toContain("0,1,2");
  });

  it("reports malformed GLB index buffer ranges", () => {
    const { root, bytes } = rootWithIndexedTriangleMesh({
      declaredBufferByteLength: 40,
    });
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([
        jsonChunk(root),
        bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
      ]),
      createMeshAssets: true,
    });

    expect(report.valid).toBe(false);
    expect(report.importReport?.accessorValidation?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "gltfAccessor.bufferRangeOutOfBounds",
          bufferViewIndex: 1,
          bufferIndex: 0,
        }),
      ]),
    );
  });
});

const decodedImage = {
  width: 1,
  height: 1,
  sourceData: {
    bytes: new Uint8Array([255, 255, 255, 255]),
    bytesPerRow: 4,
  },
};

function rootWithTriangleMesh(
  options: {
    readonly buffer?: { readonly byteLength: number; readonly uri?: string };
  } = {},
) {
  const bytes = new Uint8Array(36);
  const view = new DataView(bytes.buffer);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    view.setFloat32(index * 4, value, true),
  );

  return {
    bytes,
    root: {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: "Root", mesh: 0 }],
      buffers: [options.buffer ?? { byteLength: 36 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    },
  };
}

function rootWithBufferViewImage() {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

  return {
    bytes,
    root: {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: "Textured" }],
      buffers: [{ byteLength: bytes.byteLength }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bytes.byteLength }],
      materials: [
        {
          pbrMetallicRoughness: {
            baseColorTexture: { index: 0 },
          },
        },
      ],
      textures: [{ source: 0 }],
      images: [{ bufferView: 0, mimeType: "image/png" }],
    },
  };
}

function rootWithIndexedTriangleMesh(
  options: { readonly declaredBufferByteLength?: number } = {},
) {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);

  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    view.setFloat32(index * 4, value, true),
  );
  [0, 1, 2].forEach((value, index) =>
    view.setUint16(36 + index * 2, value, true),
  );

  return {
    bytes,
    root: {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: "Indexed", mesh: 0 }],
      buffers: [{ byteLength: options.declaredBufferByteLength ?? 42 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 6 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    },
  };
}
