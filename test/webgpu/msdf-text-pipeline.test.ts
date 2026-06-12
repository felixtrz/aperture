import { describe, expect, it } from "vitest";

import {
  MSDF_TEXT_WGSL,
  createMsdfTextRenderPipelineResource,
  msdfTextPipelineCacheKey,
  type MsdfTextRenderPipelineDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("MSDF text WebGPU pipeline", () => {
  it("builds a transparent linear-data atlas text pipeline", async () => {
    const renderPipelineDescriptors: unknown[] = [];
    const device: MsdfTextRenderPipelineDeviceLike = {
      createShaderModule: () => ({
        compilationInfo: async () => ({ messages: [] }),
      }),
      createRenderPipeline: (descriptor) => {
        renderPipelineDescriptors.push(descriptor);
        return { getBindGroupLayout: (group: number) => ({ group }) };
      },
    };

    const result = await createMsdfTextRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource?.cacheKey).toBe(
      msdfTextPipelineCacheKey("bgra8unorm", "depth24plus"),
    );
    expect(MSDF_TEXT_WGSL).toContain("struct GlyphData");
    expect(MSDF_TEXT_WGSL).toContain("metadata: vec4f");
    expect(MSDF_TEXT_WGSL).toContain(
      "let transformIndex = u32(glyph.metadata.x)",
    );
    expect(MSDF_TEXT_WGSL).toContain("fn median");
    expect(MSDF_TEXT_WGSL).toContain("textureSample(fontAtlasTexture");
    expect(MSDF_TEXT_WGSL).toContain("MSDF atlas textures are linear data");
    expect(MSDF_TEXT_WGSL).toContain("let dpiScale = max(input.params.w");
    expect(MSDF_TEXT_WGSL).toContain("let screenPxRange = max");
    expect(MSDF_TEXT_WGSL).toContain("input.color.a * opacity");
    expect(renderPipelineDescriptors).toEqual([
      expect.objectContaining({
        label: "aperture/msdf-text:bgra8unorm",
        layout: "auto",
        vertex: expect.objectContaining({ entryPoint: "vs_main" }),
        fragment: expect.objectContaining({
          entryPoint: "fs_main",
          targets: [
            expect.objectContaining({
              format: "bgra8unorm",
              blend: {
                color: {
                  operation: "add",
                  srcFactor: "src-alpha",
                  dstFactor: "one-minus-src-alpha",
                },
                alpha: {
                  operation: "add",
                  srcFactor: "one",
                  dstFactor: "one-minus-src-alpha",
                },
              },
            }),
          ],
        }),
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: false,
          depthCompare: "less",
        },
      }),
    ]);
  });
});

describe("MSDF text pipeline output-stage tonemap/encode (AI-17)", () => {
  function recordingDevice(): {
    device: MsdfTextRenderPipelineDeviceLike;
    shaderCodes: string[];
  } {
    const shaderCodes: string[] = [];
    const device: MsdfTextRenderPipelineDeviceLike = {
      createShaderModule: (descriptor: { readonly code?: string }) => {
        shaderCodes.push(descriptor.code ?? "");
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createRenderPipeline: () => ({
        getBindGroupLayout: (group: number) => ({ group }),
      }),
    };
    return { device, shaderCodes };
  }

  it("wraps the text fragment with the output stage when requested", async () => {
    const { device, shaderCodes } = recordingDevice();
    const result = await createMsdfTextRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "aces",
      outputColorSpace: "srgb",
    });
    expect(result.valid).toBe(true);
    expect(shaderCodes[0]).toContain(
      "apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb))",
    );
    expect(shaderCodes[0]?.match(/@fragment/g)).toHaveLength(1);
    expect(result.resource?.cacheKey).toContain("tonemap:aces");
    expect(result.resource?.cacheKey).toContain("output-color:srgb");
  });

  it("leaves the text shader + cache key byte-identical on none + linear", async () => {
    const { device, shaderCodes } = recordingDevice();
    const result = await createMsdfTextRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "none",
      outputColorSpace: "linear",
    });
    expect(shaderCodes[0]).toBe(MSDF_TEXT_WGSL);
    expect(result.resource?.cacheKey).toBe(
      msdfTextPipelineCacheKey("bgra8unorm", "depth24plus"),
    );
  });
});
