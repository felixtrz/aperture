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
  it("packs scalar proof-point fields into the documented 80-byte layout", () => {
    const material = createStandardMaterialAsset({
      baseColorFactor: new Float32Array([0.2, 0.4, 0.6, 0.8]),
      metallicFactor: 0.25,
      roughnessFactor: 0.75,
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
  });

  it("records texture dependencies and feature flags without raw handles", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        baseColorTexture: textureBinding("base", "base-sampler", 1),
        metallicRoughnessTexture: textureBinding("mr", "mr-sampler", 2),
        normalTexture: textureBinding("normal", "normal-sampler", 3),
        occlusionTexture: textureBinding("ao", "ao-sampler", 4),
        emissiveTexture: textureBinding("emissive", "emissive-sampler", 5),
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.packed?.featureFlags).toBe(
      STANDARD_MATERIAL_FEATURE_FLAGS.BASE_COLOR_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.METALLIC_ROUGHNESS_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.NORMAL_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.OCCLUSION_TEXTURE |
        STANDARD_MATERIAL_FEATURE_FLAGS.EMISSIVE_TEXTURE,
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
    });
    expect(
      Array.from(result.packed?.uniformUint32.slice(13, 18) ?? []),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      Array.from(result.packed?.uniformFloat32.slice(18, 22) ?? []),
    ).toEqual([0, 0, 1, 1]);
  });

  it("packs base-color texture offset and scale for shader sampling", () => {
    const result = packStandardMaterial(
      createStandardMaterialAsset({
        baseColorTexture: textureBinding("base", "base-sampler", 0, {
          offset: [0.25, 0.5],
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
    },
  };
}

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
