import { describe, expect, it } from "vitest";

import {
  createMaterialPipelineKeyInput,
  createMaterialHandle,
  createMatcapMaterialAsset,
  createSamplerAsset,
  createSamplerHandle,
  createStandardMaterialAsset,
  createTextureAsset,
  createTextureHandle,
  createUnlitMaterialAsset,
  samplerPipelineKey,
  validateMaterialAsset,
  validateTextureAsset,
} from "@aperture-engine/core";

describe("material, texture, sampler, and render-state schemas", () => {
  it("validates a simple unlit material", () => {
    const material = createUnlitMaterialAsset({
      label: "White Unlit",
      baseColorFactor: new Float32Array([1, 1, 1, 1]),
    });

    expect(validateMaterialAsset(material)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(createMaterialHandle("white").kind).toBe("material");
    expect(createMaterialPipelineKeyInput(material)).toMatchObject({
      shaderFamily: "unlit",
      features: [],
      alphaMode: "opaque",
    });
  });

  it("adds a stable unlit pipeline feature for base-color textures", () => {
    const material = createUnlitMaterialAsset({
      baseColorTexture: {
        texture: createTextureHandle("albedo"),
        sampler: createSamplerHandle("linear-repeat"),
      },
    });

    expect(createMaterialPipelineKeyInput(material).features).toEqual([
      "baseColorTexture",
    ]);
  });

  it("validates matcap source material dependencies without WebGPU resources", () => {
    const texture = createTextureHandle("studio-matcap");
    const sampler = createSamplerHandle("linear-clamp");
    const material = createMatcapMaterialAsset({
      label: "Studio Matcap",
      baseColorFactor: new Float32Array([0.9, 0.95, 1, 1]),
      matcapTexture: { texture, sampler },
    });

    expect(validateMaterialAsset(material)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(createMaterialPipelineKeyInput(material)).toMatchObject({
      shaderFamily: "matcap",
      features: ["matcapTexture"],
      alphaMode: "opaque",
    });
  });

  it("validates a standard metallic-roughness material and stable sampler keys", () => {
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear-repeat");
    const material = createStandardMaterialAsset({
      baseColorTexture: { texture, sampler },
      metallicFactor: 0.25,
      roughnessFactor: 0.75,
    });
    const firstSampler = createSamplerAsset({ label: "linear-repeat" });
    const secondSampler = createSamplerAsset({
      label: "same-fields-different-label",
    });

    expect(validateMaterialAsset(material)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(createMaterialPipelineKeyInput(material).features).toEqual([
      "baseColorTexture",
    ]);
    expect(samplerPipelineKey(firstSampler)).toBe(
      samplerPipelineKey(secondSampler),
    );
  });

  it("adds a stable StandardMaterial clearcoat pipeline feature", () => {
    const material = createStandardMaterialAsset({
      metallicFactor: 0,
      roughnessFactor: 0.6,
      clearcoatFactor: 1,
      clearcoatRoughnessFactor: 0.05,
    });

    expect(validateMaterialAsset(material)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(createMaterialPipelineKeyInput(material).features).toEqual([
      "clearcoat",
    ]);
  });

  it("adds a stable StandardMaterial transmission pipeline feature", () => {
    const material = createStandardMaterialAsset({
      metallicFactor: 0,
      roughnessFactor: 0.05,
      transmissionFactor: 0.72,
      renderState: {
        alphaMode: "blend",
        depth: { test: true, write: false, compare: "less" },
        blend: { preset: "alpha" },
      },
    });

    expect(validateMaterialAsset(material)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(createMaterialPipelineKeyInput(material).features).toEqual([
      "transmission",
    ]);
  });

  it("adds a stable StandardMaterial sheen pipeline feature", () => {
    const material = createStandardMaterialAsset({
      metallicFactor: 0,
      roughnessFactor: 0.7,
      sheenColorFactor: [0.85, 0.42, 0.18],
      sheenRoughnessFactor: 0.35,
    });

    expect(validateMaterialAsset(material)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(createMaterialPipelineKeyInput(material).features).toEqual([
      "sheen",
    ]);
  });

  it("validates texture color-space rules", () => {
    const invalidNormal = createTextureAsset({
      label: "Normal",
      dimension: "2d",
      width: 4,
      height: 4,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "normal",
    });

    expect(
      validateTextureAsset(invalidNormal).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["material.invalidTextureColorSpace"]);

    const mismatchedBaseColor = createTextureAsset({
      label: "Base Color",
      dimension: "2d",
      width: 4,
      height: 4,
      format: "rgba8unorm",
      colorSpace: "srgb",
      semantic: "base-color",
    });

    expect(validateTextureAsset(mismatchedBaseColor).diagnostics).toEqual([
      {
        code: "material.invalidTextureColorSpaceFormat",
        field: "format",
        message:
          "base-color texture 'Base Color' declares color space 'srgb' but uses format 'rgba8unorm'.",
      },
    ]);
  });

  it("reports missing handles, invalid alpha cutoff, unsupported features, and incompatible render state", () => {
    const invalid = createStandardMaterialAsset({
      baseColorTexture: { texture: null, sampler: null },
      unsupportedFeatures: ["stencil", "custom-shader"],
      renderState: {
        alphaMode: "blend",
        alphaCutoff: 1.5,
        depth: { test: true, write: true, compare: "less" },
        blend: { preset: "none" },
      },
    });

    expect(
      validateMaterialAsset(invalid).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual([
      "material.invalidAlphaCutoff",
      "material.incompatibleRenderState",
      "material.incompatibleRenderState",
      "material.unsupportedFeature",
      "material.unsupportedFeature",
      "material.missingTextureHandle",
      "material.missingSamplerHandle",
    ]);
  });

  it("reports incomplete matcap texture bindings", () => {
    const missing = createMatcapMaterialAsset();
    const incomplete = createMatcapMaterialAsset({
      matcapTexture: {
        texture: createTextureHandle("studio-matcap"),
        sampler: null,
      },
    });

    expect(
      validateMaterialAsset(missing).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual([
      "material.missingTextureHandle",
      "material.missingSamplerHandle",
    ]);
    expect(validateMaterialAsset(incomplete).diagnostics).toMatchObject([
      {
        code: "material.missingSamplerHandle",
        field: "matcapTexture",
      },
    ]);
  });
});
