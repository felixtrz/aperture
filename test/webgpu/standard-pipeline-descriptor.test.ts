import { describe, expect, it } from "vitest";

import {
  STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
  STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT,
  STANDARD_DIRECT_LIGHT_SHADER_VARIANT,
  STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT,
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
