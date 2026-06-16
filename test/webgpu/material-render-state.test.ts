import { describe, expect, it } from "vitest";

import {
  createWebGpuDepthStencilDescriptor,
  resolveWebGpuPipelineRenderState,
} from "../../packages/webgpu/src/materials/core/material-render-state.js";

describe("WebGPU material render-state descriptors", () => {
  it("enables opaque depth write when a depth format is attached", () => {
    const renderState = resolveWebGpuPipelineRenderState(
      "standard|opaque|back|less|none",
      "depth24plus",
    );

    expect(
      createWebGpuDepthStencilDescriptor("depth24plus", renderState),
    ).toEqual({
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    });
  });

  it("keeps the no-depth fallback descriptor null", () => {
    const renderState = resolveWebGpuPipelineRenderState(
      "standard|opaque|back|less|none",
      null,
    );

    expect(createWebGpuDepthStencilDescriptor(null, renderState)).toBeNull();
  });

  it("depth-tests alpha-blend pipelines without depth writes", () => {
    const renderState = resolveWebGpuPipelineRenderState(
      "standard|blend|back|less|alpha",
      "depth24plus",
    );

    expect(
      createWebGpuDepthStencilDescriptor("depth24plus", renderState),
    ).toEqual({
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "less",
    });
  });

  it("parses material depth bias tokens into WebGPU depth-stencil descriptors", () => {
    const renderState = resolveWebGpuPipelineRenderState(
      "unlit|depth-bias:-2:1.5|blend|none|less|alpha",
      "depth24plus",
    );

    expect(
      createWebGpuDepthStencilDescriptor("depth24plus", renderState),
    ).toEqual({
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "less",
      depthBias: -2,
      depthBiasSlopeScale: 1.5,
    });
  });
});
