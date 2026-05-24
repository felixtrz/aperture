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
  it("prepares the first spot cookie backed by a supported spot matrix", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("spot-cookie");
    const sampler = createSamplerHandle("spot-cookie-linear");
    const createdTextures: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const writes: unknown[] = [];
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
          return { createView: () => ({ label: "spot-cookie-view" }) };
        },
        createSampler: (descriptor: unknown) => {
          createdSamplers.push(descriptor);
          return { label: "spot-cookie-sampler" };
        },
        queue: {
          writeTexture: (
            destination: unknown,
            data: Uint8Array,
            layout: unknown,
            size: unknown,
          ) => {
            writes.push({ destination, data, layout, size });
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
      textureKey: "texture:spot-cookie@1",
      samplerKey: "sampler:spot-cookie-linear@1",
      supportedResources: [
        {
          lightId: 100,
          textureKey: "texture:spot-cookie@1",
          samplerKey: "sampler:spot-cookie-linear@1",
          matrixBaseIndex: 4,
        },
      ],
    });
    expect(createdTextures).toMatchObject([
      {
        label: "SpotCookie",
        size: [2, 2, 1],
        format: "rgba8unorm",
        usage: 6,
      },
    ]);
    expect(createdSamplers).toMatchObject([
      {
        label: "SpotCookieLinear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      },
    ]);
    expect(writes).toHaveLength(1);
    expect(reuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
  });

  it("leaves cookie metadata unsupported until a spot matrix resource is available", () => {
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
        queue: { writeTexture: () => undefined },
      },
      reuse,
      snapshot: snapshotWithSpotCookie(texture, null),
    });

    expect(result).toEqual({
      valid: true,
      resources: null,
      diagnostics: [],
    });
    expect(reuse).toMatchObject({
      textureResourcesCreated: 0,
      samplerResourcesCreated: 0,
    });
  });
});

function snapshotWithSpotCookie(
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
    transforms: new Float32Array(16),
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
