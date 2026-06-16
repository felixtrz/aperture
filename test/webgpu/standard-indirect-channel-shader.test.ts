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
    // ...with the indirect term split out of the lit color (ambientDiffuse here,
    // since this variant has no IBL) and direct/emissive left in `color`.
    expect(variant.code).toContain(
      "let standardIndirectColor = ambientDiffuse;",
    );
    expect(variant.code).toContain(
      "let color = standardIndirectColor + direct + material.emissiveFactor;",
    );
    expect(variant.code).toContain(
      "standardFragmentOutput.color = vec4f(color, alpha);",
    );
    expect(variant.code).toContain(
      "standardFragmentOutput.indirect = vec4f(standardIndirectColor, 1.0);",
    );
    // The single-target return is gone.
    expect(variant.code).not.toContain("-> @location(0) vec4f {");
  });

  it("captures ambient + diffuse + specular IBL terms in the indirect channel", () => {
    // Synthetic shader carrying the specular-IBL color-assembly form, to prove
    // the capture splits the full indirect sum regardless of which IBL terms
    // are present.
    const iblShader = {
      label: "aperture/standard-mesh",
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      bindings: [],
      code: `@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let color = ambientDiffuse + diffuseIbl + specularIblBrdf + direct + material.emissiveFactor;
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
      "let color = standardIndirectColor + direct + material.emissiveFactor;",
    );
    expect(variant.code).toContain(
      "standardFragmentOutput.indirect = vec4f(standardIndirectColor, 1.0);",
    );
  });

  it("re-applies a tonemap-wrapped return to the indirect channel", () => {
    const tonemapped = {
      label: "aperture/standard-mesh|tonemap:aces|output-color:srgb",
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      bindings: [],
      code: `@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let color = ambientDiffuse + direct + material.emissiveFactor;
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
      "standardFragmentOutput.indirect = vec4f(apertureOutputColorSpace(apertureOutputTonemap(standardIndirectColor)), 1.0);",
    );
  });
});
