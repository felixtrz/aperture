import { describe, expect, it } from "vitest";

import {
  createOutputColorSpacePipelineKey,
  createOutputColorSpaceWgsl,
  STANDARD_MESH_SHADER,
  TONEMAP_OPERATORS,
  applyOutputTonemapToStandardShader,
  createOutputTonemapWgsl,
  createTonemapPipelineKey,
  parseTonemapOperator,
  resolveTonemapOperator,
} from "@aperture-engine/webgpu/test-support";

describe("output-stage tonemap operators", () => {
  it("parses supported operators and falls back to none", () => {
    expect(parseTonemapOperator("ACES")).toBe("aces");
    expect(parseTonemapOperator(" neutral ")).toBe("neutral");
    expect(parseTonemapOperator("filmic")).toBeNull();
    expect(resolveTonemapOperator("filmic")).toBe("none");
  });

  it("provides WGSL snippets for every supported operator", () => {
    for (const operator of TONEMAP_OPERATORS) {
      expect(createOutputTonemapWgsl(operator)).toContain(
        "fn apertureOutputTonemap(color: vec3f) -> vec3f",
      );
    }
  });

  it("provides WGSL output color-space encoding for sRGB displays", () => {
    expect(createOutputColorSpaceWgsl("srgb")).toContain(
      "fn apertureLinearToSrgbChannel",
    );
    expect(createOutputColorSpaceWgsl("srgb")).toContain(
      "fn apertureOutputColorSpace(color: vec3f) -> vec3f",
    );
    expect(createOutputColorSpaceWgsl("linear")).toContain("return color;");
  });

  it("keeps none as the identity shader", () => {
    expect(
      applyOutputTonemapToStandardShader(STANDARD_MESH_SHADER, "none"),
    ).toBe(STANDARD_MESH_SHADER);
  });

  it("wraps standard material fragment output with the selected operator and output color space", () => {
    const shader = applyOutputTonemapToStandardShader(
      STANDARD_MESH_SHADER,
      "aces",
      "srgb",
    );

    expect(shader).not.toBe(STANDARD_MESH_SHADER);
    expect(shader.label).toBe(
      [
        "aperture/standard-mesh",
        createTonemapPipelineKey("aces"),
        createOutputColorSpacePipelineKey("srgb"),
      ].join("|"),
    );
    expect(shader.code).toContain("fn apertureOutputTonemap");
    expect(shader.code).toContain("fn apertureOutputColorSpace");
    expect(shader.code).toContain(
      "return vec4f(apertureOutputColorSpace(apertureOutputTonemap(color)), alpha);",
    );
    expect(shader.bindings).toBe(STANDARD_MESH_SHADER.bindings);
  });

  it("can add sRGB output encoding without changing the tonemap operator", () => {
    const shader = applyOutputTonemapToStandardShader(
      STANDARD_MESH_SHADER,
      "none",
      "srgb",
    );

    expect(shader.label).toContain(createTonemapPipelineKey("none"));
    expect(shader.label).toContain(createOutputColorSpacePipelineKey("srgb"));
    expect(shader.code).toContain("return color;");
    expect(shader.code).toContain("apertureLinearToSrgbChannel");
  });
});
