import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createMaterialHandle,
  createMatcapMaterialAsset,
  createMatcapMaterialBindGroupLayoutPlan,
  createPreparedMatcapMaterialCache,
  createPreparedMatcapTextureDependencyKeys,
  createSamplerAsset,
  createSamplerHandle,
  createTextureAsset,
  createTextureHandle,
  prepareMatcapMaterialResource,
  type MatcapFrameGpuResourceDeviceLike,
  type MatcapMaterialBindGroupCreationDescriptor,
  type MatcapMaterialBindGroupLayoutResource,
  type SamplerGpuResource,
  type TextureGpuResource,
} from "@aperture-engine/webgpu";

describe("Matcap prepared texture dependency keys", () => {
  it("derives ready matcap texture and sampler handle/version keys", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("studio");
    const sampler = createSamplerHandle("linear");

    registry.register(texture);
    registry.register(sampler);
    const textureEntry = registry.markReady(texture, textureAsset());
    const samplerEntry = registry.markReady(
      sampler,
      createSamplerAsset({ label: "linear" }),
    );

    const result = createPreparedMatcapTextureDependencyKeys({
      registry,
      material: createMatcapMaterialAsset({
        matcapTexture: { texture, sampler },
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual({
      texture: {
        kind: "texture",
        handleKey: "texture:studio",
        version: textureEntry.version,
        versionKey: "texture:studio@1",
      },
      sampler: {
        kind: "sampler",
        handleKey: "sampler:linear",
        version: samplerEntry.version,
        versionKey: "sampler:linear@1",
      },
      cacheKeySegments: [
        "matcapTexture:texture:texture:studio@1",
        "matcapTexture:sampler:sampler:linear@1",
      ],
    });
  });

  it("reports missing source assets without GPU handles", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("missing-studio");
    const sampler = createSamplerHandle("registered-linear");

    registry.register(sampler);

    const result = createPreparedMatcapTextureDependencyKeys({
      registry,
      material: createMatcapMaterialAsset({
        matcapTexture: { texture, sampler },
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.dependencies).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "preparedMatcapTextureDependency.textureSourceNotReady",
        resourceKey: "texture:missing-studio",
        status: "missing",
        message:
          "Texture source asset 'texture:missing-studio' is not ready for prepared Matcap material resources.",
      },
      {
        code: "preparedMatcapTextureDependency.samplerSourceNotReady",
        resourceKey: "sampler:registered-linear",
        status: "registered",
        message:
          "Sampler source asset 'sampler:registered-linear' is not ready for prepared Matcap material resources.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("createTexture");
    expect(JSON.stringify(result)).not.toContain("createSampler");
  });
});

describe("Matcap prepared material cache", () => {
  it("creates, reuses, and invalidates group-2 prepared resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: MatcapMaterialBindGroupCreationDescriptor[] = [];
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("studio-matcap");
    const texture = createTextureHandle("studio");
    const sampler = createSamplerHandle("linear");
    const cache = createPreparedMatcapMaterialCache();
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(texture);
    registry.register(sampler);
    registry.register(handle);
    registry.markReady(texture, textureAsset({ label: "first" }));
    registry.markReady(sampler, createSamplerAsset({ label: "first" }));
    const materialEntry = registry.markReady(
      handle,
      createMatcapMaterialAsset({
        label: "Studio",
        matcapTexture: { texture, sampler },
      }),
    );

    const first = prepareMatcapMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      frame: 20,
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureResource("texture:studio")],
      samplers: [samplerResource("sampler:linear")],
    });
    const second = prepareMatcapMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      frame: 21,
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureResource("texture:studio")],
      samplers: [samplerResource("sampler:linear")],
    });
    const updatedMaterialEntry = registry.markReady(
      handle,
      createMatcapMaterialAsset({
        label: "Studio Updated",
        matcapTexture: { texture, sampler },
      }),
    );
    const third = prepareMatcapMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(updatedMaterialEntry.asset),
      sourceVersion: updatedMaterialEntry.version,
      frame: 22,
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureResource("texture:studio")],
      samplers: [samplerResource("sampler:linear")],
    });

    registry.markReady(texture, textureAsset({ label: "second" }));

    const fourth = prepareMatcapMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(updatedMaterialEntry.asset),
      sourceVersion: updatedMaterialEntry.version,
      frame: 23,
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureResource("texture:studio")],
      samplers: [samplerResource("sampler:linear")],
    });

    registry.markReady(sampler, createSamplerAsset({ label: "second" }));

    const fifth = prepareMatcapMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(updatedMaterialEntry.asset),
      sourceVersion: updatedMaterialEntry.version,
      frame: 24,
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureResource("texture:studio")],
      samplers: [samplerResource("sampler:linear")],
    });

    expect(first.status).toBe("created");
    expect(first.resource?.materialResourceKey).toBe(
      "material-buffer:prepared-material:material:studio-matcap",
    );
    expect(first.resource?.textureResourceKey).toBe("texture:studio");
    expect(first.resource?.samplerResourceKey).toBe("sampler:linear");
    expect(first.resource?.dependencyCacheKeySegments).toEqual([
      "matcapTexture:texture:texture:studio@1",
      "matcapTexture:sampler:sampler:linear@1",
    ]);
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(second.resource?.lastUsedFrame).toBe(21);
    expect(third.status).toBe("created");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.sourceVersion).toBe(updatedMaterialEntry.version);
    expect(third.resource?.lastUsedFrame).toBe(22);
    expect(fourth.status).toBe("created");
    expect(fourth.resource).not.toBe(third.resource);
    expect(fourth.resource?.dependencyCacheKeySegments).toEqual([
      "matcapTexture:texture:texture:studio@2",
      "matcapTexture:sampler:sampler:linear@1",
    ]);
    expect(fourth.resource?.lastUsedFrame).toBe(23);
    expect(fifth.status).toBe("created");
    expect(fifth.resource).not.toBe(fourth.resource);
    expect(fifth.resource?.dependencyCacheKeySegments).toEqual([
      "matcapTexture:texture:texture:studio@2",
      "matcapTexture:sampler:sampler:linear@2",
    ]);
    expect(fifth.resource?.lastUsedFrame).toBe(24);
    expect(
      [...cache.resources.values()].map((resource) => ({
        sourceVersion: resource.sourceVersion,
        lastUsedFrame: resource.lastUsedFrame,
        dependencyCacheKeySegments: resource.dependencyCacheKeySegments,
      })),
    ).toEqual([
      {
        sourceVersion: materialEntry.version,
        lastUsedFrame: 21,
        dependencyCacheKeySegments: [
          "matcapTexture:texture:texture:studio@1",
          "matcapTexture:sampler:sampler:linear@1",
        ],
      },
      {
        sourceVersion: updatedMaterialEntry.version,
        lastUsedFrame: 22,
        dependencyCacheKeySegments: [
          "matcapTexture:texture:texture:studio@1",
          "matcapTexture:sampler:sampler:linear@1",
        ],
      },
      {
        sourceVersion: updatedMaterialEntry.version,
        lastUsedFrame: 23,
        dependencyCacheKeySegments: [
          "matcapTexture:texture:texture:studio@2",
          "matcapTexture:sampler:sampler:linear@1",
        ],
      },
      {
        sourceVersion: updatedMaterialEntry.version,
        lastUsedFrame: 24,
        dependencyCacheKeySegments: [
          "matcapTexture:texture:texture:studio@2",
          "matcapTexture:sampler:sampler:linear@2",
        ],
      },
    ]);
    expect(createdBuffers).toHaveLength(4);
    expect(createdBindGroups).toHaveLength(4);
    expect(createdBindGroups[0]?.entries.map((entry) => entry.binding)).toEqual(
      [0, 1, 2],
    );
  });

  it("reports missing WebGPU texture or sampler resources by logical key", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("studio-matcap");
    const texture = createTextureHandle("studio");
    const sampler = createSamplerHandle("linear");
    const createdBuffers: unknown[] = [];
    const createdBindGroups: MatcapMaterialBindGroupCreationDescriptor[] = [];

    registry.register(texture);
    registry.register(sampler);
    registry.register(handle);
    registry.markReady(texture, textureAsset());
    registry.markReady(sampler, createSamplerAsset());
    const materialEntry = registry.markReady(
      handle,
      createMatcapMaterialAsset({
        matcapTexture: { texture, sampler },
      }),
    );

    const result = prepareMatcapMaterialResource({
      registry,
      device: deviceWithResources(createdBuffers, createdBindGroups),
      cache: createPreparedMatcapMaterialCache(),
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [],
      samplers: [],
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.resource).toBeNull();
    expect(result.diagnostics).toMatchObject([
      {
        code: "matcapMaterialBindGroupResource.missingTextureResource",
        resourceKey: "texture:studio",
      },
      {
        code: "matcapMaterialBindGroupResource.missingSamplerResource",
        resourceKey: "sampler:linear",
      },
    ]);
    expect(createdBuffers).toHaveLength(1);
    expect(createdBindGroups).toHaveLength(0);
  });
});

function materialLayout(): MatcapMaterialBindGroupLayoutResource {
  const plan = createMatcapMaterialBindGroupLayoutPlan(
    "layout:matcap/material",
  );

  return {
    group: 2,
    layoutKey: "layout:matcap/material",
    layout: { group: 2 },
    descriptor: plan.layout,
  };
}

function deviceWithResources(
  createdBuffers: unknown[],
  createdBindGroups: MatcapMaterialBindGroupCreationDescriptor[],
): MatcapFrameGpuResourceDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        createdBuffers.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => ({ descriptor }),
    createBindGroup: (descriptor) => {
      createdBindGroups.push(
        descriptor as MatcapMaterialBindGroupCreationDescriptor,
      );
      return { descriptor };
    },
  };
}

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}

function textureResource(resourceKey: string): TextureGpuResource {
  return {
    resourceKey,
    texture: { resourceKey, kind: "texture" },
    view: { resourceKey, kind: "texture-view" },
    descriptor: {
      label: resourceKey,
      size: [1, 1, 1],
      format: "rgba8unorm",
      usage: 4,
    },
  };
}

function samplerResource(resourceKey: string): SamplerGpuResource {
  return {
    resourceKey,
    sampler: { resourceKey, kind: "sampler" },
    descriptor: {
      label: resourceKey,
      addressModeU: "repeat",
      addressModeV: "repeat",
      addressModeW: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      lodMinClamp: 0,
      lodMaxClamp: 32,
      maxAnisotropy: 1,
    },
  };
}

function textureAsset(
  overrides: Partial<Parameters<typeof createTextureAsset>[0]> = {},
): ReturnType<typeof createTextureAsset> {
  return createTextureAsset({
    label: overrides.label ?? "studio",
    dimension: overrides.dimension ?? "2d",
    width: overrides.width ?? 1,
    height: overrides.height ?? 1,
    format: overrides.format ?? "rgba8unorm",
    colorSpace: overrides.colorSpace ?? "data",
    semantic: overrides.semantic ?? "data",
    ...overrides,
  });
}
