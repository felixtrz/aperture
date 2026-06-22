import { describe, expect, it } from "vitest";

import {
  createGltfUriLoadCache,
  loadGltfFromUri,
} from "@aperture-engine/render";

const GLTF_URL = "https://example.test/assets/external-triangle.gltf";
const BIN_URL = "https://example.test/assets/external-triangle.bin";
const IMAGE_URL = "https://example.test/assets/helmet-basecolor.png";
const SECOND_IMAGE_URL = "https://example.test/assets/helmet-normal.png";

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

function texturedTriangleRoot(
  image: Record<string, unknown> = { uri: "helmet-basecolor.png" },
): Record<string, unknown> {
  return {
    ...triangleRoot(),
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
        },
      },
    ],
    textures: [{ source: 0 }],
    images: [image],
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

function triangleBytesWithImage(imageBytes: Uint8Array): ArrayBuffer {
  const triangle = new Uint8Array(triangleBytes());
  const bytes = new Uint8Array(triangle.byteLength + imageBytes.byteLength);
  bytes.set(triangle, 0);
  bytes.set(imageBytes, triangle.byteLength);
  return bytes.buffer;
}

function decodedImage() {
  return {
    width: 2,
    height: 2,
    sourceData: {
      bytes: new Uint8Array([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
      ]),
      bytesPerRow: 8,
      rowsPerImage: 2,
    },
  };
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

  it("deduplicates repeated external buffer URI fetches", async () => {
    const root = {
      ...triangleRoot(),
      buffers: [
        { uri: "external-triangle.bin", byteLength: 44 },
        { uri: "external-triangle.bin", byteLength: 44 },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 1, byteOffset: 36, byteLength: 6 },
      ],
    };
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytes();
    const fetched: string[] = [];

    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "dedupe-buffer",
      createAssetMapping: true,
      createMeshAssets: true,
      fetch: async (url) => {
        fetched.push(url);

        return {
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
        };
      },
    });

    expect(report.ok).toBe(true);
    expect(fetched).toEqual([GLTF_URL, BIN_URL]);
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

  it("fetches and decodes external image URIs relative to the .gltf source", async () => {
    const root = texturedTriangleRoot();
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytes();
    const imageBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetched: string[] = [];
    const decodedByteLengths: number[] = [];
    const decoded = decodedImage();
    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "external-image",
      createAssetMapping: true,
      createMeshAssets: true,
      decodeImageData: async (input) => {
        decodedByteLengths.push(input.bytes.byteLength);
        return decoded;
      },
      fetch: async (url) => {
        fetched.push(url);

        return {
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

            if (url === IMAGE_URL) {
              return imageBytes;
            }

            throw new Error(`Unexpected URL ${url}`);
          },
        };
      },
    });

    expect(report.ok).toBe(true);
    expect(fetched).toEqual([GLTF_URL, BIN_URL, IMAGE_URL]);
    expect(decodedByteLengths).toEqual([4]);
    expect(report.externalImages).toEqual([
      expect.objectContaining({
        imageIndex: 0,
        sourceKind: "uri",
        uri: "helmet-basecolor.png",
        url: IMAGE_URL,
        status: "loaded",
        byteLength: 4,
        mimeType: "image/png",
        width: 2,
        height: 2,
      }),
    ]);
    const sourceData =
      report.loader?.gltfImportReport.assetMapping?.textures[0]?.texture
        ?.sourceData;
    expect(sourceData?.bytes.byteLength).toBe(16);
    expect(sourceData?.bytes).toBe(decoded.sourceData.bytes);
    expect(sourceData).toMatchObject({
      bytesPerRow: 8,
      rowsPerImage: 2,
    });
  });

  it("fetches external buffer and image URI resources concurrently", async () => {
    const root = texturedTriangleRoot();
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytes();
    const imageBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    let resourceArrayBufferCalls = 0;
    let resolveBothResourcesStarted: (() => void) | null = null;
    const bothResourcesStarted = new Promise<void>((resolve) => {
      resolveBothResourcesStarted = resolve;
    });

    const waitForBothResourceReads = async () => {
      resourceArrayBufferCalls += 1;

      if (resourceArrayBufferCalls === 2) {
        resolveBothResourcesStarted?.();
      }

      await Promise.race([
        bothResourcesStarted,
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "external buffer and image fetches were not concurrent",
                ),
              ),
            100,
          ),
        ),
      ]);
    };

    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "parallel-buffer-image",
      createAssetMapping: true,
      createMeshAssets: true,
      decodeImageData: async () => decodedImage(),
      fetch: async (url) => ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => {
          if (url === GLTF_URL) {
            return sourceBytes;
          }

          if (url === BIN_URL) {
            await waitForBothResourceReads();
            return binBytes;
          }

          if (url === IMAGE_URL) {
            await waitForBothResourceReads();
            return imageBytes;
          }

          throw new Error(`Unexpected URL ${url}`);
        },
      }),
    });

    expect(report.ok).toBe(true);
    expect(resourceArrayBufferCalls).toBe(2);
  });

  it("deduplicates repeated external image URI fetches and decodes", async () => {
    const root = {
      ...texturedTriangleRoot(),
      textures: [{ source: 0 }, { source: 1 }],
      images: [
        { uri: "helmet-basecolor.png" },
        { uri: "helmet-basecolor.png" },
      ],
    };
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytes();
    const imageBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetched: string[] = [];
    let decodeCalls = 0;

    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "dedupe-image",
      createAssetMapping: true,
      createMeshAssets: true,
      decodeImageData: async () => {
        decodeCalls += 1;
        return decodedImage();
      },
      fetch: async (url) => {
        fetched.push(url);

        return {
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

            if (url === IMAGE_URL) {
              return imageBytes;
            }

            throw new Error(`Unexpected URL ${url}`);
          },
        };
      },
    });

    expect(report.ok).toBe(true);
    expect(fetched).toEqual([GLTF_URL, BIN_URL, IMAGE_URL]);
    expect(decodeCalls).toBe(1);
    expect(report.externalImages).toEqual([
      expect.objectContaining({
        imageIndex: 0,
        status: "loaded",
        byteLength: 4,
      }),
      expect.objectContaining({
        imageIndex: 1,
        status: "loaded",
        byteLength: 4,
      }),
    ]);
  });

  it("reuses cached source, external bytes, and decoded images across loads", async () => {
    const cache = createGltfUriLoadCache();
    const sourceBytes = encodeJson(texturedTriangleRoot());
    const binBytes = triangleBytes();
    const imageBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchCounts = new Map<string, number>();
    let decodeCalls = 0;

    const load = async (keyPrefix: string) =>
      loadGltfFromUri(GLTF_URL, {
        keyPrefix,
        createAssetMapping: true,
        createMeshAssets: true,
        cache,
        decodeImageData: async () => {
          decodeCalls += 1;
          return decodedImage();
        },
        fetch: async (url) => {
          fetchCounts.set(url, (fetchCounts.get(url) ?? 0) + 1);

          return {
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

              if (url === IMAGE_URL) {
                return imageBytes;
              }

              throw new Error(`Unexpected URL ${url}`);
            },
          };
        },
      });

    const first = await load("cached-first");
    const second = await load("cached-second");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchCounts).toEqual(
      new Map([
        [GLTF_URL, 1],
        [BIN_URL, 1],
        [IMAGE_URL, 1],
      ]),
    );
    expect(decodeCalls).toBe(1);
  });

  it("reuses cached external URI image decodes when image order changes", async () => {
    const firstUrl = "https://example.test/assets/order-a.gltf";
    const secondUrl = "https://example.test/assets/order-b.gltf";
    const sharedImageUrl = "https://example.test/assets/shared.png";
    const otherImageUrl = "https://example.test/assets/other.png";
    const rootForImages = (
      uris: readonly string[],
    ): Record<string, unknown> => ({
      ...triangleRoot(),
      materials: uris.map((_, index) => ({
        pbrMetallicRoughness: { baseColorTexture: { index } },
      })),
      textures: uris.map((_, index) => ({ source: index })),
      images: uris.map((uri) => ({ uri })),
    });
    const firstSourceBytes = encodeJson(
      rootForImages(["shared.png", "other.png"]),
    );
    const secondSourceBytes = encodeJson(
      rootForImages(["other.png", "shared.png"]),
    );
    const binBytes = triangleBytes();
    const fetched: string[] = [];
    const decoded: string[] = [];
    const cache = createGltfUriLoadCache();
    const load = (url: string) =>
      loadGltfFromUri(url, {
        keyPrefix: url.endsWith("order-a.gltf") ? "order-a" : "order-b",
        cache,
        createAssetMapping: true,
        decodeImageData: async (input) => {
          decoded.push(input.source.kind === "uri" ? input.source.uri : "");
          return decodedImage();
        },
        fetch: async (requestUrl) => {
          fetched.push(requestUrl);

          return {
            ok: true,
            status: 200,
            statusText: "OK",
            arrayBuffer: async () => {
              if (requestUrl === firstUrl) {
                return firstSourceBytes;
              }

              if (requestUrl === secondUrl) {
                return secondSourceBytes;
              }

              if (requestUrl === BIN_URL) {
                return binBytes;
              }

              if (requestUrl === sharedImageUrl) {
                return new Uint8Array([1, 2, 3, 4]).buffer;
              }

              if (requestUrl === otherImageUrl) {
                return new Uint8Array([5, 6, 7, 8]).buffer;
              }

              throw new Error(`Unexpected URL ${requestUrl}`);
            },
          };
        },
      });

    const first = await load(firstUrl);
    const second = await load(secondUrl);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetched).toEqual([
      firstUrl,
      BIN_URL,
      sharedImageUrl,
      otherImageUrl,
      secondUrl,
    ]);
    expect(decoded).toEqual(["shared.png", "other.png"]);
  });

  it("coalesces in-flight cached loads for the same glTF URI", async () => {
    const cache = createGltfUriLoadCache();
    const sourceBytes = encodeJson(texturedTriangleRoot());
    const binBytes = triangleBytes();
    const imageBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchCounts = new Map<string, number>();
    let decodeCalls = 0;

    const fetch = async (url: string) => {
      fetchCounts.set(url, (fetchCounts.get(url) ?? 0) + 1);

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));

          if (url === GLTF_URL) {
            return sourceBytes;
          }

          if (url === BIN_URL) {
            return binBytes;
          }

          if (url === IMAGE_URL) {
            return imageBytes;
          }

          throw new Error(`Unexpected URL ${url}`);
        },
      };
    };
    const options = {
      createAssetMapping: true,
      createMeshAssets: true,
      cache,
      fetch,
      decodeImageData: async () => {
        decodeCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return decodedImage();
      },
    };

    const [first, second] = await Promise.all([
      loadGltfFromUri(GLTF_URL, {
        ...options,
        keyPrefix: "cached-concurrent-a",
      }),
      loadGltfFromUri(GLTF_URL, {
        ...options,
        keyPrefix: "cached-concurrent-b",
      }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchCounts).toEqual(
      new Map([
        [GLTF_URL, 1],
        [BIN_URL, 1],
        [IMAGE_URL, 1],
      ]),
    );
    expect(decodeCalls).toBe(1);
  });

  it("fetches independent external image URIs concurrently", async () => {
    const root = {
      ...texturedTriangleRoot(),
      images: [{ uri: "helmet-basecolor.png" }, { uri: "helmet-normal.png" }],
    };
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytes();
    const imageBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetched: string[] = [];
    let imageArrayBufferCalls = 0;
    let resolveBothImagesStarted: (() => void) | null = null;
    const bothImagesStarted = new Promise<void>((resolve) => {
      resolveBothImagesStarted = resolve;
    });

    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "parallel-images",
      createAssetMapping: true,
      createMeshAssets: true,
      decodeImageData: async () => decodedImage(),
      fetch: async (url) => {
        fetched.push(url);

        return {
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

            if (url === IMAGE_URL || url === SECOND_IMAGE_URL) {
              imageArrayBufferCalls += 1;

              if (imageArrayBufferCalls === 2) {
                resolveBothImagesStarted?.();
              }

              await Promise.race([
                bothImagesStarted,
                new Promise((_, reject) =>
                  setTimeout(
                    () =>
                      reject(
                        new Error("external image fetches were not concurrent"),
                      ),
                    100,
                  ),
                ),
              ]);

              return imageBytes;
            }

            throw new Error(`Unexpected URL ${url}`);
          },
        };
      },
    });

    expect(report.ok).toBe(true);
    expect(fetched).toEqual([GLTF_URL, BIN_URL, IMAGE_URL, SECOND_IMAGE_URL]);
    expect(report.externalImages).toEqual([
      expect.objectContaining({
        imageIndex: 0,
        status: "loaded",
      }),
      expect.objectContaining({
        imageIndex: 1,
        status: "loaded",
      }),
    ]);
  });

  it("uses caller-provided externalImageBytes without fetching the image URI", async () => {
    const root = texturedTriangleRoot();
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytes();
    const fetched: string[] = [];
    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "provided-image",
      createAssetMapping: true,
      createMeshAssets: true,
      externalImageBytes: new Map([[0, new Uint8Array([9, 8, 7, 6])]]),
      decodeImageData: async (input) => {
        expect([...input.bytes]).toEqual([9, 8, 7, 6]);
        return decodedImage();
      },
      fetch: async (url) => {
        fetched.push(url);

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => (url === GLTF_URL ? sourceBytes : binBytes),
        };
      },
    });

    expect(report.ok).toBe(true);
    expect(fetched).toEqual([GLTF_URL, BIN_URL]);
    expect(report.externalImages[0]).toMatchObject({
      imageIndex: 0,
      status: "loaded",
      byteLength: 4,
    });
  });

  it("decodes data URI images without treating them as external fetches", async () => {
    const sourceBytes = encodeJson(
      texturedTriangleRoot({ uri: "data:image/png,%01%02%03%04" }),
    );
    const binBytes = triangleBytes();
    const fetched: string[] = [];
    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "data-image",
      createAssetMapping: true,
      createMeshAssets: true,
      decodeImageData: async (input) => {
        expect([...input.bytes]).toEqual([1, 2, 3, 4]);
        return decodedImage();
      },
      fetch: async (url) => {
        fetched.push(url);

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => (url === GLTF_URL ? sourceBytes : binBytes),
        };
      },
    });

    expect(report.ok).toBe(true);
    expect(fetched).toEqual([GLTF_URL, BIN_URL]);
    expect(report.externalImages[0]).toMatchObject({
      imageIndex: 0,
      sourceKind: "data-uri",
      status: "loaded",
    });
  });

  it("decodes bufferView-backed images from the resolved external buffer bytes", async () => {
    const root = texturedTriangleRoot({
      bufferView: 2,
      mimeType: "image/png",
    });
    root.buffers = [{ uri: "external-triangle.bin", byteLength: 48 }];
    root.bufferViews = [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
      { buffer: 0, byteOffset: 44, byteLength: 4 },
    ];
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytesWithImage(new Uint8Array([4, 3, 2, 1]));
    const fetched: string[] = [];
    const decodedInput: { current: Uint8Array | null } = { current: null };
    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "buffer-view-image",
      createAssetMapping: true,
      createMeshAssets: true,
      decodeImageData: async (input) => {
        decodedInput.current = input.bytes;
        expect([...input.bytes]).toEqual([4, 3, 2, 1]);
        return decodedImage();
      },
      fetch: async (url) => {
        fetched.push(url);

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () => (url === GLTF_URL ? sourceBytes : binBytes),
        };
      },
    });

    expect(report.ok).toBe(true);
    expect(fetched).toEqual([GLTF_URL, BIN_URL]);
    expect(decodedInput.current?.buffer).toBe(binBytes);
    expect(decodedInput.current?.byteOffset).toBe(44);
    expect(decodedInput.current?.byteLength).toBe(4);
    expect(report.externalImages[0]).toMatchObject({
      imageIndex: 0,
      sourceKind: "buffer-view",
      uri: "bufferView:2",
      status: "loaded",
      byteLength: 4,
      mimeType: "image/png",
    });
  });

  it("reports typed diagnostics when an external image fetch fails", async () => {
    const sourceBytes = encodeJson(texturedTriangleRoot());
    const binBytes = triangleBytes();
    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "missing-image",
      createAssetMapping: true,
      createMeshAssets: true,
      decodeImageData: async () => decodedImage(),
      fetch: async (url) => ({
        ok: url !== IMAGE_URL,
        status: url === IMAGE_URL ? 404 : 200,
        statusText: url === IMAGE_URL ? "Not Found" : "OK",
        arrayBuffer: async () => (url === GLTF_URL ? sourceBytes : binBytes),
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "loadGltfFromUri.imageHttpError",
          imageIndex: 0,
          uri: IMAGE_URL,
          status: 404,
        }),
      ]),
    );
  });

  it("reports duplicate external image fetch failures per image", async () => {
    const root = {
      ...texturedTriangleRoot(),
      textures: [{ source: 0 }, { source: 1 }],
      images: [
        { uri: "helmet-basecolor.png" },
        { uri: "helmet-basecolor.png" },
      ],
    };
    const sourceBytes = encodeJson(root);
    const binBytes = triangleBytes();
    const fetched: string[] = [];

    const report = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "missing-duplicate-image",
      createAssetMapping: true,
      createMeshAssets: true,
      decodeImageData: async () => decodedImage(),
      fetch: async (url) => {
        fetched.push(url);

        return {
          ok: url !== IMAGE_URL,
          status: url === IMAGE_URL ? 404 : 200,
          statusText: url === IMAGE_URL ? "Not Found" : "OK",
          arrayBuffer: async () => (url === GLTF_URL ? sourceBytes : binBytes),
        };
      },
    });

    expect(report.ok).toBe(false);
    expect(fetched).toEqual([GLTF_URL, BIN_URL, IMAGE_URL]);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "loadGltfFromUri.imageHttpError",
          imageIndex: 0,
          uri: IMAGE_URL,
          status: 404,
        }),
        expect.objectContaining({
          code: "loadGltfFromUri.imageHttpError",
          imageIndex: 1,
          uri: IMAGE_URL,
          status: 404,
        }),
      ]),
    );
  });

  it("does not pin failed cached fetches", async () => {
    const cache = createGltfUriLoadCache();
    const sourceBytes = encodeJson(texturedTriangleRoot());
    const binBytes = triangleBytes();
    const imageBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchCounts = new Map<string, number>();
    let failImageFetch = true;

    const fetch = async (url: string) => {
      fetchCounts.set(url, (fetchCounts.get(url) ?? 0) + 1);

      return {
        ok: !(url === IMAGE_URL && failImageFetch),
        status: url === IMAGE_URL && failImageFetch ? 503 : 200,
        statusText: url === IMAGE_URL && failImageFetch ? "Retry" : "OK",
        arrayBuffer: async () => {
          if (url === GLTF_URL) {
            return sourceBytes;
          }

          if (url === BIN_URL) {
            return binBytes;
          }

          if (url === IMAGE_URL) {
            return imageBytes;
          }

          throw new Error(`Unexpected URL ${url}`);
        },
      };
    };

    const first = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "cached-failed-first",
      createAssetMapping: true,
      createMeshAssets: true,
      cache,
      fetch,
      decodeImageData: async () => decodedImage(),
    });

    failImageFetch = false;

    const second = await loadGltfFromUri(GLTF_URL, {
      keyPrefix: "cached-failed-second",
      createAssetMapping: true,
      createMeshAssets: true,
      cache,
      fetch,
      decodeImageData: async () => decodedImage(),
    });

    expect(first.ok).toBe(false);
    expect(first.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "loadGltfFromUri.imageHttpError",
          imageIndex: 0,
          status: 503,
        }),
      ]),
    );
    expect(second.ok).toBe(true);
    expect(fetchCounts).toEqual(
      new Map([
        [GLTF_URL, 1],
        [BIN_URL, 1],
        [IMAGE_URL, 2],
      ]),
    );
  });
});
