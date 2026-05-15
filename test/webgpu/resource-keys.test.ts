import { describe, expect, it } from "vitest";

import {
  materialUniformBufferResourceKey,
  bindGroupResourceKey,
  commandBufferResourceKey,
  commandEncoderResourceKey,
  meshBufferResourceKey,
  meshIndexBufferResourceKey,
  meshVertexBufferResourceKey,
  renderPipelineResourceKey,
  shaderModuleResourceKey,
  viewUniformBufferResourceKey,
  webGpuResourceKey,
} from "../../src/index.js";

describe("WebGPU renderer resource key conventions", () => {
  it("creates stable keys for renderer-owned resource kinds", () => {
    expect(meshBufferResourceKey("Cube")).toBe("mesh-buffer:Cube");
    expect(meshVertexBufferResourceKey("Cube", "p3n3uv2")).toBe(
      "mesh-vertex-buffer:Cube/vertex:p3n3uv2",
    );
    expect(meshIndexBufferResourceKey("Cube")).toBe(
      "mesh-index-buffer:Cube/index",
    );
    expect(materialUniformBufferResourceKey("White/uniform")).toBe(
      "material-buffer:White/uniform",
    );
    expect(viewUniformBufferResourceKey("Frame/view-uniforms")).toBe(
      "view-uniform-buffer:Frame/view-uniforms",
    );
    expect(shaderModuleResourceKey("aperture/unlit")).toBe(
      "shader-module:aperture/unlit",
    );
    expect(renderPipelineResourceKey("cache-key")).toBe(
      "render-pipeline:cache-key",
    );
    expect(bindGroupResourceKey("unlit/group-0")).toBe(
      "bind-group:unlit/group-0",
    );
    expect(commandBufferResourceKey("frame-1")).toBe("command-buffer:frame-1");
    expect(commandEncoderResourceKey("frame-1")).toBe(
      "command-encoder:frame-1",
    );
  });

  it("keeps resource kinds distinct and rejects empty ids", () => {
    expect(webGpuResourceKey("mesh-buffer", "shared")).not.toBe(
      webGpuResourceKey("material-buffer", "shared"),
    );
    expect(() => webGpuResourceKey("mesh-buffer", "")).toThrow("empty id");
    expect(() => materialUniformBufferResourceKey("   ")).toThrow("empty id");
  });
});
