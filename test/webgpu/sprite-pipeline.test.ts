import { describe, expect, it } from "vitest";

import {
  SPRITE_WGSL,
  createSpriteRenderPipelineResource,
  spritePipelineCacheKey,
  type SpriteRenderPipelineDeviceLike,
} from "@aperture-engine/webgpu";

describe("sprite billboard WebGPU pipeline", () => {
  it("builds a transparent billboard pipeline from camera-facing basis vectors", async () => {
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
    expect(SPRITE_WGSL).toContain(
      "let toCamera = safeNormalize(view.cameraPosition.xyz - center",
    );
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
