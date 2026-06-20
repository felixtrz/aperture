import { describe, expect, it } from "vitest";

import {
  createIndirectColorChannelShaderVariant,
  createStandardTextureVariantShader,
} from "@aperture-engine/webgpu/test-support";

describe("standard indirect color-channel shader variant (M5-T6)", () => {
  it("emits a two-target fragment splitting indirect (ambient+IBL) from direct+emissive", () => {
    const base = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
    });
    const variant = createIndirectColorChannelShaderVariant(base);

    expect(variant.label).toBe(`${base.label}-indirect-channel`);
    // The fragment now returns the two-target struct...
    expect(variant.code).toContain("struct StandardIndirectFragmentOutput {");
    expect(variant.code).toContain("@location(0) color: vec4f,");
    expect(variant.code).toContain("@location(1) indirect: vec4f,");
    expect(variant.code).toContain(
      "fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> StandardIndirectFragmentOutput {",
    );
    // ...with the composer-owned indirect, direct, and emissive terms kept
    // named before final color assembly.
    expect(variant.code).toContain(
      "let standardIndirectColor = ambientDiffuse;",
    );
    expect(variant.code).toContain("let standardDirectColor = direct;");
    expect(variant.code).toContain(
      "let standardEmissiveColor = material.emissiveFactor;",
    );
    expect(variant.code).toContain(
      "var color = standardIndirectColor + standardDirectColor + standardEmissiveColor;",
    );
    expect(variant.code).toContain(
      "standardFragmentOutput.color = vec4f(color, alpha);",
    );
    expect(variant.code).toContain(
      "standardFragmentOutput.indirect = vec4f(standardIndirectOutputColor, 1.0);",
    );
    // The single-target return is gone.
    expect(variant.code).not.toContain("-> @location(0) vec4f {");
  });

  it("captures ambient + diffuse + specular IBL terms in the indirect channel", () => {
    // Synthetic shader carrying the composer-owned specular-IBL terms, to prove
    // the second target uses the named indirect output instead of parsing final
    // color math.
    const iblShader = {
      label: "aperture/standard-mesh",
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      bindings: [],
      code: `@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let standardIndirectColor = ambientDiffuse + diffuseIbl + specularIblBrdf;
  let standardDirectColor = direct;
  let standardEmissiveColor = material.emissiveFactor;
  var color = standardIndirectColor + standardDirectColor + standardEmissiveColor;
  let standardIndirectOutputColor = standardIndirectColor;
  return vec4f(color, alpha);
}`,
    } as unknown as Parameters<
      typeof createIndirectColorChannelShaderVariant
    >[0];
    const variant = createIndirectColorChannelShaderVariant(iblShader);

    expect(variant.code).toContain(
      "let standardIndirectColor = ambientDiffuse + diffuseIbl + specularIblBrdf;",
    );
    expect(variant.code).toContain(
      "standardFragmentOutput.indirect = vec4f(standardIndirectOutputColor, 1.0);",
    );
  });

  it("re-applies a tonemap-wrapped return to the indirect channel", () => {
    const tonemapped = {
      label: "aperture/standard-mesh|tonemap:aces|output-color:srgb",
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      bindings: [],
      code: `@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let standardIndirectColor = ambientDiffuse;
  var color = standardIndirectColor + direct + material.emissiveFactor;
  let standardIndirectOutputColor = apertureOutputColorSpace(apertureOutputTonemap(standardIndirectColor));
  return vec4f(apertureOutputColorSpace(apertureOutputTonemap(color)), alpha);
}`,
    } as unknown as Parameters<
      typeof createIndirectColorChannelShaderVariant
    >[0];
    const variant = createIndirectColorChannelShaderVariant(tonemapped);

    // Both targets receive the same tonemap+sRGB transform (color → indirect).
    expect(variant.code).toContain(
      "standardFragmentOutput.color = vec4f(apertureOutputColorSpace(apertureOutputTonemap(color)), alpha);",
    );
    expect(variant.code).toContain(
      "standardFragmentOutput.indirect = vec4f(standardIndirectOutputColor, 1.0);",
    );
  });
});
