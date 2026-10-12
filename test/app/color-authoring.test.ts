import { describe, expect, expectTypeOf, it } from "vitest";
import {
  color,
  hexColor,
  material,
  mesh,
  type StandardMaterialDescriptor,
  type StandardMaterialInputOptions,
  type StandardMaterialOptions,
  type UnlitMaterialDescriptor,
  type Vec4,
} from "@aperture-engine/app/systems";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  createStandardMaterialAsset,
  type StandardMaterialAsset,
  type UnlitMaterialAsset,
} from "@aperture-engine/render";
import { prepareSpawnMeshAssets } from "../../packages/app/src/systems/spawn/assets.js";

function toAsset(
  descriptor: StandardMaterialDescriptor | UnlitMaterialDescriptor,
): StandardMaterialAsset | UnlitMaterialAsset {
  const registry = new AssetRegistry();
  const prepared = prepareSpawnMeshAssets(
    { mesh: mesh.box(), material: descriptor },
    "test.color",
  );
  prepared.publish(registry);
  return registry.get<"material", StandardMaterialAsset | UnlitMaterialAsset>(
    prepared.materialHandle,
  )!.asset!;
}

describe("explicit app authoring color spaces", () => {
  it("returns typed Vec4s while material descriptors keep their numeric contract", () => {
    expectTypeOf(color.srgbHex).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(color.linear).returns.toEqualTypeOf<Vec4>();
    const input: StandardMaterialInputOptions = { baseColor: "#808080" };
    expectTypeOf(
      material.standard(input).options,
    ).toEqualTypeOf<StandardMaterialOptions>();
    expect(color.srgbHex("#808080")).toBeInstanceOf(Float32Array);
    expect(Object.isFrozen(color)).toBe(true);
  });

  it("matches known sRGB transfer values on both sides of the linear segment", () => {
    expect(Array.from(color.srgbHex("#000"))).toEqual([0, 0, 0, 1]);
    expect(Array.from(color.srgbHex("#FFF"))).toEqual([1, 1, 1, 1]);
    expect(color.srgbHex("#808080")[0]).toBeCloseTo(0.21586050011389926, 7);
    expect(color.srgbHex("#0a0a0a")[0]).toBeCloseTo(0.003035269835488375, 8);
    expect(color.srgbHex("#0b0b0b")[0]).toBeCloseTo(0.003346535763899161, 8);
  });

  it("expands short CSS RGB/RGBA and handles mixed-case hex deterministically", () => {
    expect(Array.from(color.srgbHex("#aBc"))).toEqual(
      Array.from(color.srgbHex("#AABBCC")),
    );
    expect(Array.from(color.srgbHex("#aBcD"))).toEqual(
      Array.from(color.srgbHex("#AABBCCDD")),
    );
    expect(color.srgbHex("#abcd")[3]).toBeCloseTo(221 / 255, 7);
  });

  it("keeps alpha independent of gamma and never premultiplies RGB", () => {
    const translucent = color.srgbHex("#80808080");
    expect(translucent[0]).toBeCloseTo(0.21586050011389926, 7);
    expect(translucent[3]).toBeCloseTo(128 / 255, 7);
    expect(Array.from(color.srgbHex("#fff0"))).toEqual([1, 1, 1, 0]);
  });

  it("copies linear and HDR channel values without reinterpretation", () => {
    const value = color.linear(2.5, 0.125, -0.25, 0.4);
    expect(Array.from(value).slice(0, 3)).toEqual([2.5, 0.125, -0.25]);
    expect(value[3]).toBeCloseTo(0.4, 7);
    expect(color.linear(0.5, 0.5, 0.5)[0]).toBe(0.5);
    expect(color.linear(0.5, 0.5, 0.5)[3]).toBe(1);
    expect(hexColor(0x808080)[0]).toBe(128 / 255);
  });

  it("reports malformed hex, coercions, nonfinite channels and storage overflow", () => {
    for (const value of [
      "",
      "red",
      "0xff0000",
      "#12",
      "#12345",
      "#1234567",
      "#123456789",
      "#ggg",
      " #fff",
      "#fff ",
      42,
      null,
    ]) {
      expect(() => color.srgbHex(value as string)).toThrowError(
        expect.objectContaining({
          code: "aperture.color.invalidHex",
          suggestedFix: expect.stringContaining("color.srgbHex"),
        }),
      );
    }
    for (const value of [NaN, Infinity, -Infinity, "1", null]) {
      for (let index = 0; index < 4; index++) {
        const values: [number, number, number, number] = [1, 1, 1, 1];
        values[index] = value as number;
        expect(() => color.linear(...values)).toThrowError(
          expect.objectContaining({ code: "aperture.color.invalidLinear" }),
        );
      }
    }
    expect(() => color.linear(Number.MAX_VALUE, 0, 0)).toThrowError(
      expect.objectContaining({ code: "aperture.color.invalidLinear" }),
    );
  });

  it("normalizes hex before registering standard and unlit assets exactly once", () => {
    for (const factory of [material.standard, material.unlit]) {
      const options = { baseColor: "#80808080", label: "Original" };
      const descriptor = factory(options);
      options.baseColor = "#fff";
      expect(Object.isFrozen(descriptor)).toBe(true);
      expect(descriptor.options.baseColor).toBeInstanceOf(Float32Array);
      expect(descriptor.options.label).toBe("Original");
      const asset = toAsset(descriptor);
      expect(asset.baseColorFactor[0]).toBeCloseTo(0.21586050011389926, 7);
      expect(asset.baseColorFactor[3]).toBeCloseTo(128 / 255, 7);
      expect(() => factory({ baseColor: "blue" })).toThrowError(
        expect.objectContaining({ code: "aperture.color.invalidHex" }),
      );
    }
  });

  it("retains numeric inputs, default factors and low-level numeric material semantics", () => {
    const numeric = [0.5, 0.25, 0.125, 0.5] as const;
    for (const factory of [material.standard, material.unlit]) {
      const descriptor = factory({ baseColor: numeric });
      expect(descriptor.options.baseColor).toBe(numeric);
      expect(Array.from(toAsset(descriptor).baseColorFactor)).toEqual(numeric);
      expect(factory()).toEqual({
        kind: factory === material.standard ? "standard" : "unlit",
        options: {},
      });
      // JavaScript callers can still supply an explicit undefined property.
      const explicitUndefined = {
        baseColor: undefined,
      } as unknown as StandardMaterialInputOptions;
      expect(factory(explicitUndefined).options).toHaveProperty(
        "baseColor",
        undefined,
      );
      expect(Array.from(toAsset(factory()).baseColorFactor)).toEqual([
        1, 1, 1, 1,
      ]);
    }
    const standard = toAsset(material.standard()) as StandardMaterialAsset;
    expect(standard.metallicFactor).toBe(0);
    expect(standard.roughnessFactor).toBe(1);
    expect(
      Array.from(
        createStandardMaterialAsset({ baseColorFactor: numeric })
          .baseColorFactor,
      ),
    ).toEqual(numeric);
  });
});
