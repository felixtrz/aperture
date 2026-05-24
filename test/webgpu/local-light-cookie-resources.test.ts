import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createSamplerAsset,
  createSamplerHandle,
  createTextureAsset,
  createTextureHandle,
  prepareLocalLightClusterCookieResources,
  type AppTextureSamplerResourceCache,
  type AppTextureSamplerResourceReuseReport,
  type RenderSnapshot,
} from "@aperture-engine/webgpu";

describe("clustered local-light cookie resources", () => {
  it("prepares the first spot cookie with a renderer-owned projection matrix", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("spot-cookie");
    const sampler = createSamplerHandle("spot-cookie-linear");
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const createdBuffers: unknown[] = [];
    const textureWrites: unknown[] = [];
    const bufferWrites: unknown[] = [];
    const reuse = createReuseReport();

    registry.register(texture);
    registry.register(sampler);
    registry.markReady(
      texture,
      createTextureAsset({
        label: "SpotCookie",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 255, 255, 255, 32, 32, 32, 255, 32, 32, 32, 255, 255, 255, 255,
            255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    registry.markReady(
      sampler,
      createSamplerAsset({
        label: "SpotCookieLinear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      }),
    );

    const result = prepareLocalLightClusterCookieResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: (descriptor: unknown) => {
          createdTextures.push(descriptor);
          return {
            createView: (viewDescriptor: unknown) => {
              createdViews.push(viewDescriptor);
              return { label: "spot-cookie-view" };
            },
          };
        },
        createSampler: (descriptor: unknown) => {
          createdSamplers.push(descriptor);
          return { label: "spot-cookie-sampler" };
        },
        createBuffer: (descriptor: unknown) => {
          createdBuffers.push(descriptor);
          return { label: "spot-cookie-matrix-buffer" };
        },
        queue: {
          writeTexture: (
            destination: unknown,
            data: Uint8Array,
            layout: unknown,
            size: unknown,
          ) => {
            textureWrites.push({ destination, data, layout, size });
          },
          writeBuffer: (
            buffer: unknown,
            bufferOffset: number,
            data: unknown,
            dataOffset?: number,
            size?: number,
          ) => {
            bufferWrites.push({ buffer, bufferOffset, data, dataOffset, size });
          },
        },
      },
      reuse,
      snapshot: snapshotWithSpotCookie(texture, sampler),
      shadowReceiverResources: spotShadowReceiverResources(100, 4),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      matrixResource: {
        resourceKey: "local-light-cookie-matrix:v1:spot:100",
        matrixCount: 1,
        entryLightIds: [100],
      },
      textureKey: "texture:spot-cookie@1",
      samplerKey: "sampler:spot-cookie-linear@1",
      textureViewDimension: "2d",
      supportedResources: [
        {
          lightId: 100,
          textureKey: "texture:spot-cookie@1",
          samplerKey: "sampler:spot-cookie-linear@1",
          textureViewDimension: "2d",
          matrixBaseIndex: 0,
        },
      ],
    });
    expect(createdBuffers).toMatchObject([
      {
        label: "local-light-cookie-matrix:v1:spot:100",
        size: 64,
      },
    ]);
    expect(createdTextures).toMatchObject([
      {
        label: "SpotCookie",
        size: [2, 2, 1],
        format: "rgba8unorm",
        usage: 6,
      },
    ]);
    expect(createdViews).toEqual([undefined]);
    expect(createdSamplers).toMatchObject([
      {
        label: "SpotCookieLinear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      },
    ]);
    expect(textureWrites).toHaveLength(1);
    expect(bufferWrites).toHaveLength(1);
    expect(reuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
  });

  it("prepares the first point cookie with a renderer-owned cube texture view", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("point-cookie");
    const sampler = createSamplerHandle("point-cookie-nearest");
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const reuse = createReuseReport();

    registry.register(texture);
    registry.register(sampler);
    registry.markReady(
      texture,
      createTextureAsset({
        label: "PointCookieCube",
        dimension: "cube",
        width: 2,
        height: 2,
        depthOrLayers: 6,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
      }),
    );
    registry.markReady(
      sampler,
      createSamplerAsset({
        label: "PointCookieNearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        addressModeW: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
      }),
    );

    const result = prepareLocalLightClusterCookieResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: (descriptor: unknown) => {
          createdTextures.push(descriptor);
          return {
            createView: (viewDescriptor: unknown) => {
              createdViews.push(viewDescriptor);
              return { label: "point-cookie-cube-view" };
            },
          };
        },
        createSampler: (descriptor: unknown) => {
          createdSamplers.push(descriptor);
          return { label: "point-cookie-sampler" };
        },
        createBuffer: () => ({ label: "point-cookie-matrix-buffer" }),
        queue: {
          writeTexture: () => undefined,
          writeBuffer: () => undefined,
        },
      },
      reuse,
      snapshot: snapshotWithPointCookie(texture, sampler),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      matrixResource: {
        resourceKey: "local-light-cookie-matrix:v1:point:100",
        matrixCount: 1,
        entryLightIds: [100],
      },
      textureKey: "texture:point-cookie@1:cube",
      samplerKey: "sampler:point-cookie-nearest@1",
      textureViewDimension: "cube",
      supportedResources: [
        {
          lightId: 100,
          textureKey: "texture:point-cookie@1:cube",
          samplerKey: "sampler:point-cookie-nearest@1",
          textureViewDimension: "cube",
          matrixBaseIndex: 0,
        },
      ],
    });
    expect(createdTextures).toMatchObject([
      {
        label: "PointCookieCube",
        size: [2, 2, 6],
        format: "rgba8unorm",
        usage: 6,
      },
    ]);
    expect(createdViews).toEqual([{ dimension: "cube" }]);
    expect(createdSamplers).toMatchObject([
      {
        label: "PointCookieNearest",
        addressModeW: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
      },
    ]);
    expect(reuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
  });

  it("packs multiple compatible spot cookies into a renderer-owned texture array", () => {
    const registry = new AssetRegistry();
    const firstTexture = createTextureHandle("spot-cookie-a");
    const secondTexture = createTextureHandle("spot-cookie-b");
    const sampler = createSamplerHandle("spot-cookie-linear");
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const createdBuffers: unknown[] = [];
    const textureWrites: Array<{
      readonly destination: unknown;
      readonly data: Uint8Array;
      readonly layout: unknown;
      readonly size: unknown;
    }> = [];
    const bufferWrites: unknown[] = [];
    const reuse = createReuseReport();

    registry.register(firstTexture);
    registry.register(secondTexture);
    registry.register(sampler);
    registry.markReady(
      firstTexture,
      createTestCookieTextureAsset(
        "SpotCookieA",
        [
          255, 255, 255, 255, 16, 16, 16, 255, 16, 16, 16, 255, 255, 255, 255,
          255,
        ],
      ),
    );
    registry.markReady(
      secondTexture,
      createTestCookieTextureAsset(
        "SpotCookieB",
        [
          32, 32, 32, 255, 255, 255, 255, 255, 255, 255, 255, 255, 32, 32, 32,
          255,
        ],
      ),
    );
    registry.markReady(
      sampler,
      createSamplerAsset({
        label: "SpotCookieLinear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      }),
    );

    const result = prepareLocalLightClusterCookieResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: (descriptor: unknown) => {
          createdTextures.push(descriptor);
          return {
            createView: (viewDescriptor: unknown) => {
              createdViews.push(viewDescriptor);
              return { label: "spot-cookie-array-view" };
            },
          };
        },
        createSampler: (descriptor: unknown) => {
          createdSamplers.push(descriptor);
          return { label: "spot-cookie-sampler" };
        },
        createBuffer: (descriptor: unknown) => {
          createdBuffers.push(descriptor);
          return { label: "spot-cookie-matrix-array-buffer" };
        },
        queue: {
          writeTexture: (
            destination: unknown,
            data: Uint8Array,
            layout: unknown,
            size: unknown,
          ) => {
            textureWrites.push({ destination, data, layout, size });
          },
          writeBuffer: (
            buffer: unknown,
            bufferOffset: number,
            data: unknown,
            dataOffset?: number,
            size?: number,
          ) => {
            bufferWrites.push({ buffer, bufferOffset, data, dataOffset, size });
          },
        },
      },
      reuse,
      snapshot: snapshotWithTwoSpotCookies(
        firstTexture,
        secondTexture,
        sampler,
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      matrixResource: {
        resourceKey:
          "local-light-cookie-matrix-array:v1:spot:100@0+1,spot:101@1+1",
        matrixCount: 2,
        entryLightIds: [100, 101],
      },
      textureViewDimension: "2d-array",
      samplerKey: "sampler:spot-cookie-linear@1",
      supportedResources: [
        {
          lightId: 100,
          samplerKey: "sampler:spot-cookie-linear@1",
          textureViewDimension: "2d-array",
          matrixBaseIndex: 0,
        },
        {
          lightId: 101,
          samplerKey: "sampler:spot-cookie-linear@1",
          textureViewDimension: "2d-array",
          matrixBaseIndex: 1,
        },
      ],
    });
    expect(result.resources?.textureKey).toContain(
      "local-light-cookie-array:v1:",
    );
    expect(createdBuffers).toMatchObject([
      {
        label: "local-light-cookie-matrix-array:v1:spot:100@0+1,spot:101@1+1",
        size: 128,
      },
    ]);
    expect(createdTextures).toMatchObject([
      {
        size: [2, 2, 2],
        format: "rgba8unorm",
        usage: 6,
      },
    ]);
    expect(createdViews).toEqual([{ dimension: "2d-array" }]);
    expect(createdSamplers).toMatchObject([
      {
        label: "SpotCookieLinear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      },
    ]);
    expect(textureWrites).toHaveLength(1);
    expect(textureWrites[0]).toMatchObject({
      layout: { bytesPerRow: 8, rowsPerImage: 2 },
      size: [2, 2, 2],
    });
    expect(Array.from(textureWrites[0]?.data ?? [])).toEqual([
      255, 255, 255, 255, 16, 16, 16, 255, 16, 16, 16, 255, 255, 255, 255, 255,
      32, 32, 32, 255, 255, 255, 255, 255, 255, 255, 255, 255, 32, 32, 32, 255,
    ]);
    expect(bufferWrites).toHaveLength(1);
    expect(reuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
  });

  it("packs nonuniform spot cookies into a renderer-owned texture atlas", () => {
    const registry = new AssetRegistry();
    const firstTexture = createTextureHandle("spot-cookie-small");
    const secondTexture = createTextureHandle("spot-cookie-wide");
    const sampler = createSamplerHandle("spot-cookie-linear");
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const createdBuffers: unknown[] = [];
    const bufferWrites: Array<{
      readonly data: ArrayBufferLike | ArrayBufferView;
      readonly dataOffset?: number;
      readonly size?: number;
    }> = [];
    const textureWrites: Array<{
      readonly destination: unknown;
      readonly data: Uint8Array;
      readonly layout: unknown;
      readonly size: unknown;
    }> = [];
    const reuse = createReuseReport();

    registry.register(firstTexture);
    registry.register(secondTexture);
    registry.register(sampler);
    registry.markReady(
      firstTexture,
      createTestCookieTextureAsset(
        "SpotCookieSmall",
        [
          255, 255, 255, 255, 24, 24, 24, 255, 24, 24, 24, 255, 255, 255, 255,
          255,
        ],
      ),
    );
    registry.markReady(
      secondTexture,
      createWideTestCookieTextureAsset("SpotCookieWide"),
    );
    registry.markReady(sampler, createLinearCookieSamplerAsset());

    const result = prepareLocalLightClusterCookieResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: (descriptor: unknown) => {
          createdTextures.push(descriptor);
          return {
            createView: (viewDescriptor: unknown) => {
              createdViews.push(viewDescriptor);
              return { label: "spot-cookie-atlas-view" };
            },
          };
        },
        createSampler: (descriptor: unknown) => {
          createdSamplers.push(descriptor);
          return { label: "spot-cookie-atlas-sampler" };
        },
        createBuffer: (descriptor: unknown) => {
          createdBuffers.push(descriptor);
          return { label: "spot-cookie-atlas-matrix-buffer" };
        },
        queue: {
          writeTexture: (
            destination: unknown,
            data: Uint8Array,
            layout: unknown,
            size: unknown,
          ) => {
            textureWrites.push({ destination, data, layout, size });
          },
          writeBuffer: (
            _buffer: unknown,
            _bufferOffset: number,
            data: ArrayBufferLike | ArrayBufferView,
            dataOffset?: number,
            size?: number,
          ) => {
            bufferWrites.push({
              data,
              ...(dataOffset === undefined ? {} : { dataOffset }),
              ...(size === undefined ? {} : { size }),
            });
          },
        },
      },
      reuse,
      snapshot: snapshotWithTwoSpotCookies(
        firstTexture,
        secondTexture,
        sampler,
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      matrixResource: {
        resourceKey:
          "local-light-cookie-matrix-atlas:v1:spot:100@0:0,0+2x2,spot:101@1:2,0+4x2",
        matrixCount: 2,
        entryLightIds: [100, 101],
      },
      textureViewDimension: "2d",
      samplerKey: "sampler:spot-cookie-linear@1",
      supportedResources: [
        {
          lightId: 100,
          samplerKey: "sampler:spot-cookie-linear@1",
          textureViewDimension: "2d",
          matrixBaseIndex: 0,
        },
        {
          lightId: 101,
          samplerKey: "sampler:spot-cookie-linear@1",
          textureViewDimension: "2d",
          matrixBaseIndex: 1,
        },
      ],
    });
    expect(result.resources?.textureKey).toContain(
      "local-light-cookie-atlas:v1:6x2:",
    );
    expect(createdTextures).toMatchObject([
      {
        size: [6, 2, 1],
        format: "rgba8unorm",
        usage: 6,
      },
    ]);
    expect(createdViews).toEqual([undefined]);
    expect(createdSamplers).toHaveLength(1);
    expect(createdBuffers).toMatchObject([
      {
        label:
          "local-light-cookie-matrix-atlas:v1:spot:100@0:0,0+2x2,spot:101@1:2,0+4x2",
        size: 128,
      },
    ]);
    expect(textureWrites).toHaveLength(2);
    expect(textureWrites[0]).toMatchObject({
      destination: { origin: { x: 0, y: 0, z: 0 } },
      layout: { bytesPerRow: 8, rowsPerImage: 2 },
      size: [2, 2, 1],
    });
    expect(textureWrites[1]).toMatchObject({
      destination: { origin: { x: 2, y: 0, z: 0 } },
      layout: { bytesPerRow: 16, rowsPerImage: 2 },
      size: [4, 2, 1],
    });
    const matrixUpload = bufferWrites[0];
    const matrixData =
      matrixUpload === undefined
        ? null
        : new Float32Array(
            ArrayBuffer.isView(matrixUpload.data)
              ? matrixUpload.data.buffer
              : matrixUpload.data,
            matrixUpload.dataOffset ?? 0,
            (matrixUpload.size ?? 128) / Float32Array.BYTES_PER_ELEMENT,
          );

    expect(matrixData).toBeInstanceOf(Float32Array);
    expect(matrixData?.[0]).not.toBe(matrixData?.[16]);
    expect(reuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
  });

  it("packs compatible spot and point cookies into one renderer-owned texture array", () => {
    const registry = new AssetRegistry();
    const spotTexture = createTextureHandle("mixed-spot-cookie");
    const pointTexture = createTextureHandle("mixed-point-cookie");
    const spotSampler = createSamplerHandle("mixed-spot-sampler");
    const pointSampler = createSamplerHandle("mixed-point-sampler");
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const createdBuffers: unknown[] = [];
    const textureWrites: Array<{
      readonly data: Uint8Array;
      readonly layout: unknown;
      readonly size: unknown;
    }> = [];
    const reuse = createReuseReport();

    registry.register(spotTexture);
    registry.register(pointTexture);
    registry.register(spotSampler);
    registry.register(pointSampler);
    registry.markReady(
      spotTexture,
      createTestCookieTextureAsset(
        "MixedSpotCookie",
        [
          250, 250, 250, 255, 10, 10, 10, 255, 10, 10, 10, 255, 250, 250, 250,
          255,
        ],
      ),
    );
    registry.markReady(pointTexture, createTestCookieCubeTextureAsset());
    registry.markReady(spotSampler, createLinearCookieSamplerAsset());
    registry.markReady(pointSampler, createLinearCookieSamplerAsset());

    const result = prepareLocalLightClusterCookieResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: (descriptor: unknown) => {
          createdTextures.push(descriptor);
          return {
            createView: (viewDescriptor: unknown) => {
              createdViews.push(viewDescriptor);
              return { label: "mixed-cookie-array-view" };
            },
          };
        },
        createSampler: (descriptor: unknown) => {
          createdSamplers.push(descriptor);
          return { label: "mixed-cookie-sampler" };
        },
        createBuffer: (descriptor: unknown) => {
          createdBuffers.push(descriptor);
          return { label: "mixed-cookie-matrix-array-buffer" };
        },
        queue: {
          writeTexture: (
            _destination: unknown,
            data: Uint8Array,
            layout: unknown,
            size: unknown,
          ) => {
            textureWrites.push({ data, layout, size });
          },
          writeBuffer: () => undefined,
        },
      },
      reuse,
      snapshot: snapshotWithMixedCookies(
        spotTexture,
        pointTexture,
        spotSampler,
        pointSampler,
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      matrixResource: {
        resourceKey:
          "local-light-cookie-matrix-array:v1:spot:100@0+1,point:101@1+6",
        matrixCount: 7,
        entryLightIds: [100, 101],
      },
      textureViewDimension: "2d-array",
      samplerKey: "sampler:mixed-spot-sampler@1",
      supportedResources: [
        {
          lightId: 100,
          samplerKey: "sampler:mixed-spot-sampler@1",
          textureViewDimension: "2d-array",
          matrixBaseIndex: 0,
        },
        {
          lightId: 101,
          samplerKey: "sampler:mixed-spot-sampler@1",
          textureViewDimension: "2d-array",
          matrixBaseIndex: 1,
        },
      ],
    });
    expect(createdBuffers).toMatchObject([
      {
        label: "local-light-cookie-matrix-array:v1:spot:100@0+1,point:101@1+6",
        size: 448,
      },
    ]);
    expect(createdTextures).toMatchObject([
      {
        size: [2, 2, 7],
        format: "rgba8unorm",
        usage: 6,
      },
    ]);
    expect(createdViews).toEqual([{ dimension: "2d-array" }]);
    expect(createdSamplers).toHaveLength(1);
    expect(textureWrites).toHaveLength(1);
    expect(textureWrites[0]).toMatchObject({
      layout: { bytesPerRow: 8, rowsPerImage: 2 },
      size: [2, 2, 7],
    });
    expect(textureWrites[0]?.data.byteLength).toBe(112);
    expect(Array.from(textureWrites[0]?.data.subarray(0, 16) ?? [])).toEqual([
      250, 250, 250, 255, 10, 10, 10, 255, 10, 10, 10, 255, 250, 250, 250, 255,
    ]);
    expect(reuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
  });

  it("prepares cookie-only resources without a shadow receiver", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("spot-cookie");
    const reuse = createReuseReport();

    registry.register(texture);
    registry.markReady(
      texture,
      createTextureAsset({
        label: "SpotCookie",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
      }),
    );

    const result = prepareLocalLightClusterCookieResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: () => ({ createView: () => ({}) }),
        createSampler: () => ({}),
        createBuffer: () => ({}),
        queue: {
          writeTexture: () => undefined,
          writeBuffer: () => undefined,
        },
      },
      reuse,
      snapshot: snapshotWithSpotCookie(texture, null),
    });

    expect(result).toMatchObject({
      valid: true,
      resources: {
        matrixResource: {
          resourceKey: "local-light-cookie-matrix:v1:spot:100",
          matrixCount: 1,
        },
        supportedResources: [
          {
            lightId: 100,
            textureViewDimension: "2d",
            matrixBaseIndex: 0,
          },
        ],
      },
      diagnostics: [],
    });
    expect(reuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
  });

  it("prepares a spot cookie when the authored up axis is parallel to the light direction", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("parallel-up-cookie");
    const reuse = createReuseReport();

    registry.register(texture);
    registry.markReady(
      texture,
      createTextureAsset({
        label: "ParallelUpCookie",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
      }),
    );

    const result = prepareLocalLightClusterCookieResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: () => ({ createView: () => ({}) }),
        createSampler: () => ({}),
        createBuffer: () => ({}),
        queue: {
          writeTexture: () => undefined,
          writeBuffer: () => undefined,
        },
      },
      reuse,
      snapshot: snapshotWithSpotCookie(texture, null, parallelUpTransform()),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources?.matrixResource).toMatchObject({
      resourceKey: "local-light-cookie-matrix:v1:spot:100",
      matrixCount: 1,
    });
  });
});

function snapshotWithPointCookie(
  texture: ReturnType<typeof createTextureHandle>,
  sampler: ReturnType<typeof createSamplerHandle> | null,
): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [
      {
        lightId: 100,
        entity: { index: 1, generation: 0 },
        kind: "point",
        color: [1, 1, 1, 1],
        intensity: 10,
        range: 4,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 0,
        layerMask: 1,
        cookieTexture: texture,
        cookieSampler: sampler,
        cookieIntensity: 1,
      },
    ],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: identityTransform(),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 1,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function snapshotWithSpotCookie(
  texture: ReturnType<typeof createTextureHandle>,
  sampler: ReturnType<typeof createSamplerHandle> | null,
  transform: Float32Array = identityTransform(),
): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [
      {
        lightId: 100,
        entity: { index: 1, generation: 0 },
        kind: "spot",
        color: [1, 1, 1, 1],
        intensity: 10,
        range: 4,
        innerConeAngle: 0.2,
        outerConeAngle: 0.7,
        worldTransformOffset: 0,
        layerMask: 1,
        cookieTexture: texture,
        cookieSampler: sampler,
        cookieIntensity: 1,
      },
    ],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: transform,
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 1,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function snapshotWithTwoSpotCookies(
  firstTexture: ReturnType<typeof createTextureHandle>,
  secondTexture: ReturnType<typeof createTextureHandle>,
  sampler: ReturnType<typeof createSamplerHandle>,
): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [
      spotCookieLight(100, 0, firstTexture, sampler),
      spotCookieLight(101, 16, secondTexture, sampler),
    ],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: twoIdentityTransforms(),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 2,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function snapshotWithMixedCookies(
  spotTexture: ReturnType<typeof createTextureHandle>,
  pointTexture: ReturnType<typeof createTextureHandle>,
  spotSampler: ReturnType<typeof createSamplerHandle>,
  pointSampler: ReturnType<typeof createSamplerHandle>,
): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [
      spotCookieLight(100, 0, spotTexture, spotSampler),
      {
        lightId: 101,
        entity: { index: 101, generation: 0 },
        kind: "point",
        color: [1, 1, 1, 1],
        intensity: 10,
        range: 4,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 16,
        layerMask: 1,
        cookieTexture: pointTexture,
        cookieSampler: pointSampler,
        cookieIntensity: 1,
      },
    ],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: twoIdentityTransforms(),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 2,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function spotCookieLight(
  lightId: number,
  worldTransformOffset: number,
  texture: ReturnType<typeof createTextureHandle>,
  sampler: ReturnType<typeof createSamplerHandle>,
): RenderSnapshot["lights"][number] {
  return {
    lightId,
    entity: { index: lightId, generation: 0 },
    kind: "spot",
    color: [1, 1, 1, 1],
    intensity: 10,
    range: 4,
    innerConeAngle: 0.2,
    outerConeAngle: 0.7,
    worldTransformOffset,
    layerMask: 1,
    cookieTexture: texture,
    cookieSampler: sampler,
    cookieIntensity: 1,
  };
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function twoIdentityTransforms(): Float32Array {
  const transforms = new Float32Array(32);
  transforms.set(identityTransform(), 0);
  transforms.set(identityTransform(), 16);
  return transforms;
}

function parallelUpTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function createTestCookieTextureAsset(label: string, bytes: readonly number[]) {
  return createTextureAsset({
    label,
    dimension: "2d",
    width: 2,
    height: 2,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes: new Uint8Array(bytes),
      bytesPerRow: 8,
      rowsPerImage: 2,
    },
  });
}

function createWideTestCookieTextureAsset(label: string) {
  const width = 4;
  const height = 2;
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const bright = x === 1 || x === 2;
      const value = bright ? 255 : 32;

      bytes[index] = value;
      bytes[index + 1] = value;
      bytes[index + 2] = value;
      bytes[index + 3] = 255;
    }
  }

  return createTextureAsset({
    label,
    dimension: "2d",
    width,
    height,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes,
      bytesPerRow: width * 4,
      rowsPerImage: height,
    },
  });
}

function createTestCookieCubeTextureAsset() {
  const layerBytes = 16;
  const bytes = new Uint8Array(layerBytes * 6);

  for (let layer = 0; layer < 6; layer += 1) {
    bytes.fill(layer * 32, layer * layerBytes, (layer + 1) * layerBytes);
    for (
      let alpha = layer * layerBytes + 3;
      alpha < (layer + 1) * layerBytes;
      alpha += 4
    ) {
      bytes[alpha] = 255;
    }
  }

  return createTextureAsset({
    label: "MixedPointCookieCube",
    dimension: "cube",
    width: 2,
    height: 2,
    depthOrLayers: 6,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes,
      bytesPerRow: 8,
      rowsPerImage: 2,
    },
  });
}

function createLinearCookieSamplerAsset() {
  return createSamplerAsset({
    label: "MixedCookieLinear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  });
}

function spotShadowReceiverResources(lightId: number, matrixBaseIndex: number) {
  return {
    shadowKind: "spot",
    matrixBufferResource: { resource: { label: "spot-matrices" } },
    samplerResource: { resource: { label: "spot-shadow-sampler" } },
    depthTextureResources: {
      resources: Array.from({ length: matrixBaseIndex + 1 }, (_, index) => ({
        lightId: index === matrixBaseIndex ? lightId : 1_000 + index,
        viewDimension: "2d",
        allocation: { resource: { label: `spot-depth-${index}` } },
      })),
    },
  } as never;
}

function createCache(): AppTextureSamplerResourceCache {
  return {
    textures: new Map(),
    samplers: new Map(),
  };
}

function createReuseReport(): AppTextureSamplerResourceReuseReport {
  return {
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
  };
}
