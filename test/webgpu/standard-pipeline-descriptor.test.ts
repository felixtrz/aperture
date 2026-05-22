import { describe, expect, it } from "vitest";

import {
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT,
  STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT,
  STANDARD_DIFFUSE_IBL_SHADER_VARIANT,
  STANDARD_DIRECT_LIGHT_SHADER_VARIANT,
  STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
  STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT,
  createStandardPipelineDescriptorPlan,
  createStandardPipelineShaderFeaturePlan,
  createUnlitPipelineDescriptorPlan,
  type BatchCompatibilityKey,
  type BuiltInShaderSourceModule,
} from "@aperture-engine/webgpu";

const STANDARD_BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "standard|opaque|back|less|none",
  materialKey: "material:standard-gold",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

const UNLIT_BATCH_KEY: BatchCompatibilityKey = {
  ...STANDARD_BATCH_KEY,
  pipelineKey: "unlit|opaque|back|less|none",
  materialKey: "material:white",
};

const ALPHA_BLEND_STATE = {
  color: {
    srcFactor: "src-alpha",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
};

describe("standard material pipeline descriptor planning", () => {
  it("creates descriptor-like data and a cache key for the direct-lit standard pipeline", () => {
    const result = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: STANDARD_BATCH_KEY,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor).toMatchObject({
      label: "aperture/standard-mesh:bgra8unorm:triangle-list",
      layout: "auto",
      vertex: {
        moduleLabel: "aperture/standard-mesh",
        entryPoint: "vs_main",
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh",
        entryPoint: "fs_main",
        targets: [{ format: "bgra8unorm" }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
        frontFace: "ccw",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    expect(JSON.parse(required(result.plan).cacheKey) as unknown).toMatchObject(
      {
        shader: {
          label: "aperture/standard-mesh",
          family: "standard",
          variantKey: STANDARD_DIRECT_LIGHT_SHADER_VARIANT,
        },
        targets: {
          colorFormats: ["bgra8unorm"],
          depthFormat: "depth24plus",
          stencilFormat: null,
        },
        layouts: {
          vertex: "primitive-interleaved",
          bindGroups: [
            "standard/group-0:view-uniform@0",
            "standard/group-1:world-transforms@0",
            "standard/group-2:material@0",
            "lights/group-3:light-floats@0,light-metadata@1",
          ],
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "back",
          frontFace: "ccw",
          stripIndexFormat: null,
        },
        material: {
          pipelineKey: "standard|opaque|back|less|none",
          variantKey: "material:standard-gold",
        },
        batch: STANDARD_BATCH_KEY,
      },
    );
  });

  it("distinguishes standard pipeline cache keys from unlit", () => {
    const standard = required(
      createStandardPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        batchKey: STANDARD_BATCH_KEY,
      }).plan,
    );
    const unlit = required(
      createUnlitPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        batchKey: UNLIT_BATCH_KEY,
      }).plan,
    );

    expect(standard.cacheKey).not.toBe(unlit.cacheKey);
    expect(JSON.parse(standard.cacheKey) as unknown).toMatchObject({
      shader: {
        family: "standard",
        variantKey: "direct-lit-metallic-roughness",
      },
    });
    expect(JSON.parse(unlit.cacheKey) as unknown).toMatchObject({
      shader: { family: "unlit" },
    });
  });

  it("recognizes the instance tint StandardMaterial pipeline feature", () => {
    const featurePlan = createStandardPipelineShaderFeaturePlan({
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|instance-tint|opaque|back|less|none",
    });
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|instance-tint|opaque|back|less|none",
      },
    });

    expect(featurePlan.features.instanceTint).toBe(true);
    expect(featurePlan.variantKey).toContain("instance-tint");
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor.vertex).toMatchObject({
      buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "INSTANCE_TINT"],
    });
  });

  it("selects the cascaded shadow shader and array-depth bind-group layout", () => {
    const batchKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|shadowMap|cascadedShadowMap|opaque|back|less|none",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey,
    });

    expect(featurePlan.features).toMatchObject({
      shadowMap: true,
      cascadedShadowMap: true,
    });
    expect(featurePlan.variantKey).toBe(
      STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT,
    );
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      layouts: {
        bindGroups: expect.arrayContaining([
          expect.stringContaining(
            STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY,
          ),
        ]),
      },
    });
  });

  it("recognizes the morphed StandardMaterial pipeline feature", () => {
    const featurePlan = createStandardPipelineShaderFeaturePlan({
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|morphed|opaque|back|less|none",
      meshLayoutKey:
        "POSITION,NORMAL,TEXCOORD_0,MORPH_POSITION_0,MORPH_NORMAL_0,MORPH_POSITION_1,MORPH_NORMAL_1",
      morphed: true,
    });

    expect(featurePlan.features.morphed).toBe(true);
    expect(featurePlan.morphedEnabled).toBe(true);
    expect(featurePlan.morphTargets).toEqual({
      enabled: true,
      positionAttributeSemantics: ["MORPH_POSITION_0", "MORPH_POSITION_1"],
      normalAttributeSemantics: ["MORPH_NORMAL_0", "MORPH_NORMAL_1"],
    });
    expect(featurePlan.variantKey).toContain("morphed");
  });

  it("derives cache keys and descriptor render state from standard alpha, depth, and cull tokens", () => {
    const opaque = required(
      createStandardPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        depthFormat: "depth24plus",
        batchKey: STANDARD_BATCH_KEY,
      }).plan,
    );
    const maskBatchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|mask|front|less-equal|none",
      materialKey: "material:standard-cutout",
    };
    const mask = required(
      createStandardPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        depthFormat: "depth24plus",
        batchKey: maskBatchKey,
      }).plan,
    );
    const alphaBlendBatchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|blend|none|less|alpha",
      materialKey: "material:standard-glass",
    };
    const alphaBlend = required(
      createStandardPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        depthFormat: "depth24plus",
        batchKey: alphaBlendBatchKey,
      }).plan,
    );

    expect(opaque.cacheKey).not.toBe(mask.cacheKey);
    expect(mask.cacheKey).not.toBe(alphaBlend.cacheKey);
    expect(opaque.descriptor).toMatchObject({
      fragment: { targets: [{ format: "bgra8unorm" }] },
      primitive: { cullMode: "back" },
      depthStencil: { depthWriteEnabled: true, depthCompare: "less" },
    });
    expect(JSON.parse(opaque.cacheKey) as unknown).toMatchObject({
      primitive: { cullMode: "back" },
      depthStencil: { depthWriteEnabled: true, depthCompare: "less" },
      blend: { colorTargets: [{ blend: null }] },
    });

    expect(mask.descriptor).toMatchObject({
      fragment: { targets: [{ format: "bgra8unorm" }] },
      primitive: { cullMode: "front" },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less-equal",
      },
    });
    expect(JSON.parse(mask.cacheKey) as unknown).toMatchObject({
      primitive: { cullMode: "front" },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less-equal",
      },
      blend: { colorTargets: [{ blend: null }] },
    });

    expect(alphaBlend.descriptor).toMatchObject({
      fragment: {
        targets: [{ format: "bgra8unorm", blend: ALPHA_BLEND_STATE }],
      },
      primitive: { cullMode: "none" },
      depthStencil: { depthWriteEnabled: false, depthCompare: "less" },
    });
    expect(JSON.parse(alphaBlend.cacheKey) as unknown).toMatchObject({
      primitive: { cullMode: "none" },
      depthStencil: { depthWriteEnabled: false, depthCompare: "less" },
      blend: { colorTargets: [{ blend: ALPHA_BLEND_STATE }] },
    });
  });

  it("specializes standard texture pipeline variants", () => {
    const baseColor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      },
    });
    const metallicRoughness = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|metallicRoughnessTexture|opaque|back|less|none",
      },
    });
    const combined = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey:
          "standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none",
      },
    });

    expect(baseColor.diagnostics).toEqual([]);
    expect(baseColor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-textured:bgra8unorm:triangle-list",
      vertex: { moduleLabel: "aperture/standard-mesh-base-color-textured" },
      fragment: { moduleLabel: "aperture/standard-mesh-base-color-textured" },
    });
    expect(
      JSON.parse(required(baseColor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey: STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT,
      },
      layouts: {
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-base-color-texture@0,1,2",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
    });

    expect(metallicRoughness.diagnostics).toEqual([]);
    expect(metallicRoughness.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-metallic-roughness-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-metallic-roughness-textured",
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-metallic-roughness-textured",
      },
    });
    expect(
      JSON.parse(required(metallicRoughness.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey: STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
      },
      layouts: {
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-metallic-roughness-texture@0,3,4",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
    });

    expect(combined.diagnostics).toEqual([]);
    expect(combined.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-metallic-roughness-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel:
          "aperture/standard-mesh-base-color-metallic-roughness-textured",
      },
      fragment: {
        moduleLabel:
          "aperture/standard-mesh-base-color-metallic-roughness-textured",
      },
    });
    expect(
      JSON.parse(required(combined.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
      },
      layouts: {
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-base-color-metallic-roughness-texture@0,1,2,3,4",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
    });
  });

  it("specializes the diffuse IBL pipeline variant with a group 3 executable layout key", () => {
    const result = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|iblDiffuse|opaque|back|less|none",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor).toMatchObject({
      label: "aperture/standard-mesh-diffuse-ibl:bgra8unorm:triangle-list",
      vertex: { moduleLabel: "aperture/standard-mesh-diffuse-ibl" },
      fragment: { moduleLabel: "aperture/standard-mesh-diffuse-ibl" },
    });
    expect(JSON.parse(required(result.plan).cacheKey) as unknown).toMatchObject(
      {
        shader: {
          variantKey: STANDARD_DIFFUSE_IBL_SHADER_VARIANT,
        },
        layouts: {
          bindGroups: [
            "standard/group-0:view-uniform@0",
            "standard/group-1:world-transforms@0",
            "standard/group-2:material@0",
            "standard/lights-ibl/group-3:light-floats@0,light-metadata@1,diffuse-ibl@5,ibl-sampler@6",
          ],
        },
      },
    );
  });

  it("specializes the specular IBL proof pipeline variant with a group 3 executable layout key", () => {
    const result = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey:
          "standard|iblDiffuse|iblSpecularProof|opaque|back|less|none",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-diffuse-specular-ibl-proof:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-diffuse-specular-ibl-proof",
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-diffuse-specular-ibl-proof",
      },
    });
    expect(JSON.parse(required(result.plan).cacheKey) as unknown).toMatchObject(
      {
        shader: {
          variantKey: STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT,
        },
        layouts: {
          bindGroups: [
            "standard/group-0:view-uniform@0",
            "standard/group-1:world-transforms@0",
            "standard/group-2:material@0",
            "standard/lights-ibl/group-3:light-floats@0,light-metadata@1,diffuse-ibl@5,ibl-sampler@6,specular-ibl-proof@7",
          ],
        },
      },
    );
  });

  it("specializes emissive and occlusion texture variants without deferring them", () => {
    const result = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey:
          "standard|baseColorTexture|emissiveTexture|metallicRoughnessTexture|occlusionTexture|opaque|back|less|none",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-metallic-roughness-occlusion-emissive-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel:
          "aperture/standard-mesh-base-color-metallic-roughness-occlusion-emissive-textured",
      },
      fragment: {
        moduleLabel:
          "aperture/standard-mesh-base-color-metallic-roughness-occlusion-emissive-textured",
      },
    });
    expect(JSON.parse(required(result.plan).cacheKey) as unknown).toMatchObject(
      {
        shader: {
          variantKey:
            "direct-lit-metallic-roughness-base-color-metallic-roughness-occlusion-emissive-texture",
        },
        layouts: {
          bindGroups: [
            "standard/group-0:view-uniform@0",
            "standard/group-1:world-transforms@0",
            "standard/group-2:material-base-color-metallic-roughness-occlusion-emissive-texture@0,1,2,3,4,7,8,9,10",
            "lights/group-3:light-floats@0,light-metadata@1",
          ],
        },
      },
    );
  });

  it("specializes normal-map variants with tangent vertex attributes", () => {
    const featurePlan = createStandardPipelineShaderFeaturePlan({
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
    });
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|normalTexture|opaque|back|less|none",
      },
    });

    expect(featurePlan).toMatchObject({
      variantKey: `${STANDARD_DIRECT_LIGHT_SHADER_VARIANT}-normal-map-texture`,
      shader: { label: "aperture/standard-mesh-normal-map-textured" },
      features: {
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: true,
      },
      normalMap: {
        authored: true,
        requiresTangents: true,
        output: "tangent-space-normal-mapping",
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-normal-map-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-normal-map-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"],
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-normal-map-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey: `${STANDARD_DIRECT_LIGHT_SHADER_VARIANT}-normal-map-texture`,
      },
      layouts: {
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-normal-map-texture@0,5,6",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
    });
  });

  it("specializes metallic-roughness plus normal-map variants with tangent vertex attributes", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|metallicRoughnessTexture|normalTexture|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
      materialKey: "material:standard-metallic-normal",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey:
        "direct-lit-metallic-roughness-metallic-roughness-normal-map-texture",
      shader: {
        label: "aperture/standard-mesh-metallic-roughness-normal-map-textured",
      },
      features: {
        metallicRoughnessTexture: true,
        normalTexture: true,
      },
      normalMap: {
        authored: true,
        requiresTangents: true,
        output: "tangent-space-normal-mapping",
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-metallic-roughness-normal-map-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel:
          "aperture/standard-mesh-metallic-roughness-normal-map-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"],
      },
      fragment: {
        moduleLabel:
          "aperture/standard-mesh-metallic-roughness-normal-map-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-metallic-roughness-normal-map-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-metallic-roughness-normal-map-texture@0,3,4,5,6",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|metallicRoughnessTexture|normalTexture|opaque|back|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes occlusion plus normal-map variants with tangent vertex attributes", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|normalTexture|occlusionTexture|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
      materialKey: "material:standard-occlusion-normal",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey: "direct-lit-metallic-roughness-normal-map-occlusion-texture",
      shader: {
        label: "aperture/standard-mesh-normal-map-occlusion-textured",
      },
      features: {
        normalTexture: true,
        occlusionTexture: true,
      },
      normalMap: {
        authored: true,
        requiresTangents: true,
        output: "tangent-space-normal-mapping",
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-normal-map-occlusion-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-normal-map-occlusion-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"],
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-normal-map-occlusion-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-normal-map-occlusion-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-normal-map-occlusion-texture@0,5,6,7,8",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|normalTexture|occlusionTexture|opaque|back|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes metallic-roughness plus emissive texture variants", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
      materialKey: "material:standard-metallic-emissive",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey:
        "direct-lit-metallic-roughness-metallic-roughness-emissive-texture",
      shader: {
        label: "aperture/standard-mesh-metallic-roughness-emissive-textured",
      },
      features: {
        metallicRoughnessTexture: true,
        emissiveTexture: true,
      },
      normalMap: {
        authored: false,
        requiresTangents: false,
        output: "unchanged",
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-metallic-roughness-emissive-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel:
          "aperture/standard-mesh-metallic-roughness-emissive-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0"],
      },
      fragment: {
        moduleLabel:
          "aperture/standard-mesh-metallic-roughness-emissive-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-metallic-roughness-emissive-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-metallic-roughness-emissive-texture@0,3,4,9,10",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes base-color plus metallic-roughness plus emissive texture variants", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|baseColorTexture|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
      materialKey: "material:standard-base-metallic-emissive",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey:
        "direct-lit-metallic-roughness-base-color-metallic-roughness-emissive-texture",
      shader: {
        label:
          "aperture/standard-mesh-base-color-metallic-roughness-emissive-textured",
      },
      features: {
        baseColorTexture: true,
        metallicRoughnessTexture: true,
        emissiveTexture: true,
      },
      normalMap: {
        authored: false,
        requiresTangents: false,
        output: "unchanged",
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-metallic-roughness-emissive-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel:
          "aperture/standard-mesh-base-color-metallic-roughness-emissive-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0"],
      },
      fragment: {
        moduleLabel:
          "aperture/standard-mesh-base-color-metallic-roughness-emissive-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-base-color-metallic-roughness-emissive-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-base-color-metallic-roughness-emissive-texture@0,1,2,3,4,9,10",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|baseColorTexture|emissiveTexture|metallicRoughnessTexture|opaque|back|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes alpha-masked base-color plus metallic-roughness texture variants", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|baseColorTexture|metallicRoughnessTexture|mask|none|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
      materialKey: "material:standard-alpha-metallic",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey:
        "direct-lit-metallic-roughness-base-color-metallic-roughness-texture",
      features: {
        baseColorTexture: true,
        metallicRoughnessTexture: true,
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      fragment: { targets: [{ format: "bgra8unorm" }] },
      primitive: { cullMode: "none" },
      depthStencil: { depthWriteEnabled: true, depthCompare: "less" },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-base-color-metallic-roughness-texture@0,1,2,3,4",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|baseColorTexture|metallicRoughnessTexture|mask|none|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes alpha-blended base-color plus normal-map variants without depth writes", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|baseColorTexture|normalTexture|blend|none|less|alpha",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
      materialKey: "material:standard-alpha-blend-normal",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey: "direct-lit-metallic-roughness-base-color-normal-map-texture",
      shader: {
        label: "aperture/standard-mesh-base-color-normal-map-textured",
      },
      features: {
        baseColorTexture: true,
        normalTexture: true,
      },
      normalMap: {
        authored: true,
        requiresTangents: true,
        output: "tangent-space-normal-mapping",
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-normal-map-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-base-color-normal-map-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"],
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-base-color-normal-map-textured",
        targets: [
          {
            format: "bgra8unorm",
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        cullMode: "none",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "less",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-base-color-normal-map-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-base-color-normal-map-texture@0,1,2,5,6",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|baseColorTexture|normalTexture|blend|none|less|alpha",
      },
      batch: batchKey,
    });
  });

  it("specializes alpha-blended base-color plus emissive texture variants without depth writes", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|baseColorTexture|emissiveTexture|blend|none|less|alpha",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
      materialKey: "material:standard-alpha-blend-emissive",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey: "direct-lit-metallic-roughness-base-color-emissive-texture",
      shader: {
        label: "aperture/standard-mesh-base-color-emissive-textured",
      },
      features: {
        baseColorTexture: true,
        emissiveTexture: true,
      },
      normalMap: {
        authored: false,
        requiresTangents: false,
        output: "unchanged",
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-emissive-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-base-color-emissive-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0"],
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-base-color-emissive-textured",
        targets: [{ blend: ALPHA_BLEND_STATE }],
      },
      depthStencil: {
        depthWriteEnabled: false,
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey: "direct-lit-metallic-roughness-base-color-emissive-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-base-color-emissive-texture@0,1,2,9,10",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|baseColorTexture|emissiveTexture|blend|none|less|alpha",
      },
      batch: batchKey,
    });
  });

  it("specializes UV1 metallic-roughness plus normal-map variants", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|metallicRoughnessTexture|normalTexture|uv1|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT,TEXCOORD_1",
      materialKey: "material:standard-uv1-metallic-normal",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey:
        "direct-lit-metallic-roughness-metallic-roughness-normal-map-uv1-texture",
      shader: {
        label:
          "aperture/standard-mesh-metallic-roughness-normal-map-uv1-textured",
      },
      features: {
        metallicRoughnessTexture: true,
        normalTexture: true,
        texCoord1: true,
      },
      normalMap: {
        authored: true,
        requiresTangents: true,
        output: "tangent-space-normal-mapping",
      },
    });
    expect(featurePlan.shader.code).toContain("@location(4) uv1: vec2f");
    expect(featurePlan.shader.code).toContain(
      "standardTextureUv(material.metallicRoughnessTexCoord, input.uv, input.uv1)",
    );
    expect(featurePlan.shader.code).toContain(
      "standardTextureUv(material.normalTexCoord, input.uv, input.uv1)",
    );
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-metallic-roughness-normal-map-uv1-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel:
          "aperture/standard-mesh-metallic-roughness-normal-map-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TANGENT", "TEXCOORD_1"],
      },
      fragment: {
        moduleLabel:
          "aperture/standard-mesh-metallic-roughness-normal-map-uv1-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-metallic-roughness-normal-map-uv1-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,TANGENT,TEXCOORD_1",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-metallic-roughness-normal-map-texture@0,3,4,5,6",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|metallicRoughnessTexture|normalTexture|uv1|opaque|back|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes UV1 base-color plus occlusion texture variants", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|baseColorTexture|occlusionTexture|uv1|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
      materialKey: "material:standard-uv1-base-occlusion",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey:
        "direct-lit-metallic-roughness-base-color-occlusion-uv1-texture",
      shader: {
        label: "aperture/standard-mesh-base-color-occlusion-uv1-textured",
      },
      features: {
        baseColorTexture: true,
        occlusionTexture: true,
        texCoord1: true,
      },
    });
    expect(featurePlan.shader.code).toContain("@location(4) uv1: vec2f");
    expect(featurePlan.shader.code).toContain(
      "standardTextureUv(material.baseColorTexCoord, input.uv, input.uv1)",
    );
    expect(featurePlan.shader.code).toContain(
      "standardTextureUv(material.occlusionTexCoord, input.uv, input.uv1)",
    );
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-occlusion-uv1-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-base-color-occlusion-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TEXCOORD_1"],
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-base-color-occlusion-uv1-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-base-color-occlusion-uv1-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-base-color-occlusion-texture@0,1,2,7,8",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|baseColorTexture|occlusionTexture|uv1|opaque|back|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes UV1 base-color plus emissive texture variants", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|baseColorTexture|emissiveTexture|uv1|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
      materialKey: "material:standard-uv1-base-emissive",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey:
        "direct-lit-metallic-roughness-base-color-emissive-uv1-texture",
      shader: {
        label: "aperture/standard-mesh-base-color-emissive-uv1-textured",
      },
      features: {
        baseColorTexture: true,
        emissiveTexture: true,
        texCoord1: true,
      },
    });
    expect(featurePlan.shader.code).toContain("@location(4) uv1: vec2f");
    expect(featurePlan.shader.code).toContain(
      "standardTextureUv(material.baseColorTexCoord, input.uv, input.uv1)",
    );
    expect(featurePlan.shader.code).toContain(
      "standardTextureUv(material.emissiveTexCoord, input.uv, input.uv1)",
    );
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-emissive-uv1-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-base-color-emissive-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TEXCOORD_1"],
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-base-color-emissive-uv1-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-base-color-emissive-uv1-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-base-color-emissive-texture@0,1,2,9,10",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|baseColorTexture|emissiveTexture|uv1|opaque|back|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes UV1 metallic-roughness plus emissive texture variants", () => {
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey:
        "standard|emissiveTexture|metallicRoughnessTexture|uv1|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
      materialKey: "material:standard-uv1-metallic-emissive",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey:
        "direct-lit-metallic-roughness-metallic-roughness-emissive-uv1-texture",
      shader: {
        label:
          "aperture/standard-mesh-metallic-roughness-emissive-uv1-textured",
      },
      features: {
        metallicRoughnessTexture: true,
        emissiveTexture: true,
        texCoord1: true,
      },
    });
    expect(featurePlan.shader.code).toContain("@location(4) uv1: vec2f");
    expect(featurePlan.shader.code).toContain(
      "standardTextureUv(material.metallicRoughnessTexCoord, input.uv, input.uv1)",
    );
    expect(featurePlan.shader.code).toContain(
      "standardTextureUv(material.emissiveTexCoord, input.uv, input.uv1)",
    );
    expect(descriptor.diagnostics).toEqual([]);
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey:
          "direct-lit-metallic-roughness-metallic-roughness-emissive-uv1-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
        bindGroups: [
          "standard/group-0:view-uniform@0",
          "standard/group-1:world-transforms@0",
          "standard/group-2:material-metallic-roughness-emissive-texture@0,3,4,9,10",
          "lights/group-3:light-floats@0,light-metadata@1",
        ],
      },
      material: {
        pipelineKey:
          "standard|emissiveTexture|metallicRoughnessTexture|uv1|opaque|back|less|none",
      },
      batch: batchKey,
    });
  });

  it("specializes vertex-color variants from COLOR_0 mesh layout", () => {
    const batchKey = {
      ...STANDARD_BATCH_KEY,
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
      materialKey: "material:standard-vertex-color",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey: `${STANDARD_DIRECT_LIGHT_SHADER_VARIANT}-vertex-color-texture`,
      shader: {
        label: "aperture/standard-mesh-vertex-color-textured",
      },
      features: {
        vertexColor: true,
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-vertex-color-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-vertex-color-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0"],
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-vertex-color-textured",
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey: `${STANDARD_DIRECT_LIGHT_SHADER_VARIANT}-vertex-color-texture`,
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
      },
      batch: batchKey,
    });
  });

  it("specializes textured vertex-color variants from material and mesh layout", () => {
    const batchKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|baseColorTexture|opaque|none|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
      materialKey: "material:standard-textured-vertex-color",
    };
    const featurePlan = createStandardPipelineShaderFeaturePlan(batchKey);
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey,
    });

    expect(featurePlan).toMatchObject({
      variantKey: `${STANDARD_DIRECT_LIGHT_SHADER_VARIANT}-base-color-vertex-color-texture`,
      shader: {
        label: "aperture/standard-mesh-base-color-vertex-color-textured",
      },
      features: {
        baseColorTexture: true,
        vertexColor: true,
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      label:
        "aperture/standard-mesh-base-color-vertex-color-textured:bgra8unorm:triangle-list",
      vertex: {
        moduleLabel: "aperture/standard-mesh-base-color-vertex-color-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0"],
      },
      fragment: {
        moduleLabel: "aperture/standard-mesh-base-color-vertex-color-textured",
      },
    });
  });

  it("specializes TEXCOORD_1 variants with UV1 vertex attributes", () => {
    const featurePlan = createStandardPipelineShaderFeaturePlan({
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|baseColorTexture|uv1|opaque|back|less|none",
    });
    const descriptor = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|baseColorTexture|uv1|opaque|back|less|none",
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
      },
    });

    expect(featurePlan).toMatchObject({
      variantKey: "direct-lit-metallic-roughness-base-color-uv1-texture",
      shader: { label: "aperture/standard-mesh-base-color-uv1-textured" },
      features: {
        baseColorTexture: true,
        texCoord1: true,
      },
    });
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan?.descriptor).toMatchObject({
      vertex: {
        moduleLabel: "aperture/standard-mesh-base-color-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TEXCOORD_1"],
      },
    });
    expect(
      JSON.parse(required(descriptor.plan).cacheKey) as unknown,
    ).toMatchObject({
      shader: {
        variantKey: "direct-lit-metallic-roughness-base-color-uv1-texture",
      },
      layouts: {
        vertex: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
      },
      material: {
        pipelineKey: "standard|baseColorTexture|uv1|opaque|back|less|none",
      },
    });
  });

  it("selects UV1 shader features for every StandardMaterial texture field", () => {
    const cases = [
      {
        token: "baseColorTexture",
        feature: "baseColorTexture",
        uniformField: "baseColor",
        variantKey: "direct-lit-metallic-roughness-base-color-uv1-texture",
        label: "aperture/standard-mesh-base-color-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TEXCOORD_1"],
      },
      {
        token: "metallicRoughnessTexture",
        feature: "metallicRoughnessTexture",
        uniformField: "metallicRoughness",
        variantKey:
          "direct-lit-metallic-roughness-metallic-roughness-uv1-texture",
        label: "aperture/standard-mesh-metallic-roughness-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TEXCOORD_1"],
      },
      {
        token: "normalTexture",
        feature: "normalTexture",
        uniformField: "normal",
        variantKey: "direct-lit-metallic-roughness-normal-map-uv1-texture",
        label: "aperture/standard-mesh-normal-map-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TANGENT", "TEXCOORD_1"],
      },
      {
        token: "occlusionTexture",
        feature: "occlusionTexture",
        uniformField: "occlusion",
        variantKey: "direct-lit-metallic-roughness-occlusion-uv1-texture",
        label: "aperture/standard-mesh-occlusion-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TEXCOORD_1"],
      },
      {
        token: "emissiveTexture",
        feature: "emissiveTexture",
        uniformField: "emissive",
        variantKey: "direct-lit-metallic-roughness-emissive-uv1-texture",
        label: "aperture/standard-mesh-emissive-uv1-textured",
        buffers: ["POSITION", "NORMAL", "TEXCOORD_0", "TEXCOORD_1"],
      },
    ] as const;

    for (const variant of cases) {
      const pipelineKey = `standard|${variant.token}|uv1|opaque|back|less|none`;
      const featurePlan = createStandardPipelineShaderFeaturePlan({
        ...STANDARD_BATCH_KEY,
        pipelineKey,
      });
      const descriptor = createStandardPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        batchKey: {
          ...STANDARD_BATCH_KEY,
          pipelineKey,
          meshLayoutKey: variant.buffers.join(","),
        },
      });

      expect(featurePlan.variantKey).toBe(variant.variantKey);
      expect(featurePlan.shader.label).toBe(variant.label);
      expect(featurePlan.features).toMatchObject({
        [variant.feature]: true,
        texCoord1: true,
      });
      expect(featurePlan.shader.code).toContain(
        `standardTextureUv(material.${variant.uniformField}TexCoord, input.uv, input.uv1)`,
      );
      expect(descriptor.diagnostics).toEqual([]);
      expect(descriptor.plan?.descriptor).toMatchObject({
        vertex: { buffers: variant.buffers },
      });
      expect(
        JSON.parse(required(descriptor.plan).cacheKey) as unknown,
      ).toMatchObject({
        shader: { variantKey: variant.variantKey },
        layouts: { vertex: variant.buffers.join(",") },
        material: { pipelineKey },
      });
    }
  });

  it("diagnoses invalid metadata, missing color format, and non-standard batch keys", () => {
    const invalidShader: BuiltInShaderSourceModule = {
      label: "",
      code: "",
      entryPoints: { vertex: "", fragment: "" },
      bindings: [],
    };
    const result = createStandardPipelineDescriptorPlan({
      shader: invalidShader,
      colorFormat: "",
      batchKey: {
        pipelineKey: "unlit|opaque|back|less|none",
        materialKey: "",
        meshLayoutKey: "",
      } as unknown as BatchCompatibilityKey,
    });

    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingShaderMetadata",
      "standardPipeline.missingColorFormat",
      "standardPipeline.unsupportedTopology",
      "standardPipeline.missingBatchKeyField",
      "standardPipeline.missingBatchKeyField",
      "standardPipeline.missingBatchKeyField",
      "standardPipeline.unsupportedShaderFamily",
    ]);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
