import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createPreparedScalarStandardMaterialCache,
  createPreparedStandardBaseColorTextureDependencyKeys,
  createPreparedStandardIridescenceThicknessTextureDependencyKeys,
  createPreparedStandardMetallicRoughnessTextureDependencyKeys,
  createPreparedStandardNormalTextureDependencyKeys,
  createPreparedStandardTextureDependencyKeys,
  createSamplerAsset,
  createSamplerHandle,
  createStandardMaterialAsset,
  createStandardMaterialBindGroupLayoutPlan,
  createTextureAsset,
  createTextureHandle,
  prepareBaseColorTexturedStandardMaterialResource,
  prepareIridescenceThicknessTexturedStandardMaterialResource,
  prepareMetallicRoughnessTexturedStandardMaterialResource,
  prepareNormalTexturedStandardMaterialResource,
  prepareOcclusionEmissiveTexturedStandardMaterialResource,
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
      frame: 30,
      pipelineKey: "standard|opaque|back|less|none",
      layout: materialLayout(),
    });
    const second = prepareScalarStandardMaterialResource({
      device,
      cache,
      handle,
      material,
      sourceVersion: 1,
      frame: 31,
      pipelineKey: "standard|opaque|back|less|none",
      layout: materialLayout(),
    });
    const third = prepareScalarStandardMaterialResource({
      device,
      cache,
      handle,
      material,
      sourceVersion: 2,
      frame: 32,
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
    expect(second.resource?.lastUsedFrame).toBe(31);
    expect(third.status).toBe("created");
    expect(third.resource).not.toBe(first.resource);
    expect(third.resource?.sourceVersion).toBe(2);
    expect(third.resource?.lastUsedFrame).toBe(32);
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
    const iridescenceThickness = readyTextureSamplerPair(
      registry,
      "iridescence-thickness",
    );

    const result = createPreparedStandardTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        baseColorTexture: baseColor,
        metallicRoughnessTexture: metallicRoughness,
        normalTexture: normal,
        occlusionTexture: occlusion,
        emissiveTexture: emissive,
        iridescenceThicknessTexture: iridescenceThickness,
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.dependencies?.bindings.map((binding) => binding.field),
    ).toEqual([
      "baseColorTexture",
      "metallicRoughnessTexture",
      "iridescenceThicknessTexture",
      "normalTexture",
      "occlusionTexture",
      "emissiveTexture",
    ]);
    expect(result.dependencies?.cacheKeySegments).toEqual([
      "baseColorTexture:texture:texture:base-color@1",
      "baseColorTexture:sampler:sampler:base-color-sampler@1",
      "metallicRoughnessTexture:texture:texture:metallic-roughness@1",
      "metallicRoughnessTexture:sampler:sampler:metallic-roughness-sampler@1",
      "iridescenceThicknessTexture:texture:texture:iridescence-thickness@1",
      "iridescenceThicknessTexture:sampler:sampler:iridescence-thickness-sampler@1",
      "normalTexture:texture:texture:normal@1",
      "normalTexture:sampler:sampler:normal-sampler@1",
      "occlusionTexture:texture:texture:occlusion@1",
      "occlusionTexture:sampler:sampler:occlusion-sampler@1",
      "emissiveTexture:texture:texture:emissive@1",
      "emissiveTexture:sampler:sampler:emissive-sampler@1",
    ]);
  });

  it("derives ready iridescence thickness texture and sampler handle/version keys", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("standard-iridescence-thickness");
    const sampler = createSamplerHandle(
      "standard-iridescence-thickness-sampler",
    );

    registry.register(texture);
    registry.register(sampler);
    const textureEntry = registry.markReady(
      texture,
      textureAsset({
        label: "standard-iridescence-thickness",
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "iridescence-thickness",
      }),
    );
    const samplerEntry = registry.markReady(
      sampler,
      createSamplerAsset({ label: "nearest" }),
    );

    const result =
      createPreparedStandardIridescenceThicknessTextureDependencyKeys({
        registry,
        material: createStandardMaterialAsset({
          iridescenceThicknessTexture: { texture, sampler },
        }),
      });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual({
      field: "iridescenceThicknessTexture",
      texture: {
        field: "iridescenceThicknessTexture",
        kind: "texture",
        handleKey: "texture:standard-iridescence-thickness",
        version: textureEntry.version,
        versionKey: "texture:standard-iridescence-thickness@1",
      },
      sampler: {
        field: "iridescenceThicknessTexture",
        kind: "sampler",
        handleKey: "sampler:standard-iridescence-thickness-sampler",
        version: samplerEntry.version,
        versionKey: "sampler:standard-iridescence-thickness-sampler@1",
      },
      cacheKeySegments: [
        "iridescenceThicknessTexture:texture:texture:standard-iridescence-thickness@1",
        "iridescenceThicknessTexture:sampler:sampler:standard-iridescence-thickness-sampler@1",
      ],
    });
  });

  it("derives ready metallic-roughness texture and sampler handle/version keys", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("standard-metallic-roughness");
    const sampler = createSamplerHandle("standard-metallic-roughness-sampler");

    registry.register(texture);
    registry.register(sampler);
    const textureEntry = registry.markReady(
      texture,
      textureAsset({
        label: "standard-metallic-roughness",
        colorSpace: "data",
        semantic: "metallic-roughness",
      }),
    );
    const samplerEntry = registry.markReady(
      sampler,
      createSamplerAsset({ label: "linear" }),
    );

    const result = createPreparedStandardMetallicRoughnessTextureDependencyKeys(
      {
        registry,
        material: createStandardMaterialAsset({
          metallicRoughnessTexture: { texture, sampler },
        }),
      },
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual({
      field: "metallicRoughnessTexture",
      texture: {
        field: "metallicRoughnessTexture",
        kind: "texture",
        handleKey: "texture:standard-metallic-roughness",
        version: textureEntry.version,
        versionKey: "texture:standard-metallic-roughness@1",
      },
      sampler: {
        field: "metallicRoughnessTexture",
        kind: "sampler",
        handleKey: "sampler:standard-metallic-roughness-sampler",
        version: samplerEntry.version,
        versionKey: "sampler:standard-metallic-roughness-sampler@1",
      },
      cacheKeySegments: [
        "metallicRoughnessTexture:texture:texture:standard-metallic-roughness@1",
        "metallicRoughnessTexture:sampler:sampler:standard-metallic-roughness-sampler@1",
      ],
    });
  });

  it("derives ready normal texture and sampler handle/version keys", () => {
    const registry = new AssetRegistry();
    const texture = createTextureHandle("standard-normal");
    const sampler = createSamplerHandle("standard-normal-sampler");

    registry.register(texture);
    registry.register(sampler);
    const textureEntry = registry.markReady(
      texture,
      textureAsset({
        label: "standard-normal",
        colorSpace: "data",
        semantic: "normal",
      }),
    );
    const samplerEntry = registry.markReady(
      sampler,
      createSamplerAsset({ label: "linear" }),
    );

    const result = createPreparedStandardNormalTextureDependencyKeys({
      registry,
      material: createStandardMaterialAsset({
        normalTexture: { texture, sampler },
      }),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual({
      field: "normalTexture",
      texture: {
        field: "normalTexture",
        kind: "texture",
        handleKey: "texture:standard-normal",
        version: textureEntry.version,
        versionKey: "texture:standard-normal@1",
      },
      sampler: {
        field: "normalTexture",
        kind: "sampler",
        handleKey: "sampler:standard-normal-sampler",
        version: samplerEntry.version,
        versionKey: "sampler:standard-normal-sampler@1",
      },
      cacheKeySegments: [
        "normalTexture:texture:texture:standard-normal@1",
        "normalTexture:sampler:sampler:standard-normal-sampler@1",
      ],
    });
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
      frame: 60,
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
      frame: 61,
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
      frame: 62,
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
      frame: 63,
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
      frame: 64,
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
    expect(second.resource?.lastUsedFrame).toBe(61);
    expect(materialVersion.status).toBe("created");
    expect(materialVersion.resource).not.toBe(first.resource);
    expect(materialVersion.resource?.lastUsedFrame).toBe(62);
    expect(textureVersion.status).toBe("created");
    expect(textureVersion.resource?.dependencyCacheKeySegments).toEqual([
      "baseColorTexture:texture:texture:standard-base-color@2",
      "baseColorTexture:sampler:sampler:standard-base-color-sampler@1",
    ]);
    expect(textureVersion.resource?.lastUsedFrame).toBe(63);
    expect(samplerVersion.status).toBe("created");
    expect(samplerVersion.resource?.dependencyCacheKeySegments).toEqual([
      "baseColorTexture:texture:texture:standard-base-color@2",
      "baseColorTexture:sampler:sampler:standard-base-color-sampler@2",
    ]);
    expect(samplerVersion.resource?.lastUsedFrame).toBe(64);
    expect(
      [...cache.resources.values()].map((resource) => ({
        sourceVersion: resource.sourceVersion,
        lastUsedFrame: resource.lastUsedFrame,
        dependencyCacheKeySegments:
          "dependencyCacheKeySegments" in resource
            ? resource.dependencyCacheKeySegments
            : [],
      })),
    ).toEqual([
      {
        sourceVersion: firstMaterialEntry.version,
        lastUsedFrame: 61,
        dependencyCacheKeySegments: [
          "baseColorTexture:texture:texture:standard-base-color@1",
          "baseColorTexture:sampler:sampler:standard-base-color-sampler@1",
        ],
      },
      {
        sourceVersion: secondMaterialEntry.version,
        lastUsedFrame: 62,
        dependencyCacheKeySegments: [
          "baseColorTexture:texture:texture:standard-base-color@1",
          "baseColorTexture:sampler:sampler:standard-base-color-sampler@1",
        ],
      },
      {
        sourceVersion: secondMaterialEntry.version,
        lastUsedFrame: 63,
        dependencyCacheKeySegments: [
          "baseColorTexture:texture:texture:standard-base-color@2",
          "baseColorTexture:sampler:sampler:standard-base-color-sampler@1",
        ],
      },
      {
        sourceVersion: secondMaterialEntry.version,
        lastUsedFrame: 64,
        dependencyCacheKeySegments: [
          "baseColorTexture:texture:texture:standard-base-color@2",
          "baseColorTexture:sampler:sampler:standard-base-color-sampler@2",
        ],
      },
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

describe("iridescence thickness textured StandardMaterial prepared material cache", () => {
  it("creates a single-texture group-2 prepared resource", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: StandardMaterialBindGroupCreationDescriptor[] = [];
    const registry = new AssetRegistry();
    const cache = createPreparedScalarStandardMaterialCache();
    const handle = createMaterialHandle("iridescence-thickness-standard");
    const texture = createTextureHandle("iridescence-thickness");
    const sampler = createSamplerHandle("iridescence-thickness-sampler");
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(texture);
    registry.register(sampler);
    registry.register(handle);
    registry.markReady(
      texture,
      textureAsset({
        label: "iridescence-thickness",
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "iridescence-thickness",
      }),
    );
    registry.markReady(sampler, createSamplerAsset({ label: "nearest" }));
    const material = createStandardMaterialAsset({
      label: "Iridescence Thickness Standard",
      iridescenceFactor: 1,
      iridescenceThicknessTexture: { texture, sampler },
    });
    const materialEntry = registry.markReady(handle, material);

    const result = prepareIridescenceThicknessTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material,
      sourceVersion: materialEntry.version,
      frame: 70,
      pipelineKey:
        "standard|iridescence|iridescenceThicknessTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });

    expect(result.valid).toBe(true);
    expect(result.status).toBe("created");
    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      sourceMaterialKey: "material:iridescence-thickness-standard",
      sourceVersion: materialEntry.version,
      dependencyCacheKeySegments: [
        "iridescenceThicknessTexture:texture:texture:iridescence-thickness@1",
        "iridescenceThicknessTexture:sampler:sampler:iridescence-thickness-sampler@1",
      ],
      textureResourceKey: "texture:iridescence-thickness",
      samplerResourceKey: "sampler:iridescence-thickness-sampler",
    });
    expect(result.resource?.bindGroup.entryResourceKeys).toEqual([
      "material-buffer:prepared-material:material:iridescence-thickness-standard",
      "texture:iridescence-thickness",
      "sampler:iridescence-thickness-sampler",
    ]);
    expect(createdBuffers).toHaveLength(1);
    expect(createdBindGroups).toHaveLength(1);
  });
});

describe("metallic-roughness textured StandardMaterial prepared material cache", () => {
  it("creates, reuses, and invalidates metallic-roughness group-2 prepared resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: StandardMaterialBindGroupCreationDescriptor[] = [];
    const registry = new AssetRegistry();
    const cache = createPreparedScalarStandardMaterialCache();
    const handle = createMaterialHandle("metallic-standard");
    const texture = createTextureHandle("standard-metallic-roughness");
    const sampler = createSamplerHandle("standard-metallic-roughness-sampler");
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(texture);
    registry.register(sampler);
    registry.register(handle);
    registry.markReady(
      texture,
      textureAsset({
        label: "texture-v1",
        colorSpace: "data",
        semantic: "metallic-roughness",
      }),
    );
    registry.markReady(sampler, createSamplerAsset({ label: "sampler-v1" }));
    const firstMaterial = createStandardMaterialAsset({
      label: "Metallic Roughness Standard",
      metallicRoughnessTexture: { texture, sampler },
    });
    const firstMaterialEntry = registry.markReady(handle, firstMaterial);

    const first = prepareMetallicRoughnessTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: firstMaterial,
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });
    const second = prepareMetallicRoughnessTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: firstMaterial,
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });
    const secondMaterial = createStandardMaterialAsset({
      label: "Metallic Roughness Standard Updated",
      roughnessFactor: 0.42,
      metallicRoughnessTexture: { texture, sampler },
    });
    const secondMaterialEntry = registry.markReady(handle, secondMaterial);
    const materialVersion =
      prepareMetallicRoughnessTexturedStandardMaterialResource({
        registry,
        device,
        cache,
        handle,
        material: secondMaterial,
        sourceVersion: secondMaterialEntry.version,
        pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
        layout: materialLayout(),
        textures: [textureGpuResource(texture)],
        samplers: [samplerGpuResource(sampler)],
      });

    registry.markReady(
      texture,
      textureAsset({
        label: "texture-v2",
        colorSpace: "data",
        semantic: "metallic-roughness",
      }),
    );
    const textureVersion =
      prepareMetallicRoughnessTexturedStandardMaterialResource({
        registry,
        device,
        cache,
        handle,
        material: secondMaterial,
        sourceVersion: secondMaterialEntry.version,
        pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
        layout: materialLayout(),
        textures: [textureGpuResource(texture)],
        samplers: [samplerGpuResource(sampler)],
      });

    registry.markReady(sampler, createSamplerAsset({ label: "sampler-v2" }));
    const samplerVersion =
      prepareMetallicRoughnessTexturedStandardMaterialResource({
        registry,
        device,
        cache,
        handle,
        material: secondMaterial,
        sourceVersion: secondMaterialEntry.version,
        pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
        layout: materialLayout(),
        textures: [textureGpuResource(texture)],
        samplers: [samplerGpuResource(sampler)],
      });

    expect(first.status).toBe("created");
    expect(first.resource).toMatchObject({
      sourceMaterialKey: "material:metallic-standard",
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
      dependencyCacheKeySegments: [
        "metallicRoughnessTexture:texture:texture:standard-metallic-roughness@1",
        "metallicRoughnessTexture:sampler:sampler:standard-metallic-roughness-sampler@1",
      ],
      textureResourceKey: "texture:standard-metallic-roughness",
      samplerResourceKey: "sampler:standard-metallic-roughness-sampler",
    });
    expect(first.resource?.bindGroup.entryResourceKeys).toEqual([
      "material-buffer:prepared-material:material:metallic-standard",
      "texture:standard-metallic-roughness",
      "sampler:standard-metallic-roughness-sampler",
    ]);
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(materialVersion.status).toBe("created");
    expect(materialVersion.resource).not.toBe(first.resource);
    expect(textureVersion.status).toBe("created");
    expect(textureVersion.resource?.dependencyCacheKeySegments).toEqual([
      "metallicRoughnessTexture:texture:texture:standard-metallic-roughness@2",
      "metallicRoughnessTexture:sampler:sampler:standard-metallic-roughness-sampler@1",
    ]);
    expect(samplerVersion.status).toBe("created");
    expect(samplerVersion.resource?.dependencyCacheKeySegments).toEqual([
      "metallicRoughnessTexture:texture:texture:standard-metallic-roughness@2",
      "metallicRoughnessTexture:sampler:sampler:standard-metallic-roughness-sampler@2",
    ]);
    expect(createdBuffers).toHaveLength(4);
    expect(createdBindGroups).toHaveLength(4);
  });

  it("keeps scalar, base-color, and multi-texture StandardMaterial variants out of the metallic-roughness cache", () => {
    const baseColorTexture = createTextureHandle("base-color");
    const baseColorSampler = createSamplerHandle("base-color-sampler");
    const metallicRoughnessTexture = createTextureHandle("metallic-roughness");
    const metallicRoughnessSampler = createSamplerHandle(
      "metallic-roughness-sampler",
    );
    const cache = createPreparedScalarStandardMaterialCache();

    const scalar = prepareMetallicRoughnessTexturedStandardMaterialResource({
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
    const baseColorOnly =
      prepareMetallicRoughnessTexturedStandardMaterialResource({
        registry: new AssetRegistry(),
        device: deviceWithResources([], []),
        cache,
        handle: createMaterialHandle("base-color"),
        material: createStandardMaterialAsset({
          baseColorTexture: {
            texture: baseColorTexture,
            sampler: baseColorSampler,
          },
        }),
        sourceVersion: 1,
        pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
        layout: materialLayout(),
        textures: [],
        samplers: [],
      });
    const multiTexture =
      prepareMetallicRoughnessTexturedStandardMaterialResource({
        registry: new AssetRegistry(),
        device: deviceWithResources([], []),
        cache,
        handle: createMaterialHandle("multi-texture"),
        material: createStandardMaterialAsset({
          baseColorTexture: {
            texture: baseColorTexture,
            sampler: baseColorSampler,
          },
          metallicRoughnessTexture: {
            texture: metallicRoughnessTexture,
            sampler: metallicRoughnessSampler,
          },
        }),
        sourceVersion: 1,
        pipelineKey:
          "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none",
        layout: materialLayout(),
        textures: [],
        samplers: [],
      });

    expect(scalar.status).toBe("skipped");
    expect(scalar.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedMetallicRoughnessTexturedStandardMaterial.notMetallicRoughnessTextured",
        materialKey: "material:scalar",
      }),
    ]);
    expect(baseColorOnly.status).toBe("skipped");
    expect(baseColorOnly.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedMetallicRoughnessTexturedStandardMaterial.notMetallicRoughnessTextured",
        materialKey: "material:base-color",
      }),
    ]);
    expect(multiTexture.status).toBe("skipped");
    expect(multiTexture.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedMetallicRoughnessTexturedStandardMaterial.notMetallicRoughnessTextured",
        materialKey: "material:multi-texture",
      }),
    ]);
  });
});

describe("normal textured StandardMaterial prepared material cache", () => {
  it("creates, reuses, and invalidates normal group-2 prepared resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: StandardMaterialBindGroupCreationDescriptor[] = [];
    const registry = new AssetRegistry();
    const cache = createPreparedScalarStandardMaterialCache();
    const handle = createMaterialHandle("normal-standard");
    const texture = createTextureHandle("standard-normal");
    const sampler = createSamplerHandle("standard-normal-sampler");
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(texture);
    registry.register(sampler);
    registry.register(handle);
    registry.markReady(
      texture,
      textureAsset({
        label: "texture-v1",
        colorSpace: "data",
        semantic: "normal",
      }),
    );
    registry.markReady(sampler, createSamplerAsset({ label: "sampler-v1" }));
    const firstMaterial = createStandardMaterialAsset({
      label: "Normal Standard",
      normalTexture: { texture, sampler },
    });
    const firstMaterialEntry = registry.markReady(handle, firstMaterial);

    const first = prepareNormalTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: firstMaterial,
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });
    const second = prepareNormalTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: firstMaterial,
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });
    const secondMaterial = createStandardMaterialAsset({
      label: "Normal Standard Updated",
      normalScale: 0.5,
      normalTexture: { texture, sampler },
    });
    const secondMaterialEntry = registry.markReady(handle, secondMaterial);
    const materialVersion = prepareNormalTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: secondMaterial,
      sourceVersion: secondMaterialEntry.version,
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });

    registry.markReady(
      texture,
      textureAsset({
        label: "texture-v2",
        colorSpace: "data",
        semantic: "normal",
      }),
    );
    const textureVersion = prepareNormalTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: secondMaterial,
      sourceVersion: secondMaterialEntry.version,
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });

    registry.markReady(sampler, createSamplerAsset({ label: "sampler-v2" }));
    const samplerVersion = prepareNormalTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle,
      material: secondMaterial,
      sourceVersion: secondMaterialEntry.version,
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(texture)],
      samplers: [samplerGpuResource(sampler)],
    });

    expect(first.status).toBe("created");
    expect(first.resource).toMatchObject({
      sourceMaterialKey: "material:normal-standard",
      sourceVersion: firstMaterialEntry.version,
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
      dependencyCacheKeySegments: [
        "normalTexture:texture:texture:standard-normal@1",
        "normalTexture:sampler:sampler:standard-normal-sampler@1",
      ],
      textureResourceKey: "texture:standard-normal",
      samplerResourceKey: "sampler:standard-normal-sampler",
    });
    expect(first.resource?.bindGroup.entryResourceKeys).toEqual([
      "material-buffer:prepared-material:material:normal-standard",
      "texture:standard-normal",
      "sampler:standard-normal-sampler",
    ]);
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(materialVersion.status).toBe("created");
    expect(materialVersion.resource).not.toBe(first.resource);
    expect(textureVersion.status).toBe("created");
    expect(textureVersion.resource?.dependencyCacheKeySegments).toEqual([
      "normalTexture:texture:texture:standard-normal@2",
      "normalTexture:sampler:sampler:standard-normal-sampler@1",
    ]);
    expect(samplerVersion.status).toBe("created");
    expect(samplerVersion.resource?.dependencyCacheKeySegments).toEqual([
      "normalTexture:texture:texture:standard-normal@2",
      "normalTexture:sampler:sampler:standard-normal-sampler@2",
    ]);
    expect(createdBuffers).toHaveLength(4);
    expect(createdBindGroups).toHaveLength(4);
  });

  it("keeps scalar and multi-texture StandardMaterial variants out of the normal cache", () => {
    const normalTexture = createTextureHandle("normal");
    const normalSampler = createSamplerHandle("normal-sampler");
    const emissiveTexture = createTextureHandle("emissive");
    const emissiveSampler = createSamplerHandle("emissive-sampler");
    const cache = createPreparedScalarStandardMaterialCache();

    const scalar = prepareNormalTexturedStandardMaterialResource({
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
    const multiTexture = prepareNormalTexturedStandardMaterialResource({
      registry: new AssetRegistry(),
      device: deviceWithResources([], []),
      cache,
      handle: createMaterialHandle("multi-texture"),
      material: createStandardMaterialAsset({
        normalTexture: { texture: normalTexture, sampler: normalSampler },
        emissiveTexture: { texture: emissiveTexture, sampler: emissiveSampler },
      }),
      sourceVersion: 1,
      pipelineKey:
        "standard|normalTexture|emissiveTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [],
      samplers: [],
    });

    expect(scalar.status).toBe("skipped");
    expect(scalar.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedNormalTexturedStandardMaterial.notNormalTextured",
        materialKey: "material:scalar",
      }),
    ]);
    expect(multiTexture.status).toBe("skipped");
    expect(multiTexture.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedNormalTexturedStandardMaterial.notNormalTextured",
        materialKey: "material:multi-texture",
      }),
    ]);
  });
});

describe("occlusion/emissive textured StandardMaterial prepared material cache", () => {
  it("creates and reuses occlusion-only, emissive-only, and combined group-2 prepared resources", () => {
    const createdBuffers: unknown[] = [];
    const createdBindGroups: StandardMaterialBindGroupCreationDescriptor[] = [];
    const registry = new AssetRegistry();
    const cache = createPreparedScalarStandardMaterialCache();
    const occlusionHandle = createMaterialHandle("occlusion-standard");
    const emissiveHandle = createMaterialHandle("emissive-standard");
    const combinedHandle = createMaterialHandle("occlusion-emissive-standard");
    const occlusionTexture = createTextureHandle("standard-occlusion");
    const occlusionSampler = createSamplerHandle("standard-occlusion-sampler");
    const emissiveTexture = createTextureHandle("standard-emissive");
    const emissiveSampler = createSamplerHandle("standard-emissive-sampler");
    const device = deviceWithResources(createdBuffers, createdBindGroups);

    registry.register(occlusionTexture);
    registry.register(occlusionSampler);
    registry.register(emissiveTexture);
    registry.register(emissiveSampler);
    registry.markReady(
      occlusionTexture,
      textureAsset({
        label: "occlusion",
        colorSpace: "data",
        semantic: "occlusion",
      }),
    );
    registry.markReady(
      occlusionSampler,
      createSamplerAsset({ label: "occlusion-sampler" }),
    );
    registry.markReady(
      emissiveTexture,
      textureAsset({
        label: "emissive",
        semantic: "emissive",
      }),
    );
    registry.markReady(
      emissiveSampler,
      createSamplerAsset({ label: "emissive-sampler" }),
    );

    const occlusionMaterial = createStandardMaterialAsset({
      label: "Occlusion Standard",
      occlusionTexture: {
        texture: occlusionTexture,
        sampler: occlusionSampler,
      },
    });
    const emissiveMaterial = createStandardMaterialAsset({
      label: "Emissive Standard",
      emissiveTexture: { texture: emissiveTexture, sampler: emissiveSampler },
    });
    const combinedMaterial = createStandardMaterialAsset({
      label: "Occlusion Emissive Standard",
      occlusionTexture: {
        texture: occlusionTexture,
        sampler: occlusionSampler,
      },
      emissiveTexture: { texture: emissiveTexture, sampler: emissiveSampler },
    });
    registry.register(occlusionHandle);
    registry.register(emissiveHandle);
    registry.register(combinedHandle);
    const occlusionEntry = registry.markReady(
      occlusionHandle,
      occlusionMaterial,
    );
    const emissiveEntry = registry.markReady(emissiveHandle, emissiveMaterial);
    const combinedEntry = registry.markReady(combinedHandle, combinedMaterial);

    const occlusion = prepareOcclusionEmissiveTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle: occlusionHandle,
      material: occlusionMaterial,
      sourceVersion: occlusionEntry.version,
      pipelineKey: "standard|occlusionTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(occlusionTexture)],
      samplers: [samplerGpuResource(occlusionSampler)],
    });
    const emissive = prepareOcclusionEmissiveTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle: emissiveHandle,
      material: emissiveMaterial,
      sourceVersion: emissiveEntry.version,
      pipelineKey: "standard|emissiveTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [textureGpuResource(emissiveTexture)],
      samplers: [samplerGpuResource(emissiveSampler)],
    });
    const combined = prepareOcclusionEmissiveTexturedStandardMaterialResource({
      registry,
      device,
      cache,
      handle: combinedHandle,
      material: combinedMaterial,
      sourceVersion: combinedEntry.version,
      pipelineKey:
        "standard|emissiveTexture|occlusionTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [
        textureGpuResource(occlusionTexture),
        textureGpuResource(emissiveTexture),
      ],
      samplers: [
        samplerGpuResource(occlusionSampler),
        samplerGpuResource(emissiveSampler),
      ],
    });
    const combinedAgain =
      prepareOcclusionEmissiveTexturedStandardMaterialResource({
        registry,
        device,
        cache,
        handle: combinedHandle,
        material: combinedMaterial,
        sourceVersion: combinedEntry.version,
        pipelineKey:
          "standard|emissiveTexture|occlusionTexture|opaque|back|less|none",
        layout: materialLayout(),
        textures: [
          textureGpuResource(occlusionTexture),
          textureGpuResource(emissiveTexture),
        ],
        samplers: [
          samplerGpuResource(occlusionSampler),
          samplerGpuResource(emissiveSampler),
        ],
      });

    expect(occlusion.status).toBe("created");
    expect(occlusion.resource?.textureResourceKeys).toEqual([
      "texture:standard-occlusion",
    ]);
    expect(emissive.status).toBe("created");
    expect(emissive.resource?.textureResourceKeys).toEqual([
      "texture:standard-emissive",
    ]);
    expect(combined.status).toBe("created");
    expect(combined.resource?.dependencyCacheKeySegments).toEqual([
      "occlusionTexture:texture:texture:standard-occlusion@1",
      "occlusionTexture:sampler:sampler:standard-occlusion-sampler@1",
      "emissiveTexture:texture:texture:standard-emissive@1",
      "emissiveTexture:sampler:sampler:standard-emissive-sampler@1",
    ]);
    expect(combined.resource?.bindGroup.entryResourceKeys).toEqual([
      "material-buffer:prepared-material:material:occlusion-emissive-standard",
      "texture:standard-occlusion",
      "sampler:standard-occlusion-sampler",
      "texture:standard-emissive",
      "sampler:standard-emissive-sampler",
    ]);
    expect(combinedAgain.status).toBe("reused");
    expect(combinedAgain.resource).toBe(combined.resource);
    expect(createdBuffers).toHaveLength(3);
    expect(createdBindGroups).toHaveLength(3);
  });

  it("keeps scalar and non-occlusion/emissive StandardMaterial variants out of the occlusion/emissive cache", () => {
    const normalTexture = createTextureHandle("normal");
    const normalSampler = createSamplerHandle("normal-sampler");
    const occlusionTexture = createTextureHandle("occlusion");
    const occlusionSampler = createSamplerHandle("occlusion-sampler");
    const cache = createPreparedScalarStandardMaterialCache();

    const scalar = prepareOcclusionEmissiveTexturedStandardMaterialResource({
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
    const mixed = prepareOcclusionEmissiveTexturedStandardMaterialResource({
      registry: new AssetRegistry(),
      device: deviceWithResources([], []),
      cache,
      handle: createMaterialHandle("mixed"),
      material: createStandardMaterialAsset({
        normalTexture: { texture: normalTexture, sampler: normalSampler },
        occlusionTexture: {
          texture: occlusionTexture,
          sampler: occlusionSampler,
        },
      }),
      sourceVersion: 1,
      pipelineKey:
        "standard|normalTexture|occlusionTexture|opaque|back|less|none",
      layout: materialLayout(),
      textures: [],
      samplers: [],
    });

    expect(scalar.status).toBe("skipped");
    expect(scalar.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedOcclusionEmissiveTexturedStandardMaterial.notOcclusionEmissiveTextured",
        materialKey: "material:scalar",
      }),
    ]);
    expect(mixed.status).toBe("skipped");
    expect(mixed.diagnostics).toEqual([
      expect.objectContaining({
        code: "preparedOcclusionEmissiveTexturedStandardMaterial.notOcclusionEmissiveTextured",
        materialKey: "material:mixed",
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
