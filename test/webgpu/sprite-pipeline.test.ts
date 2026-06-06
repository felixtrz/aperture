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
});
