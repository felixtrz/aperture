import {
  createShadowPassCommandBufferSubmissionReport,
  shadowPassCommandBufferSubmissionReportToJsonValue,
  type ShadowPassEncoderAssemblyReport,
} from "@aperture-engine/webgpu";
import { describe, expect, it } from "vitest";

describe("ShadowPassCommandBufferSubmissionReport", () => {
  it("reports not-required when no shadow passes exist", () => {
    const report = createShadowPassCommandBufferSubmissionReport({
      assembly: assembly({ passes: 0, assembledPasses: 0 }),
    });

    expect(report).toMatchObject({
      ready: true,
      status: "not-required",
      counts: {
        assembledPasses: 0,
        commandBuffers: 0,
        submittedCommandBuffers: 0,
      },
      sections: {
        encoderAssembly: false,
        commandBufferFinish: false,
        queueSubmission: false,
        shaderSampling: false,
      },
      diagnostics: [],
    });
  });

  it("reports missing assembly and encoder prerequisites", () => {
    const report = createShadowPassCommandBufferSubmissionReport({
      assembly: assembly({ assembledPasses: 0 }),
    });

    expect(report.ready).toBe(false);
    expect(report.status).toBe("missing");
    expect(report.counts.commandBuffers).toBe(0);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowPassCommandBufferSubmission.missingEncoderAssembly",
      "shadowPassCommandBufferSubmission.missingCommandEncoder",
    ]);
  });

  it("reports finish failure without exposing raw command-buffer handles", () => {
    const report = createShadowPassCommandBufferSubmissionReport({
      assembly: assembly(),
      encoder: {},
      label: "shadow-pass:test",
    });

    expect(report).toMatchObject({
      ready: false,
      status: "missing",
      counts: {
        commandBuffers: 0,
        submittedCommandBuffers: 0,
      },
      diagnostics: [
        {
          code: "shadowPassCommandBufferSubmission.finishFailed",
          severity: "warning",
        },
      ],
    });
    expect(
      JSON.stringify(
        shadowPassCommandBufferSubmissionReportToJsonValue(report),
      ),
    ).not.toMatch(/GPUCommandBuffer|GPUCommandEncoder|"raw"|commandBuffer":/);
  });

  it("finishes a shadow command buffer while queue submission is deferred", () => {
    const finished: string[] = [];
    const report = createShadowPassCommandBufferSubmissionReport({
      assembly: assembly(),
      encoder: {
        finish: () => {
          finished.push("finish");
          return { raw: "command-buffer" };
        },
      },
      label: "shadow-pass:directional",
    });

    expect(finished).toEqual(["finish"]);
    expect(report).toMatchObject({
      ready: true,
      status: "ready",
      counts: {
        assembledPasses: 1,
        commandCount: 15,
        drawCalls: 3,
        commandBuffers: 1,
        submittedCommandBuffers: 0,
        skippedSubmissions: 1,
      },
      sections: {
        encoderAssembly: true,
        commandBufferFinish: true,
        queueSubmission: false,
        shaderSampling: false,
      },
      commandBufferKeys: ["command-buffer:shadow-pass:directional"],
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowPassCommandBufferSubmission.queueSubmissionDeferred",
      "shadowPassCommandBufferSubmission.shaderSamplingDeferred",
    ]);
  });

  it("submits finished shadow command buffers when requested", () => {
    const submitted: (readonly unknown[])[] = [];
    const commandBuffer = { raw: "command-buffer" };
    const report = createShadowPassCommandBufferSubmissionReport({
      assembly: assembly(),
      encoder: { finish: () => commandBuffer },
      queue: {
        submit: (commandBuffers) => {
          submitted.push(commandBuffers);
        },
      },
      label: "shadow-pass:directional",
      submit: true,
    });

    expect(submitted).toEqual([[commandBuffer]]);
    expect(report).toMatchObject({
      ready: true,
      status: "submitted",
      counts: {
        commandBuffers: 1,
        submittedCommandBuffers: 1,
        skippedSubmissions: 0,
      },
      sections: {
        commandBufferFinish: true,
        queueSubmission: true,
        shaderSampling: false,
      },
      diagnostics: [
        {
          code: "shadowPassCommandBufferSubmission.shaderSamplingDeferred",
        },
      ],
    });
  });

  it("reports queue submission failure when submission is requested without a queue", () => {
    const report = createShadowPassCommandBufferSubmissionReport({
      assembly: assembly(),
      encoder: { finish: () => ({}) },
      submit: true,
    });

    expect(report).toMatchObject({
      ready: false,
      status: "missing",
      counts: {
        commandBuffers: 1,
        submittedCommandBuffers: 0,
        skippedSubmissions: 1,
      },
      diagnostics: [
        {
          code: "shadowPassCommandBufferSubmission.submitFailed",
          severity: "warning",
        },
      ],
    });
  });
});

function assembly(
  overrides: {
    readonly passes?: number;
    readonly assembledPasses?: number;
    readonly commandCount?: number;
    readonly drawCalls?: number;
  } = {},
): ShadowPassEncoderAssemblyReport {
  const passes = overrides.passes ?? 1;
  const assembledPasses = overrides.assembledPasses ?? 1;
  const commandCount = overrides.commandCount ?? 15;
  const drawCalls = overrides.drawCalls ?? 3;

  return {
    ready: assembledPasses > 0,
    status: assembledPasses > 0 ? "ready" : "missing",
    counts: {
      passes,
      attachments: assembledPasses,
      frameResourceDraws: drawCalls,
      commandRecords: assembledPasses,
      assembledPasses,
      commandCount,
      executedCommands: commandCount,
      drawCalls,
    },
    sections: {
      attachmentDescriptors: assembledPasses > 0,
      frameResources: assembledPasses > 0,
      commandRecords: assembledPasses > 0,
      passBegin: assembledPasses > 0,
      commandExecution: assembledPasses > 0,
      passEnd: assembledPasses > 0,
      commandBufferFinish: false,
      queueSubmission: false,
      shaderSampling: false,
    },
    records: [],
    diagnostics: [],
  };
}
