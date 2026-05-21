import { describe, expect, it } from "vitest";

import {
  STANDARD_MESH_SHADER,
  TONEMAP_OPERATORS,
  applyOutputTonemapToStandardShader,
  createOutputTonemapWgsl,
  createTonemapPipelineKey,
  parseTonemapOperator,
  resolveTonemapOperator,
} from "@aperture-engine/webgpu";

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

  it("keeps none as the identity shader", () => {
    expect(
      applyOutputTonemapToStandardShader(STANDARD_MESH_SHADER, "none"),
    ).toBe(STANDARD_MESH_SHADER);
  });

  it("wraps standard material fragment output with the selected operator", () => {
    const shader = applyOutputTonemapToStandardShader(
      STANDARD_MESH_SHADER,
      "aces",
    );

    expect(shader).not.toBe(STANDARD_MESH_SHADER);
    expect(shader.label).toBe(
      `aperture/standard-mesh|${createTonemapPipelineKey("aces")}`,
    );
    expect(shader.code).toContain("fn apertureOutputTonemap");
    expect(shader.code).toContain(
      "return vec4f(apertureOutputTonemap(color), alpha);",
    );
    expect(shader.bindings).toBe(STANDARD_MESH_SHADER.bindings);
  });
});
