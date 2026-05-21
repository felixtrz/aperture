import { describe, expect, it } from "vitest";

import {
  createDefaultRenderState,
  type PreparedCustomWgslMaterial,
} from "@aperture-engine/render";
import {
  createBrowserCustomWgslMaterialPipelineDescriptor,
  createCustomWgslMaterialBindGroupLayoutDescriptor,
  createCustomWgslMaterialBindGroupResource,
  createCustomWgslMaterialRenderResources,
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  type CustomWgslMaterialBindGroupCreationDescriptor,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu";

describe("custom WGSL material WebGPU resources", () => {
  it("builds browser pipeline and bind-group layout descriptors from prepared metadata", () => {
    const material = customWaterMaterial();
    const shaderModule = { kind: "shader-module" };
    const descriptor = createBrowserCustomWgslMaterialPipelineDescriptor({
      material,
      shaderModule,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });

    expect(descriptor).toMatchObject({
      label: "Water Material:bgra8unorm:triangle-list",
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
        cullMode: "none",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    expect(createCustomWgslMaterialBindGroupLayoutDescriptor(material)).toEqual(
      {
        label:
          "custom-wgsl-bind-group-layout:material:water:custom-water-pipeline",
        entries: [
          {
            binding: 0,
            visibility: 2,
            buffer: { type: "uniform" },
          },
        ],
      },
    );
  });

  it("omits custom material depth state when no depth format is provided", () => {
    const descriptor = createBrowserCustomWgslMaterialPipelineDescriptor({
      material: customWaterMaterial(),
      shaderModule: { kind: "shader-module" },
      colorFormat: "bgra8unorm",
      depthFormat: null,
    });

    expect(descriptor).not.toHaveProperty("depthStencil");
  });

  it("creates shader module, render pipeline, and material bind group through an injected device", async () => {
    const material = customWaterMaterial();
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const bindGroupLayout = { kind: "bind-group-layout-2" };
    const pipeline = {
      kind: "render-pipeline",
      getBindGroupLayout(group: number) {
        return group === 2 ? bindGroupLayout : null;
      },
    };
    const bindGroup = { kind: "bind-group" };
    const shaderDescriptors: WebGpuShaderCreateDescriptor[] = [];
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const bindGroupDescriptors: CustomWgslMaterialBindGroupCreationDescriptor[] =
      [];
    const device = {
      createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
        shaderDescriptors.push(descriptor);
        return shaderModule;
      },
      createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
        pipelineDescriptors.push(descriptor);
        return pipeline;
      },
      createBindGroup(
        descriptor: CustomWgslMaterialBindGroupCreationDescriptor,
      ) {
        bindGroupDescriptors.push(descriptor);
        return bindGroup;
      },
    };

    const result = await createCustomWgslMaterialRenderResources({
      device,
      material,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      resources: [
        {
          resourceKey: "material:water:binding:0",
          resource: { buffer: "water-uniform-buffer" },
        },
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      pipeline: {
        cacheKey: expect.stringContaining(material.pipeline.pipelineKey),
        shaderModule,
        pipeline,
      },
      bindGroup: {
        group: 2,
        resourceKey:
          "custom-wgsl-bind-group:material:water:custom-water-pipeline",
        layoutKey:
          "custom-wgsl-bind-group-layout:material:water:custom-water-pipeline",
        bindGroup,
        entryResourceKeys: [
          "material:water",
          "custom-wgsl-bind-group:material:water:custom-water-pipeline",
          "material:water:binding:0",
        ],
      },
    });
    expect(shaderDescriptors).toEqual([
      {
        label: "custom-wgsl-module:material:water:shader",
        code: material.shader.code,
      },
    ]);
    expect(pipelineDescriptors[0]).toMatchObject({
      vertex: { entryPoint: "vs_main" },
      fragment: { entryPoint: "fs_main" },
    });
    expect(bindGroupDescriptors).toEqual([
      {
        label: "custom-wgsl-bind-group:material:water:custom-water-pipeline",
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: "water-uniform-buffer" },
          },
        ],
      },
    ]);
  });

  it("diagnoses missing custom binding resources before bind-group creation", () => {
    const result = createCustomWgslMaterialBindGroupResource({
      device: {
        createBindGroup() {
          return { kind: "bind-group" };
        },
      },
      material: customWaterMaterial(),
      pipeline: {
        getBindGroupLayout() {
          return { kind: "bind-group-layout-2" };
        },
      },
      resources: [],
    });

    expect(result.resource).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "customWgslMaterial.missingBindingResource",
        binding: 0,
        resourceKey: "material:water:binding:0",
        message:
          "Missing GPU resource 'material:water:binding:0' for custom WGSL binding 0.",
      },
    ]);
  });
});

function customWaterMaterial(): PreparedCustomWgslMaterial {
  const renderState = createDefaultRenderState({
    cullMode: "none",
  });

  return {
    resourceFamily: "custom-wgsl-material",
    sourceMaterialKey: "material:water",
    materialKey: "material:water",
    label: "Water Material",
    materialFamily: "custom-water",
    shader: {
      language: "wgsl",
      moduleKey: "custom-wgsl-module:material:water:shader",
      code: `
        @group(2) @binding(0) var<uniform> water: vec4f;

        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f,
        };

        @vertex
        fn vs_main(
          @location(0) position: vec3f,
          @location(2) uv: vec2f,
        ) -> VertexOutput {
          var output: VertexOutput;
          output.position = vec4f(position, 1.0);
          output.uv = uv;
          return output;
        }

        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4f {
          return vec4f(input.uv, water.z, water.w);
        }
      `,
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
    },
    pipeline: {
      pipelineKey:
        "custom-water|shader:abc123|vs:vs_main|fs:fs_main|bindings:0:uniform-buffer|opaque|none|less|none",
      shaderModuleKey: "custom-wgsl-module:material:water:shader",
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
      renderState,
    },
    bindGroupLayout: {
      resourceKey:
        "custom-wgsl-bind-group-layout:material:water:custom-water-pipeline",
      entries: [
        {
          binding: 0,
          kind: "uniform-buffer",
          visibility: ["fragment"],
          label: "waterUniforms",
        },
      ],
    },
    bindGroup: {
      resourceKey:
        "custom-wgsl-bind-group:material:water:custom-water-pipeline",
      layoutResourceKey:
        "custom-wgsl-bind-group-layout:material:water:custom-water-pipeline",
      entries: [
        {
          binding: 0,
          kind: "uniform-buffer",
          resourceKey: "material:water:binding:0",
        },
      ],
    },
  };
}
