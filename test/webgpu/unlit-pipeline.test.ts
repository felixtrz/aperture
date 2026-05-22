import { describe, expect, it } from "vitest";

import {
  createBrowserUnlitRenderPipelineDescriptor,
  createUnlitRenderPipelineResource,
  UNLIT_MESH_WGSL,
  UNLIT_TEXTURED_MESH_WGSL,
  UNLIT_TEXTURED_VERTEX_COLOR_MESH_WGSL,
  UNLIT_VERTEX_COLOR_MESH_WGSL,
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  UNLIT_VERTEX_COLOR_FLOAT32X3_VERTEX_BUFFER_LAYOUT,
  UNLIT_VERTEX_COLOR_VERTEX_BUFFER_LAYOUT,
  UNLIT_VERTEX_COLOR_UNORM8_VERTEX_BUFFER_LAYOUT,
  type BatchCompatibilityKey,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu";

const BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "unlit|opaque|back|less|none",
  materialKey: "material:white",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

const TEXTURED_BATCH_KEY: BatchCompatibilityKey = {
  ...BATCH_KEY,
  pipelineKey: "unlit|baseColorTexture|opaque|back|less|none",
  materialKey: "material:textured",
};

const VERTEX_COLOR_BATCH_KEY: BatchCompatibilityKey = {
  ...BATCH_KEY,
  meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
  materialKey: "material:vertex-color",
};

const TEXTURED_VERTEX_COLOR_BATCH_KEY: BatchCompatibilityKey = {
  ...TEXTURED_BATCH_KEY,
  meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0",
  materialKey: "material:textured-vertex-color",
};

describe("browser unlit pipeline bridge", () => {
  it("builds a browser-valid unlit pipeline descriptor with primitive vertex layout", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const descriptor = createBrowserUnlitRenderPipelineDescriptor({
      shaderModule,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });

    expect(descriptor).toMatchObject({
      label: "aperture/unlit-mesh:bgra8unorm:triangle-list",
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
    const pipeline = { kind: "render-pipeline" };
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

    const result = await createUnlitRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: BATCH_KEY,
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
    expect(required(result.resource).cacheKey).toContain("aperture/unlit-mesh");
    expect(shaderDescriptors).toEqual([
      {
        label: "aperture/unlit-mesh",
        code: UNLIT_MESH_WGSL,
      },
    ]);
    expect(pipelineDescriptors).toHaveLength(1);
    expect(pipelineDescriptors[0]).toMatchObject({
      vertex: {
        module: shaderModule,
        buffers: [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
      },
      primitive: { topology: "triangle-list" },
    });
  });

  it("creates the textured WGSL shader module when the batch key requires it", async () => {
    const shaderDescriptors: WebGpuShaderCreateDescriptor[] = [];
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const device = {
      createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
        shaderDescriptors.push(descriptor);
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
        pipelineDescriptors.push(descriptor);
        return { kind: "render-pipeline" };
      },
    };

    const result = await createUnlitRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      batchKey: TEXTURED_BATCH_KEY,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      cacheKey: expect.stringContaining("aperture/unlit-mesh-textured"),
      descriptor: {
        label: "aperture/unlit-mesh-textured:bgra8unorm:triangle-list",
      },
    });
    expect(shaderDescriptors).toEqual([
      {
        label: "aperture/unlit-mesh-textured",
        code: UNLIT_TEXTURED_MESH_WGSL,
      },
    ]);
    expect(pipelineDescriptors[0]).toMatchObject({
      vertex: { entryPoint: "vs_main" },
      fragment: { entryPoint: "fs_main" },
    });
  });

  it("creates a vertex-color WGSL shader module and matching vertex layout", async () => {
    const shaderDescriptors: WebGpuShaderCreateDescriptor[] = [];
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const device = {
      createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
        shaderDescriptors.push(descriptor);
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
        pipelineDescriptors.push(descriptor);
        return { kind: "render-pipeline" };
      },
    };

    const result = await createUnlitRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      batchKey: VERTEX_COLOR_BATCH_KEY,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      cacheKey: expect.stringContaining("aperture/unlit-mesh-vertex-color"),
      descriptor: {
        label: "aperture/unlit-mesh-vertex-color:bgra8unorm:triangle-list",
      },
    });
    expect(shaderDescriptors).toEqual([
      {
        label: "aperture/unlit-mesh-vertex-color",
        code: UNLIT_VERTEX_COLOR_MESH_WGSL,
      },
    ]);
    expect(pipelineDescriptors[0]).toMatchObject({
      vertex: {
        entryPoint: "vs_main",
        buffers: [UNLIT_VERTEX_COLOR_VERTEX_BUFFER_LAYOUT],
      },
      fragment: { entryPoint: "fs_main" },
    });
  });

  it("creates compact vertex-color layouts for compact COLOR_0 meshes", async () => {
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const device = {
      createShaderModule() {
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
        pipelineDescriptors.push(descriptor);
        return { kind: "render-pipeline" };
      },
    };

    const result = await createUnlitRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      batchKey: {
        ...VERTEX_COLOR_BATCH_KEY,
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0:float32x3",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource?.cacheKey).toContain(
      "aperture/unlit-mesh-vertex-color",
    );
    expect(pipelineDescriptors[0]).toMatchObject({
      vertex: {
        entryPoint: "vs_main",
        buffers: [UNLIT_VERTEX_COLOR_FLOAT32X3_VERTEX_BUFFER_LAYOUT],
      },
    });

    const normalized = createBrowserUnlitRenderPipelineDescriptor({
      shaderModule: { compilationInfo: async () => ({ messages: [] }) },
      colorFormat: "bgra8unorm",
      batchKey: {
        ...VERTEX_COLOR_BATCH_KEY,
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0:unorm8x4",
      },
    });

    expect(normalized.vertex).toMatchObject({
      buffers: [UNLIT_VERTEX_COLOR_UNORM8_VERTEX_BUFFER_LAYOUT],
    });
  });

  it("derives multi-stream vertex layouts from stream-aware mesh keys", async () => {
    const shaderDescriptors: WebGpuShaderCreateDescriptor[] = [];
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const device = {
      createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
        shaderDescriptors.push(descriptor);
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
        pipelineDescriptors.push(descriptor);
        return { kind: "render-pipeline" };
      },
    };

    const result = await createUnlitRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      batchKey: {
        ...VERTEX_COLOR_BATCH_KEY,
        meshLayoutKey: "POSITION,NORMAL|TEXCOORD_0|COLOR_0:unorm8x4",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(shaderDescriptors[0]).toMatchObject({
      label: "aperture/unlit-mesh-vertex-color",
    });
    expect(pipelineDescriptors[0]?.vertex).toMatchObject({
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x3" },
          ],
        },
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 2, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 4,
          attributes: [{ shaderLocation: 5, offset: 0, format: "unorm8x4" }],
        },
      ],
    });
  });

  it("honors explicit source stream stride and attribute offsets", async () => {
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const device = {
      createShaderModule() {
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
        pipelineDescriptors.push(descriptor);
        return { kind: "render-pipeline" };
      },
    };

    const result = await createUnlitRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      batchKey: {
        ...BATCH_KEY,
        meshLayoutKey: "stride=40,POSITION@4,NORMAL@20,TEXCOORD_0@32",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(pipelineDescriptors[0]?.vertex).toMatchObject({
      buffers: [
        {
          arrayStride: 40,
          attributes: [
            { shaderLocation: 0, offset: 4, format: "float32x3" },
            { shaderLocation: 1, offset: 20, format: "float32x3" },
            { shaderLocation: 2, offset: 32, format: "float32x2" },
          ],
        },
      ],
    });
  });

  it("creates the combined textured vertex-color shader and vertex layout", async () => {
    const shaderDescriptors: WebGpuShaderCreateDescriptor[] = [];
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const device = {
      createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
        shaderDescriptors.push(descriptor);
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
        pipelineDescriptors.push(descriptor);
        return { kind: "render-pipeline" };
      },
    };

    const result = await createUnlitRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      batchKey: TEXTURED_VERTEX_COLOR_BATCH_KEY,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      cacheKey: expect.stringContaining(
        "aperture/unlit-mesh-textured-vertex-color",
      ),
      descriptor: {
        label:
          "aperture/unlit-mesh-textured-vertex-color:bgra8unorm:triangle-list",
      },
    });
    expect(shaderDescriptors).toEqual([
      {
        label: "aperture/unlit-mesh-textured-vertex-color",
        code: UNLIT_TEXTURED_VERTEX_COLOR_MESH_WGSL,
      },
    ]);
    expect(pipelineDescriptors[0]).toMatchObject({
      vertex: {
        entryPoint: "vs_main",
        buffers: [UNLIT_VERTEX_COLOR_VERTEX_BUFFER_LAYOUT],
      },
      fragment: { entryPoint: "fs_main" },
    });
  });

  it("diagnoses missing pipeline creation separately from shader creation", async () => {
    const result = await createUnlitRenderPipelineResource({
      device: {
        createShaderModule() {
          return { compilationInfo: async () => ({ messages: [] }) };
        },
      },
      colorFormat: "bgra8unorm",
      batchKey: BATCH_KEY,
    });

    expect(result.resource).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "unlitRenderPipeline.createRenderPipelineUnavailable",
        message: "WebGPU device cannot create render pipelines.",
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
