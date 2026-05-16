import { describe, expect, it } from "vitest";

import {
  MATCAP_MESH_WGSL,
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  createBrowserMatcapRenderPipelineDescriptor,
  createMatcapRenderPipelineResource,
  type BatchCompatibilityKey,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu";

const MATCAP_BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
  materialKey: "material:studio-matcap",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("browser matcap material pipeline bridge", () => {
  it("builds a browser-valid matcap pipeline descriptor with primitive vertex layout", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const descriptor = createBrowserMatcapRenderPipelineDescriptor({
      shaderModule,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });

    expect(descriptor).toMatchObject({
      label: "aperture/matcap-mesh:bgra8unorm:triangle-list",
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
    const pipeline = { kind: "matcap-render-pipeline" };
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

    const result = await createMatcapRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: MATCAP_BATCH_KEY,
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
      "aperture/matcap-mesh",
    );
    expect(shaderDescriptors).toEqual([
      {
        label: "aperture/matcap-mesh",
        code: MATCAP_MESH_WGSL,
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
    const result = await createMatcapRenderPipelineResource({
      device: {
        createShaderModule() {
          return { compilationInfo: async () => ({ messages: [] }) };
        },
      },
      colorFormat: "bgra8unorm",
      batchKey: MATCAP_BATCH_KEY,
    });

    expect(result.resource).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "matcapRenderPipeline.createRenderPipelineUnavailable",
        message: "WebGPU device cannot create matcap material pipelines.",
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
