import { describe, expect, it } from "vitest";

import {
  PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  createBoxMeshAsset,
  createDefaultRenderState,
  createInstanceAttributeLayout,
  defineInstanceAttributes,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type PreparedCustomWgslMaterial,
  type RuntimeUniformPacket,
} from "@aperture-engine/render";
import {
  createBrowserCustomWgslMaterialPipelineDescriptor,
  createCustomWgslAppFrameResources,
  createCustomWgslMaterialBindGroupLayoutDescriptor,
  createCustomWgslMaterialBindGroupResource,
  createCustomWgslMaterialRenderResources,
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  type CustomWgslMaterialBindGroupCreationDescriptor,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu/test-support";

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

  it("adds instance-rate vertex buffers for custom instance attributes", () => {
    const material = customWaterMaterial(
      required(
        createInstanceAttributeLayout(
          defineInstanceAttributes([
            { name: "wind", format: "float32x3" },
            { name: "phase", format: "float32" },
          ]),
        ),
      ),
    );
    const descriptor = createBrowserCustomWgslMaterialPipelineDescriptor({
      material,
      shaderModule: { kind: "shader-module" },
      colorFormat: "bgra8unorm",
      depthFormat: null,
    });

    expect((descriptor.vertex as { buffers?: unknown }).buffers).toEqual([
      UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
      {
        arrayStride: 16,
        stepMode: "instance",
        attributes: [
          { shaderLocation: 6, offset: 0, format: "float32x3" },
          { shaderLocation: 7, offset: 12, format: "float32" },
        ],
      },
    ]);
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

  it("updates runtime uniform buffers without recreating custom WGSL pipelines", async () => {
    const material = customWaterMaterial(null, {
      runtimeUniformKey: "water.params",
    });
    const writes: unknown[] = [];
    const bindGroups: unknown[] = [];
    const pipelines: unknown[] = [];
    const runtimeUniformCache = new Map();
    const reuse = { dynamicBufferWrites: 0 };
    const device = customFrameDevice(writes, bindGroups, pipelines);
    const first = await createCustomWgslAppFrameResources({
      device,
      mesh: createBoxMeshAsset({ label: "Runtime Uniform Box" }),
      material,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      runtimeUniforms: [runtimeUniformPacket([0.1, 0.2, 0.8, 1])],
      runtimeUniformCache,
      reuse,
    });

    expect(first.valid).toBe(true);
    expect(first.diagnostics).toEqual([]);
    expect(pipelines).toHaveLength(1);
    expect(runtimeUniformCache.size).toBe(1);

    const cachedRuntimeUniform = required([...runtimeUniformCache.values()][0]);
    const cachedBuffer = cachedRuntimeUniform.buffer;

    writes.length = 0;
    bindGroups.length = 0;

    const second = await createCustomWgslAppFrameResources({
      device,
      mesh: createBoxMeshAsset({ label: "Runtime Uniform Box" }),
      material,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      pipelineResult: required(first.pipelineResult),
      runtimeUniforms: [runtimeUniformPacket([1.0, 0.4, 0.1, 1])],
      runtimeUniformCache,
      reuse,
    });

    expect(second.valid).toBe(true);
    expect(second.diagnostics).toEqual([]);
    expect(pipelines).toHaveLength(1);
    expect(runtimeUniformCache.size).toBe(1);
    expect([...runtimeUniformCache.values()][0]?.buffer).toBe(cachedBuffer);
    expect(writes).toContainEqual(
      expect.objectContaining({ buffer: cachedBuffer }),
    );
    expect(reuse.dynamicBufferWrites).toBeGreaterThanOrEqual(2);
  });
});

function customWaterMaterial(
  instanceAttributes: PreparedCustomWgslMaterial["pipeline"]["instanceAttributes"] = null,
  options: { readonly runtimeUniformKey?: string } = {},
): PreparedCustomWgslMaterial {
  const renderState = createDefaultRenderState({
    cullMode: "none",
  });

  return {
    resourceFamily: "custom-wgsl-material",
    sourceMaterialKey: "material:water",
    materialKey: "material:water",
    label: "Water Material",
    materialFamily: "custom/water",
    pipelineKey:
      "custom/water|shader:abc123|vs:vs_main|fs:fs_main|instance-attributes:none|bindings:0:uniform-buffer|opaque|none|less|none",
    materialResourceKey:
      "custom-wgsl-bind-group:material:water:custom-water-pipeline",
    bindGroupResourceKey:
      "custom-wgsl-bind-group:material:water:custom-water-pipeline",
    shader: {
      language: "wgsl",
      moduleKey: "custom-wgsl-module:material:water:shader",
      sourceKey: "inline:material:water:water.wgsl",
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
        "custom/water|shader:abc123|vs:vs_main|fs:fs_main|instance-attributes:none|bindings:0:uniform-buffer|opaque|none|less|none",
      shaderModuleKey: "custom-wgsl-module:material:water:shader",
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
      renderState,
      instanceAttributes,
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
          fields: {
            water: { type: "vec4" },
          },
          values: {
            water: [0, 0, 1, 1],
          },
          ...(options.runtimeUniformKey === undefined
            ? {}
            : { runtimeUniformKey: options.runtimeUniformKey }),
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

function runtimeUniformPacket(
  water: readonly [number, number, number, number],
): RuntimeUniformPacket {
  return {
    uniformId: 99,
    entity: { index: 99, generation: 0 },
    key: "water.params",
    values: { water },
    version: 1,
  };
}

function packedViews(count: number): PackedSnapshotViewUniforms {
  return {
    data: identityViewUniforms(count),
    views: Array.from({ length: count }, (_, index) => ({
      viewId: index + 1,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}

function packedTransforms(count: number): PackedSnapshotTransforms {
  return {
    data: identityMatrices(count),
    offsets: Array.from({ length: count }, (_, index) => ({
      renderId: index + 7,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}

function identityMatrices(count: number): Float32Array {
  const data = new Float32Array(count * 16);

  for (let index = 0; index < count; index += 1) {
    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], index * 16);
  }

  return data;
}

function identityViewUniforms(count: number): Float32Array {
  const data = new Float32Array(count * PACKED_VIEW_UNIFORM_FLOAT_STRIDE);

  for (let index = 0; index < count; index += 1) {
    const offset = index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE;

    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], offset);
    data.set([index, 0, 1, 1], offset + 16);
  }

  return data;
}

function customFrameDevice(
  writes: unknown[],
  bindGroups: unknown[],
  pipelines: unknown[],
) {
  return {
    queue: {
      writeBuffer(
        buffer: unknown,
        bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) {
        writes.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer(descriptor: unknown) {
      return { descriptor };
    },
    createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
      return {
        descriptor,
        compilationInfo: async () => ({ messages: [] }),
      };
    },
    createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
      const pipeline = {
        descriptor,
        getBindGroupLayout(group: number) {
          return { group };
        },
      };

      pipelines.push(descriptor);
      return pipeline;
    },
    createBindGroup(descriptor: CustomWgslMaterialBindGroupCreationDescriptor) {
      bindGroups.push(descriptor);
      return { descriptor };
    },
  };
}

function required<T>(value: T | null | undefined): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected value to be present.");
  }

  return value as NonNullable<T>;
}
