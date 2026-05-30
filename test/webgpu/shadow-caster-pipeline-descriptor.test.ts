import { describe, expect, it } from "vitest";

import {
  createShadowCasterPipelineDescriptorReport,
  shadowCasterPipelineDescriptorReportToJson,
  shadowCasterPipelineDescriptorReportToJsonValue,
  type ShadowPassCommandEncodingReport,
} from "@aperture-engine/webgpu/test-support";

describe("shadow caster pipeline descriptor metadata", () => {
  it("emits authored slope-scaled and constant depth bias on the caster pipeline depthStencil (M4-T5)", () => {
    const report = createShadowCasterPipelineDescriptorReport({
      commandEncoding: commandEncoding("ready"),
      depthBias: 3,
      slopeBias: 2.5,
    });

    expect(report.descriptor?.depthStencil).toMatchObject({
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less-equal",
      depthBias: 3,
      depthBiasSlopeScale: 2.5,
    });
    // Truncated to an integer for the WebGPU depthBias (depth-buffer units).
    const biased = createShadowCasterPipelineDescriptorReport({
      commandEncoding: commandEncoding("ready"),
      depthBias: 4.9,
      slopeBias: -1,
    });
    expect(biased.descriptor?.depthStencil.depthBias).toBe(4);
    expect(biased.descriptor?.depthStencil.depthBiasSlopeScale).toBe(0);
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
          depthBias: 0,
          depthBiasSlopeScale: 0,
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
            depthBias: 0,
            depthBiasSlopeScale: 0,
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
