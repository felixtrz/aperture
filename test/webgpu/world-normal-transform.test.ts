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
