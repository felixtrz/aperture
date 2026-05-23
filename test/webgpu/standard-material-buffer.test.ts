import { describe, expect, it } from "vitest";

import type { MaterialTextureTransform } from "@aperture-engine/render";
import {
  DEFAULT_STANDARD_MATERIAL_BUFFER_USAGE,
  STANDARD_MATERIAL_FEATURE_FLAGS,
  STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH,
  STANDARD_MATERIAL_UNIFORM_FLOATS,
  STANDARD_MATERIAL_UNIFORM_LAYOUT,
  createSamplerHandle,
  createStandardMaterialAsset,
  createStandardMaterialBufferDescriptor,
  createStandardMaterialPreparationPlan,
  createTextureHandle,
  createUnlitMaterialAsset,
  packStandardMaterial,
  type PackedStandardMaterial,
} from "@aperture-engine/webgpu";

describe("standard material WebGPU uniform packing", () => {
  it("packs scalar proof-point fields into the documented uniform layout", () => {
    const material = createStandardMaterialAsset({
      baseColorFactor: new Float32Array([0.2, 0.4, 0.6, 0.8]),
      metallicFactor: 0.25,
      roughnessFactor: 0.75,
      clearcoatFactor: 0.85,
      clearcoatRoughnessFactor: 0.12,
      transmissionFactor: 0.65,
      sheenColorFactor: [0.9, 0.4, 0.15],
      sheenRoughnessFactor: 0.35,
      iridescenceFactor: 0.95,
      iridescenceIor: 1.38,
      iridescenceThicknessMinimum: 130,
      iridescenceThicknessMaximum: 510,
      normalScale: 0.5,
      occlusionStrength: 0.9,
      emissiveFactor: [0.1, 0.2, 0.3],
      renderState: {
        alphaMode: "mask",
        alphaCutoff: 0.42,
        cullMode: "none",
      },
    });
    const result = packStandardMaterial(material);

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.packed?.uniformLayout).toBe(STANDARD_MATERIAL_UNIFORM_LAYOUT);
    expect(result.packed?.uniform.byteLength).toBe(
      STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH,
    );
    expect(result.packed?.uniformFloat32.length).toBe(
      STANDARD_MATERIAL_UNIFORM_FLOATS,
    );
    expect(
      Array.from(result.packed?.uniformFloat32.slice(0, 12) ?? []),
    ).toEqual([
      expect.closeTo(0.2, 5),
      expect.closeTo(0.4, 5),
      expect.closeTo(0.6, 5),
      expect.closeTo(0.8, 5),
      expect.closeTo(0.1, 5),
      expect.closeTo(0.2, 5),
      expect.closeTo(0.3, 5),
      expect.closeTo(0.25, 5),
      expect.closeTo(0.75, 5),
      expect.closeTo(0.5, 5),
      expect.closeTo(0.9, 5),
      expect.closeTo(0.42, 5),
    ]);
    expect(result.packed?.uniformUint32[12]).toBe(
      STANDARD_MATERIAL_FEATURE_FLAGS.ALPHA_MASK |
        STANDARD_MATERIAL_FEATURE_FLAGS.DOUBLE_SIDED,
    );
    expect(result.packed?.uniformFloat32[48]).toBeCloseTo(0.85);
    expect(result.packed?.uniformFloat32[49]).toBeCloseTo(0.12);
    expect(result.packed?.uniformFloat32[50]).toBeCloseTo(0.65);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(52, 56) ?? []),
    ).toEqual([
      expect.closeTo(0.9, 5),
      expect.closeTo(0.4, 5),
      expect.closeTo(0.15, 5),
      expect.closeTo(0.35, 5),
    ]);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(56, 60) ?? []),
    ).toEqual([
      expect.closeTo(0.95, 5),
      expect.closeTo(1.38, 5),
      expect.closeTo(130, 5),
      expect.closeTo(510, 5),
    ]);
  });

  it("records texture dependencies and feature flags without raw handles", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        baseColorTexture: textureBinding("base", "base-sampler", 1),
        metallicRoughnessTexture: textureBinding("mr", "mr-sampler", 2),
        normalTexture: textureBinding("normal", "normal-sampler", 3),
        occlusionTexture: textureBinding("ao", "ao-sampler", 4),
        emissiveTexture: textureBinding("emissive", "emissive-sampler", 5),
        clearcoatTexture: textureBinding("clearcoat", "clearcoat-sampler", 1),
        transmissionTexture: textureBinding(
          "transmission",
          "transmission-sampler",
          1,
        ),
        sheenColorTexture: textureBinding("sheen", "sheen-sampler", 1),
        sheenRoughnessTexture: textureBinding(
          "sheen-roughness",
          "sheen-roughness-sampler",
          1,
        ),
        iridescenceTexture: textureBinding(
          "iridescence",
          "iridescence-sampler",
          1,
        ),
        iridescenceThicknessTexture: textureBinding(
          "iridescence-thickness",
          "iridescence-thickness-sampler",
          1,
        ),
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.packed?.featureFlags).toBe(
      STANDARD_MATERIAL_FEATURE_FLAGS.BASE_COLOR_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.METALLIC_ROUGHNESS_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.NORMAL_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.OCCLUSION_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.EMISSIVE_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.CLEARCOAT_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.TRANSMISSION_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.SHEEN_COLOR_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.SHEEN_ROUGHNESS_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.IRIDESCENCE_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.IRIDESCENCE_THICKNESS_TEXTURE,
    );
    expect(result.packed?.dependencies).toEqual({
      baseColor: {
        textureKey: "texture:base",
        samplerKey: "sampler:base-sampler",
        texCoord: 1,
      },
      metallicRoughness: {
        textureKey: "texture:mr",
        samplerKey: "sampler:mr-sampler",
        texCoord: 2,
      },
      normal: {
        textureKey: "texture:normal",
        samplerKey: "sampler:normal-sampler",
        texCoord: 3,
      },
      occlusion: {
        textureKey: "texture:ao",
        samplerKey: "sampler:ao-sampler",
        texCoord: 4,
      },
      emissive: {
        textureKey: "texture:emissive",
        samplerKey: "sampler:emissive-sampler",
        texCoord: 5,
      },
      clearcoat: {
        textureKey: "texture:clearcoat",
        samplerKey: "sampler:clearcoat-sampler",
        texCoord: 1,
      },
      transmission: {
        textureKey: "texture:transmission",
        samplerKey: "sampler:transmission-sampler",
        texCoord: 1,
      },
      sheenColor: {
        textureKey: "texture:sheen",
        samplerKey: "sampler:sheen-sampler",
        texCoord: 1,
      },
      sheenRoughness: {
        textureKey: "texture:sheen-roughness",
        samplerKey: "sampler:sheen-roughness-sampler",
        texCoord: 1,
      },
      iridescence: {
        textureKey: "texture:iridescence",
        samplerKey: "sampler:iridescence-sampler",
        texCoord: 1,
      },
      iridescenceThickness: {
        textureKey: "texture:iridescence-thickness",
        samplerKey: "sampler:iridescence-thickness-sampler",
        texCoord: 1,
      },
    });
    expect(
      Array.from(result.packed?.uniformUint32.slice(13, 18) ?? []),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(result.packed?.uniformUint32[51]).toBe(1);
    expect(result.packed?.uniformUint32[60]).toBe(1);
    expect(result.packed?.uniformUint32[61]).toBe(1);
    expect(result.packed?.uniformUint32[62]).toBe(1);
    expect(result.packed?.uniformUint32[63]).toBe(1);
    expect(result.packed?.uniformUint32[64]).toBe(1);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(18, 22) ?? []),
    ).toEqual([0, 0, 1, 1]);
    expect(result.packed?.uniformFloat32[22]).toBe(0);
  });

  it("packs base-color texture offset, scale, and rotation for shader sampling", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        baseColorTexture: textureBinding("base", "base-sampler", 0, {
          offset: [0.25, 0.5],
          rotation: Math.PI / 2,
          scale: [0.5, 2],
        }),
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(18, 22) ?? []),
    ).toEqual([
      expect.closeTo(0.25, 5),
      expect.closeTo(0.5, 5),
      expect.closeTo(0.5, 5),
      expect.closeTo(2, 5),
    ]);
    expect(result.packed?.uniformFloat32[22]).toBeCloseTo(Math.PI / 2);
  });

  it("packs metallic-roughness texture transforms for shader sampling", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        metallicRoughnessTexture: textureBinding("mr", "mr-sampler", 0, {
          offset: [0.125, 0.25],
          rotation: Math.PI / 4,
          scale: [2, 0.5],
        }),
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(24, 28) ?? []),
    ).toEqual([
      expect.closeTo(0.125, 5),
      expect.closeTo(0.25, 5),
      expect.closeTo(2, 5),
      expect.closeTo(0.5, 5),
    ]);
    expect(result.packed?.uniformFloat32[28]).toBeCloseTo(Math.PI / 4);
  });

  it("packs normal texture transforms for shader sampling", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        normalTexture: textureBinding("normal", "normal-sampler", 0, {
          offset: [0.375, 0.625],
          rotation: Math.PI / 6,
          scale: [0.25, 4],
        }),
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(30, 34) ?? []),
    ).toEqual([
      expect.closeTo(0.375, 5),
      expect.closeTo(0.625, 5),
      expect.closeTo(0.25, 5),
      expect.closeTo(4, 5),
    ]);
    expect(result.packed?.uniformFloat32[34]).toBeCloseTo(Math.PI / 6);
  });

  it("packs occlusion texture transforms for shader sampling", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        occlusionTexture: textureBinding("ao", "ao-sampler", 0, {
          offset: [0.1, 0.2],
          rotation: Math.PI / 8,
          scale: [2, 3],
        }),
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(36, 40) ?? []),
    ).toEqual([
      expect.closeTo(0.1, 5),
      expect.closeTo(0.2, 5),
      expect.closeTo(2, 5),
      expect.closeTo(3, 5),
    ]);
    expect(result.packed?.uniformFloat32[40]).toBeCloseTo(Math.PI / 8);
  });

  it("packs emissive texture transforms for shader sampling", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        emissiveTexture: textureBinding("emissive", "emissive-sampler", 0, {
          offset: [0.15, 0.35],
          rotation: Math.PI / 3,
          scale: [0.75, 1.5],
        }),
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(42, 46) ?? []),
    ).toEqual([
      expect.closeTo(0.15, 5),
      expect.closeTo(0.35, 5),
      expect.closeTo(0.75, 5),
      expect.closeTo(1.5, 5),
    ]);
    expect(result.packed?.uniformFloat32[46]).toBeCloseTo(Math.PI / 3);
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[48]).toBe("clearcoatFactor");
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[49]).toBe(
      "clearcoatRoughnessFactor",
    );
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[50]).toBe("transmissionFactor");
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[51]).toBe("clearcoatTexCoord.u32");
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[52]).toBe("sheenColorFactor.r");
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[55]).toBe("sheenRoughnessFactor");
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[56]).toBe("iridescenceFactor");
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[59]).toBe(
      "iridescenceThicknessMaximum",
    );
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[60]).toBe(
      "transmissionTexCoord.u32",
    );
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[61]).toBe("sheenColorTexCoord.u32");
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[62]).toBe(
      "iridescenceTexCoord.u32",
    );
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[63]).toBe(
      "sheenRoughnessTexCoord.u32",
    );
    expect(STANDARD_MATERIAL_UNIFORM_LAYOUT[64]).toBe(
      "iridescenceThicknessTexCoord.u32",
    );
    expect(STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH).toBe(272);
  });

  it("packs textured alpha-mask flags and cutoff for shader discard", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        baseColorTexture: textureBinding("alpha-mask", "nearest", 0),
        renderState: {
          alphaMode: "mask",
          alphaCutoff: 0.5,
          cullMode: "none",
        },
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.packed?.featureFlags).toBe(
      STANDARD_MATERIAL_FEATURE_FLAGS.BASE_COLOR_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.ALPHA_MASK |
        STANDARD_MATERIAL_FEATURE_FLAGS.DOUBLE_SIDED,
    );
    expect(result.packed?.uniformFloat32[11]).toBeCloseTo(0.5);
    expect(result.packed?.dependencies.baseColor).toEqual({
      textureKey: "texture:alpha-mask",
      samplerKey: "sampler:nearest",
      texCoord: 0,
    });
    expect(JSON.stringify(result)).not.toContain("GPU");
  });

  it("plans a material buffer and material bind group with stable keys", () => {
    const material = createStandardMaterialAsset({
      label: "Gold",
      metallicFactor: 1,
      roughnessFactor: 0.35,
    });
    const packed = required(packStandardMaterial(material).packed);
    const descriptor = createStandardMaterialBufferDescriptor(packed, {
      label: "StandardMaterial/Gold/uniform",
    });
    const preparation = createStandardMaterialPreparationPlan(material, {
      label: "StandardMaterial/Gold/uniform",
    });

    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan).toMatchObject({
      descriptor: {
        label: "StandardMaterial/Gold/uniform",
        size: STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH,
        usage: DEFAULT_STANDARD_MATERIAL_BUFFER_USAGE,
      },
      featureFlags: 0,
    });
    expect(descriptor.plan?.source).toBe(packed.uniform);
    expect(descriptor.plan?.descriptor.initialData).toBe(packed.uniform);
    expect(preparation.plan).toMatchObject({
      materialBufferResourceKey:
        "material-buffer:StandardMaterial/Gold/uniform",
      materialBindGroup: {
        valid: true,
        resourceKey:
          "bind-group:standard/group-2/0:material-buffer:StandardMaterial/Gold/uniform",
      },
    });
  });

  it("reports invalid materials, missing handles, and bad descriptors", () => {
    expect(
      packStandardMaterial(
        createStandardMaterialAsset({ metallicFactor: 2 }),
      ).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["standardMaterial.invalidFactor"]);

    expect(
      packStandardMaterial(
        createStandardMaterialAsset({
          baseColorTexture: { texture: null, sampler: null },
        }),
      ).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "standardMaterialPack.missingTextureHandle",
      "standardMaterialPack.missingSamplerHandle",
    ]);

    expect(
      packStandardMaterial(createUnlitMaterialAsset()).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["standardMaterialPack.unsupportedMaterialKind"]);

    expect(createStandardMaterialBufferDescriptor(null)).toMatchObject({
      valid: false,
      diagnostics: [{ code: "standardMaterialBuffer.nullPackedMaterial" }],
    });
    expect(
      createStandardMaterialBufferDescriptor(invalidPacked(), {
        usage: 0,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "standardMaterialBuffer.invalidUsageFlags",
      "standardMaterialBuffer.invalidUniformData",
    ]);
  });
});

function textureBinding(
  texture: string,
  sampler: string,
  texCoord: number,
  transform: MaterialTextureTransform | undefined = undefined,
): ReturnType<typeof createStandardMaterialAsset>["baseColorTexture"] {
  return {
    texture: createTextureHandle(texture),
    sampler: createSamplerHandle(sampler),
    texCoord,
    ...(transform === undefined ? {} : { transform }),
  };
}

function invalidPacked(): PackedStandardMaterial {
  const buffer = new ArrayBuffer(16);

  return {
    uniform: new Uint8Array(buffer),
    uniformFloat32: new Float32Array(buffer),
    uniformUint32: new Uint32Array(buffer),
    uniformLayout: STANDARD_MATERIAL_UNIFORM_LAYOUT,
    featureFlags: 0,
    dependencies: {
      baseColor: { textureKey: null, samplerKey: null, texCoord: 0 },
      metallicRoughness: { textureKey: null, samplerKey: null, texCoord: 0 },
      normal: { textureKey: null, samplerKey: null, texCoord: 0 },
      occlusion: { textureKey: null, samplerKey: null, texCoord: 0 },
      emissive: { textureKey: null, samplerKey: null, texCoord: 0 },
      clearcoat: { textureKey: null, samplerKey: null, texCoord: 0 },
      transmission: { textureKey: null, samplerKey: null, texCoord: 0 },
      sheenColor: { textureKey: null, samplerKey: null, texCoord: 0 },
      sheenRoughness: { textureKey: null, samplerKey: null, texCoord: 0 },
      iridescence: { textureKey: null, samplerKey: null, texCoord: 0 },
      iridescenceThickness: { textureKey: null, samplerKey: null, texCoord: 0 },
    },
  };
}

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
