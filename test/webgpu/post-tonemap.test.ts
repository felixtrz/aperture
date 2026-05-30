import { describe, expect, it } from "vitest";

import {
  createWebGpuTonemapPostEffect,
  tonemapPostEffectWgsl,
} from "@aperture-engine/webgpu/test-support";

describe("HDR tonemap post effect", () => {
  it("bakes exposure + the operator + sRGB encode into the full-screen WGSL", () => {
    const wgsl = tonemapPostEffectWgsl("aces", "srgb", 4);

    // exposure-aware tonemap + the baked exposure constant. The parameter is
    // `inputColor` (not `color`) so the injected `let color` is not a same-scope
    // redeclaration of the parameter — that would be a WGSL compile error.
    expect(wgsl).toContain(
      "fn apertureOutputTonemap(inputColor: vec3f, exposure: f32) -> vec3f",
    );
    expect(wgsl).toContain("let color = inputColor * exposure;");
    expect(
      wgsl,
      "exposure WGSL must not shadow its own parameter (WGSL compile error)",
    ).not.toContain("let color = color * exposure;");
    expect(wgsl).toContain("const APERTURE_EXPOSURE: f32 = 4.0;");
    // sRGB OETF + the full-screen fragment that samples the HDR scene buffer
    expect(wgsl).toContain("fn apertureOutputColorSpace");
    expect(wgsl).toContain("textureSample(inputTexture, inputSampler");
    expect(wgsl).toContain("apertureOutputTonemap(hdr.rgb, APERTURE_EXPOSURE)");
    expect(wgsl).toContain("apertureOutputColorSpace(tonemapped)");
  });

  it("formats integand fractional exposure as valid f32 literals", () => {
    expect(tonemapPostEffectWgsl("linear", "srgb", 1)).toContain(
      "const APERTURE_EXPOSURE: f32 = 1.0;",
    );
    expect(tonemapPostEffectWgsl("linear", "srgb", 0.25)).toContain(
      "const APERTURE_EXPOSURE: f32 = 0.25;",
    );
  });

  it("prepares a single full-screen draw against a capable post device", () => {
    const effect = createWebGpuTonemapPostEffect({
      operator: "aces",
      exposure: 1,
    });
    expect(effect.id).toBe("hdr-tonemap");

    const prepared = effect.prepare({
      device: {
        createShaderModule: () => ({}),
        createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
        createSampler: () => ({}),
        createBindGroup: () => ({}),
      } as never,
      input: {
        texture: { createView: () => ({}) },
        label: "scene",
      } as never,
      outputFormat: "rgba8unorm",
      width: 4,
      height: 4,
      frame: 0,
      passIndex: 0,
      isLast: true,
    } as never);

    expect(prepared.diagnostics).toHaveLength(0);
    const kinds = prepared.commands.map((command) => command.kind);
    expect(kinds).toEqual(["setPipeline", "setBindGroup", "draw"]);
  });

  it("emits a diagnostic (no commands) when the device cannot create pipelines", () => {
    const effect = createWebGpuTonemapPostEffect({
      operator: "aces",
      exposure: 1,
    });
    const prepared = effect.prepare({
      device: {} as never,
      input: { texture: { createView: () => ({}) }, label: "scene" } as never,
      outputFormat: "rgba8unorm",
      width: 4,
      height: 4,
      frame: 0,
      passIndex: 0,
      isLast: true,
    } as never);

    expect(prepared.commands).toHaveLength(0);
    expect(prepared.diagnostics[0]?.code).toBe(
      "webGpuPostPass.createShaderModuleUnavailable",
    );
  });
});
