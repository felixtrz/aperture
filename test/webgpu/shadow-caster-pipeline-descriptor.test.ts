import { describe, expect, it } from "vitest";

import {
  createShadowCasterPipelineDescriptorReport,
  SHADOW_CASTER_ALPHA_TEST_WGSL,
  SHADOW_CASTER_DEPTH_ONLY_WGSL,
  shadowCasterPipelineDescriptorReportToJson,
  shadowCasterPipelineDescriptorReportToJsonValue,
  type ShadowPassCommandEncodingReport,
} from "@aperture-engine/webgpu/test-support";

describe("shadow caster pipeline descriptor metadata", () => {
  it("emits an alpha-test caster pipeline variant alongside the opaque position-only one (M4-T8)", () => {
    const report = createShadowCasterPipelineDescriptorReport({
      commandEncoding: commandEncoding("ready"),
      alphaTestCasters: [
        {
          meshLayoutKey: null,
          alphaCutoff: 0.5,
          baseColorTextureKey: "texture:foliage",
          baseColorSamplerKey: "sampler:foliage",
        },
      ],
    });

    const opaque = report.descriptors.find(
      (descriptor) => descriptor.shader.label === "shadow-caster-depth-only",
    );
    const alphaTest = report.descriptors.find(
      (descriptor) => descriptor.shader.label === "shadow-caster-alpha-test",
    );

    // Both variants coexist with DISTINCT pipeline keys.
    expect(opaque).toBeDefined();
    expect(alphaTest).toBeDefined();
    expect(alphaTest?.pipelineKey).not.toBe(opaque?.pipelineKey);
    expect(alphaTest?.pipelineKey).toContain("alpha-test");

    // Opaque caster stays position-only with an empty fragment.
    expect(opaque?.vertex.buffers).toEqual(["POSITION"]);
    expect(opaque?.alphaTest).toBeUndefined();
    expect(SHADOW_CASTER_DEPTH_ONLY_WGSL).toContain("fn fs_main() {");

    // Alpha-test caster adds TEXCOORD_0 + binds the material baseColor + cutoff,
    // and its fragment discards cutout fragments.
    expect(alphaTest?.vertex.buffers).toEqual(["POSITION", "TEXCOORD_0"]);
    expect(alphaTest?.alphaTest).toEqual({
      alphaCutoff: 0.5,
      baseColorTextureKey: "texture:foliage",
      baseColorSamplerKey: "sampler:foliage",
    });
    expect(SHADOW_CASTER_ALPHA_TEST_WGSL).toContain(
      "var baseColorTexture: texture_2d<f32>",
    );
    expect(SHADOW_CASTER_ALPHA_TEST_WGSL).toContain(
      "textureSample(baseColorTexture, baseColorSampler, input.uv).a",
    );
    expect(SHADOW_CASTER_ALPHA_TEST_WGSL).toContain("discard;");
  });

  it("emits authored slope-scaled and constant depth bias on the caster pipeline depthStencil (M4-T5)", () => {
    // Every caster gets an always-on slope-scaled + constant depth bias (PlayCanvas
    // front-face parity); authored bias/slopeBias win when LARGER than the floor.
    const report = createShadowCasterPipelineDescriptorReport({
      commandEncoding: commandEncoding("ready"),
      depthBias: 3,
      slopeBias: 3,
    });

    expect(report.descriptor?.depthStencil).toMatchObject({
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less-equal",
      depthBias: 3,
      depthBiasSlopeScale: 3,
    });
    // Authored sub-integer rounds (4.9 -> 5); a below-floor slope (-1 -> 0) falls
    // back to the always-on caster slope (2.75).
    const biased = createShadowCasterPipelineDescriptorReport({
      commandEncoding: commandEncoding("ready"),
      depthBias: 4.9,
      slopeBias: -1,
    });
    expect(biased.descriptor?.depthStencil.depthBias).toBe(5);
    expect(biased.descriptor?.depthStencil.depthBiasSlopeScale).toBe(2.75);
  });

  it("reports depth-only shadow caster pipeline metadata without creating pipelines", () => {
    const report = createShadowCasterPipelineDescriptorReport({
      commandEncoding: commandEncoding("ready"),
    });
    const json = shadowCasterPipelineDescriptorReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "ready",
      commandRecordCount: 1,
      descriptorCount: 1,
      sections: {
        commandEncoding: true,
        vertexBufferLayout: true,
        indexBuffer: true,
        matrixBufferLayout: true,
        depthStencil: true,
        colorTargets: true,
        pipelineCreation: false,
        passSubmission: false,
        shaderSampling: false,
      },
      descriptor: {
        pipelineKey: "shadow-caster/depth-only/depth24plus/triangle-list/none",
        label: "shadow-caster-depth-only:depth24plus:triangle-list",
        shader: {
          family: "shadow-caster",
          label: "shadow-caster-depth-only",
          entryPoints: {
            vertex: "vs_main",
            fragment: "fs_main",
          },
        },
        vertex: {
          buffers: ["POSITION"],
          meshLayoutKey: null,
          matrixBufferLayoutKey:
            "shadow-caster/group-0:directional-shadow-matrices@0",
        },
        index: {
          required: true,
          format: "uint32",
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none",
          frontFace: "ccw",
        },
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: true,
          depthCompare: "less-equal",
          depthBias: 2,
          depthBiasSlopeScale: 2.75,
        },
        colorTargets: [],
      },
      descriptors: [
        {
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/none",
          label: "shadow-caster-depth-only:depth24plus:triangle-list",
          shader: {
            family: "shadow-caster",
            label: "shadow-caster-depth-only",
            entryPoints: {
              vertex: "vs_main",
              fragment: "fs_main",
            },
          },
          vertex: {
            buffers: ["POSITION"],
            meshLayoutKey: null,
            matrixBufferLayoutKey:
              "shadow-caster/group-0:directional-shadow-matrices@0",
          },
          index: {
            required: true,
            format: "uint32",
          },
          primitive: {
            topology: "triangle-list",
            cullMode: "none",
            frontFace: "ccw",
          },
          depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less-equal",
            depthBias: 2,
            depthBiasSlopeScale: 2.75,
          },
          colorTargets: [],
        },
      ],
      diagnostics: [
        {
          code: "shadowCasterPipelineDescriptor.passSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow caster pipeline descriptor metadata is planned, but shadow pass submission is deferred.",
        },
      ],
    });
    expect(
      JSON.parse(shadowCasterPipelineDescriptorReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPURenderPipeline|GPUShaderModule|GPUCommandEncoder|"raw"|callback/,
    );
  });

  it("preserves deferred command-encoding status without blocking metadata", () => {
    const json = shadowCasterPipelineDescriptorReportToJsonValue(
      createShadowCasterPipelineDescriptorReport({
        commandEncoding: commandEncoding("deferred"),
      }),
    );

    expect(json).toMatchObject({
      ready: false,
      status: "deferred",
      commandRecordCount: 1,
      descriptorCount: 1,
      sections: {
        commandEncoding: true,
        pipelineCreation: false,
        passSubmission: false,
        shaderSampling: false,
      },
      diagnostics: [
        {
          code: "shadowCasterPipelineDescriptor.commandEncodingDeferred",
          severity: "warning",
        },
        {
          code: "shadowCasterPipelineDescriptor.passSubmissionDeferred",
          severity: "warning",
        },
      ],
    });
  });

  it("specializes descriptor keys by caster mesh layout", () => {
    const json = shadowCasterPipelineDescriptorReportToJsonValue(
      createShadowCasterPipelineDescriptorReport({
        commandEncoding: commandEncoding("ready"),
        meshLayoutKeys: [
          "POSITION,NORMAL,TEXCOORD_0",
          "stride=40,POSITION@4,NORMAL@20,TEXCOORD_0@32",
          "POSITION,NORMAL,TEXCOORD_0",
        ],
      }),
    );

    expect(json.descriptorCount).toBe(2);
    expect(json.descriptors.map((descriptor) => descriptor.vertex)).toEqual([
      {
        buffers: ["POSITION"],
        meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
        matrixBufferLayoutKey:
          "shadow-caster/group-0:directional-shadow-matrices@0",
      },
      {
        buffers: ["POSITION"],
        meshLayoutKey: "stride=40,POSITION@4,NORMAL@20,TEXCOORD_0@32",
        matrixBufferLayoutKey:
          "shadow-caster/group-0:directional-shadow-matrices@0",
      },
    ]);
    expect(
      json.descriptors.map((descriptor) => descriptor.pipelineKey),
    ).toEqual([
      "shadow-caster/depth-only/depth24plus/triangle-list/none/mesh-layout:POSITION%2CNORMAL%2CTEXCOORD_0",
      "shadow-caster/depth-only/depth24plus/triangle-list/none/mesh-layout:stride%3D40%2CPOSITION%404%2CNORMAL%4020%2CTEXCOORD_0%4032",
    ]);
  });

  it("reports missing command records and unsupported topology", () => {
    const missing = shadowCasterPipelineDescriptorReportToJsonValue(
      createShadowCasterPipelineDescriptorReport({
        commandEncoding: { ...commandEncoding("missing"), records: [] },
        topology: "line-list",
        depthFormat: "",
      }),
    );

    expect(missing).toMatchObject({
      ready: false,
      status: "missing",
      commandRecordCount: 0,
      descriptorCount: 0,
      descriptor: null,
      sections: {
        commandEncoding: false,
        vertexBufferLayout: false,
        indexBuffer: false,
        matrixBufferLayout: false,
        depthStencil: false,
      },
    });
    expect(missing.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowCasterPipelineDescriptor.missingCommandEncoding",
      "shadowCasterPipelineDescriptor.missingDepthFormat",
      "shadowCasterPipelineDescriptor.unsupportedTopology",
    ]);
  });
});

describe("shadow caster pipeline cull mode (three.js shadowSide parity)", () => {
  function opaqueDescriptors(
    casterCullModes?: readonly ("back" | "front" | "none")[],
  ) {
    const report = createShadowCasterPipelineDescriptorReport({
      commandEncoding: commandEncoding("ready"),
      ...(casterCullModes === undefined ? {} : { casterCullModes }),
    });
    return report.descriptors.filter(
      (descriptor) => descriptor.shader.label === "shadow-caster-depth-only",
    );
  }

  it("defaults to cull 'none' with the legacy (unsuffixed) key when no cull modes given", () => {
    const [descriptor] = opaqueDescriptors();
    expect(descriptor?.primitive.cullMode).toBe("none");
    expect(descriptor?.pipelineKey).not.toContain("/cull:");
  });

  it("emits a 'front' (back-face) descriptor with a /cull:front key suffix", () => {
    const [descriptor] = opaqueDescriptors(["front"]);
    expect(descriptor?.primitive.cullMode).toBe("front");
    expect(descriptor?.pipelineKey).toContain("/cull:front");
  });

  it("emits one distinct descriptor per cull mode with distinct keys", () => {
    const descriptors = opaqueDescriptors(["front", "none"]);
    const byCull = new Map(
      descriptors.map((descriptor) => [
        descriptor.primitive.cullMode,
        descriptor,
      ]),
    );
    expect(byCull.get("front")).toBeDefined();
    expect(byCull.get("none")).toBeDefined();
    // Same mesh layout, different cull -> keys must NOT collide (cache guard).
    expect(byCull.get("front")?.pipelineKey).not.toBe(
      byCull.get("none")?.pipelineKey,
    );
  });

  it("forces alpha-test casters to cull 'none' regardless of opaque cull modes", () => {
    const report = createShadowCasterPipelineDescriptorReport({
      commandEncoding: commandEncoding("ready"),
      casterCullModes: ["front"],
      alphaTestCasters: [
        {
          meshLayoutKey: null,
          alphaCutoff: 0.5,
          baseColorTextureKey: "texture:foliage",
          baseColorSamplerKey: "sampler:foliage",
        },
      ],
    });
    const alphaTest = report.descriptors.find(
      (descriptor) => descriptor.shader.label === "shadow-caster-alpha-test",
    );
    expect(alphaTest?.primitive.cullMode).toBe("none");
  });
});

function commandEncoding(
  status: ShadowPassCommandEncodingReport["status"],
): ShadowPassCommandEncodingReport {
  return {
    ready: status === "ready" || status === "not-required",
    status,
    counts: {
      passes: status === "not-required" ? 0 : 1,
      depthViews: status === "not-required" ? 0 : 1,
      matrixBuffers: status === "not-required" ? 0 : 1,
      casterLists: status === "not-required" ? 0 : 1,
      commandPlans: status === "not-required" ? 0 : 1,
      commandRecords: status === "not-required" ? 0 : 1,
      drawCommands: status === "not-required" ? 0 : 3,
    },
    sections: {
      passPlans: true,
      depthTextureResources: true,
      matrixBufferResource: true,
      casterDrawLists: status !== "deferred",
      commandPlans: status !== "deferred",
      commandEncoding: status === "ready" || status === "not-required",
      passSubmission: false,
      shaderSampling: false,
    },
    records:
      status === "not-required"
        ? []
        : [
            {
              passKey: "shadow-pass:7:light:11",
              shadowId: 7,
              lightId: 11,
              depthTextureKey: "shadow-map:7:light:11:texture",
              depthViewKey: "shadow-map:7:light:11:view",
              matrixResourceKey: "shadow-matrix-buffer:directional",
              commandKey: "shadow-pass:7:light:11:caster-commands",
              drawCount: 3,
              commandEncoding: status === "ready" ? "ready" : "deferred",
            },
          ],
    diagnostics: [],
  };
}
