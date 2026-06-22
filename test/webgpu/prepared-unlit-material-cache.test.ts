import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createMaterialHandle,
  createPreparedScalarUnlitMaterialCache,
  createPreparedUnlitTextureDependencyKeys,
  createSamplerAsset,
  createSamplerHandle,
  createTextureAsset,
  createTextureHandle,
  createUnlitBindGroupLayoutMetadata,
  createUnlitMaterialAsset,
  prepareTexturedUnlitMaterialResource,
  type SamplerGpuResource,
  type TextureGpuResource,
  prepareScalarUnlitMaterialResource,
  type UnlitBindGroupCreationDescriptor,
  type UnlitBindGroupLayoutResource,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("scalar unlit prepared material cache", () => {
  it("creates, reuses, and invalidates scalar unlit material resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: UnlitBindGroupCreationDescriptor[] = [];
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("white");
    const cache = createPreparedScalarUnlitMaterialCache();
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(handle);
    const firstEntry = registry.markReady(
      handle,
      createUnlitMaterialAsset({ label: "White" }),
    );

    const first = prepareScalarUnlitMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(firstEntry.asset),
      sourceVersion: firstEntry.version,
      frame: 10,
      pipelineKey: "unlit|opaque|back|less|none",
      layout: materialLayout(),
    });
    const second = prepareScalarUnlitMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(firstEntry.asset),
      sourceVersion: firstEntry.version,
      frame: 11,
      pipelineKey: "unlit|opaque|back|less|none",
      layout: materialLayout(),
    });
    const updatedEntry = registry.markReady(
      handle,
      createUnlitMaterialAsset({ label: "White Updated" }),
    );
    const third = prepareScalarUnlitMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(updatedEntry.asset),
      sourceVersion: updatedEntry.version,
      frame: 12,
      pipelineKey: "unlit|opaque|back|less|none",
      layout: materialLayout(),
    });

    expect(first.status).toBe("created");
    expect(first.resource?.sourceVersion).toBe(firstEntry.version);
    expect(first.resource?.materialResourceKey).toBe(
      "prepared-material:material:white@v1",
    );
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(second.resource?.lastUsedFrame).toBe(11);
    expect(third.status).toBe("created");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.sourceVersion).toBe(updatedEntry.version);
    expect(third.resource?.lastUsedFrame).toBe(12);
    expect(
      [...cache.resources.values()].map((resource) => ({
        sourceVersion: resource.sourceVersion,
        lastUsedFrame: resource.lastUsedFrame,
      })),
    ).toEqual([
      { sourceVersion: firstEntry.version, lastUsedFrame: 11 },
      { sourceVersion: updatedEntry.version, lastUsedFrame: 12 },
    ]);
    expect(createdBuffers).toHaveLength(2);
    expect(createdBindGroups).toHaveLength(2);
  });

  it("skips textured unlit materials for the scalar cache", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("textured");
    const material = createUnlitMaterialAsset({
      baseColorTexture: {
        texture: createTextureHandle("albedo"),
        sampler: createSamplerHandle("linear"),
      },
    });

    registry.register(handle);
    const entry = registry.markReady(handle, material);

    const result = prepareScalarUnlitMaterialResource({
      registry,
      device: deviceWithResources([], []),
      cache: createPreparedScalarUnlitMaterialCache(),
      handle,
      material: required(entry.asset),
      sourceVersion: entry.version,
      pipelineKey: "unlit|opaque|back|less|none",
      layout: materialLayout(),
    });

    expect(result.status).toBe("skipped");
    expect(result.resource).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "preparedScalarUnlitMaterial.notScalar",
    ]);
  });
});

describe("unlit prepared texture dependency keys", () => {
  it("derives ready texture and sampler handle/version keys", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");

    registry.register(texture);
    registry.register(sampler);
    const textureEntry = registry.markReady(texture, textureAsset());
    const samplerEntry = registry.markReady(
      sampler,
      createSamplerAsset({ label: "linear" }),
    );

    const result = createPreparedUnlitTextureDependencyKeys({
      registry,
      material: createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual({
      texture: {
        handleKey: "texture:albedo",
        version: textureEntry.version,
        versionKey: "texture:albedo@1",
      },
      sampler: {
        handleKey: "sampler:linear",
        version: samplerEntry.version,
        versionKey: "sampler:linear@1",
      },
      cacheKeySegments: [
        "texture:texture:albedo@1",
        "sampler:sampler:linear@1",
      ],
    });
  });

  it("reports missing texture and sampler dependencies without GPU handles", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("missing-albedo");
    const sampler = createSamplerHandle("registered-linear");

    registry.register(sampler);

    const result = createPreparedUnlitTextureDependencyKeys({
      registry,
      material: createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.dependencies).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "preparedUnlitTextureDependency.textureSourceNotReady",
        resourceKey: "texture:missing-albedo",
        status: "missing",
        message:
          "Texture source asset 'texture:missing-albedo' is not ready for prepared unlit material resources.",
      },
      {
        code: "preparedUnlitTextureDependency.samplerSourceNotReady",
        resourceKey: "sampler:registered-linear",
        status: "registered",
        message:
          "Sampler source asset 'sampler:registered-linear' is not ready for prepared unlit material resources.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("createTexture");
    expect(JSON.stringify(result)).not.toContain("createSampler");
  });

  it("updates dependency keys when source asset versions change", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");

    registry.register(texture);
    registry.register(sampler);
    registry.markReady(texture, textureAsset({ label: "first" }));
    registry.markReady(sampler, createSamplerAsset({ label: "first" }));

    const first = createPreparedUnlitTextureDependencyKeys({
      registry,
      material: createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    registry.markReady(texture, textureAsset({ label: "second" }));
    registry.markReady(sampler, createSamplerAsset({ label: "second" }));

    const second = createPreparedUnlitTextureDependencyKeys({
      registry,
      material: createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    expect(first.dependencies?.cacheKeySegments).toEqual([
      "texture:texture:albedo@1",
      "sampler:sampler:linear@1",
    ]);
    expect(second.dependencies?.cacheKeySegments).toEqual([
      "texture:texture:albedo@2",
      "sampler:sampler:linear@2",
    ]);
  });
});

describe("textured unlit prepared material cache", () => {
  it("creates, reuses, and invalidates textured group-2 prepared resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: UnlitBindGroupCreationDescriptor[] = [];
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("textured");
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");
    const cache = createPreparedScalarUnlitMaterialCache();
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(texture);
    registry.register(sampler);
    registry.register(handle);
    registry.markReady(texture, textureAsset({ label: "first" }));
    registry.markReady(sampler, createSamplerAsset({ label: "first" }));
    const materialEntry = registry.markReady(
      handle,
      createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    const first = prepareTexturedUnlitMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      pipelineKey: "unlit|opaque|back|less|textured",
      layout: materialLayout(),
      textures: [textureResource("texture:albedo")],
      samplers: [samplerResource("sampler:linear")],
    });
    const second = prepareTexturedUnlitMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      pipelineKey: "unlit|opaque|back|less|textured",
      layout: materialLayout(),
      textures: [textureResource("texture:albedo")],
      samplers: [samplerResource("sampler:linear")],
    });

    registry.markReady(sampler, createSamplerAsset({ label: "second" }));

    const third = prepareTexturedUnlitMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      pipelineKey: "unlit|opaque|back|less|textured",
      layout: materialLayout(),
      textures: [textureResource("texture:albedo")],
      samplers: [samplerResource("sampler:linear")],
    });

    expect(first.status).toBe("created");
    expect(first.resource?.textureResourceKey).toBe("texture:albedo");
    expect(first.resource?.samplerResourceKey).toBe("sampler:linear");
    expect(first.resource?.dependencyCacheKeySegments).toEqual([
      "texture:texture:albedo@1",
      "sampler:sampler:linear@1",
    ]);
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(third.status).toBe("created");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.dependencyCacheKeySegments).toEqual([
      "texture:texture:albedo@1",
      "sampler:sampler:linear@2",
    ]);
    expect(createdBuffers).toHaveLength(2);
    expect(createdBindGroups).toHaveLength(2);
    expect(createdBindGroups[0]?.entries.map((entry) => entry.binding)).toEqual(
      [0, 1, 2],
    );
  });

  it("reports missing textured dependencies without creating GPU resources", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("textured");
    const texture = createTextureHandle("missing");
    const sampler = createSamplerHandle("linear");
    const createdBuffers: unknown[] = [];
    const createdBindGroups: UnlitBindGroupCreationDescriptor[] = [];

    registry.register(sampler);
    registry.register(handle);
    const materialEntry = registry.markReady(
      handle,
      createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    const result = prepareTexturedUnlitMaterialResource({
      registry,
      device: deviceWithResources(createdBuffers, createdBindGroups),
      cache: createPreparedScalarUnlitMaterialCache(),
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      pipelineKey: "unlit|opaque|back|less|textured",
      layout: materialLayout(),
      textures: [],
      samplers: [],
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.resource).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "preparedUnlitTextureDependency.textureSourceNotReady",
      "preparedUnlitTextureDependency.samplerSourceNotReady",
    ]);
    expect(createdBuffers).toHaveLength(0);
    expect(createdBindGroups).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("[object Object]");
  });

  it("reports missing WebGPU texture or sampler resources by logical key", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("textured");
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");
    const createdBindGroups: UnlitBindGroupCreationDescriptor[] = [];

    registry.register(texture);
    registry.register(sampler);
    registry.register(handle);
    registry.markReady(texture, textureAsset());
    registry.markReady(sampler, createSamplerAsset());
    const materialEntry = registry.markReady(
      handle,
      createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    const result = prepareTexturedUnlitMaterialResource({
      registry,
      device: deviceWithResources([], createdBindGroups),
      cache: createPreparedScalarUnlitMaterialCache(),
      handle,
      material: required(materialEntry.asset),
      sourceVersion: materialEntry.version,
      pipelineKey: "unlit|opaque|back|less|textured",
      layout: materialLayout(),
      textures: [],
      samplers: [],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: "unlitBindGroupResource.missingTextureResource",
        resourceKey: "texture:albedo",
      },
      {
        code: "unlitBindGroupResource.missingSamplerResource",
        resourceKey: "sampler:linear",
      },
    ]);
    expect(createdBindGroups).toHaveLength(0);
  });
});

function materialLayout(): UnlitBindGroupLayoutResource {
  return {
    group: 2,
    layoutKey: "layout:unlit/material",
    layout: { group: 2 },
    metadata: createUnlitBindGroupLayoutMetadata(2, "layout:unlit/material"),
  };
}

function deviceWithResources(
  createdBuffers: unknown[],
  createdBindGroups: UnlitBindGroupCreationDescriptor[],
): WebGpuBufferDeviceLike & {
  createBindGroup(descriptor: UnlitBindGroupCreationDescriptor): unknown;
} {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        createdBuffers.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => ({ descriptor }),
    createBindGroup: (descriptor) => {
      createdBindGroups.push(descriptor);
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
    label: overrides.label ?? "albedo",
    dimension: overrides.dimension ?? "2d",
    width: overrides.width ?? 1,
    height: overrides.height ?? 1,
    format: overrides.format ?? "rgba8unorm",
    colorSpace: overrides.colorSpace ?? "srgb",
    semantic: overrides.semantic ?? "base-color",
    ...overrides,
  });
}
