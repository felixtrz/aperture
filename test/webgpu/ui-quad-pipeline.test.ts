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

describe("UI quad pipeline output-stage tonemap/encode (AI-17)", () => {
  function recordingDevice(): {
    device: UiQuadRenderPipelineDeviceLike;
    shaderCodes: string[];
  } {
    const shaderCodes: string[] = [];
    const device: UiQuadRenderPipelineDeviceLike = {
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

  it("wraps panel + image fragments with the output stage when requested", async () => {
    const panel = recordingDevice();
    const panelResult = await createUiPanelRenderPipelineResource({
      device: panel.device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "aces",
      outputColorSpace: "srgb",
    });
    expect(panel.shaderCodes[0]).toContain(
      "apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb))",
    );
    expect(panel.shaderCodes[0]?.match(/@fragment/g)).toHaveLength(1);
    expect(panelResult.resource?.cacheKey).toContain("tonemap:aces");
    expect(panelResult.resource?.cacheKey).toContain("output-color:srgb");

    const image = recordingDevice();
    const imageResult = await createUiImageRenderPipelineResource({
      device: image.device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "aces",
      outputColorSpace: "srgb",
    });
    expect(image.shaderCodes[0]).toContain(
      "apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb))",
    );
    expect(imageResult.resource?.cacheKey).toContain("output-color:srgb");
  });

  it("leaves panel + image byte-identical on none + linear", async () => {
    const panel = recordingDevice();
    const panelResult = await createUiPanelRenderPipelineResource({
      device: panel.device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "none",
      outputColorSpace: "linear",
    });
    expect(panel.shaderCodes[0]).toBe(UI_PANEL_WGSL);
    expect(panelResult.resource?.cacheKey).toBe(
      uiPanelPipelineCacheKey("bgra8unorm", "depth24plus"),
    );

    const image = recordingDevice();
    await createUiImageRenderPipelineResource({
      device: image.device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });
    expect(image.shaderCodes[0]).toBe(UI_IMAGE_WGSL);
  });
});
