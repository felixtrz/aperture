import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createPreparedScalarStandardMaterialCache,
  createPreparedStandardBaseColorTextureDependencyKeys,
  createPreparedStandardTextureDependencyKeys,
  createSamplerAsset,
  createSamplerHandle,
  createStandardMaterialAsset,
  createStandardMaterialBindGroupLayoutPlan,
  createTextureAsset,
  createTextureHandle,
  prepareBaseColorTexturedStandardMaterialResource,
  prepareScalarStandardMaterialResource,
  type SamplerGpuResource,
  type StandardFrameGpuResourceDeviceLike,
  type StandardMaterialBindGroupCreationDescriptor,
  type StandardMaterialBindGroupLayoutResource,
  type TextureGpuResource,
} from "@aperture-engine/webgpu";

describe("scalar StandardMaterial prepared material cache", () => {
  it("creates, reuses, and invalidates scalar group-2 prepared resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: StandardMaterialBindGroupCreationDescriptor[] = [];
    const cache = createPreparedScalarStandardMaterialCache();
    const handle = createMaterialHandle("standard");
    const material = createStandardMaterialAsset({
      label: "Prepared Standard",
    });
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    const first = prepareScalarStandardMaterialResource({
      device,
      cache,
      handle,
      material,
      sourceVersion: 1,
      pipelineKey: "standard|opaque|back|less|none",
      layout: materialLayout(),
    });
    const second = prepareScalarStandardMaterialResource({
      device,
      cache,
      handle,
      material,
      sourceVersion: 1,
      pipelineKey: "standard|opaque|back|less|none",
      layout: materialLayout(),
    });
    const third = prepareScalarStandardMaterialResource({
      device,
      cache,
      handle,
      material,
      sourceVersion: 2,
      pipelineKey: "standard|opaque|back|less|none",
      layout: materialLayout(),
    });

    expect(first.status).toBe("created");
    expect(first.resource).toMatchObject({
      sourceMaterialKey: "material:standard",
      sourceVersion: 1,
      pipelineKey: "standard|opaque|back|less|none",
      layoutKey: "test-standard/group-2",
      materialResourceKey:
        "material-buffer:prepared-material:material:standard",
    });
    expect(first.resource?.bindGroup.entryResourceKeys).toEqual([
      "material-buffer:prepared-material:material:standard",
    ]);
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(third.status).toBe("created");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.sourceVersion).toBe(2);
    expect(createdBuffers).toHaveLength(2);
    expect(createdBindGroups).toHaveLength(2);
  });

  it("skips textured StandardMaterial variants with JSON-safe diagnostics", () => {
    const texture = createTextureHandle("base-color");
    const sampler = createSamplerHandle("linear");
    const result = prepareScalarStandardMaterialResource({
      device: deviceWithResources([], []),
      cache: createPreparedScalarStandardMaterialCache(),
      handle: createMaterialHandle("textured-standard"),
      material: createStandardMaterialAsset({
        label: "Textured Standard",
        baseColorTexture: { texture, sampler },
      }),
      sourceVersion: 1,
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      layout: materialLayout(),
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe("skipped");
    expect(result.resource).toBeNull();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedScalarStandardMaterial.notScalar",
        materialKey: "material:textured-standard",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("[object Object]");
  });
});

describe("StandardMaterial prepared texture dependency keys", () => {
  it("derives ready base-color texture and sampler handle/version keys", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("standard-base-color");
    const sampler = createSamplerHandle("standard-base-color-sampler");

    registry.register(texture);
    registry.register(sampler);
    const textureEntry = registry.markReady(texture, textureAsset());
    const samplerEntry = registry.markReady(
      sampler,
      createSamplerAsset({ label: "linear" }),
    );

    const result = createPreparedStandardBaseColorTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual({
      field: "baseColorTexture",
      texture: {
        field: "baseColorTexture",
        kind: "texture",
        handleKey: "texture:standard-base-color",
        version: textureEntry.version,
        versionKey: "texture:standard-base-color@1",
      },
      sampler: {
        field: "baseColorTexture",
        kind: "sampler",
        handleKey: "sampler:standard-base-color-sampler",
        version: samplerEntry.version,
        versionKey: "sampler:standard-base-color-sampler@1",
      },
      cacheKeySegments: [
        "baseColorTexture:texture:texture:standard-base-color@1",
        "baseColorTexture:sampler:sampler:standard-base-color-sampler@1",
      ],
    });
  });

  it("derives ordered dependency keys for all Standard texture families", () => {
    const registry = new AssetRegistry();
    const baseColor = readyTextureSamplerPair(registry, "base-color");
    const metallicRoughness = readyTextureSamplerPair(
      registry,
      "metallic-roughness",
    );
    const normal = readyTextureSamplerPair(registry, "normal");
    const occlusion = readyTextureSamplerPair(registry, "occlusion");
    const emissive = readyTextureSamplerPair(registry, "emissive");

    const result = createPreparedStandardTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        baseColorTexture: baseColor,
        metallicRoughnessTexture: metallicRoughness,
        normalTexture: normal,
        occlusionTexture: occlusion,
        emissiveTexture: emissive,
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.dependencies?.bindings.map((binding) => binding.field),
    ).toEqual([
      "baseColorTexture",
      "metallicRoughnessTexture",
      "normalTexture",
      "occlusionTexture",
      "emissiveTexture",
    ]);
    expect(result.dependencies?.cacheKeySegments).toEqual([
      "baseColorTexture:texture:texture:base-color@1",
      "baseColorTexture:sampler:sampler:base-color-sampler@1",
      "metallicRoughnessTexture:texture:texture:metallic-roughness@1",
      "metallicRoughnessTexture:sampler:sampler:metallic-roughness-sampler@1",
      "normalTexture:texture:texture:normal@1",
      "normalTexture:sampler:sampler:normal-sampler@1",
      "occlusionTexture:texture:texture:occlusion@1",
      "occlusionTexture:sampler:sampler:occlusion-sampler@1",
      "emissiveTexture:texture:texture:emissive@1",
      "emissiveTexture:sampler:sampler:emissive-sampler@1",
    ]);
  });

  it("updates base-color dependency keys when source asset versions change", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("standard-base-color");
    const sampler = createSamplerHandle("standard-base-color-sampler");

    registry.register(texture);
    registry.register(sampler);
    registry.markReady(texture, textureAsset({ label: "first" }));
    registry.markReady(sampler, createSamplerAsset({ label: "first" }));

    const first = createPreparedStandardBaseColorTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    registry.markReady(texture, textureAsset({ label: "second" }));
    registry.markReady(sampler, createSamplerAsset({ label: "second" }));

    const second = createPreparedStandardBaseColorTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    expect(first.dependencies?.cacheKeySegments).toEqual([
      "baseColorTexture:texture:texture:standard-base-color@1",
      "baseColorTexture:sampler:sampler:standard-base-color-sampler@1",
    ]);
    expect(second.dependencies?.cacheKeySegments).toEqual([
      "baseColorTexture:texture:texture:standard-base-color@2",
      "baseColorTexture:sampler:sampler:standard-base-color-sampler@2",
    ]);
  });

  it("reports missing base-color texture handles without GPU details", () => {
    const registry = new AssetRegistry();
    const sampler = createSamplerHandle("standard-linear");

    registry.register(sampler);
    registry.markReady(sampler, createSamplerAsset({ label: "linear" }));

    const result = createPreparedStandardBaseColorTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        baseColorTexture: { texture: null, sampler },
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.dependencies).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "preparedStandardTextureDependency.missingTextureHandle",
        field: "baseColorTexture.texture",
        message:
          "Prepared StandardMaterial texture resources require a texture handle.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("createTexture");
    expect(JSON.stringify(result)).not.toContain("createSampler");
  });

  it("reports loading base-color samplers without prepared dependencies", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("standard-base-color");
    const sampler = createSamplerHandle("standard-loading-sampler");

    registry.register(texture);
    registry.register(sampler);
    registry.markReady(texture, textureAsset());
    registry.markLoading(sampler);

    const result = createPreparedStandardBaseColorTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.dependencies).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "preparedStandardTextureDependency.samplerSourceNotReady",
        field: "baseColorTexture",
        resourceKey: "sampler:standard-loading-sampler",
        status: "loading",
        message:
          "Sampler source asset 'sampler:standard-loading-sampler' is not ready for prepared StandardMaterial resources.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("descriptor");
  });

  it("reports missing and loading dependencies for non-base-color families", () => {
    const registry = new AssetRegistry();
    const metallicRoughnessTexture = createTextureHandle("missing-mr");
    const metallicRoughnessSampler = createSamplerHandle("mr-sampler");
    const normalTexture = createTextureHandle("normal");
    const normalSampler = createSamplerHandle("normal-loading-sampler");

    registry.register(metallicRoughnessSampler);
    registry.markReady(
      metallicRoughnessSampler,
      createSamplerAsset({ label: "mr" }),
    );
    registry.register(normalTexture);
    registry.markReady(normalTexture, textureAsset({ label: "normal" }));
    registry.register(normalSampler);
    registry.markLoading(normalSampler);

    const result = createPreparedStandardTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        metallicRoughnessTexture: {
          texture: metallicRoughnessTexture,
          sampler: metallicRoughnessSampler,
        },
        normalTexture: {
          texture: normalTexture,
          sampler: normalSampler,
        },
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.dependencies).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "preparedStandardTextureDependency.textureSourceNotReady",
        field: "metallicRoughnessTexture",
        resourceKey: "texture:missing-mr",
        status: "missing",
        message:
          "Texture source asset 'texture:missing-mr' is not ready for prepared StandardMaterial resources.",
      },
      {
        code: "preparedStandardTextureDependency.samplerSourceNotReady",
        field: "normalTexture",
        resourceKey: "sampler:normal-loading-sampler",
        status: "loading",
        message:
          "Sampler source asset 'sampler:normal-loading-sampler' is not ready for prepared StandardMaterial resources.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("descriptor");
  });
});

describe("base-color textured StandardMaterial prepared material cache", () => {
  it("creates, reuses, and invalidates textured group-2 prepared resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: StandardMaterialBindGroupCreationDescriptor[] = [];
    const registry = new AssetRegistry();
    const cache = createPreparedScalarStandardMaterialCache();
    const handle = createMaterialHandle("textured-standard");
    const texture = createTextureHandle("standard-base-color");
    const sampler = createSamplerHandle("standard-base-color-sampler");
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(texture);
    registry.register(sampler);
    registry.register(handle);
    registry.markReady(texture, textureAsset({ label: "texture-v1" }));
    registry.markReady(sampler, createSamplerAsset({ label: "sampler-v1" }));
    const firstMaterial = createStandardMaterialAsset({
      label: "Textured Standard",
      baseColorTexture: { texture, sampler },
    });
    const firstMaterialEntry = registry.markReady(handle, firstMaterial);

    const first = prepareBaseColorTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: firstMaterial,
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });
    const second = prepareBaseColorTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: firstMaterial,
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });
    const secondMaterial = createStandardMaterialAsset({
      label: "Textured Standard Updated",
      roughnessFactor: 0.35,
      baseColorTexture: { texture, sampler },
    });
    const secondMaterialEntry = registry.markReady(handle, secondMaterial);
    const materialVersion = prepareBaseColorTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: secondMaterial,
      sourceVersion: secondMaterialEntry.version,
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });

    registry.markReady(texture, textureAsset({ label: "texture-v2" }));
    const textureVersion = prepareBaseColorTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: secondMaterial,
      sourceVersion: secondMaterialEntry.version,
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });

    registry.markReady(sampler, createSamplerAsset({ label: "sampler-v2" }));
    const samplerVersion = prepareBaseColorTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: secondMaterial,
      sourceVersion: secondMaterialEntry.version,
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });

    expect(first.status).toBe("created");
    expect(first.resource).toMatchObject({
      sourceMaterialKey: "material:textured-standard",
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      dependencyCacheKeySegments: [
        "baseColorTexture:texture:texture:standard-base-color@1",
        "baseColorTexture:sampler:sampler:standard-base-color-sampler@1",
      ],
      textureResourceKey: "texture:standard-base-color",
      samplerResourceKey: "sampler:standard-base-color-sampler",
    });
    expect(first.resource?.bindGroup.entryResourceKeys).toEqual([
      "material-buffer:prepared-material:material:textured-standard",
      "texture:standard-base-color",
      "sampler:standard-base-color-sampler",
    ]);
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(materialVersion.status).toBe("created");
    expect(materialVersion.resource).not.toBe(first.resource);
    expect(textureVersion.status).toBe("created");
    expect(textureVersion.resource?.dependencyCacheKeySegments).toEqual([
      "baseColorTexture:texture:texture:standard-base-color@2",
      "baseColorTexture:sampler:sampler:standard-base-color-sampler@1",
    ]);
    expect(samplerVersion.status).toBe("created");
    expect(samplerVersion.resource?.dependencyCacheKeySegments).toEqual([
      "baseColorTexture:texture:texture:standard-base-color@2",
      "baseColorTexture:sampler:sampler:standard-base-color-sampler@2",
    ]);
    expect(createdBuffers).toHaveLength(4);
    expect(createdBindGroups).toHaveLength(4);
  });

  it("keeps scalar and multi-texture StandardMaterial variants out of the base-color cache", () => {
    const texture = createTextureHandle("base-color");
    const sampler = createSamplerHandle("base-color-sampler");
    const normalTexture = createTextureHandle("normal");
    const normalSampler = createSamplerHandle("normal-sampler");
    const cache = createPreparedScalarStandardMaterialCache();

    const scalar = prepareBaseColorTexturedStandardMaterialResource({
      registry: new AssetRegistry(),
      device: deviceWithResources([], []),
      cache,
      handle: createMaterialHandle("scalar"),
      material: createStandardMaterialAsset(),
      sourceVersion: 1,
      pipelineKey: "standard|opaque|back|less|none",
      layout: materialLayout(),
      textures: [],
      samplers: [],
    });
    const multiTexture = prepareBaseColorTexturedStandardMaterialResource({
      registry: new AssetRegistry(),
      device: deviceWithResources([], []),
      cache,
      handle: createMaterialHandle("multi-texture"),
      material: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
        normalTexture: { texture: normalTexture, sampler: normalSampler },
      }),
      sourceVersion: 1,
      pipelineKey:
        "standard|baseColorTexture|normalTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [],
      samplers: [],
    });

    expect(scalar.status).toBe("skipped");
    expect(scalar.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedBaseColorTexturedStandardMaterial.notBaseColorTextured",
        materialKey: "material:scalar",
      }),
    ]);
    expect(multiTexture.status).toBe("skipped");
    expect(multiTexture.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedBaseColorTexturedStandardMaterial.notBaseColorTextured",
        materialKey: "material:multi-texture",
      }),
    ]);
  });
});

function deviceWithResources(
  createdBuffers: unknown[],
  createdBindGroups: StandardMaterialBindGroupCreationDescriptor[],
): StandardFrameGpuResourceDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        createdBuffers.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => ({ descriptor }),
    createBindGroup: (descriptor) => {
      createdBindGroups.push(
        descriptor as StandardMaterialBindGroupCreationDescriptor,
      );
      return { descriptor };
    },
  };
}

function materialLayout(): StandardMaterialBindGroupLayoutResource {
  return {
    group: 2,
    layoutKey: "test-standard/group-2",
    layout: { group: 2 },
    descriptor: createStandardMaterialBindGroupLayoutPlan(
      "test-standard/group-2",
    ).layout,
  };
}

function textureGpuResource(
  handle: ReturnType<typeof createTextureHandle>,
): TextureGpuResource {
  return {
    resourceKey: assetHandleKey(handle),
    texture: { handle },
    view: { handle, view: true },
    descriptor: {
      label: handle.id,
      size: [2, 2, 1],
      format: "rgba8unorm-srgb",
      usage: 1,
    },
  };
}

function samplerGpuResource(
  handle: ReturnType<typeof createSamplerHandle>,
): SamplerGpuResource {
  return {
    resourceKey: assetHandleKey(handle),
    sampler: { handle },
    descriptor: createSamplerAsset({ label: handle.id }),
  };
}

function textureAsset(
  overrides: Partial<Parameters<typeof createTextureAsset>[0]> = {},
): ReturnType<typeof createTextureAsset> {
  return createTextureAsset({
    label: "standard-base-color",
    dimension: "2d",
    width: 2,
    height: 2,
    format: "rgba8unorm-srgb",
    colorSpace: "srgb",
    semantic: "base-color",
    usage: ["sampled"],
    ...overrides,
  });
}

function readyTextureSamplerPair(
  registry: AssetRegistry,
  id: string,
): {
  readonly texture: ReturnType<typeof createTextureHandle>;
  readonly sampler: ReturnType<typeof createSamplerHandle>;
} {
  const texture = createTextureHandle(id);
  const sampler = createSamplerHandle(`${id}-sampler`);

  registry.register(texture);
  registry.markReady(texture, textureAsset({ label: id }));
  registry.register(sampler);
  registry.markReady(sampler, createSamplerAsset({ label: `${id}-sampler` }));

  return { texture, sampler };
}
