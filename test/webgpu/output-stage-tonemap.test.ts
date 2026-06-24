import { describe, expect, it } from "vitest";

import {
  createOutputColorSpacePipelineKey,
  createOutputColorSpaceWgsl,
  STANDARD_MESH_SHADER,
  TONEMAP_OPERATORS,
  UNLIT_MESH_SHADER,
  applyOutputStageToBuiltInShader,
  applyOutputTonemapToStandardShader,
  createStandardTextureVariantShader,
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

  it("wraps standard material fragment variants that return a composed color expression", () => {
    const fogShader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      fogLinear: true,
    });
    const shader = applyOutputTonemapToStandardShader(
      fogShader,
      "none",
      "srgb",
    );

    expect(fogShader.code).toContain("return vec4f(foggedColor, alpha);");
    expect(shader.code).toContain(
      "return vec4f(apertureOutputColorSpace(apertureOutputTonemap(foggedColor)), alpha);",
    );
  });
});

describe("agx + neutral fidelity (AI-90)", () => {
  // The Dawn numeric harness (scripts/webgpu-tonemap-numeric-check.mjs) proves
  // the operator WGSL produces these values on a real GPU. These string checks
  // pin the faithful structure in the default (GPU-free) gate so a revert to the
  // old curve fails here, and the JS port cross-checks the reference numbers.

  it("agx WGSL carries the inset/outset + Rec2020 transforms and final gamma", () => {
    const agx = createOutputTonemapWgsl("agx");
    // inset matrix first column (three.js AgXInsetMatrix)
    expect(agx).toContain("0.856627153315983");
    // outset matrix first entry (three.js AgXOutsetMatrix)
    expect(agx).toContain("1.1271005818144368");
    // LINEAR_SRGB_TO_LINEAR_REC2020 / LINEAR_REC2020_TO_LINEAR_SRGB pair
    expect(agx).toContain("0.6274");
    expect(agx).toContain("1.6605");
    // the missing final 2.2 power that gives AgX its rolloff
    expect(agx).toContain("pow(max(vec3f(0.0), c), vec3f(2.2))");
  });

  it("neutral WGSL carries the black offset and the desaturation mix", () => {
    const neutral = createOutputTonemapWgsl("neutral");
    // low-end black offset (Khronos PBR-neutral)
    expect(neutral).toContain("6.25 * lowest * lowest");
    // final hue-preserving desaturation toward the new peak
    expect(neutral).toContain("mix(c, vec3f(newPeak), g)");
    // StartCompression = 0.8 - 0.04
    expect(neutral).toContain("0.8 - 0.04");
  });

  it("matches reference values via a faithful JS port (GPU-free pin)", () => {
    // Tuple-typed so every access is a `number` under the test tsconfig's
    // noUncheckedIndexedAccess. Column-major mat3 (three.js mat3(col0,col1,col2)
    // / WGSL `m * v`).
    type Vec3 = [number, number, number];
    const mul3 = (m: [Vec3, Vec3, Vec3], [x, y, z]: Vec3): Vec3 => {
      const [a, b, c] = m;
      return [
        a[0] * x + b[0] * y + c[0] * z,
        a[1] * x + b[1] * y + c[1] * z,
        a[2] * x + b[2] * y + c[2] * z,
      ];
    };
    const cl = (x: number) => Math.min(1, Math.max(0, x));
    const cl3 = ([x, y, z]: Vec3): Vec3 => [cl(x), cl(y), cl(z)];
    const linSrgbToRec2020: [Vec3, Vec3, Vec3] = [
      [0.6274, 0.0691, 0.0164],
      [0.3293, 0.9195, 0.088],
      [0.0433, 0.0113, 0.8956],
    ];
    const linRec2020ToSrgb: [Vec3, Vec3, Vec3] = [
      [1.6605, -0.1246, -0.0182],
      [-0.5876, 1.1329, -0.1006],
      [-0.0728, -0.0083, 1.1187],
    ];
    const agxInset: [Vec3, Vec3, Vec3] = [
      [0.856627153315983, 0.137318972929847, 0.11189821299995],
      [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
      [0.0482516061458583, 0.101439036467562, 0.811302368396859],
    ];
    const agxOutset: [Vec3, Vec3, Vec3] = [
      [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
      [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
      [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
    ];
    const agxContrast = (x: number) => {
      const x2 = x * x;
      const x4 = x2 * x2;
      return (
        15.5 * x4 * x2 -
        40.14 * x4 * x +
        31.96 * x4 -
        6.868 * x2 * x +
        0.4298 * x2 +
        0.1191 * x -
        0.00232
      );
    };
    const agx = (color: Vec3): Vec3 => {
      const minEv = -12.47393;
      const maxEv = 4.026069;
      const encode = (x: number) =>
        cl((Math.log2(Math.max(x, 1e-10)) - minEv) / (maxEv - minEv));
      const [ix, iy, iz] = mul3(agxInset, mul3(linSrgbToRec2020, color));
      const contrasted: Vec3 = [
        agxContrast(encode(ix)),
        agxContrast(encode(iy)),
        agxContrast(encode(iz)),
      ];
      const [ox, oy, oz] = mul3(agxOutset, contrasted);
      const gamma: Vec3 = [
        Math.pow(Math.max(0, ox), 2.2),
        Math.pow(Math.max(0, oy), 2.2),
        Math.pow(Math.max(0, oz), 2.2),
      ];
      return cl3(mul3(linRec2020ToSrgb, gamma));
    };
    const neutral = ([r, g, b]: Vec3): Vec3 => {
      const startCompression = 0.8 - 0.04;
      const desaturation = 0.15;
      const lowest = Math.min(r, g, b);
      const offset = lowest < 0.08 ? lowest - 6.25 * lowest * lowest : 0.04;
      const cr = r - offset;
      const cg = g - offset;
      const cb = b - offset;
      const peak = Math.max(cr, cg, cb);
      if (peak < startCompression) return [cr, cg, cb];
      const d = 1 - startCompression;
      const newPeak = 1 - (d * d) / (peak + d - startCompression);
      const scale = newPeak / peak;
      const gg = 1 - 1 / (desaturation * (peak - newPeak) + 1);
      const mix = (v: number) => v * scale * (1 - gg) + newPeak * gg;
      return [mix(cr), mix(cg), mix(cb)];
    };

    // Pins shared with the Dawn numeric harness.
    const close = (got: Vec3, want: Vec3) => {
      expect(got[0]).toBeCloseTo(want[0], 4);
      expect(got[1]).toBeCloseTo(want[1], 4);
      expect(got[2]).toBeCloseTo(want[2], 4);
    };
    close(agx([0.18, 0.18, 0.18]), [0.214549, 0.214502, 0.214499]);
    close(agx([1, 0, 0]), [0.723276, 0.105847, 0.066736]);
    close(agx([3, 1.5, 0.3]), [0.849271, 0.679243, 0.449166]);
    close(neutral([1, 0, 0]), [0.88, 0.01556, 0.01556]);
    close(neutral([3, 1.5, 0.3]), [0.976393, 0.595061, 0.289996]);
    close(neutral([0.18, 0.18, 0.18]), [0.14, 0.14, 0.14]);
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
