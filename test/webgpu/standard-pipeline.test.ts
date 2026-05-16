import { describe, expect, it } from "vitest";

import {
  STANDARD_MESH_WGSL,
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  createBrowserStandardRenderPipelineDescriptor,
  createStandardRenderPipelineResource,
  type BatchCompatibilityKey,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu";

const STANDARD_BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "standard|opaque|back|less|none",
  materialKey: "material:standard-gold",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("browser standard material pipeline bridge", () => {
  it("builds a browser-valid standard pipeline descriptor with primitive vertex layout", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shaderModule,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });

    expect(descriptor).toMatchObject({
      label: "aperture/standard-mesh:bgra8unorm:triangle-list",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format: "bgra8unorm" }],
      },
      primitive: {
        topology: "triangle-list",
        frontFace: "ccw",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
  });

  it("creates the WGSL shader module and render pipeline through an injected device", async () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const pipeline = { kind: "standard-render-pipeline" };
    const shaderDescriptors: WebGpuShaderCreateDescriptor[] = [];
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const device = {
      createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
        shaderDescriptors.push(descriptor);
        return shaderModule;
      },
      createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
        pipelineDescriptors.push(descriptor);
        return pipeline;
      },
    };

    const result = await createStandardRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: STANDARD_BATCH_KEY,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      shaderModule,
      pipeline,
      descriptor: {
        vertex: { module: shaderModule },
        fragment: { module: shaderModule },
      },
    });
    expect(required(result.resource).cacheKey).toContain(
      "aperture/standard-mesh",
    );
    expect(shaderDescriptors).toEqual([
      {
        label: "aperture/standard-mesh",
        code: STANDARD_MESH_WGSL,
      },
    ]);
    expect(pipelineDescriptors).toHaveLength(1);
    expect(pipelineDescriptors[0]).toMatchObject({
      vertex: {
        module: shaderModule,
        buffers: [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
      },
      primitive: { topology: "triangle-list", cullMode: "back" },
    });
  });

  it("diagnoses missing pipeline creation separately from shader creation", async () => {
    const result = await createStandardRenderPipelineResource({
      device: {
        createShaderModule() {
          return { compilationInfo: async () => ({ messages: [] }) };
        },
      },
      colorFormat: "bgra8unorm",
      batchKey: STANDARD_BATCH_KEY,
    });

    expect(result.resource).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "standardRenderPipeline.createRenderPipelineUnavailable",
        message: "WebGPU device cannot create standard material pipelines.",
      },
    ]);
  });
});

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
