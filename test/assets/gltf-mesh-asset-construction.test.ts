import { describe, expect, it } from "vitest";

import {
  createGltfMeshPrimitiveMappingReport,
  createMeshAssetsFromGltfDecodedAccessors,
  decodeGltfPrimitiveAccessors,
  validateGltfPrimitiveAccessorReferences,
  type GltfAccessorDecodingReport,
} from "@aperture-engine/core";

describe("glTF mesh source asset construction", () => {
  it("constructs a MeshAsset from decoded primitive arrays", () => {
    const root = {
      asset: { version: "2.0" },
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
    const bytes = new Uint8Array(42);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0, 0, 2, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    [0, 1, 2].forEach((value, index) =>
      view.setUint16(36 + index * 2, value, true),
    );
    const decodedReport = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const position = decodedReport.primitives[0]?.attributes[0]?.array;

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.meshes[0]).toMatchObject({
      handleKey: "gltf:mesh:0:primitive:0",
      registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
    });
    expect(report.meshes[0]?.mesh).toMatchObject({
      kind: "mesh",
      label: "mesh:gltf:mesh:0:primitive:0",
      vertexStreams: [
        {
          id: "gltf-primitive-interleaved",
          arrayStride: 12,
          vertexCount: 3,
          attributes: [
            { semantic: "POSITION", format: "float32x3", offset: 0 },
          ],
        },
      ],
      indexBuffer: { format: "uint16" },
      submeshes: [{ topology: "triangle-list", indexCount: 3 }],
      materialSlots: [{ index: 0, label: "default" }],
      localAabb: { min: [0, 0, 0], max: [1, 2, 0] },
    });
    expect(
      Array.from(report.meshes[0]?.mesh?.vertexStreams[0]?.data ?? []),
    ).toEqual([0, 0, 0, 1, 0, 0, 0, 2, 0]);
    expect(report.meshes[0]?.mesh?.vertexStreams[0]?.data).toBe(position);
  });

  it("preserves tightly interleaved source bufferViews without repacking", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 102 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 96, byteStride: 32 },
        { buffer: 0, byteOffset: 96, byteLength: 6 },
      ],
      accessors: [
        {
          bufferView: 0,
          byteOffset: 0,
          componentType: 5126,
          type: "VEC3",
          count: 3,
        },
        {
          bufferView: 0,
          byteOffset: 12,
          componentType: 5126,
          type: "VEC3",
          count: 3,
        },
        {
          bufferView: 0,
          byteOffset: 24,
          componentType: 5126,
          type: "VEC2",
          count: 3,
        },
        { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
              indices: 3,
            },
          ],
        },
      ],
    };
    const bytes = new Uint8Array(102);
    const view = new DataView(bytes.buffer);

    [
      { position: [0, 0, 0], normal: [0, 0, 1], uv: [0, 0] },
      { position: [1, 0, 0], normal: [0, 1, 0], uv: [1, 0] },
      { position: [0, 1, 0], normal: [1, 0, 0], uv: [0, 1] },
    ].forEach((vertex, vertexIndex) => {
      const base = vertexIndex * 32;

      vertex.position.forEach((value, component) =>
        view.setFloat32(base + component * 4, value, true),
      );
      vertex.normal.forEach((value, component) =>
        view.setFloat32(base + 12 + component * 4, value, true),
      );
      vertex.uv.forEach((value, component) =>
        view.setFloat32(base + 24 + component * 4, value, true),
      );
    });
    [0, 1, 2].forEach((value, index) =>
      view.setUint16(96 + index * 2, value, true),
    );

    const decodedReport = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
      storageMode: "source-view",
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(stream).toMatchObject({
      id: "gltf-source-buffer-view:0:0:32",
      arrayStride: 32,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
      ],
    });
    expect(stream?.data).toBeInstanceOf(Uint8Array);
    expect(stream?.data.byteOffset).toBe(0);
    expect(stream?.data.byteLength).toBe(96);
    expect(stream?.data.buffer).toBe(bytes.buffer);
    expect(report.meshes[0]?.mesh?.indexBuffer?.data.buffer).toBe(bytes.buffer);
  });

  it("preserves padded source bufferViews with explicit attribute offsets", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 126 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 120, byteStride: 40 },
        { buffer: 0, byteOffset: 120, byteLength: 6 },
      ],
      accessors: [
        {
          bufferView: 0,
          byteOffset: 4,
          componentType: 5126,
          type: "VEC3",
          count: 3,
        },
        {
          bufferView: 0,
          byteOffset: 20,
          componentType: 5126,
          type: "VEC3",
          count: 3,
        },
        {
          bufferView: 0,
          byteOffset: 32,
          componentType: 5126,
          type: "VEC2",
          count: 3,
        },
        { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
              indices: 3,
            },
          ],
        },
      ],
    };
    const bytes = new Uint8Array(126);
    const view = new DataView(bytes.buffer);

    [
      { position: [0, 0, 0], normal: [0, 0, 1], uv: [0, 0] },
      { position: [1, 0, 0], normal: [0, 1, 0], uv: [1, 0] },
      { position: [0, 1, 0], normal: [1, 0, 0], uv: [0, 1] },
    ].forEach((vertex, vertexIndex) => {
      const base = vertexIndex * 40;

      vertex.position.forEach((value, component) =>
        view.setFloat32(base + 4 + component * 4, value, true),
      );
      vertex.normal.forEach((value, component) =>
        view.setFloat32(base + 20 + component * 4, value, true),
      );
      vertex.uv.forEach((value, component) =>
        view.setFloat32(base + 32 + component * 4, value, true),
      );
    });
    [0, 1, 2].forEach((value, index) =>
      view.setUint16(120 + index * 2, value, true),
    );

    const decodedReport = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
      storageMode: "source-view",
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(stream).toMatchObject({
      id: "gltf-source-buffer-view:0:0:40",
      arrayStride: 40,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 4 },
        { semantic: "NORMAL", format: "float32x3", offset: 20 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 32 },
      ],
    });
    expect(stream?.data).toBeInstanceOf(Uint8Array);
    expect(stream?.data.byteOffset).toBe(0);
    expect(stream?.data.byteLength).toBe(120);
    expect(stream?.data.buffer).toBe(bytes.buffer);
  });

  it("preserves multiple tightly packed source bufferViews as vertex streams", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 102 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 36 },
        { buffer: 0, byteOffset: 72, byteLength: 24 },
        { buffer: 0, byteOffset: 96, byteLength: 6 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 2, componentType: 5126, type: "VEC2", count: 3 },
        { bufferView: 3, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
              indices: 3,
            },
          ],
        },
      ],
    };
    const bytes = new Uint8Array(102);
    const view = new DataView(bytes.buffer);

    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    [0, 0, 1, 0, 1, 0, 1, 0, 0].forEach((value, index) =>
      view.setFloat32(36 + index * 4, value, true),
    );
    [0, 0, 1, 0, 0, 1].forEach((value, index) =>
      view.setFloat32(72 + index * 4, value, true),
    );
    [0, 1, 2].forEach((value, index) =>
      view.setUint16(96 + index * 2, value, true),
    );

    const decodedReport = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
      storageMode: "source-view",
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const streams = report.meshes[0]?.mesh?.vertexStreams ?? [];

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(streams).toMatchObject([
      {
        id: "gltf-source-buffer-view:0:0:12",
        arrayStride: 12,
        attributes: [{ semantic: "POSITION", format: "float32x3", offset: 0 }],
      },
      {
        id: "gltf-source-buffer-view:0:1:12",
        arrayStride: 12,
        attributes: [{ semantic: "NORMAL", format: "float32x3", offset: 0 }],
      },
      {
        id: "gltf-source-buffer-view:0:2:8",
        arrayStride: 8,
        attributes: [
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 0 },
        ],
      },
    ]);
    expect(streams).toHaveLength(3);
    expect(streams[0]?.data.buffer).toBe(bytes.buffer);
    expect(streams[0]?.data.byteOffset).toBe(0);
    expect(streams[1]?.data.byteOffset).toBe(36);
    expect(streams[2]?.data.byteOffset).toBe(72);
  });

  it("reports index values outside the vertex range", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0]),
      indices: new Uint16Array([0, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });

    expect(report.valid).toBe(false);
    expect(report.meshes[0]?.mesh).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMeshAsset.invalidIndexValue",
        indexValue: 2,
        vertexCount: 2,
      },
    ]);
  });

  it("preserves decoded TANGENT attributes for normal-mapped glTF meshes", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      tangents: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]),
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(stream).toMatchObject({
      arrayStride: 48,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "TANGENT", format: "float32x4", offset: 32 },
      ],
    });
    expect(Array.from(stream?.data ?? [])).toEqual([
      0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0,
      1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1,
    ]);
  });

  it("generates TANGENT attributes for requested normal-mapped glTF primitives", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({
      decodedReport,
      generateMissingTangentsFor: [
        { meshIndex: 0, primitiveIndex: 0, reason: "normalTexture" },
      ],
    });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMeshAsset.generatedTangents",
        severity: "warning",
        semantic: "TANGENT",
        reason: "normalTexture",
        tangentPath: "generated-mesh-attribute",
        vertexCount: 3,
      },
    ]);
    expect(stream).toMatchObject({
      arrayStride: 48,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "TANGENT", format: "float32x4", offset: 32 },
      ],
    });
    expect(Array.from(stream?.data ?? [])).toEqual([
      0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0,
      1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1,
    ]);
  });

  it("preserves decoded TEXCOORD_1 attributes for UV1 glTF textures", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      texcoords1: new Float32Array([0.25, 0.75, 0.5, 0.5, 0.75, 0.25]),
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(stream).toMatchObject({
      arrayStride: 40,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "TEXCOORD_1", format: "float32x2", offset: 32 },
      ],
    });
    expect(Array.from(stream?.data ?? [])).toEqual([
      0, 0, 0, 0, 0, 1, 0, 0, 0.25, 0.75, 1, 0, 0, 0, 0, 1, 1, 0, 0.5, 0.5, 0,
      1, 0, 0, 0, 1, 0, 1, 0.75, 0.25,
    ]);
  });

  it("preserves decoded TANGENT and TEXCOORD_1 attributes together for UV1 normal maps", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      tangents: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]),
      texcoords1: new Float32Array([0.25, 0.75, 0.5, 0.5, 0.75, 0.25]),
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(stream).toMatchObject({
      arrayStride: 56,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "TANGENT", format: "float32x4", offset: 32 },
        { semantic: "TEXCOORD_1", format: "float32x2", offset: 48 },
      ],
    });
    expect(Array.from(stream?.data ?? [])).toEqual([
      0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0.25, 0.75, 1, 0, 0, 0, 0, 1, 1, 0, 1,
      0, 0, 1, 0.5, 0.5, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0.75, 0.25,
    ]);
  });

  it("preserves decoded COLOR_0 attributes for vertex-colored glTF meshes", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      colors: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]),
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(stream).toMatchObject({
      arrayStride: 48,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "COLOR_0", format: "float32x4", offset: 32 },
      ],
    });
    expect(Array.from(stream?.data ?? [])).toEqual([
      0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0,
      1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1,
    ]);
  });

  it("preserves normalized byte COLOR_0 attributes as compact unorm streams", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      colors: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
      colorExpectedFormat: "unorm8x4",
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(stream).toMatchObject({
      arrayStride: 36,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "COLOR_0", format: "unorm8x4", offset: 32 },
      ],
    });
    expect(stream?.data).toBeInstanceOf(Uint8Array);
    if (!(stream?.data instanceof Uint8Array)) {
      throw new Error(
        "Expected vertex-color mesh stream data to be byte-packed.",
      );
    }

    const view = new DataView(
      stream.data.buffer,
      stream.data.byteOffset,
      stream.data.byteLength,
    );

    expect(view.getFloat32(0, true)).toBe(0);
    expect(view.getFloat32(12 + 8, true)).toBe(1);
    expect(Array.from(stream.data.slice(32, 36))).toEqual([255, 0, 0, 255]);
    expect(Array.from(stream.data.slice(36 + 32, 36 + 36))).toEqual([
      0, 255, 0, 255,
    ]);
  });

  it("preserves decoded VEC3 float COLOR_0 attributes as float32x3 streams", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      colors: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      colorExpectedFormat: "float32x3",
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(stream).toMatchObject({
      arrayStride: 44,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "COLOR_0", format: "float32x3", offset: 32 },
      ],
    });
  });

  it("packs skinned glTF mesh attributes into the standard mixed stream layout", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([
        -0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0,
      ]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      joints: new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
      weights: new Float32Array([
        1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
      ]),
      indices: new Uint16Array([0, 1, 2, 2, 1, 3]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const mesh = report.meshes[0]?.mesh;
    const stream = mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(mesh?.skinning).toEqual({
      joints0: "JOINTS_0",
      weights0: "WEIGHTS_0",
    });
    expect(stream).toMatchObject({
      arrayStride: 56,
      vertexCount: 4,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "JOINTS_0", format: "uint16x4", offset: 32 },
        { semantic: "WEIGHTS_0", format: "float32x4", offset: 40 },
      ],
    });
    expect(stream?.data).toBeInstanceOf(Uint8Array);
    if (!(stream?.data instanceof Uint8Array)) {
      throw new Error("Expected skinned mesh stream data to be byte-packed.");
    }

    const view = new DataView(
      stream.data.buffer,
      stream.data.byteOffset,
      stream.data.byteLength,
    );

    expect(view.getFloat32(0, true)).toBe(-0.5);
    expect(view.getFloat32(12 + 8, true)).toBe(1);
    expect(view.getFloat32(24 + 4, true)).toBe(0);
    expect(view.getUint16(32, true)).toBe(0);
    expect(view.getFloat32(40, true)).toBe(1);

    const vertex2 = 2 * 56;
    expect(view.getFloat32(vertex2, true)).toBe(-0.5);
    expect(view.getFloat32(vertex2 + 4, true)).toBe(1);
    expect(view.getUint16(vertex2 + 32, true)).toBe(1);
    expect(view.getFloat32(vertex2 + 40, true)).toBe(1);
  });

  it("preserves compact skinned glTF attributes in byte-normalized layouts", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([
        -0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0,
      ]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      joints: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
      weights: new Uint8Array([
        255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0,
      ]),
      indices: new Uint16Array([0, 1, 2, 2, 1, 3]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const mesh = report.meshes[0]?.mesh;
    const stream = mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(mesh?.skinning).toEqual({
      joints0: "JOINTS_0",
      weights0: "WEIGHTS_0",
    });
    expect(stream).toMatchObject({
      arrayStride: 40,
      vertexCount: 4,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "JOINTS_0", format: "uint8x4", offset: 32 },
        { semantic: "WEIGHTS_0", format: "unorm8x4", offset: 36 },
      ],
    });
    expect(stream?.data).toBeInstanceOf(Uint8Array);
    if (!(stream?.data instanceof Uint8Array)) {
      throw new Error(
        "Expected compact skinned mesh stream to be byte-packed.",
      );
    }

    const view = new DataView(
      stream.data.buffer,
      stream.data.byteOffset,
      stream.data.byteLength,
    );
    const vertex2 = 2 * 40;

    expect(view.getFloat32(vertex2, true)).toBe(-0.5);
    expect(view.getUint8(vertex2 + 32)).toBe(1);
    expect(view.getUint8(vertex2 + 36)).toBe(255);
  });

  it("packs morph target attributes into the standard morphed stream layout", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([
        -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
      ]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
      morphPosition0: new Float32Array([
        0.4, 0, 0, 0.4, 0, 0, 0.4, 0, 0, 0.4, 0, 0,
      ]),
      morphNormal0: new Float32Array(12),
      morphPosition1: new Float32Array([
        0, -0.2, 0, 0, -0.2, 0, 0, 0.3, 0, 0, 0.3, 0,
      ]),
      morphNormal1: new Float32Array(12),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const mesh = report.meshes[0]?.mesh;
    const stream = mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(mesh?.morphTargets).toEqual([
      {
        label: "target0",
        positionSemantic: "MORPH_POSITION_0",
        normalSemantic: "MORPH_NORMAL_0",
      },
      {
        label: "target1",
        positionSemantic: "MORPH_POSITION_1",
        normalSemantic: "MORPH_NORMAL_1",
      },
    ]);
    expect(stream).toMatchObject({
      arrayStride: 80,
      vertexCount: 4,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "MORPH_POSITION_0", format: "float32x3", offset: 32 },
        { semantic: "MORPH_NORMAL_0", format: "float32x3", offset: 44 },
        { semantic: "MORPH_POSITION_1", format: "float32x3", offset: 56 },
        { semantic: "MORPH_NORMAL_1", format: "float32x3", offset: 68 },
      ],
    });
    expect(stream?.data).toBeInstanceOf(Float32Array);
    if (!(stream?.data instanceof Float32Array)) {
      throw new Error("Expected morphed mesh stream data to be float-packed.");
    }

    expect(stream.data[32 / 4]).toBeCloseTo(0.4);
    expect(stream.data[(56 + 4) / 4]).toBeCloseTo(-0.2);
    expect(stream.data[(3 * 80 + 56 + 4) / 4]).toBeCloseTo(0.3);
  });

  it("reports mismatched optional attribute counts", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0]),
      normals: new Float32Array([0, 0, 1]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });

    expect(report.valid).toBe(false);
    expect(report.meshes[0]?.mesh).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMeshAsset.mismatchedAttributeCount",
        semantic: "NORMAL",
        vertexCount: 2,
      },
    ]);
  });
});

function decodedFixture(input: {
  readonly positions: Float32Array;
  readonly normals?: Float32Array;
  readonly texcoords?: Float32Array;
  readonly texcoords1?: Float32Array;
  readonly tangents?: Float32Array;
  readonly colors?: Float32Array | Uint8Array | Uint16Array;
  readonly colorExpectedFormat?: GltfAccessorDecodingReport["primitives"][number]["attributes"][number]["expectedFormat"];
  readonly joints?: Uint8Array | Uint16Array;
  readonly jointsExpectedFormat?: GltfAccessorDecodingReport["primitives"][number]["attributes"][number]["expectedFormat"];
  readonly weights?: Float32Array | Uint8Array | Uint16Array;
  readonly weightsExpectedFormat?: GltfAccessorDecodingReport["primitives"][number]["attributes"][number]["expectedFormat"];
  readonly morphPosition0?: Float32Array;
  readonly morphNormal0?: Float32Array;
  readonly morphPosition1?: Float32Array;
  readonly morphNormal1?: Float32Array;
  readonly indices?: Uint16Array;
}): GltfAccessorDecodingReport {
  const attributes: GltfAccessorDecodingReport["primitives"][number]["attributes"][number][] =
    [];
  let sourceByteOffset = 0;
  let accessorIndex = 0;
  const addAttribute = (
    semantic: GltfAccessorDecodingReport["primitives"][number]["attributes"][number]["semantic"],
    array: GltfAccessorDecodingReport["primitives"][number]["attributes"][number]["array"],
    expectedFormat: GltfAccessorDecodingReport["primitives"][number]["attributes"][number]["expectedFormat"],
    itemSize: number,
  ) => {
    attributes.push({
      semantic,
      accessorIndex,
      bufferIndex: 0,
      sourceByteOffset,
      sourceByteLength: array.byteLength,
      expectedFormat,
      itemSize,
      array,
    });
    accessorIndex += 1;
    sourceByteOffset += array.byteLength;
  };

  addAttribute("POSITION", input.positions, "float32x3", 3);
  if (input.normals !== undefined) {
    addAttribute("NORMAL", input.normals, "float32x3", 3);
  }
  if (input.texcoords !== undefined) {
    addAttribute("TEXCOORD_0", input.texcoords, "float32x2", 2);
  }
  if (input.joints !== undefined) {
    addAttribute(
      "JOINTS_0",
      input.joints,
      input.jointsExpectedFormat ??
        (input.joints instanceof Uint8Array ? "uint8x4" : "uint16x4"),
      4,
    );
  }
  if (input.weights !== undefined) {
    addAttribute(
      "WEIGHTS_0",
      input.weights,
      input.weightsExpectedFormat ??
        (input.weights instanceof Uint8Array
          ? "unorm8x4"
          : input.weights instanceof Uint16Array
            ? "unorm16x4"
            : "float32x4"),
      4,
    );
  }
  if (input.morphPosition0 !== undefined) {
    addAttribute("MORPH_POSITION_0", input.morphPosition0, "float32x3", 3);
  }
  if (input.morphNormal0 !== undefined) {
    addAttribute("MORPH_NORMAL_0", input.morphNormal0, "float32x3", 3);
  }
  if (input.morphPosition1 !== undefined) {
    addAttribute("MORPH_POSITION_1", input.morphPosition1, "float32x3", 3);
  }
  if (input.morphNormal1 !== undefined) {
    addAttribute("MORPH_NORMAL_1", input.morphNormal1, "float32x3", 3);
  }
  if (input.tangents !== undefined) {
    addAttribute("TANGENT", input.tangents, "float32x4", 4);
  }
  if (input.texcoords1 !== undefined) {
    addAttribute("TEXCOORD_1", input.texcoords1, "float32x2", 2);
  }
  if (input.colors !== undefined) {
    const colorExpectedFormat = input.colorExpectedFormat ?? "float32x4";
    addAttribute(
      "COLOR_0",
      input.colors,
      colorExpectedFormat,
      colorExpectedFormat === "float32x3" ? 3 : 4,
    );
  }

  return {
    valid: true,
    primitives: [
      {
        meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        vertexCount: input.positions.length / 3,
        attributes,
        indices:
          input.indices === undefined
            ? null
            : {
                semantic: "INDICES",
                accessorIndex,
                bufferIndex: 0,
                sourceByteOffset: 0,
                sourceByteLength: input.indices.byteLength,
                expectedFormat: "uint16",
                itemSize: 1,
                array: input.indices,
              },
      },
    ],
    diagnostics: [],
  };
}
