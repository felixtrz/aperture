import { describe, expect, it } from "vitest";
import { createStandardTextureVariantShader } from "../../packages/webgpu/src/materials/standard/standard-shader.js";
import type { StandardTextureShaderFeatures } from "../../packages/webgpu/src/materials/standard/standard-shader-features.js";
import {
  applyStandardSmallLightUniforms,
  supportsStandardSmallLightUniforms,
} from "../../packages/webgpu/src/materials/standard/standard-small-light-uniforms.js";

function features(layout: readonly (0 | 1)[]): StandardTextureShaderFeatures {
  return {
    baseColorTexture: true,
    metallicRoughnessTexture: false,
    normalTexture: false,
    occlusionTexture: false,
    emissiveTexture: false,
    shadowMap: true,
    lightKindMask: 3,
    knownLightKindLayout: layout,
    fixedSingleShadowLightIndex: layout.indexOf(1),
    fixedDirectionalShadowFilter: 1,
  };
}

function functionBody(code: string, name: string): string {
  const start = code.indexOf(`fn ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const opening = code.indexOf("{", start);
  let depth = 1;
  let cursor = opening + 1;
  while (depth > 0 && cursor < code.length) {
    if (code[cursor] === "{") depth++;
    if (code[cursor] === "}") depth--;
    cursor++;
  }
  return code.slice(start, cursor);
}

describe("small-light uniform shader transport", () => {
  it.each([
    [0, 1],
    [1, 0],
  ] as const)(
    "keeps the original BRDF, PCF and arithmetic for packed order %j",
    (...tuple) => {
      const storageFeatures = features(tuple);
      const storage = createStandardTextureVariantShader(storageFeatures);
      const uniform = createStandardTextureVariantShader({
        ...storageFeatures,
        smallLightUniforms: "sun-ambient-v1",
      });
      expect(uniform.code).toContain(
        "var<uniform> smallLightFloats: array<vec4f, 15>",
      );
      expect(uniform.code).toContain(
        "var<uniform> smallLightMetadata: array<vec4i, 4>",
      );
      expect(uniform.code).not.toMatch(
        /var<storage, read> light(?:Floats|Metadata)/u,
      );
      expect(uniform.code).not.toMatch(
        /arrayLength\(&light(?:Floats|Metadata)\)/u,
      );
      expect(functionBody(uniform.code, "lightCount")).toContain(
        "smallLightMetadata[3].x",
      );
      expect(functionBody(uniform.code, "lightRadiance")).toContain(
        "return color * intensity",
      );
      for (const name of [
        "evaluateDirectLight",
        "fresnelSchlick",
        "distributionGGX",
        "geometrySmith",
        "sampleDirectionalShadowPcfSoft",
        "singleShadowLightIndex",
      ]) {
        expect(functionBody(uniform.code, name)).toBe(
          functionBody(storage.code, name),
        );
      }
      expect(
        uniform.bindings
          .filter((binding) => binding.group === 3 && binding.binding < 2)
          .map((binding) => binding.resource),
      ).toEqual(["uniform-buffer", "uniform-buffer"]);
    },
  );

  it("leaves storage source untouched when no uniform route was selected", () => {
    const ordinary = features([1, 0]);
    const source = createStandardTextureVariantShader(ordinary).code;
    expect(applyStandardSmallLightUniforms(source, ordinary)).toBe(source);
  });

  it("rejects unsupported routes before changing their binding ABI", () => {
    for (const addition of [
      { knownLightKindLayout: [0, 1, 1] as const },
      { knownLightKindLayout: [1, 1] as const },
      { fixedDirectionalShadowFilter: 2 as const },
      { fixedSingleShadowLightIndex: 1 },
      { transmission: true },
      { iblDiffuse: true },
      { skinned: true },
      { clusteredLocalLights: true },
      { pointShadowMap: true },
    ]) {
      const candidate = {
        ...features([1, 0]),
        ...addition,
        smallLightUniforms: "sun-ambient-v1" as const,
      };
      expect(supportsStandardSmallLightUniforms(candidate)).toBe(false);
      expect(() =>
        applyStandardSmallLightUniforms("unchanged", candidate),
      ).toThrow(/one ambient/u);
    }
  });
});
