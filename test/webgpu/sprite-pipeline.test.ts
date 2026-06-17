import { describe, expect, it } from "vitest";

import {
  SPRITE_WGSL,
  createSpriteRenderPipelineResource,
  spritePipelineCacheKey,
  type SpriteRenderPipelineDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("sprite billboard WebGPU pipeline", () => {
  it("builds a transparent quad sprite pipeline from packed sprite records", async () => {
    const renderPipelineDescriptors: unknown[] = [];
    const device: SpriteRenderPipelineDeviceLike = {
      createShaderModule: () => ({
        compilationInfo: async () => ({ messages: [] }),
      }),
      createRenderPipeline: (descriptor) => {
        renderPipelineDescriptors.push(descriptor);
        return { getBindGroupLayout: (group: number) => ({ group }) };
      },
    };

    const result = await createSpriteRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource?.cacheKey).toBe(
      spritePipelineCacheKey("bgra8unorm", "depth24plus"),
    );
    expect(SPRITE_WGSL).toContain("viewport: vec4f");
    expect(SPRITE_WGSL).toContain("var toCamera = safeNormalize(cameraDelta");
    expect(SPRITE_WGSL).toContain("let flags = u32(sprite.mode.x)");
    expect(SPRITE_WGSL).toContain("let coordinateMode = flags & 3u");
    expect(SPRITE_WGSL).toContain("let sizeMode = (flags >> 6u) & 3u");
    expect(SPRITE_WGSL).toContain("let transformIndex = u32(sprite.mode.z)");
    expect(SPRITE_WGSL).toContain("sprite.uvRect.xy + quadUv(vertexIndex)");
    expect(SPRITE_WGSL).toContain(
      "quadPosition(vertexIndex) - sprite.sizePivot.zw",
    );
    expect(SPRITE_WGSL).toContain("let viewportSize = max(view.viewport.xy");
    expect(SPRITE_WGSL).toContain("centerClip + vec4f(clipOffset");
    expect(SPRITE_WGSL).toContain("cross(worldUp, toCamera)");
    expect(SPRITE_WGSL).toContain("center + billboardOffset");
    expect(renderPipelineDescriptors).toEqual([
      expect.objectContaining({
        label: "aperture/sprite-billboard:bgra8unorm",
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

  it("can build a depth-disabled sprite pipeline for source-style overlay effects", async () => {
    const renderPipelineDescriptors: unknown[] = [];
    const device: SpriteRenderPipelineDeviceLike = {
      createShaderModule: () => ({
        compilationInfo: async () => ({ messages: [] }),
      }),
      createRenderPipeline: (descriptor) => {
        renderPipelineDescriptors.push(descriptor);
        return { getBindGroupLayout: (group: number) => ({ group }) };
      },
    };

    const result = await createSpriteRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      depthMode: "disabled",
    });

    expect(result.valid).toBe(true);
    expect(result.resource?.cacheKey).toBe(
      spritePipelineCacheKey(
        "bgra8unorm",
        "depth24plus",
        1,
        "none",
        "linear",
        "disabled",
      ),
    );
    expect(renderPipelineDescriptors).toEqual([
      expect.objectContaining({
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: false,
          depthCompare: "always",
        },
      }),
    ]);
  });
});

describe("sprite pipeline output-stage tonemap/encode (AI-17)", () => {
  function recordingDevice(): {
    device: SpriteRenderPipelineDeviceLike;
    shaderCodes: string[];
  } {
    const shaderCodes: string[] = [];
    const device: SpriteRenderPipelineDeviceLike = {
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

  it("wraps the sprite fragment with the output stage when a non-default operator/color space is requested", async () => {
    const { device, shaderCodes } = recordingDevice();
    const result = await createSpriteRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "aces",
      outputColorSpace: "srgb",
    });

    expect(result.valid).toBe(true);
    expect(shaderCodes[0]).toContain(
      "fn apertureOutputStageInner(input: VertexOutput) -> vec4f",
    );
    expect(shaderCodes[0]).toContain(
      "apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb))",
    );
    // alpha forwarded untouched; exactly one @fragment entry remains.
    expect(shaderCodes[0]).toContain("apertureFragment.a)");
    expect(shaderCodes[0]?.match(/@fragment/g)).toHaveLength(1);
    expect(result.resource?.cacheKey).toContain("tonemap:aces");
    expect(result.resource?.cacheKey).toContain("output-color:srgb");
  });

  it("leaves the sprite shader and cache key byte-identical on the HDR path (none + linear)", async () => {
    const { device, shaderCodes } = recordingDevice();
    const result = await createSpriteRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "none",
      outputColorSpace: "linear",
    });

    expect(shaderCodes[0]).toBe(SPRITE_WGSL);
    expect(result.resource?.cacheKey).toBe(
      spritePipelineCacheKey("bgra8unorm", "depth24plus"),
    );
  });
});
