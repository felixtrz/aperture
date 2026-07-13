import { describe, expect, it } from "vitest";

import {
  createRenderTargetAsset,
  isRenderTargetAsset,
  resolveRenderTargetAssetFormat,
  validateRenderTargetAsset,
  type RenderTargetAsset,
} from "@aperture-engine/render";

describe("render target source assets", () => {
  it("creates data-only render target assets with defaults", () => {
    const asset = createRenderTargetAsset({ width: 256, height: 128 });

    expect(asset).toEqual({
      kind: "render-target",
      label: "Render Target",
      width: 256,
      height: 128,
      format: "swapchain",
      msaa: 1,
      depth: true,
      sampleable: true,
    });
    expect(validateRenderTargetAsset(asset).valid).toBe(true);
    expect(isRenderTargetAsset(asset)).toBe(true);
  });

  it("resolves the swapchain format renderer-side and keeps concrete formats", () => {
    expect(
      resolveRenderTargetAssetFormat({ format: "swapchain" }, "bgra8unorm"),
    ).toBe("bgra8unorm");
    expect(
      resolveRenderTargetAssetFormat({ format: "rgba16float" }, "bgra8unorm"),
    ).toBe("rgba16float");
  });

  it("rejects non-positive and non-integer sizes", () => {
    for (const size of [0, -64, 2.5, Number.NaN]) {
      const report = validateRenderTargetAsset(
        createRenderTargetAsset({ width: size, height: 64 }),
      );

      expect(report.valid).toBe(false);
      expect(
        report.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "renderTargetAsset.invalidSize" &&
            diagnostic.field === "width",
        ),
      ).toBe(true);
    }
  });

  it("rejects unknown formats", () => {
    const report = validateRenderTargetAsset(
      createRenderTargetAsset({
        width: 64,
        height: 64,
        format: "r32float" as unknown as RenderTargetAsset["format"],
      }),
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "renderTargetAsset.invalidFormat",
        severity: "error",
        field: "format",
      },
    ]);
  });

  it("rejects msaa values other than 1 and 4", () => {
    const report = validateRenderTargetAsset(
      createRenderTargetAsset({
        width: 64,
        height: 64,
        msaa: 8 as unknown as RenderTargetAsset["msaa"],
      }),
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      { code: "renderTargetAsset.invalidMsaa", severity: "error" },
    ]);
  });

  it("rejects depth: false with an explanatory diagnostic", () => {
    const report = validateRenderTargetAsset(
      createRenderTargetAsset({ width: 64, height: 64, depth: false }),
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "renderTargetAsset.depthDisabledUnsupported",
        severity: "error",
        field: "depth",
      },
    ]);
    expect(report.diagnostics[0]?.message).toContain("depth buffer");
  });

  it("rejects live GPU textures — the asset must stay data-only", () => {
    const live = {
      ...createRenderTargetAsset({ width: 64, height: 64 }),
      texture: { createView: () => ({}) },
    } as RenderTargetAsset;
    const report = validateRenderTargetAsset(live);

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      { code: "renderTargetAsset.liveRendererObject", severity: "error" },
    ]);
  });

  it("distinguishes facade assets from the low-level live-texture payload", () => {
    // The low-level createWebGpuAppRenderTargetAsset payload wraps a live
    // texture and has no kind discriminator — the guard must reject it.
    expect(
      isRenderTargetAsset({
        texture: { createView: () => ({}) },
        width: 64,
        height: 64,
      }),
    ).toBe(false);
    expect(isRenderTargetAsset(null)).toBe(false);
    expect(isRenderTargetAsset("render-target")).toBe(false);
  });

  it("flags empty labels as warnings without failing validation alone", () => {
    const report = validateRenderTargetAsset(
      createRenderTargetAsset({ label: "  ", width: 4, height: 4 }),
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toMatchObject([
      { code: "renderTargetAsset.invalidLabel", severity: "warning" },
    ]);
  });
});
