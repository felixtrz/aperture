import { describe, expect, it } from "vitest";

import {
  createShadowPassEncoderAssemblyReport,
  shadowPassEncoderAssemblyReportToJson,
  shadowPassEncoderAssemblyReportToJsonValue,
  type RenderPassCommand,
  type RenderPassCommandEncoderLike,
  type ShadowCasterFrameResourceReadinessReport,
  type ShadowPassAttachmentDescriptorReport,
  type ShadowPassCommandEncodingReport,
} from "@aperture-engine/webgpu/test-support";

describe("shadow pass encoder assembly report", () => {
  it("begins, executes, and ends shadow pass command records without submitting", () => {
    const calls: unknown[] = [];
    const report = createShadowPassEncoderAssemblyReport({
      attachments: attachments(),
      frameResources: frameResources("ready"),
      commandEncoding: commandEncoding("ready"),
      commands: [{ passKey: "shadow-pass:7:light:11", commands: commands() }],
      encoder: recordingEncoder(calls),
      resolveDepthView: () => "depth-view",
    });
    const json = shadowPassEncoderAssemblyReportToJsonValue(report);

    expect(json).toEqual({
      ready: true,
      status: "ready",
      counts: {
        passes: 1,
        attachments: 1,
        frameResourceDraws: 1,
        commandRecords: 1,
        assembledPasses: 1,
        commandCount: 5,
        executedCommands: 5,
        drawCalls: 1,
      },
      sections: {
        attachmentDescriptors: true,
        frameResources: true,
        commandRecords: true,
        passBegin: true,
        commandExecution: true,
        passEnd: true,
        commandBufferFinish: false,
        queueSubmission: false,
        shaderSampling: false,
      },
      records: [
        {
          passKey: "shadow-pass:7:light:11",
          shadowId: 7,
          lightId: 11,
          depthTextureKey: "shadow-map:7:light:11:texture",
          depthViewKey: "shadow-map:7:light:11:view",
          commandCount: 5,
          executedCommands: 5,
          drawCalls: 1,
          indexedDrawCalls: 1,
          begun: true,
          ended: true,
        },
      ],
      diagnostics: [
        {
          code: "shadowPassEncoderAssembly.commandBufferSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow pass encoders are assembled, but command-buffer finish and queue submission are deferred.",
        },
        {
          code: "shadowPassEncoderAssembly.shaderSamplingDeferred",
          severity: "warning",
          message:
            "Shadow pass encoders are assembled, but StandardMaterial shadow sampling remains deferred.",
        },
      ],
    });
    expect(JSON.parse(shadowPassEncoderAssemblyReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toMatch(
      /GPUCommandEncoder|GPURenderPassEncoder|GPUCommandBuffer|"raw"|callback/,
    );
    expect(calls).toEqual([
      [
        "beginRenderPass",
        {
          colorAttachments: [],
          depthStencilAttachment: {
            view: "depth-view",
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
          },
        },
      ],
      ["setPipeline", "pipeline"],
      ["setBindGroup", 0, "matrix-bind-group"],
      ["setVertexBuffer", 0, "vertex-buffer"],
      ["setIndexBuffer", "index-buffer", "uint16"],
      ["drawIndexed", 6, 1, 0, 0, 0],
      ["end"],
    ]);
  });

  it("reports missing encoder and not-ready frame resources as blocking", () => {
    const json = shadowPassEncoderAssemblyReportToJsonValue(
      createShadowPassEncoderAssemblyReport({
        attachments: attachments(),
        frameResources: frameResources("missing"),
        commandEncoding: commandEncoding("ready"),
        commands: [],
      }),
    );

    expect(json).toMatchObject({
      ready: false,
      status: "missing",
      counts: {
        passes: 1,
        attachments: 1,
        frameResourceDraws: 0,
        commandRecords: 1,
        assembledPasses: 0,
        commandCount: 0,
        executedCommands: 0,
        drawCalls: 0,
      },
      records: [
        {
          passKey: "shadow-pass:7:light:11",
          commandCount: 0,
          begun: false,
          ended: false,
        },
      ],
    });
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowPassEncoderAssembly.frameResourcesNotReady",
      "shadowPassEncoderAssembly.missingCommandEncoder",
      "shadowPassEncoderAssembly.missingCommandRecords",
    ]);
  });

  it("reports command execution failures without raw encoder handles", () => {
    const json = shadowPassEncoderAssemblyReportToJsonValue(
      createShadowPassEncoderAssemblyReport({
        attachments: attachments(),
        frameResources: frameResources("ready"),
        commandEncoding: commandEncoding("ready"),
        commands: [{ passKey: "shadow-pass:7:light:11", commands: commands() }],
        encoder: {
          beginRenderPass: () => ({
            setPipeline: () => undefined,
            end: () => undefined,
          }),
        },
      }),
    );

    expect(json).toMatchObject({
      ready: false,
      status: "missing",
      counts: {
        assembledPasses: 1,
        commandCount: 5,
        executedCommands: 1,
        drawCalls: 0,
      },
      records: [
        {
          commandCount: 5,
          executedCommands: 1,
          begun: true,
          ended: true,
        },
      ],
    });
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowPassEncoderAssembly.commandExecutionFailed",
      "shadowPassEncoderAssembly.commandExecutionFailed",
      "shadowPassEncoderAssembly.commandExecutionFailed",
      "shadowPassEncoderAssembly.commandExecutionFailed",
      "shadowPassEncoderAssembly.commandBufferSubmissionDeferred",
      "shadowPassEncoderAssembly.shaderSamplingDeferred",
    ]);
  });
});

function attachments(): ShadowPassAttachmentDescriptorReport {
  return {
    ready: false,
    status: "deferred",
    passCount: 1,
    attachmentCount: 1,
    sections: {
      passPlans: true,
      depthTextureResources: true,
      depthAttachments: true,
      commandEncoder: false,
      passSubmission: false,
      shaderSampling: false,
    },
    attachments: [
      {
        passKey: "shadow-pass:7:light:11",
        shadowId: 7,
        lightId: 11,
        textureKey: "shadow-map:7:light:11:texture",
        viewKey: "shadow-map:7:light:11:view",
        width: 1024,
        height: 1024,
        depthFormat: "depth24plus",
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1,
      },
    ],
    diagnostics: [],
  };
}

function frameResources(
  status: ShadowCasterFrameResourceReadinessReport["status"],
): ShadowCasterFrameResourceReadinessReport {
  const ready = status === "ready";

  return {
    ready,
    status,
    counts: {
      casterDraws: 1,
      readyDraws: ready ? 1 : 0,
      missingMeshBuffers: ready ? 0 : 1,
      pipelineDescriptors: 1,
      matrixBuffers: 1,
    },
    sections: {
      casterDrawLists: true,
      preparedMeshBuffers: ready,
      matrixBufferResource: true,
      pipelineDescriptor: true,
      pipelineCreation: false,
      passSubmission: false,
      shaderSampling: false,
    },
    records: [],
    diagnostics: [],
  };
}

function commandEncoding(
  status: ShadowPassCommandEncodingReport["status"],
): ShadowPassCommandEncodingReport {
  return {
    ready: status === "ready" || status === "not-required",
    status,
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

function commands(): RenderPassCommand[] {
  return [
    {
      kind: "setPipeline",
      renderId: 1,
      pipelineKey: "shadow-caster/depth-only",
      pipeline: "pipeline",
    },
    {
      kind: "setBindGroup",
      renderId: 1,
      index: 0,
      resourceKey: "shadow-matrix-buffer:directional",
      bindGroup: "matrix-bind-group",
    },
    {
      kind: "setVertexBuffer",
      renderId: 1,
      slot: 0,
      resourceKey: "mesh-vertex-buffer:cube/position",
      buffer: "vertex-buffer",
    },
    {
      kind: "setIndexBuffer",
      renderId: 1,
      resourceKey: "mesh-index-buffer:cube/index",
      buffer: "index-buffer",
      format: "uint16",
    },
    {
      kind: "drawIndexed",
      renderId: 1,
      indexCount: 6,
      instanceCount: 1,
      firstIndex: 0,
      baseVertex: 0,
      firstInstance: 0,
    },
  ];
}

function recordingEncoder(calls: unknown[]): RenderPassCommandEncoderLike {
  return {
    beginRenderPass: (descriptor) => {
      calls.push(["beginRenderPass", descriptor]);

      return {
        setPipeline: (pipeline) => calls.push(["setPipeline", pipeline]),
        setBindGroup: (index, bindGroup) =>
          calls.push(["setBindGroup", index, bindGroup]),
        setVertexBuffer: (slot, buffer) =>
          calls.push(["setVertexBuffer", slot, buffer]),
        setIndexBuffer: (buffer, format) =>
          calls.push(["setIndexBuffer", buffer, format]),
        drawIndexed: (
          indexCount,
          instanceCount,
          firstIndex,
          baseVertex,
          firstInstance,
        ) =>
          calls.push([
            "drawIndexed",
            indexCount,
            instanceCount,
            firstIndex,
            baseVertex,
            firstInstance,
          ]),
        end: () => calls.push(["end"]),
      };
    },
  };
}
