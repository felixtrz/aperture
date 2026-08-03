import { describe, expect, it } from "vitest";
import {
  UNLIT_MATERIAL_UNIFORM_LAYOUT,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  packUnlitMaterial,
} from "@aperture-engine/render";
import {
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";

describe("unlit material uniform packing", () => {
  it("packs default unlit color into the documented uniform layout", () => {
    const result = packUnlitMaterial(createUnlitMaterialAsset());

    expect(result.diagnostics).toEqual([]);
    expect(result.packed?.uniformLayout).toBe(UNLIT_MATERIAL_UNIFORM_LAYOUT);
    // Color followed by the identity base-color texture transform
    // (offset 0,0 / scale 1,1 / rotation 0) and struct padding.
    expect(Array.from(result.packed?.uniform ?? [])).toEqual([
      1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0,
    ]);
    expect(result.packed?.dependencies).toEqual({
      baseColorTextureKey: null,
      baseColorSamplerKey: null,
    });
  });

  it("packs the base color texture transform for atlas sub-rect materials", () => {
    // The exact binding the talos ground-milestone glyph decals author: one
    // atlas texture, per-material offset/scale addressing a single glyph
    // cell. Before the transform floats were packed, every quad sampled the
    // whole sheet.
    const result = packUnlitMaterial(
      createUnlitMaterialAsset({
        baseColorTexture: {
          texture: createTextureHandle("glyph-atlas"),
          sampler: createSamplerHandle("clamp"),
          transform: {
            offset: [0.375, 0.833333],
            scale: [0.125, 0.166667],
          },
        },
      }),
    );

    expect(result.valid).toBe(true);
    expect(Array.from(result.packed?.uniform.slice(4) ?? [])).toEqual([
      0.375,
      Math.fround(0.833333),
      0.125,
      Math.fround(0.166667),
      0,
      0,
      0,
      0,
    ]);
  });

  it("packs a rotated texture transform and defaults omitted fields", () => {
    const result = packUnlitMaterial(
      createUnlitMaterialAsset({
        baseColorTexture: {
          texture: createTextureHandle("albedo"),
          sampler: createSamplerHandle("linear"),
          transform: { rotation: 0.5 },
        },
      }),
    );

    expect(result.valid).toBe(true);
    expect(Array.from(result.packed?.uniform.slice(4) ?? [])).toEqual([
      0, 0, 1, 1, 0.5, 0, 0, 0,
    ]);
  });

  it("packs tinted unlit color deterministically", () => {
    const result = packUnlitMaterial(
      createUnlitMaterialAsset({
        baseColorFactor: new Float32Array([0.2, 0.4, 0.6, 0.8]),
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.packed?.uniform[0]).toBeCloseTo(0.2, 5);
    expect(result.packed?.uniform[1]).toBeCloseTo(0.4, 5);
    expect(result.packed?.uniform[2]).toBeCloseTo(0.6, 5);
    expect(result.packed?.uniform[3]).toBeCloseTo(0.8, 5);
  });

  it("returns texture and sampler dependency keys for textured unlit materials", () => {
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");
    const result = packUnlitMaterial(
      createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.packed?.dependencies).toEqual({
      baseColorTextureKey: "texture:albedo",
      baseColorSamplerKey: "sampler:linear",
    });
  });

  it("reports missing handles and unsupported material kinds", () => {
    expect(
      packUnlitMaterial(
        createUnlitMaterialAsset({
          baseColorTexture: { texture: null, sampler: null },
        }),
      ).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "materialPack.missingTextureHandle",
      "materialPack.missingSamplerHandle",
    ]);

    expect(
      packUnlitMaterial(createStandardMaterialAsset()).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["materialPack.unsupportedMaterialKind"]);
  });
});
