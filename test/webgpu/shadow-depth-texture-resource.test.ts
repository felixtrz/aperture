import { describe, expect, it } from "vitest";

import {
  createShadowDepthTextureResourceReport,
  createShadowMapDescriptorReport,
  createShadowTextureResourceReport,
  resolveShadowDepthTextureAttachmentView,
  shadowDepthTextureResourceReportToJson,
  shadowDepthTextureResourceReportToJsonValue,
  type ShadowDepthTextureResourceCache,
  type ShadowRequestPacket,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("shadow depth texture resource", () => {
  it("creates renderer-owned depth texture resources from planned shadow texture descriptors", () => {
    const created: unknown[] = [];
    const report = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(created),
      textures: textures(),
    });
    const json = shadowDepthTextureResourceReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "available",
      textureDescriptorCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        textureDescriptors: true,
        depthTextureResource: true,
        gpuAllocation: true,
        matrixUpload: false,
        passSubmission: false,
        shaderSampling: false,
      },
      resources: [
        {
          valid: true,
          shadowId: 7,
          lightId: 11,
          resourceKey: "shadow-map:7:light:11",
          textureKey: "shadow-map:7:light:11:texture",
          viewKey: "shadow-map:7:light:11:view",
          layerCount: 1,
          filterRadiusTexels: 1,
          faceCount: 1,
          viewDimension: "2d",
          attachmentViewKeys: ["shadow-map:7:light:11:view"],
          descriptor: {
            label: "shadow-map:7:light:11:depth",
            size: [1024, 1024, 1],
            format: "depth24plus",
            usage: 20,
            mipLevelCount: 1,
          },
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(shadowDepthTextureResourceReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(/GPUTexture|GPUTextureView|raw/);
    expect(created).toEqual([
      {
        label: "shadow-map:7:light:11:depth",
        size: [1024, 1024, 1],
        format: "depth24plus",
        usage: 20,
        mipLevelCount: 1,
      },
    ]);
  });

  it("reports unavailable devices and missing texture descriptors", () => {
    const unavailable = shadowDepthTextureResourceReportToJsonValue(
      createShadowDepthTextureResourceReport({
        device: {},
        textures: textures(),
      }),
    );
    const missing = shadowDepthTextureResourceReportToJsonValue(
      createShadowDepthTextureResourceReport({
        device: deviceWithTextures([]),
        textures: createShadowTextureResourceReport({
          descriptors: createShadowMapDescriptorReport({
            shadowRequests: [shadowRequest(7, 11)],
            descriptors: [],
          }),
        }),
      }),
    );

    expect(unavailable).toMatchObject({
      ready: false,
      status: "missing",
      createdTextureCount: 0,
      diagnostics: [
        {
          code: "textureResource.createTextureUnavailable",
          severity: "warning",
          resourceKey: "shadow-map:7:light:11:texture",
        },
      ],
    });
    expect(missing).toMatchObject({
      ready: false,
      status: "missing",
      textureDescriptorCount: 0,
      diagnostics: [
        {
          code: "shadowDepthTextureResource.missingTextureDescriptors",
          severity: "warning",
        },
      ],
    });
  });

  it("creates array texture views and per-cascade attachment views for CSM", () => {
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const request = { ...shadowRequest(7, 11), cascadeCount: 3 };
    const report = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures, createdViews),
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [request],
          descriptors: [
            {
              shadowId: 7,
              lightId: 11,
              mapSize: 1024,
              depthBias: 0.001,
            },
          ],
        }),
      }),
    });
    const json = shadowDepthTextureResourceReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      resources: [
        {
          layerCount: 3,
          viewDimension: "2d-array",
          attachmentViewKeys: [
            "shadow-map:7:light:11:cascade-0:view",
            "shadow-map:7:light:11:cascade-1:view",
            "shadow-map:7:light:11:cascade-2:view",
          ],
          descriptor: { size: [1024, 1024, 3] },
        },
      ],
    });
    expect(createdViews[0]).toEqual({
      dimension: "2d-array",
      arrayLayerCount: 3,
    });
    expect(createdViews.slice(1)).toEqual([
      {
        dimension: "2d",
        baseArrayLayer: 0,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
      {
        dimension: "2d",
        baseArrayLayer: 1,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
      {
        dimension: "2d",
        baseArrayLayer: 2,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
    ]);
    expect(
      resolveShadowDepthTextureAttachmentView(report, {
        shadowId: 7,
        lightId: 11,
        viewKey: "shadow-map:7:light:11:cascade-1:view",
      }),
    ).toEqual({
      descriptor: {
        dimension: "2d",
        baseArrayLayer: 1,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
    });
  });

  it("shares one 2d-array depth allocation across compatible local spot shadows", () => {
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const report = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures, createdViews),
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [
            { ...shadowRequest(13, 21), lightKind: "spot" },
            { ...shadowRequest(14, 22), lightKind: "spot" },
          ],
          descriptors: [
            {
              shadowId: 13,
              lightId: 21,
              mapSize: 512,
              depthBias: 0.002,
              resourceKey: "shadow-map:clustered-spot-array",
              viewDimension: "2d-array",
              layerCount: 2,
              layerBaseIndex: 0,
            },
            {
              shadowId: 14,
              lightId: 22,
              mapSize: 512,
              depthBias: 0.002,
              resourceKey: "shadow-map:clustered-spot-array",
              viewDimension: "2d-array",
              layerCount: 2,
              layerBaseIndex: 1,
            },
          ],
        }),
      }),
    });

    expect(report.ready).toBe(true);
    expect(report.createdTextureCount).toBe(1);
    expect(report.resources).toMatchObject([
      {
        shadowId: 13,
        lightId: 21,
        textureKey: "shadow-map:clustered-spot-array:texture",
        viewDimension: "2d-array",
        layerCount: 2,
        layerBaseIndex: 0,
        attachmentViews: [
          { viewKey: "shadow-map:clustered-spot-array:layer-0:view" },
        ],
      },
      {
        shadowId: 14,
        lightId: 22,
        textureKey: "shadow-map:clustered-spot-array:texture",
        viewDimension: "2d-array",
        layerCount: 2,
        layerBaseIndex: 1,
        attachmentViews: [
          { viewKey: "shadow-map:clustered-spot-array:layer-1:view" },
        ],
      },
    ]);
    expect(createdTextures).toEqual([
      {
        label: "shadow-map:clustered-spot-array:depth",
        size: [512, 512, 2],
        format: "depth24plus",
        usage: 20,
        mipLevelCount: 1,
      },
    ]);
    expect(createdViews).toEqual([
      {
        dimension: "2d-array",
        arrayLayerCount: 2,
      },
      {
        dimension: "2d",
        baseArrayLayer: 0,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
      {
        dimension: "2d",
        baseArrayLayer: 1,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
    ]);
    expect(
      resolveShadowDepthTextureAttachmentView(report, {
        shadowId: 14,
        lightId: 22,
        viewKey: "shadow-map:clustered-spot-array:layer-1:view",
      }),
    ).toEqual({
      descriptor: {
        dimension: "2d",
        baseArrayLayer: 1,
        arrayLayerCount: 1,
        mipLevelCount: 1,
      },
    });
  });

  it("shares one 2d atlas depth allocation across nonuniform local spot shadows", () => {
    const createdTextures: unknown[] = [];
    const createdViews: unknown[] = [];
    const report = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures, createdViews),
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [
            { ...shadowRequest(13, 21), lightKind: "spot" },
            { ...shadowRequest(14, 22), lightKind: "spot" },
          ],
          descriptors: [
            {
              shadowId: 13,
              lightId: 21,
              mapSize: 256,
              textureWidth: 384,
              textureHeight: 256,
              depthBias: 0.002,
              resourceKey: "shadow-map:clustered-spot-atlas",
              viewDimension: "2d",
              atlasRegion: {
                originX: 0,
                originY: 0,
                width: 256,
                height: 256,
              },
            },
            {
              shadowId: 14,
              lightId: 22,
              mapSize: 128,
              textureWidth: 384,
              textureHeight: 256,
              depthBias: 0.002,
              resourceKey: "shadow-map:clustered-spot-atlas",
              viewDimension: "2d",
              atlasRegion: {
                originX: 256,
                originY: 0,
                width: 128,
                height: 128,
              },
            },
          ],
        }),
      }),
    });

    expect(report.ready).toBe(true);
    expect(report.createdTextureCount).toBe(1);
    expect(report.resources).toMatchObject([
      {
        shadowId: 13,
        lightId: 21,
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewDimension: "2d",
        layerCount: 1,
        layerBaseIndex: 0,
        atlasRegion: { originX: 0, originY: 0, width: 256, height: 256 },
        attachmentViews: [{ viewKey: "shadow-map:clustered-spot-atlas:view" }],
      },
      {
        shadowId: 14,
        lightId: 22,
        textureKey: "shadow-map:clustered-spot-atlas:texture",
        viewDimension: "2d",
        layerCount: 1,
        layerBaseIndex: 0,
        atlasRegion: { originX: 256, originY: 0, width: 128, height: 128 },
        attachmentViews: [{ viewKey: "shadow-map:clustered-spot-atlas:view" }],
      },
    ]);
    expect(createdTextures).toEqual([
      {
        label: "shadow-map:clustered-spot-atlas:depth",
        size: [384, 256, 1],
        format: "depth24plus",
        usage: 20,
        mipLevelCount: 1,
      },
    ]);
    expect(createdViews).toEqual([undefined]);
    expect(
      resolveShadowDepthTextureAttachmentView(report, {
        shadowId: 14,
        lightId: 22,
        viewKey: "shadow-map:clustered-spot-atlas:view",
      }),
    ).toEqual({ descriptor: undefined });
  });

  it("reuses cached renderer-owned shadow depth allocations across matching frames", () => {
    const createdTextures: unknown[] = [];
    const cache: ShadowDepthTextureResourceCache = new Map();
    const first = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures),
      textures: textures(),
      cache,
    });
    const second = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures),
      textures: textures(),
      cache,
    });

    expect(first.ready).toBe(true);
    expect(first.reusedTextureCount).toBe(0);
    expect(second.ready).toBe(true);
    expect(second.createdTextureCount).toBe(1);
    expect(second.reusedTextureCount).toBe(1);
    expect(second.resources[0]?.allocation).toBe(
      first.resources[0]?.allocation,
    );
    expect(createdTextures).toHaveLength(1);
  });

  it("reuses the same atlas allocation when only per-light atlas regions change", () => {
    const createdTextures: unknown[] = [];
    const cache: ShadowDepthTextureResourceCache = new Map();
    const first = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures),
      textures: atlasTextures([
        { shadowId: 13, lightId: 21, originX: 0, mapSize: 256 },
        { shadowId: 14, lightId: 22, originX: 256, mapSize: 128 },
      ]),
      cache,
    });
    const moved = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures),
      textures: atlasTextures([
        { shadowId: 13, lightId: 21, originX: 128, mapSize: 256 },
        { shadowId: 14, lightId: 22, originX: 0, mapSize: 128 },
      ]),
      cache,
    });

    expect(first.ready).toBe(true);
    expect(moved.ready).toBe(true);
    expect(moved.reusedTextureCount).toBe(1);
    expect(moved.resources[0]?.allocation).toBe(first.resources[0]?.allocation);
    expect(createdTextures).toHaveLength(1);
  });

  it("invalidates cached shadow depth allocations when texture dimensions change", () => {
    const createdTextures: unknown[] = [];
    const cache: ShadowDepthTextureResourceCache = new Map();
    const first = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures),
      textures: textures(512),
      cache,
    });
    const resized = createShadowDepthTextureResourceReport({
      device: deviceWithTextures(createdTextures),
      textures: textures(1024),
      cache,
    });

    expect(first.ready).toBe(true);
    expect(resized.ready).toBe(true);
    expect(resized.reusedTextureCount).toBe(0);
    expect(resized.resources[0]?.allocation).not.toBe(
      first.resources[0]?.allocation,
    );
    expect(createdTextures).toHaveLength(2);
  });
});

function textures(mapSize = 1024) {
  return createShadowTextureResourceReport({
    descriptors: createShadowMapDescriptorReport({
      shadowRequests: [shadowRequest(7, 11)],
      descriptors: [
        {
          shadowId: 7,
          lightId: 11,
          mapSize,
          depthBias: 0.001,
        },
      ],
    }),
  });
}

function atlasTextures(
  tiles: readonly {
    readonly shadowId: number;
    readonly lightId: number;
    readonly originX: number;
    readonly mapSize: number;
  }[],
) {
  return createShadowTextureResourceReport({
    descriptors: createShadowMapDescriptorReport({
      shadowRequests: tiles.map((tile) => ({
        ...shadowRequest(tile.shadowId, tile.lightId),
        lightKind: "spot",
      })),
      descriptors: tiles.map((tile) => ({
        shadowId: tile.shadowId,
        lightId: tile.lightId,
        mapSize: tile.mapSize,
        textureWidth: 384,
        textureHeight: 256,
        depthBias: 0.002,
        resourceKey: "shadow-map:clustered-spot-atlas",
        viewDimension: "2d",
        atlasRegion: {
          originX: tile.originX,
          originY: 0,
          width: tile.mapSize,
          height: tile.mapSize,
        },
      })),
    }),
  });
}

function shadowRequest(shadowId: number, lightId: number): ShadowRequestPacket {
  return {
    shadowId,
    lightId,
    casterLayerMask: 1,
    receiverLayerMask: 2,
  };
}

function deviceWithTextures(
  created: unknown[],
  createdViews: unknown[] = [],
): TextureGpuDeviceLike {
  return {
    createTexture: (descriptor) => {
      created.push(descriptor);

      return {
        createView: (viewDescriptor) => {
          createdViews.push(viewDescriptor);
          return { descriptor: viewDescriptor };
        },
      };
    },
  };
}
