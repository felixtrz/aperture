import { describe, expect, it } from "vitest";

import { loadGltfFromUri } from "@aperture-engine/render";

const GLTF_URL = "https://example.test/assets/external-triangle.gltf";
const BIN_URL = "https://example.test/assets/external-triangle.bin";

function triangleRoot(): Record<string, unknown> {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        extensions: { KHR_materials_unlit: {} },
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [0.15, 0.75, 0.95, 1],
        },
      },
    ],
    buffers: [{ uri: "external-triangle.bin", byteLength: 44 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 3,
        type: "SCALAR",
      },
    ],
    extensionsUsed: ["KHR_materials_unlit"],
  };
}

function encodeJson(value: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

function triangleBytes(): ArrayBuffer {
  const bytes = new ArrayBuffer(44);
  const view = new DataView(bytes);
  const positions = [-0.8, -0.6, 0, 0.8, -0.6, 0, 0, 0.7, 0];

  positions.forEach((value, index) => view.setFloat32(index * 4, value, true));
  [0, 1, 2].forEach((value, index) =>
    view.setUint16(36 + index * 2, value, true),
  );

  return bytes;
}

describe("glTF URI loader", () => {
  it("loads same-origin .gltf JSON plus an external .bin buffer", async () => {
    const root = triangleRoot();
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytes();
    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "external",
      createAssetMapping: true,
      createMeshAssets: true,
      fetch: async (url) => ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => {
          if (url === GLTF_URL) {
            return sourceBytes;
          }

          if (url === BIN_URL) {
            return binBytes;
          }

          throw new Error(`Unexpected URL ${url}`);
        },
      }),
    });

    expect(report.ok).toBe(true);
    expect(report.byteLength).toBe(sourceBytes.byteLength);
    expect(report.loader?.status).toMatchObject({
      status: "loaded",
      sourceKind: "gltf",
      byteLength: sourceBytes.byteLength,
      externalBuffers: [
        {
          uri: "external-triangle.bin",
          status: "loaded",
          byteLength: 44,
        },
      ],
      diagnostics: [],
      glbSourceStatus: null,
    });
    expect(report.loader?.outputSummary.meshConstruction).toMatchObject({
      status: "ready",
      meshCount: 1,
      submeshCount: 1,
      vertexCount: 3,
      indexCount: 3,
    });
    expect(JSON.stringify(report.loader?.status)).not.toContain("ArrayBuffer");
    expect(JSON.stringify(report.loader?.status)).not.toContain("Uint8Array");
  });

  it("blocks cross-origin external buffers before fetching them", async () => {
    const sourceBytes = encodeJson({
      ...triangleRoot(),
      buffers: [
        {
          uri: "https://cdn.example.test/external-triangle.bin",
          byteLength: 44,
        },
      ],
    });
    const fetched: string[] = [];
    const report = await loadGltfFromUri(GLTF_URL, {
      createMeshAssets: true,
      fetch: async (url) => {
        fetched.push(url);

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => sourceBytes,
        };
      },
    });

    expect(fetched).toEqual([GLTF_URL]);
    expect(report.ok).toBe(false);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "loadGltfFromUri.unsupportedBufferUri",
          bufferIndex: 0,
        }),
      ]),
    );
    expect(report.loader?.status.sourceKind).toBe("gltf");
    expect(report.loader?.status.externalBuffers[0]).toMatchObject({
      status: "blocked",
      byteLength: null,
    });
  });
});
