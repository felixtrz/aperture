import { describe, expect, it } from "vitest";

import {
  STANDARD_MESH_WGSL,
  STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  createBrowserStandardRenderPipelineDescriptor,
  createStandardRenderPipelineResource,
  createStandardTextureVariantShader,
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

const ALPHA_BLEND_STATE = {
  color: {
    srcFactor: "src-alpha",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
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

  it("uses a tangent primitive vertex layout for normal-map standard shaders", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
    });
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
    });

    expect(descriptor.vertex).toMatchObject({
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
    });
  });

  it("uses a TEXCOORD_1 primitive vertex layout for UV1 standard shaders", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: true,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      texCoord1: true,
    });
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
    });

    expect(descriptor.vertex).toMatchObject({
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
    });
  });

  it("builds browser descriptors for opaque, mask, and alpha-blend standard render states", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const opaque = createBrowserStandardRenderPipelineDescriptor({
      shaderModule,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: STANDARD_BATCH_KEY,
    });
    const mask = createBrowserStandardRenderPipelineDescriptor({
      shaderModule,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|mask|front|less-equal|none",
        materialKey: "material:standard-cutout",
      },
    });
    const alphaBlend = createBrowserStandardRenderPipelineDescriptor({
      shaderModule,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|blend|none|less|alpha",
        materialKey: "material:standard-glass",
      },
    });

    expect(opaque).toMatchObject({
      fragment: { targets: [{ format: "bgra8unorm" }] },
      primitive: { cullMode: "back" },
      depthStencil: { depthWriteEnabled: true, depthCompare: "less" },
    });
    expect(mask).toMatchObject({
      fragment: { targets: [{ format: "bgra8unorm" }] },
      primitive: { cullMode: "front" },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less-equal",
      },
    });
    expect(alphaBlend).toMatchObject({
      fragment: {
        targets: [{ format: "bgra8unorm", blend: ALPHA_BLEND_STATE }],
      },
      primitive: { cullMode: "none" },
      depthStencil: { depthWriteEnabled: false, depthCompare: "less" },
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
