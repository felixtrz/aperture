import { describe, expect, it } from "vitest";

import {
  createOutputColorSpacePipelineKey,
  createOutputColorSpaceWgsl,
  STANDARD_MESH_SHADER,
  TONEMAP_OPERATORS,
  UNLIT_MESH_SHADER,
  applyOutputStageToBuiltInShader,
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

  it("emits an exposure multiply for the HDR post tonemap stage (opt-in)", () => {
    for (const operator of TONEMAP_OPERATORS) {
      const exposed = createOutputTonemapWgsl(operator, { exposure: true });

      // exposure variant takes exposure: f32 and multiplies color * exposure
      // BEFORE the operator (exposure=0 -> color 0 -> black; exposure=1 ->
      // identity pre-operator). The parameter is renamed to `inputColor` so the
      // injected `let color` does NOT shadow a same-named parameter in the same
      // scope — WGSL rejects that as a redeclaration (would fail to compile).
      expect(exposed).toContain(
        "fn apertureOutputTonemap(inputColor: vec3f, exposure: f32) -> vec3f",
      );
      expect(exposed).toContain("let color = inputColor * exposure;");
      expect(
        exposed,
        "exposure WGSL must not shadow its own parameter (WGSL compile error)",
      ).not.toContain("let color = color * exposure;");

      // The default (in-material) form stays byte-identical: single argument,
      // no exposure term.
      const base = createOutputTonemapWgsl(operator);
      expect(base).toContain("fn apertureOutputTonemap(color: vec3f) -> vec3f");
      expect(base).not.toContain("exposure");
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

describe("applyOutputStageToBuiltInShader (family-agnostic output stage, AI-17)", () => {
  it("is identity on the HDR-scene-buffer path (none + linear)", () => {
    expect(
      applyOutputStageToBuiltInShader(UNLIT_MESH_SHADER, "none", "linear"),
    ).toBe(UNLIT_MESH_SHADER);
  });

  it("wraps the fragment entry with the tonemap + color-space output stage", () => {
    const wrapped = applyOutputStageToBuiltInShader(
      UNLIT_MESH_SHADER,
      "aces",
      "srgb",
    );

    // The original entry is renamed to a plain inner fn; a thin @fragment wrapper
    // applies the output stage, so exactly one @fragment entry remains.
    expect(wrapped.code).toContain(
      "fn apertureOutputStageInner(input: VertexOutput) -> vec4f",
    );
    expect(wrapped.code).toContain(
      "apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb))",
    );
    expect(wrapped.code.match(/@fragment/g)).toHaveLength(1);
    expect(wrapped.label).toContain(createTonemapPipelineKey("aces"));
    expect(wrapped.label).toContain(createOutputColorSpacePipelineKey("srgb"));
  });

  it("does not put @location on the non-entry inner helper return type", () => {
    // Dawn/naga reject "'@location' is not valid for non-entry point function
    // return types" — the inner helper must return a plain vec4f and only the
    // @fragment wrapper may carry @location(0). Verified against real Dawn via
    // headless Chrome; this guards the string contract without a browser.
    const wrapped = applyOutputStageToBuiltInShader(
      UNLIT_MESH_SHADER,
      "aces",
      "srgb",
    );

    expect(wrapped.code).not.toContain(
      "fn apertureOutputStageInner(input: VertexOutput) -> @location(0) vec4f",
    );
    expect(wrapped.code).toMatch(
      /fn apertureOutputStageInner\(input: VertexOutput\) -> vec4f \{/,
    );
  });

  it("preserves the fragment alpha channel through the wrapper", () => {
    const wrapped = applyOutputStageToBuiltInShader(
      UNLIT_MESH_SHADER,
      "aces",
      "srgb",
    );

    // alpha forwarded untouched (only rgb is tonemapped/encoded).
    expect(wrapped.code).toContain("apertureFragment.a)");
  });

  it("throws when the built-in fragment entry signature is absent", () => {
    expect(() =>
      applyOutputStageToBuiltInShader(
        { ...UNLIT_MESH_SHADER, code: "fn other() -> f32 { return 1.0; }" },
        "aces",
        "srgb",
      ),
    ).toThrow();
  });
});
