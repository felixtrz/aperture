import { describe, expect, it } from "vitest";

import {
  STANDARD_SHADOW_RECEIVER_MESH_WGSL,
  INSTANCE_TINT_VERTEX_BUFFER_LAYOUT,
  STANDARD_MESH_WGSL,
  STANDARD_MORPHED_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY,
  STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY,
  STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  createBrowserStandardRenderPipelineDescriptor,
  createOutputColorSpacePipelineKey,
  createStandardRenderPipelineResource,
  createStandardPipelineDescriptorPlan,
  createStandardTextureVariantShader,
  createTonemapPipelineKey,
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

  it("uses a tangent plus TEXCOORD_1 layout for UV1 normal-map standard shaders", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: true,
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
      buffers: [STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
    });
  });

  it("uses a vertex-color primitive vertex layout for COLOR_0 standard shaders", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      vertexColor: true,
    });
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
    });

    expect(descriptor.vertex).toMatchObject({
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
    });
  });

  it("uses normalized vertex-color layouts for compact COLOR_0 standard meshes", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      vertexColor: true,
    });

    for (const testCase of [
      {
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0:float32x3",
        layout: STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
      },
      {
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0:unorm8x4",
        layout: STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
      },
      {
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,COLOR_0:unorm16x4",
        layout: STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
      },
    ] as const) {
      const descriptor = createBrowserStandardRenderPipelineDescriptor({
        shader,
        shaderModule,
        colorFormat: "bgra8unorm",
        batchKey: {
          ...STANDARD_BATCH_KEY,
          meshLayoutKey: testCase.meshLayoutKey,
        },
      });

      expect(descriptor.vertex).toMatchObject({
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [testCase.layout],
      });
    }
  });

  it("adds an instance-rate tint vertex layout for instance tint shaders", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      instanceTint: true,
    });
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
    });

    expect(descriptor.vertex).toMatchObject({
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
        INSTANCE_TINT_VERTEX_BUFFER_LAYOUT,
      ],
    });
    expect(shader.code).toContain("@location(6) instanceTint: vec4f");
    expect(shader.code).toContain("var alpha = material.baseColorFactor.a;");
    expect(shader.code).toContain(
      "baseColor = baseColor * input.instanceTint.rgb",
    );
    expect(shader.code).toContain("alpha = alpha * input.instanceTint.a");
  });

  it("uses joint and weight attributes for skinned StandardMaterial shaders", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      skinned: true,
    });
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|skinned|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,JOINTS_0,WEIGHTS_0",
      skinned: true,
    };
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
      batchKey,
    });
    const plan = createStandardPipelineDescriptorPlan({
      batchKey,
      colorFormat: "bgra8unorm",
    });

    expect(descriptor.vertex).toMatchObject({
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
    });
    expect(shader.code).toContain("@location(8) joints0: vec4u");
    expect(shader.code).toContain("@location(9) weights0: vec4f");
    expect(shader.code).toContain("apertureSkinPosition(input.position");
    expect(plan).toMatchObject({
      valid: true,
      plan: {
        keyInput: {
          shaderVariantKey: "direct-lit-metallic-roughness-skinned-texture",
          batchKey: { skinned: true },
          bindGroupLayoutKeys: expect.arrayContaining([
            STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY,
          ]),
        },
        descriptor: {
          vertex: {
            buffers: [
              "POSITION",
              "NORMAL",
              "TEXCOORD_0",
              "JOINTS_0",
              "WEIGHTS_0",
            ],
          },
        },
      },
    });
  });

  it("uses compact joint and weight layouts for compact skinned meshes", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      skinned: true,
    });
    const cases = [
      {
        meshLayoutKey:
          "POSITION,NORMAL,TEXCOORD_0,JOINTS_0:uint8x4,WEIGHTS_0:unorm8x4",
        expected: {
          arrayStride: 40,
          attributes: [
            { shaderLocation: 8, offset: 32, format: "uint8x4" },
            { shaderLocation: 9, offset: 36, format: "unorm8x4" },
          ],
        },
      },
      {
        meshLayoutKey:
          "POSITION,NORMAL,TEXCOORD_0,JOINTS_0:uint16x4,WEIGHTS_0:unorm16x4",
        expected: {
          arrayStride: 48,
          attributes: [
            { shaderLocation: 8, offset: 32, format: "uint16x4" },
            { shaderLocation: 9, offset: 40, format: "unorm16x4" },
          ],
        },
      },
      {
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,JOINTS_0:uint8x4,WEIGHTS_0",
        expected: {
          arrayStride: 52,
          attributes: [
            { shaderLocation: 8, offset: 32, format: "uint8x4" },
            { shaderLocation: 9, offset: 36, format: "float32x4" },
          ],
        },
      },
    ] as const;

    for (const testCase of cases) {
      const descriptor = createBrowserStandardRenderPipelineDescriptor({
        shader,
        shaderModule,
        colorFormat: "bgra8unorm",
        batchKey: {
          ...STANDARD_BATCH_KEY,
          pipelineKey: "standard|skinned|opaque|back|less|none",
          meshLayoutKey: testCase.meshLayoutKey,
          skinned: true,
        },
      });

      expect(descriptor.vertex).toMatchObject({
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: testCase.expected.arrayStride,
            attributes: expect.arrayContaining([
              ...testCase.expected.attributes,
            ]),
          },
        ],
      });
    }
  });

  it("derives combined StandardMaterial layouts from extracted mesh layout keys", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
      skinned: true,
      vertexColor: true,
    });
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|normalTexture|skinned|opaque|back|less|none",
        meshLayoutKey:
          "POSITION,NORMAL,TEXCOORD_0,JOINTS_0:uint8x4,WEIGHTS_0:unorm8x4,TANGENT,COLOR_0:unorm8x4",
        skinned: true,
      },
    });

    expect(descriptor.vertex).toMatchObject({
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 60,
          attributes: expect.arrayContaining([
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x3" },
            { shaderLocation: 2, offset: 24, format: "float32x2" },
            { shaderLocation: 3, offset: 40, format: "float32x4" },
            { shaderLocation: 5, offset: 56, format: "unorm8x4" },
            { shaderLocation: 8, offset: 32, format: "uint8x4" },
            { shaderLocation: 9, offset: 36, format: "unorm8x4" },
          ]),
        },
      ],
    });
  });

  it("derives multi-stream StandardMaterial layouts from stream-aware mesh keys", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
      skinned: true,
      vertexColor: true,
    });
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|normalTexture|skinned|opaque|back|less|none",
        meshLayoutKey:
          "POSITION,NORMAL|TEXCOORD_0|JOINTS_0:uint8x4,WEIGHTS_0:unorm8x4|TANGENT,COLOR_0:unorm8x4",
        skinned: true,
      },
    });

    expect(descriptor.vertex).toMatchObject({
      module: shaderModule,
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
          arrayStride: 8,
          attributes: [
            { shaderLocation: 8, offset: 0, format: "uint8x4" },
            { shaderLocation: 9, offset: 4, format: "unorm8x4" },
          ],
        },
        {
          arrayStride: 20,
          attributes: [
            { shaderLocation: 3, offset: 0, format: "float32x4" },
            { shaderLocation: 5, offset: 16, format: "unorm8x4" },
          ],
        },
      ],
    });
  });

  it("honors explicit source stream stride and attribute offsets", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: true,
      occlusionTexture: false,
      emissiveTexture: false,
      skinned: true,
      vertexColor: true,
    });
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|normalTexture|skinned|opaque|back|less|none",
        meshLayoutKey:
          "stride=72,POSITION@4,NORMAL@20,TEXCOORD_0@32,JOINTS_0:uint8x4@40,WEIGHTS_0:unorm8x4@44,TANGENT@48,COLOR_0:unorm8x4@68",
        skinned: true,
      },
    });

    expect(descriptor.vertex).toMatchObject({
      buffers: [
        {
          arrayStride: 72,
          attributes: expect.arrayContaining([
            { shaderLocation: 0, offset: 4, format: "float32x3" },
            { shaderLocation: 1, offset: 20, format: "float32x3" },
            { shaderLocation: 2, offset: 32, format: "float32x2" },
            { shaderLocation: 3, offset: 48, format: "float32x4" },
            { shaderLocation: 5, offset: 68, format: "unorm8x4" },
            { shaderLocation: 8, offset: 40, format: "uint8x4" },
            { shaderLocation: 9, offset: 44, format: "unorm8x4" },
          ]),
        },
      ],
    });
  });

  it("uses morph delta attributes for morphed StandardMaterial shaders", () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const shader = createStandardTextureVariantShader({
      baseColorTexture: false,
      metallicRoughnessTexture: false,
      normalTexture: false,
      occlusionTexture: false,
      emissiveTexture: false,
      morphed: true,
    });
    const batchKey: BatchCompatibilityKey = {
      ...STANDARD_BATCH_KEY,
      pipelineKey: "standard|morphed|opaque|back|less|none",
      meshLayoutKey:
        "POSITION,NORMAL,TEXCOORD_0,MORPH_POSITION_0,MORPH_NORMAL_0,MORPH_POSITION_1,MORPH_NORMAL_1",
      morphed: true,
    };
    const descriptor = createBrowserStandardRenderPipelineDescriptor({
      shader,
      shaderModule,
      colorFormat: "bgra8unorm",
      batchKey,
    });
    const plan = createStandardPipelineDescriptorPlan({
      batchKey,
      colorFormat: "bgra8unorm",
    });

    expect(descriptor.vertex).toMatchObject({
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [STANDARD_MORPHED_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
    });
    expect(shader.code).toContain("@location(10) morphPosition0: vec3f");
    expect(shader.code).toContain("@location(13) morphNormal1: vec3f");
    expect(shader.code).toContain("apertureMorphPosition(input.position");
    expect(plan).toMatchObject({
      valid: true,
      plan: {
        keyInput: {
          shaderVariantKey: "direct-lit-metallic-roughness-morphed-texture",
          batchKey: { morphed: true },
          bindGroupLayoutKeys: expect.arrayContaining([
            STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY,
          ]),
        },
        descriptor: {
          vertex: {
            buffers: [
              "POSITION",
              "NORMAL",
              "TEXCOORD_0",
              "MORPH_POSITION_0",
              "MORPH_NORMAL_0",
              "MORPH_POSITION_1",
              "MORPH_NORMAL_1",
            ],
          },
        },
      },
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
    expect(shaderDescriptors).toHaveLength(1);
    expect(shaderDescriptors[0]?.label).toBe(
      [
        "aperture/standard-mesh",
        createTonemapPipelineKey("none"),
        createOutputColorSpacePipelineKey("srgb"),
      ].join("|"),
    );
    expect(shaderDescriptors[0]?.code).toContain(
      STANDARD_MESH_WGSL.slice(0, 80),
    );
    expect(shaderDescriptors[0]?.code).toContain(
      "fn apertureLinearToSrgbChannel",
    );
    expect(shaderDescriptors[0]?.code).toContain(
      "return vec4f(apertureOutputColorSpace(apertureOutputTonemap(color)), alpha);",
    );
    expect(pipelineDescriptors).toHaveLength(1);
    expect(pipelineDescriptors[0]).toMatchObject({
      vertex: {
        module: shaderModule,
        buffers: [UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT],
      },
      primitive: { topology: "triangle-list", cullMode: "back" },
    });
  });

  it("includes selected output tonemap operators in standard pipeline identity", async () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const pipeline = { kind: "standard-tonemapped-render-pipeline" };
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
      tonemap: "aces",
    });

    expect(result.diagnostics).toEqual([]);
    expect(required(result.resource).cacheKey).toContain(
      createTonemapPipelineKey("aces"),
    );
    expect(required(result.resource).cacheKey).toContain(
      createOutputColorSpacePipelineKey("srgb"),
    );
    expect(shaderDescriptors[0]).toMatchObject({
      label: [
        "aperture/standard-mesh",
        createTonemapPipelineKey("aces"),
        createOutputColorSpacePipelineKey("srgb"),
      ].join("|"),
    });
    expect(shaderDescriptors[0]?.code).toContain(
      "return vec4f(apertureOutputColorSpace(apertureOutputTonemap(color)), alpha);",
    );
    expect(pipelineDescriptors[0]?.label).toBe(
      [
        "aperture/standard-mesh",
        createTonemapPipelineKey("aces"),
        createOutputColorSpacePipelineKey("srgb"),
      ].join("|") + ":bgra8unorm:triangle-list",
    );
  });

  it("selects a shadow receiver shader and browser-safe group 3 layout key for shadowMap pipeline keys", async () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const pipeline = { kind: "standard-shadow-render-pipeline" };
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
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|shadowMap|opaque|back|less|none",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(required(result.resource).cacheKey).toContain(
      "direct-lit-metallic-roughness-shadow-map",
    );
    expect(required(result.resource).cacheKey).toContain(
      "standard/lights-shadow/group-3:light-floats@0,light-metadata@1,matrix@2,depth@3,sampler@4",
    );
    expect(shaderDescriptors).toHaveLength(1);
    expect(shaderDescriptors[0]?.label).toBe(
      [
        "aperture/standard-mesh-shadow-receiver",
        createTonemapPipelineKey("none"),
        createOutputColorSpacePipelineKey("srgb"),
      ].join("|"),
    );
    expect(shaderDescriptors[0]?.code).toContain(
      STANDARD_SHADOW_RECEIVER_MESH_WGSL.slice(0, 80),
    );
    expect(shaderDescriptors[0]?.code).toContain(
      "fn apertureLinearToSrgbChannel",
    );
    expect(pipelineDescriptors[0]).toMatchObject({
      label:
        [
          "aperture/standard-mesh-shadow-receiver",
          createTonemapPipelineKey("none"),
          createOutputColorSpacePipelineKey("srgb"),
        ].join("|") + ":bgra8unorm:triangle-list",
      layout: "auto",
    });
  });

  it("selects a multi-shadow shader and group 3 layout key for combined shadow pipeline keys", async () => {
    const shaderModule = {
      compilationInfo: async () => ({ messages: [] }),
    };
    const pipeline = { kind: "standard-multi-shadow-render-pipeline" };
    const shaderDescriptors: WebGpuShaderCreateDescriptor[] = [];
    const device = {
      createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
        shaderDescriptors.push(descriptor);
        return shaderModule;
      },
      createRenderPipeline() {
        return pipeline;
      },
    };

    const result = await createStandardRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey: {
        ...STANDARD_BATCH_KEY,
        pipelineKey: "standard|pointShadowMap|shadowMap|opaque|back|less|none",
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(required(result.resource).cacheKey).toContain(
      "direct-lit-metallic-roughness-multi-shadow-map",
    );
    expect(required(result.resource).cacheKey).toContain(
      "standard/lights-multi-shadow/group-3:light-floats@0,light-metadata@1,directional-matrix@2,directional-depth@3,directional-sampler@4,spot-matrix@5,spot-depth@6,spot-sampler@7,point-matrix@8,point-depth-cube@9,point-sampler@10",
    );
    expect(shaderDescriptors[0]?.label).toBe(
      [
        "aperture/standard-mesh-multi-shadow-receiver",
        createTonemapPipelineKey("none"),
        createOutputColorSpacePipelineKey("srgb"),
      ].join("|"),
    );
    expect(shaderDescriptors[0]?.code).toContain(
      createStandardTextureVariantShader({
        baseColorTexture: false,
        metallicRoughnessTexture: false,
        normalTexture: false,
        occlusionTexture: false,
        emissiveTexture: false,
        shadowMap: true,
        pointShadowMap: true,
      }).code.slice(0, 80),
    );
    expect(shaderDescriptors[0]?.code).toContain(
      "fn apertureLinearToSrgbChannel",
    );
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
