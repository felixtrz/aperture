import { describe, expect, it, vi } from "vitest";
import { compileShader } from "@aperture-engine/shader/compiler";

import {
  createShadowCasterPipelineDescriptorReport,
  createShadowCasterPipelineResourceReport,
  shadowCasterPipelineResourceReportToJson,
  shadowCasterPipelineResourceReportToJsonValue,
  SHADOW_CASTER_DEPTH_ONLY_WGSL,
  standardMaterialExtensionKey,
  type StandardMaterialExtension,
  type ShadowCasterPipelineDescriptorMetadata,
  type ShadowPassCommandEncodingReport,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu/test-support";

describe("shadow caster pipeline resource", () => {
  it.each(
    [1, 8, 64].flatMap((count) => [
      { count, cached: true },
      { count, cached: false },
    ]),
  )(
    "creates each key once for $count uniform variants (cache: $cached)",
    ({ count, cached }) => {
      const base = pipelineDescriptor().descriptor!;
      const original = extension();
      const entries = [
        base,
        ...Array.from({ length: count }, (_, i) =>
          extensionDescriptor(
            { ...original, parameters: [i, 0, 0, 1] },
            `material:${i}`,
          ),
        ),
      ];
      const descriptor = descriptorReport(entries);
      const cache = cached ? new Map() : undefined;
      const gpu = countingDevice();
      const options = { device: gpu, descriptor, ...(cache ? { cache } : {}) };
      const first = createShadowCasterPipelineResourceReport(options);

      expect(first).toMatchObject({
        descriptorCount: count + 1,
        createdPipelineCount: 2,
        reusedPipelineCount: count - 1,
      });
      expect(first.resources).toHaveLength(count + 1);
      expect(new Set(first.resources).size).toBe(2);
      expect(first.resource).toBe(first.resources[0]);
      for (const resource of first.resources.slice(1))
        expect(resource).toBe(first.resources[1]);
      expect(gpu.createRenderPipeline).toHaveBeenCalledTimes(2);
      expect(gpu.createShaderModule).toHaveBeenCalledTimes(2);
      expect(gpu.createPipelineLayout).toHaveBeenCalledTimes(2);
      expect(gpu.createBindGroupLayout).toHaveBeenCalledTimes(3);
      expect(descriptor.descriptors).toEqual(entries);

      const second = createShadowCasterPipelineResourceReport(options);
      expect(second.createdPipelineCount).toBe(cached ? 0 : 2);
      expect(second.reusedPipelineCount).toBe(cached ? count + 1 : count - 1);
      expect(gpu.createRenderPipeline).toHaveBeenCalledTimes(cached ? 2 : 4);
      expect(second.resources).toHaveLength(count + 1);
      expect(new Set(second.resources).size).toBe(2);
      if (cached) expect(second.resources).toEqual(first.resources);
      else expect(second.resource).not.toBe(first.resource);
    },
  );

  it("preserves cached-first ordering for interleaved cached and new requests", () => {
    const gpu = countingDevice();
    const cache = new Map();
    const base = pipelineDescriptor().descriptor!;
    const cached = createShadowCasterPipelineResourceReport({
      device: gpu,
      cache,
      descriptor: descriptorReport([base]),
    }).resource!;
    const a = extensionDescriptor(extension(), "material:a");
    const b = extensionDescriptor(
      { ...extension(), deform: "deform" },
      "material:b",
    );
    const report = createShadowCasterPipelineResourceReport({
      device: gpu,
      cache,
      descriptor: descriptorReport([a, base, b, a, base, b]),
    });
    expect(report).toMatchObject({
      descriptorCount: 6,
      createdPipelineCount: 2,
      reusedPipelineCount: 4,
    });
    expect(report.resources.map((r) => r.pipelineKey)).toEqual([
      base.pipelineKey,
      base.pipelineKey,
      a.pipelineKey,
      b.pipelineKey,
      a.pipelineKey,
      b.pipelineKey,
    ]);
    expect(report.resource).toBe(cached);
    expect(report.resources[0]).toBe(report.resources[1]);
    expect(report.resources[2]).toBe(report.resources[4]);
    expect(report.resources[3]).toBe(report.resources[5]);
    expect(gpu.createRenderPipeline).toHaveBeenCalledTimes(3);
  });

  it("keeps distinct shader, shader-layout, vertex-layout and hook keys separate", () => {
    const original = extension();
    const variants = [
      extensionDescriptor(original, "material:original"),
      extensionDescriptor(
        {
          ...original,
          shader: { ...original.shader, hash: "other-shader-identity" },
        },
        "material:shader",
      ),
      extensionDescriptor(
        {
          ...original,
          shader: {
            ...original.shader,
            layoutHash: "other-shader-layout-identity",
          },
        },
        "material:shader-layout",
      ),
      extensionDescriptor(
        original,
        "material:vertex-layout",
        "stride=40,POSITION@4,NORMAL@16,TEXCOORD_0@28",
      ),
      extensionDescriptor({ ...original, deform: "deform" }, "material:deform"),
      extensionDescriptor(
        { ...original, opacity: "opacity" },
        "material:opacity",
      ),
    ];
    const entries = variants.flatMap((v) => [v, variants[0]!]);
    const gpu = countingDevice();
    const report = createShadowCasterPipelineResourceReport({
      device: gpu,
      descriptor: descriptorReport(entries),
    });
    expect(report.createdPipelineCount).toBe(6);
    expect(report.reusedPipelineCount).toBe(6);
    expect(new Set(report.resources).size).toBe(6);
    expect(report.resources.map((r) => r.pipelineKey)).toEqual(
      entries.map((e) => e.pipelineKey),
    );
    expect(gpu.createRenderPipeline).toHaveBeenCalledTimes(6);
    expect(report.resources[6]?.descriptor.vertex).toMatchObject({
      buffers: [{ arrayStride: 40 }],
    });
  });

  it("retains partial-failure reporting and caches only resources actually created", () => {
    const cache = new Map();
    const gpu = countingDevice();
    const base = pipelineDescriptor().descriptor!;
    const cached = createShadowCasterPipelineResourceReport({
      device: gpu,
      cache,
      descriptor: descriptorReport([base]),
    }).resource!;
    const a = extensionDescriptor(extension(), "material:a");
    const b = extensionDescriptor(
      { ...extension(), deform: "deform" },
      "material:b",
    );
    const c = extensionDescriptor(
      { ...extension(), opacity: "opacity" },
      "material:c",
    );
    gpu.createRenderPipeline
      .mockImplementationOnce(() => ({}))
      .mockImplementationOnce(() => {
        throw new Error("injected creation failure");
      });
    const report = createShadowCasterPipelineResourceReport({
      device: gpu,
      cache,
      descriptor: descriptorReport([a, a, base, b, c]),
    });
    expect(report).toMatchObject({
      status: "missing",
      descriptorCount: 5,
      createdPipelineCount: 0,
      reusedPipelineCount: 1,
      resource: null,
      resources: [cached],
      diagnostics: [
        {
          code: "shadowCasterPipelineResource.pipelineCreationFailed",
          message: "injected creation failure",
        },
      ],
    });
    expect(gpu.createRenderPipeline).toHaveBeenCalledTimes(3);
    expect(cache.has(a.pipelineKey)).toBe(true);
    expect(cache.has(b.pipelineKey)).toBe(false);
    expect(cache.has(c.pipelineKey)).toBe(false);
  });

  it("creates a depth-only shadow caster pipeline through an injected device", () => {
    const shaderDescriptors: WebGpuShaderCreateDescriptor[] = [];
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const shaderModule = { compilationInfo: async () => ({ messages: [] }) };
    const pipeline = { type: "render-pipeline" };
    const report = createShadowCasterPipelineResourceReport({
      device: {
        createShaderModule(descriptor) {
          shaderDescriptors.push(descriptor);
          return shaderModule;
        },
        createRenderPipeline(descriptor) {
          pipelineDescriptors.push(descriptor);
          return pipeline;
        },
      },
      descriptor: pipelineDescriptor(),
    });
    const json = shadowCasterPipelineResourceReportToJsonValue(report);

    expect(report.resource).toMatchObject({
      pipelineKey: "shadow-caster/depth-only/depth24plus/triangle-list/none",
      pipeline,
      shaderModule,
    });
    expect(shaderDescriptors).toEqual([
      {
        label: "shadow-caster-depth-only",
        code: SHADOW_CASTER_DEPTH_ONLY_WGSL,
      },
    ]);
    expect(pipelineDescriptors).toHaveLength(1);
    expect(pipelineDescriptors[0]).toMatchObject({
      label: "shadow-caster-depth-only:depth24plus:triangle-list",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [],
      },
      primitive: {
        topology: "triangle-list",
        frontFace: "ccw",
        cullMode: "none",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less-equal",
      },
    });
    expect(json).toEqual({
      ready: true,
      status: "available",
      descriptorCount: 1,
      createdPipelineCount: 1,
      reusedPipelineCount: 0,
      sections: {
        pipelineDescriptor: true,
        shaderModule: true,
        pipelineCreation: true,
        passSubmission: false,
        shaderSampling: false,
      },
      resource: {
        pipelineKey: "shadow-caster/depth-only/depth24plus/triangle-list/none",
        resourceKey:
          "render-pipeline:shadow-caster/depth-only/depth24plus/triangle-list/none",
        shaderModuleKey: "shader-module:shadow-caster-depth-only",
        label: "shadow-caster-depth-only:depth24plus:triangle-list",
      },
      resources: [
        {
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/none",
          resourceKey:
            "render-pipeline:shadow-caster/depth-only/depth24plus/triangle-list/none",
          shaderModuleKey: "shader-module:shadow-caster-depth-only",
          label: "shadow-caster-depth-only:depth24plus:triangle-list",
        },
      ],
      diagnostics: [
        {
          code: "shadowCasterPipelineResource.passSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow caster pipeline resource is available, but shadow pass submission is deferred.",
        },
        {
          code: "shadowCasterPipelineResource.shaderSamplingDeferred",
          severity: "warning",
          message:
            "Shadow caster pipeline resource is available, but StandardMaterial shadow sampling remains deferred.",
        },
      ],
    });
    expect(
      JSON.parse(shadowCasterPipelineResourceReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUShaderModule|GPURenderPipeline|"raw"|callback/,
    );
  });

  it("reuses cached pipeline resources by descriptor pipeline key", () => {
    const cache = new Map();
    const first = createShadowCasterPipelineResourceReport({
      device: device(),
      descriptor: pipelineDescriptor(),
      cache,
    });
    const second = createShadowCasterPipelineResourceReport({
      device: device(),
      descriptor: pipelineDescriptor(),
      cache,
    });

    expect(first.createdPipelineCount).toBe(1);
    expect(second.createdPipelineCount).toBe(0);
    expect(second.reusedPipelineCount).toBe(1);
    expect(second.resource).toBe(first.resource);
  });

  it("creates layout-specialized shadow pipelines for padded source streams", () => {
    const pipelineDescriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
    const shaderModule = { compilationInfo: async () => ({ messages: [] }) };
    const report = createShadowCasterPipelineResourceReport({
      device: {
        createShaderModule() {
          return shaderModule;
        },
        createRenderPipeline(descriptor) {
          pipelineDescriptors.push(descriptor);
          return { type: "render-pipeline" };
        },
      },
      descriptor: createShadowCasterPipelineDescriptorReport({
        commandEncoding: commandEncoding(),
        meshLayoutKeys: [
          "POSITION,NORMAL,TEXCOORD_0",
          "stride=40,POSITION@4,NORMAL@20,TEXCOORD_0@32",
        ],
      }),
    });

    expect(report.resources).toHaveLength(2);
    expect(report.createdPipelineCount).toBe(2);
    expect(pipelineDescriptors.map((descriptor) => descriptor.vertex)).toEqual([
      {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 32,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
          },
        ],
      },
      {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 40,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 4, format: "float32x3" }],
          },
        ],
      },
    ]);
  });

  it("reports missing descriptor and device methods", () => {
    const missingDescriptor = shadowCasterPipelineResourceReportToJsonValue(
      createShadowCasterPipelineResourceReport({
        device: device(),
        descriptor: {
          ...pipelineDescriptor(),
          ready: false,
          status: "missing",
          descriptorCount: 0,
          descriptor: null,
          descriptors: [],
        },
      }),
    );
    const missingShaderModule = shadowCasterPipelineResourceReportToJsonValue(
      createShadowCasterPipelineResourceReport({
        device: { createRenderPipeline: () => ({}) },
        descriptor: pipelineDescriptor(),
      }),
    );
    const missingPipeline = shadowCasterPipelineResourceReportToJsonValue(
      createShadowCasterPipelineResourceReport({
        device: {
          createShaderModule: () => ({
            compilationInfo: async () => ({ messages: [] }),
          }),
        },
        descriptor: pipelineDescriptor(),
      }),
    );

    expect(missingDescriptor.diagnostics).toMatchObject([
      { code: "shadowCasterPipelineResource.missingDescriptor" },
    ]);
    expect(missingShaderModule.diagnostics).toMatchObject([
      { code: "shadowCasterPipelineResource.createShaderModuleUnavailable" },
    ]);
    expect(missingPipeline.diagnostics).toMatchObject([
      { code: "shadowCasterPipelineResource.createRenderPipelineUnavailable" },
    ]);
  });
});

function pipelineDescriptor() {
  return createShadowCasterPipelineDescriptorReport({
    commandEncoding: commandEncoding(),
  });
}

function commandEncoding(): ShadowPassCommandEncodingReport {
  return {
    ready: true,
    status: "ready",
    counts: {
      passes: 1,
      depthViews: 1,
      matrixBuffers: 1,
      casterLists: 1,
      commandPlans: 1,
      commandRecords: 1,
      drawCommands: 1,
    },
    sections: {
      passPlans: true,
      depthTextureResources: true,
      matrixBufferResource: true,
      casterDrawLists: true,
      commandPlans: true,
      commandEncoding: true,
      passSubmission: false,
      shaderSampling: false,
    },
    records: [
      {
        passKey: "shadow-pass:7:light:11",
        shadowId: 7,
        lightId: 11,
        depthTextureKey: "shadow-map:7:light:11:texture",
        depthViewKey: "shadow-map:7:light:11:view",
        matrixResourceKey: "shadow-matrix-buffer:directional",
        commandKey: "shadow-pass:7:light:11:caster-commands",
        drawCount: 1,
        commandEncoding: "ready",
      },
    ],
    diagnostics: [],
  };
}

function device() {
  return {
    createShaderModule: () => ({
      compilationInfo: async () => ({ messages: [] }),
    }),
    createRenderPipeline: () => ({}),
  };
}

function countingDevice() {
  return {
    createShaderModule: vi.fn(() => ({
      compilationInfo: async () => ({ messages: [] }),
    })),
    createRenderPipeline: vi.fn(() => ({})),
    createBindGroupLayout: vi.fn(() => ({})),
    createPipelineLayout: vi.fn(() => ({})),
  };
}

function extension(): StandardMaterialExtension {
  const code = `
struct ApertureVertex { position: vec3f, normal: vec3f };
struct ApertureSurface { baseColor: vec3f, normal: vec3f, metallic: f32, roughness: f32, emissive: vec3f };
fn surface(s: ApertureSurface, uv: vec2f, p: vec4f) -> ApertureSurface { return s; }
fn deform(v: ApertureVertex, uv: vec2f, p: vec4f) -> ApertureVertex { return ApertureVertex(v.position + vec3f(p.x, 0.0, 0.0), v.normal); }
fn opacity(uv: vec2f, p: vec4f) -> f32 { return p.w; }
`;
  return {
    shader: compileShader({
      entry: "library.wgsl",
      modules: { "library.wgsl": code },
    }),
    surface: "surface",
    parameters: [0, 0, 0, 1],
  };
}

function extensionDescriptor(
  extension: StandardMaterialExtension,
  materialKey: string,
  meshLayoutKey = "POSITION,NORMAL,TEXCOORD_0",
): ShadowCasterPipelineDescriptorMetadata {
  const base = createShadowCasterPipelineDescriptorReport({
    commandEncoding: commandEncoding(),
    meshLayoutKeys: [meshLayoutKey],
  }).descriptor!;
  return {
    ...base,
    materialKey,
    extension,
    pipelineKey: `${base.pipelineKey}/extension:${standardMaterialExtensionKey(extension)}`,
  };
}

function descriptorReport(
  descriptors: readonly ShadowCasterPipelineDescriptorMetadata[],
) {
  return {
    ...pipelineDescriptor(),
    descriptor: descriptors[0] ?? null,
    descriptors,
    descriptorCount: descriptors.length,
  };
}
