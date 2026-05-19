import { describe, expect, it } from "vitest";

import {
  createShadowCasterPipelineDescriptorReport,
  createShadowCasterPipelineResourceReport,
  shadowCasterPipelineResourceReportToJson,
  shadowCasterPipelineResourceReportToJsonValue,
  SHADOW_CASTER_DEPTH_ONLY_WGSL,
  type ShadowPassCommandEncodingReport,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu";

describe("shadow caster pipeline resource", () => {
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
      pipelineKey: "shadow-caster/depth-only/depth24plus/triangle-list/back",
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
      primitive: {
        topology: "triangle-list",
        frontFace: "ccw",
        cullMode: "back",
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
        pipelineKey: "shadow-caster/depth-only/depth24plus/triangle-list/back",
        resourceKey:
          "render-pipeline:shadow-caster/depth-only/depth24plus/triangle-list/back",
        shaderModuleKey: "shader-module:shadow-caster-depth-only",
        label: "shadow-caster-depth-only:depth24plus:triangle-list",
      },
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
