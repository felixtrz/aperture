import { describe, expect, it } from "vitest";

import {
  createCustomWgslMaterialAsset,
  createCustomWgslShadowCasterResourceCache,
  createCustomWgslShadowCasterResourceReport,
  createMaterialHandle,
  createMeshHandle,
  createPreparedCustomWgslMaterial,
  createRenderShadowFrame,
  createWebGpuEnvironmentResourceCache,
  customWgslShadowCasterDrawKey,
  type CustomWgslShadowCasterDeviceLike,
  type CustomWgslShadowCasterMaterialInput,
  type PreparedCustomWgslMaterial,
  type RenderShadowFrameDeviceLike,
  type RenderSnapshot,
  type ShadowCasterExecutableMeshResourceView,
  type ShadowCasterPreparedMeshResourceView,
} from "@aperture-engine/webgpu/test-support";

// A4 (three.js parity plan): per-material shadow caster pipelines for custom
// WGSL materials with `entryPoints.shadowVertex`. Fake-device harness in the
// style of custom-wgsl-storage-buffer.test.ts: structural creation/caching
// assertions, no GPU.

const FLAG_WGSL = [
  "struct ShadowPass { viewProjection: mat4x4f }",
  "@group(0) @binding(0) var<uniform> shadowPass: ShadowPass;",
  "@group(0) @binding(1) var<storage, read> shadowWorld: array<mat4x4f>;",
  "@group(2) @binding(0) var<uniform> params: vec4f;",
  "@vertex fn vs_main() -> @builtin(position) vec4f { return vec4f(0); }",
  "@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1); }",
  "@vertex fn shadow_main(@location(0) p: vec3f, @builtin(instance_index) i: u32) -> @builtin(position) vec4f {",
  "  return shadowPass.viewProjection * shadowWorld[i] * vec4f(p + params.xyz, 1.0);",
  "}",
  "",
].join("\n");

function flagPrepared(options?: {
  readonly shadowVertex?: string | undefined;
}): PreparedCustomWgslMaterial {
  const source = createCustomWgslMaterialAsset({
    familyKey: "example/flag",
    label: "Flag",
    shader: { kind: "inline-wgsl", code: FLAG_WGSL },
    entryPoints: {
      vertex: "vs_main",
      fragment: "fs_main",
      ...(options?.shadowVertex === undefined
        ? { shadowVertex: "shadow_main" }
        : { shadowVertex: options.shadowVertex }),
    },
    renderState: { cullMode: "none" },
    bindings: [
      {
        name: "params",
        binding: 0,
        kind: "uniform-buffer",
        visibility: ["vertex"],
        fields: { offset: { type: "vec4" } },
      },
    ],
  });

  return createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:flag",
    shaderCode: FLAG_WGSL,
    shaderSourceKey: "inline:material:flag:source",
  });
}

interface CasterDeviceCalls {
  readonly shaderModules: unknown[];
  readonly bindGroupLayouts: unknown[];
  readonly pipelineLayouts: unknown[];
  readonly pipelines: unknown[];
  readonly bindGroups: unknown[];
}

function newCasterDeviceCalls(): CasterDeviceCalls {
  return {
    shaderModules: [],
    bindGroupLayouts: [],
    pipelineLayouts: [],
    pipelines: [],
    bindGroups: [],
  };
}

function casterDevice(
  calls: CasterDeviceCalls,
  options?: { readonly failPipelines?: boolean },
): CustomWgslShadowCasterDeviceLike {
  return {
    createShaderModule(descriptor) {
      calls.shaderModules.push(descriptor);
      return { descriptor };
    },
    createBindGroupLayout(descriptor) {
      calls.bindGroupLayouts.push(descriptor);
      return { descriptor };
    },
    createPipelineLayout(descriptor) {
      calls.pipelineLayouts.push(descriptor);
      return { descriptor };
    },
    createRenderPipeline(descriptor) {
      if (options?.failPipelines === true) {
        throw new Error("caster pipeline exploded");
      }
      calls.pipelines.push(descriptor);
      return { descriptor };
    },
    createBindGroup(descriptor) {
      calls.bindGroups.push(descriptor);
      return { descriptor };
    },
  };
}

function casterInput(
  prepared: PreparedCustomWgslMaterial,
  resource: unknown = { buffer: { kind: "uniform" } },
): CustomWgslShadowCasterMaterialInput {
  return {
    materialKey: "material:flag",
    material: prepared,
    bindingResources: [{ resourceKey: "material:flag:binding:0", resource }],
  };
}

describe("custom WGSL shadow caster resources", () => {
  it("creates and caches a per-material caster pipeline per mesh layout", () => {
    const calls = newCasterDeviceCalls();
    const cache = createCustomWgslShadowCasterResourceCache();
    const prepared = flagPrepared();
    const options = {
      device: casterDevice(calls),
      casters: [casterInput(prepared)],
      draws: [
        {
          materialKey: "material:flag",
          meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
          casterCullMode: "none" as const,
        },
        {
          materialKey: "material:flag",
          meshLayoutKey: "POSITION",
          casterCullMode: "none" as const,
        },
        // Duplicate combination collapses into one pipeline.
        {
          materialKey: "material:flag",
          meshLayoutKey: "POSITION",
          casterCullMode: "none" as const,
        },
      ],
      cache,
    };

    const first = createCustomWgslShadowCasterResourceReport(options);

    expect(first.status).toBe("available");
    expect(first.diagnostics).toEqual([]);
    expect(first.createdPipelineCount).toBe(2);
    expect(first.reusedPipelineCount).toBe(0);
    expect(first.createdBindGroupCount).toBe(1);
    expect(first.reusedBindGroupCount).toBe(0);
    expect(calls.shaderModules).toHaveLength(1);
    expect(calls.pipelines).toHaveLength(2);
    expect(
      first.pipelineKeyByDraw.get(
        customWgslShadowCasterDrawKey("material:flag", "POSITION", "none"),
      ),
    ).toContain("shadow-caster/custom-wgsl/material%3Aflag");

    const pipelineDescriptor = calls.pipelines[1] as {
      readonly vertex: { readonly entryPoint: string };
      readonly fragment?: unknown;
      readonly depthStencil: { readonly format: string };
      readonly primitive: { readonly cullMode: string };
    };

    expect(pipelineDescriptor.vertex.entryPoint).toBe("shadow_main");
    expect(pipelineDescriptor.fragment).toBeUndefined();
    expect(pipelineDescriptor.depthStencil.format).toBe("depth24plus");
    expect(pipelineDescriptor.primitive.cullMode).toBe("none");

    for (const pipelineKey of first.pipelineKeyByDraw.values()) {
      const bindGroups = first.drawBindGroupsByPipelineKey.get(pipelineKey);
      expect(bindGroups?.map((entry) => entry.group)).toEqual([1, 2]);
    }

    const second = createCustomWgslShadowCasterResourceReport(options);

    expect(second.status).toBe("available");
    expect(second.createdPipelineCount).toBe(0);
    expect(second.reusedPipelineCount).toBe(2);
    expect(second.createdBindGroupCount).toBe(0);
    expect(second.reusedBindGroupCount).toBe(1);
    expect(calls.shaderModules).toHaveLength(1);
    expect(calls.pipelines).toHaveLength(2);
  });

  it("recreates the material bind group when a resolved resource changes identity", () => {
    const calls = newCasterDeviceCalls();
    const cache = createCustomWgslShadowCasterResourceCache();
    const prepared = flagPrepared();
    const draws = [
      {
        materialKey: "material:flag",
        meshLayoutKey: "POSITION",
        casterCullMode: "none" as const,
      },
    ];
    const firstBuffer = { buffer: { kind: "uniform-a" } };
    const secondBuffer = { buffer: { kind: "uniform-b" } };

    const first = createCustomWgslShadowCasterResourceReport({
      device: casterDevice(calls),
      casters: [casterInput(prepared, firstBuffer)],
      draws,
      cache,
    });
    const second = createCustomWgslShadowCasterResourceReport({
      device: casterDevice(calls),
      casters: [casterInput(prepared, secondBuffer)],
      draws,
      cache,
    });

    expect(first.createdBindGroupCount).toBe(1);
    expect(second.createdBindGroupCount).toBe(1);
    expect(second.reusedBindGroupCount).toBe(0);
    // Pipeline survives (layout unchanged); only the bind group rebuilds, and
    // its resource key changes generation so command topologies invalidate.
    expect(second.createdPipelineCount).toBe(0);
    expect(second.reusedPipelineCount).toBe(1);

    const firstKey = [...first.drawBindGroupsByPipelineKey.values()][0]?.find(
      (entry) => entry.group === 2,
    )?.resourceKey;
    const secondKey = [...second.drawBindGroupsByPipelineKey.values()][0]?.find(
      (entry) => entry.group === 2,
    )?.resourceKey;

    expect(firstKey).toBeDefined();
    expect(secondKey).toBeDefined();
    expect(secondKey).not.toBe(firstKey);
  });

  it("diagnoses a missing shadow entry point and falls back to the shared caster", () => {
    const calls = newCasterDeviceCalls();
    const prepared = flagPrepared({ shadowVertex: "not_in_module" });

    const report = createCustomWgslShadowCasterResourceReport({
      device: casterDevice(calls),
      casters: [casterInput(prepared)],
      draws: [
        {
          materialKey: "material:flag",
          meshLayoutKey: "POSITION",
          casterCullMode: "none",
        },
      ],
    });

    expect(report.status).toBe("missing");
    expect(report.pipelineKeyByDraw.size).toBe(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customWgslMaterial.shadowCasterEntryPointMissing",
        severity: "error",
        materialKey: "material:flag",
      }),
    );
    expect(calls.pipelines).toHaveLength(0);
  });

  it("diagnoses pipeline creation failures without routing the draw", () => {
    const calls = newCasterDeviceCalls();

    const report = createCustomWgslShadowCasterResourceReport({
      device: casterDevice(calls, { failPipelines: true }),
      casters: [casterInput(flagPrepared())],
      draws: [
        {
          materialKey: "material:flag",
          meshLayoutKey: "POSITION",
          casterCullMode: "none",
        },
      ],
    });

    expect(report.status).toBe("missing");
    expect(report.pipelineKeyByDraw.size).toBe(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customWgslMaterial.shadowCasterPipelineCreationFailed",
        severity: "error",
        message: expect.stringContaining("caster pipeline exploded"),
      }),
    );
  });

  it("diagnoses an incapable device once and requests the shared fallback", () => {
    const report = createCustomWgslShadowCasterResourceReport({
      device: {},
      casters: [casterInput(flagPrepared())],
      draws: [
        {
          materialKey: "material:flag",
          meshLayoutKey: "POSITION",
          casterCullMode: "none",
        },
      ],
    });

    expect(report.status).toBe("missing");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "customWgslMaterial.shadowCasterDeviceUnavailable",
      }),
    ]);
  });

  it("is not required when no caster draw uses a custom material", () => {
    const report = createCustomWgslShadowCasterResourceReport({
      device: {},
      casters: [casterInput(flagPrepared())],
      draws: [
        {
          materialKey: "material:other",
          meshLayoutKey: "POSITION",
          casterCullMode: "none",
        },
      ],
    });

    expect(report.status).toBe("not-required");
    expect(report.diagnostics).toEqual([]);
  });
});

describe("render shadow frame with custom WGSL casters", () => {
  it("routes the caster draw to the per-material pipeline with groups 0..2 bound", () => {
    const calls = createFrameDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const prepared = flagPrepared();
    const input = {
      device: frameDevice(calls),
      snapshot: customCasterSnapshot(),
      preparedMeshes: casterPreparedMeshes(),
      executableMeshes: casterExecutableMeshes(),
      customWgslCasters: [casterInput(prepared)],
      cache,
      shadowMap: { cascadeCount: 1, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;

    const first = createRenderShadowFrame(input);

    expect(first.report.status).toBe("submitted");
    expect(first.customWgslCasters.status).toBe("available");
    expect(first.report.resourceReuse).toMatchObject({
      customWgslPipelinesCreated: 1,
      customWgslPipelinesReused: 0,
      customWgslBindGroupsCreated: 1,
      customWgslBindGroupsReused: 0,
    });

    const record = first.commandRecords.records[0];

    expect(record?.pipelineKeys).toEqual([
      expect.stringContaining("shadow-caster/custom-wgsl/material%3Aflag"),
    ]);
    // Groups 0 (pass matrix + world transforms), 1 (reserved empty), and
    // 2 (material bindings) are all bound for the routed draw.
    expect(record?.bindGroupResourceKeys).toHaveLength(3);

    const second = createRenderShadowFrame(input);

    expect(second.report.status).toBe("submitted");
    expect(second.report.resourceReuse).toMatchObject({
      customWgslPipelinesCreated: 0,
      customWgslPipelinesReused: 1,
      customWgslBindGroupsCreated: 0,
      customWgslBindGroupsReused: 1,
    });
  });

  it("keeps the shared position-only pipeline when no custom casters are supplied", () => {
    const calls = createFrameDeviceCalls();
    const result = createRenderShadowFrame({
      device: frameDevice(calls),
      snapshot: customCasterSnapshot(),
      preparedMeshes: casterPreparedMeshes(),
      executableMeshes: casterExecutableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });

    expect(result.report.status).toBe("submitted");
    expect(result.customWgslCasters.status).toBe("not-required");
    expect(result.commandRecords.records[0]?.pipelineKeys).toEqual([
      expect.stringContaining("shadow-caster/depth-only"),
    ]);
    expect(result.report.resourceReuse).toMatchObject({
      customWgslPipelinesCreated: 0,
      customWgslPipelinesReused: 0,
    });
  });
});

function customCasterSnapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [
      {
        renderId: 101,
        entity: { index: 2, generation: 0 },
        mesh: createMeshHandle("flag"),
        material: createMaterialHandle("flag"),
        submesh: 0,
        materialSlot: 0,
        worldTransformOffset: 0,
        boundsIndex: 0,
        layerMask: 1,
        castsShadow: true,
        receivesShadow: false,
        sortKey: {
          queue: "opaque",
          viewId: 0,
          layer: 0,
          order: 0,
          pipelineKey: "example/flag|shader:x|opaque|none|less|none",
          materialKey: "material:flag",
          meshKey: "mesh:flag",
          depth: 0,
          stableId: 101,
        },
        batchKey: {
          pipelineKey: "example/flag|shader:x|opaque|none|less|none",
          materialKey: "material:flag",
          meshLayoutKey: "POSITION",
          topology: "triangle-list",
          instanced: false,
          skinned: false,
          morphed: false,
        },
      },
    ],
    lights: [
      {
        lightId: 11,
        entity: { index: 1, generation: 0 },
        kind: "directional",
        color: [1, 1, 1, 1],
        intensity: 1,
        range: 0,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 0,
        layerMask: 1,
      },
    ],
    environments: [],
    shadowRequests: [
      {
        shadowId: 7,
        lightId: 11,
        lightKind: "directional",
        cascadeCount: 1,
        casterLayerMask: 1,
        receiverLayerMask: 1,
      },
    ],
    bounds: [],
    transforms: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 1,
      lights: 1,
      environments: 0,
      shadowRequests: 1,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function casterPreparedMeshes(): readonly ShadowCasterPreparedMeshResourceView[] {
  return [
    {
      meshKey: "mesh:flag",
      meshResourceKey: "mesh-buffer:flag",
      vertexBufferResourceKeys: ["mesh-vertex-buffer:flag/position"],
      indexBufferResourceKey: "mesh-index-buffer:flag",
    },
  ];
}

function casterExecutableMeshes(): readonly ShadowCasterExecutableMeshResourceView[] {
  return [
    {
      meshKey: "mesh:flag",
      meshResourceKey: "mesh-buffer:flag",
      vertexBuffers: [
        {
          resourceKey: "mesh-vertex-buffer:flag/position",
          buffer: { kind: "vertex-buffer" },
          vertexCount: 4,
        },
      ],
      indexBuffer: {
        resourceKey: "mesh-index-buffer:flag",
        buffer: { kind: "index-buffer" },
        format: "uint32",
        indexCount: 6,
      },
    },
  ];
}

interface FrameDeviceCalls {
  readonly pipelines: unknown[];
  readonly bindGroups: unknown[];
  readonly submissions: unknown[];
}

function createFrameDeviceCalls(): FrameDeviceCalls {
  return { pipelines: [], bindGroups: [], submissions: [] };
}

function frameDevice(calls: FrameDeviceCalls): RenderShadowFrameDeviceLike {
  return {
    createTexture() {
      return {
        createView(viewDescriptor?: unknown) {
          return { viewDescriptor: viewDescriptor ?? {} };
        },
      };
    },
    createSampler(descriptor) {
      return { descriptor };
    },
    createBuffer(descriptor) {
      const buffer = { descriptor, destroy: () => undefined };
      return buffer;
    },
    createShaderModule(descriptor) {
      return {
        descriptor,
        compilationInfo: async () => ({ messages: [] }),
      };
    },
    createBindGroupLayout(descriptor) {
      return { descriptor };
    },
    createPipelineLayout(descriptor) {
      return { descriptor };
    },
    createRenderPipeline(descriptor) {
      calls.pipelines.push(descriptor);
      return { descriptor };
    },
    createBindGroup(descriptor) {
      calls.bindGroups.push(descriptor);
      return { descriptor };
    },
    createCommandEncoder() {
      return {
        beginRenderPass() {
          return {
            setPipeline: () => undefined,
            setBindGroup: () => undefined,
            setVertexBuffer: () => undefined,
            setIndexBuffer: () => undefined,
            drawIndexed: () => undefined,
            end: () => undefined,
          };
        },
        finish() {
          return { kind: "command-buffer" };
        },
      };
    },
    queue: {
      writeBuffer() {
        return undefined;
      },
      submit(commandBuffers) {
        calls.submissions.push(commandBuffers);
      },
    },
  };
}
