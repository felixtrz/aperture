import { describe, expect, it } from "vitest";
import {
  UI_IMAGE_WGSL,
  UI_PANEL_WGSL,
  createUiImageRenderPipelineResource,
  createUiPanelRenderPipelineResource,
  uiImagePipelineCacheKey,
  uiPanelPipelineCacheKey,
  type UiQuadRenderPipelineDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("UI quad WebGPU pipelines", () => {
  it("builds alpha-blended screen-space panel and image pipelines with clipping", async () => {
    const descriptors: unknown[] = [];
    const device: UiQuadRenderPipelineDeviceLike = {
      createShaderModule: () => ({
        compilationInfo: async () => ({ messages: [] }),
      }),
      createRenderPipeline: (descriptor) => {
        descriptors.push(descriptor);
        return { getBindGroupLayout: (group: number) => ({ group }) };
      },
    };

    const panel = await createUiPanelRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });
    const image = await createUiImageRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      sampleCount: 4,
    });

    expect(panel.valid).toBe(true);
    expect(image.valid).toBe(true);
    expect(panel.resource?.cacheKey).toBe(
      uiPanelPipelineCacheKey("bgra8unorm", "depth24plus"),
    );
    expect(image.resource?.cacheKey).toBe(
      uiImagePipelineCacheKey("bgra8unorm", "depth24plus", 4),
    );
    expect(UI_PANEL_WGSL).toContain("screen.x / viewportSize.x");
    expect(UI_PANEL_WGSL).toContain("fn clipped");
    expect(UI_IMAGE_WGSL).toContain("textureSample(uiTexture");
    expect(descriptors).toEqual([
      expect.objectContaining({
        label: "aperture/ui-panel:bgra8unorm",
        layout: "auto",
        fragment: expect.objectContaining({
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
          depthCompare: "always",
        },
        multisample: { count: 1 },
      }),
      expect.objectContaining({
        label: "aperture/ui-image:bgra8unorm",
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: false,
          depthCompare: "always",
        },
        multisample: { count: 4 },
      }),
    ]);
  });
});
