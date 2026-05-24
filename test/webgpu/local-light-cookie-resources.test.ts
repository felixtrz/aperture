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

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function parallelUpTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
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
