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
    expect(Array.from(result.packed?.uniform ?? [])).toEqual([1, 1, 1, 1]);
    expect(result.packed?.dependencies).toEqual({
      baseColorTextureKey: null,
      baseColorSamplerKey: null,
    });
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
