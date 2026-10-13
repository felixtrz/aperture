import { describe, expect, it } from "vitest";
import {
  STANDARD_MESH_WGSL,
  createStandardTextureVariantShader,
} from "../../packages/webgpu/src/materials/standard/standard-shader.js";
import { DEBUG_NORMAL_MESH_WGSL } from "../../packages/webgpu/src/materials/debug-normal/debug-normal-shader.js";
import { MATCAP_MESH_WGSL } from "../../packages/webgpu/src/materials/matcap/matcap-shader.js";
import { WORLD_NORMAL_TRANSFORM_WGSL } from "../../packages/webgpu/src/materials/world-normal-transform.js";

const base = {
  baseColorTexture: false,
  metallicRoughnessTexture: false,
  normalTexture: false,
  occlusionTexture: false,
  emissiveTexture: false,
};

describe("world normal shader transform contract", () => {
  it("returns a finite nonzero cofactor normal before evaluating fallback normalizations", () => {
    const normalTransform = WORLD_NORMAL_TRANSFORM_WGSL.slice(
      WORLD_NORMAL_TRANSFORM_WGSL.indexOf("fn apertureTransformWorldNormal("),
      WORLD_NORMAL_TRANSFORM_WGSL.indexOf("fn apertureTransformWorldTangent("),
    );
    const cofactorReturn = normalTransform.indexOf(
      "return scaled * inverseSqrt(dot(scaled, scaled));",
    );
    const fallback = normalTransform.indexOf("let localFallback =");

    expect(cofactorReturn).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(cofactorReturn);
    expect(normalTransform.slice(0, fallback)).not.toContain(
      "apertureUnitVectorOr(",
    );
    expect(normalTransform.slice(fallback)).toContain(
      "return apertureUnitVectorOr(linear * normal, localFallback);",
    );
  });

  it("uses the robust unit-vector arithmetic and accepts usable rank-two cofactors", () => {
    const normalTransform = WORLD_NORMAL_TRANSFORM_WGSL.slice(
      WORLD_NORMAL_TRANSFORM_WGSL.indexOf("fn apertureTransformWorldNormal("),
      WORLD_NORMAL_TRANSFORM_WGSL.indexOf("fn apertureTransformWorldTangent("),
    );
    expect(normalTransform).toContain(
      "cofactorNormal * select(1.0, -1.0, determinant < 0.0)",
    );
    expect(normalTransform).toContain(
      "all(orientedNormal == orientedNormal) && scale > 0.0 && scale <= 3.402823466e38f",
    );
    expect(normalTransform).toContain("let scaled = orientedNormal / scale;");
    expect(normalTransform).not.toMatch(/if\s*\([^)]*determinant/);
    expect(normalTransform).toContain(
      "let localFallback = apertureUnitVectorOr(normal, vec3f(0.0, 1.0, 0.0));",
    );
  });

  it("shares inverse-transpose and finite fallback code across lit and diagnostic materials", () => {
    for (const code of [
      STANDARD_MESH_WGSL,
      DEBUG_NORMAL_MESH_WGSL,
      MATCAP_MESH_WGSL,
    ]) {
      expect(code).toContain(WORLD_NORMAL_TRANSFORM_WGSL);
      expect(code).toContain(
        "output.worldNormal = apertureTransformWorldNormal(world, input.normal)",
      );
      expect(code.match(/fn apertureTransformWorldNormal\(/g)).toHaveLength(1);
      expect(code).not.toContain(
        "normalize((world * vec4f(input.normal, 0.0)).xyz)",
      );
    }
  });

  it("keeps skinned/morphed normal sources inside the shared world transform without new bindings", () => {
    for (const features of [
      { skinned: true },
      { morphed: true },
      { skinned: true, morphed: true },
    ]) {
      const shader = createStandardTextureVariantShader({
        ...base,
        ...features,
      });
      expect(shader.code).toContain(
        "output.worldNormal = apertureTransformWorldNormal(world,",
      );
      expect(
        shader.code.match(/fn apertureTransformWorldNormal\(/g),
      ).toHaveLength(1);
      expect(
        shader.bindings.some((binding) =>
          binding.label.includes("normal matrix"),
        ),
      ).toBe(false);
    }
  });

  it("preserves mirrored tangent handedness and safely constructs degenerate tangent frames", () => {
    const shader = createStandardTextureVariantShader({
      ...base,
      normalTexture: true,
    });
    expect(shader.code).toContain(
      "output.worldTangent = apertureTransformWorldTangent(world, input.tangent.xyz)",
    );
    expect(shader.code).toContain(
      "input.tangent.w * apertureWorldOrientation(world)",
    );
    expect(shader.code).toContain(
      "apertureOrthogonalTangent(normal, input.worldTangent)",
    );
    expect(shader.code).toContain(
      "apertureUnitVectorOr(mat3x3f(tangent, bitangent, normal) * tangentNormal, normal)",
    );
  });
});
