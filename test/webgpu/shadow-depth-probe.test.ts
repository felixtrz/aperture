import { describe, expect, it } from "vitest";
import {
  createShadowDepthProbeReport,
  shadowDepthProbeReportToJson,
  shadowDepthProbeReportToJsonValue,
  type CreateShadowDepthProbeReportOptions,
  type ShadowDepthProbeDeviceLike,
  type ShadowDepthProbeProjectionSample,
} from "../../packages/webgpu/src/shadows/shadow-depth-probe.js";
import type { ShadowDepthTextureResourceReport } from "../../packages/webgpu/src/shadows/shadow-depth-texture-resource.js";
import type { ShadowPassCommandBufferSubmissionReport } from "../../packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.js";
import type { ShadowSamplerResourceReport } from "../../packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.js";

function sample(
  input: Partial<ShadowDepthProbeProjectionSample> & { readonly key: string },
): ShadowDepthProbeProjectionSample {
  return {
    role: "receiver",
    shape: "plane",
    uv: [0.5, 0.5],
    depth: 0.5,
    insideProjection: true,
    projectionDistance: 0,
    ...input,
  };
}

function depthResources(
  view: unknown = { label: "depth-view" },
): ShadowDepthTextureResourceReport {
  return {
    resources: [{ allocation: { resource: { view } } }],
  } as unknown as ShadowDepthTextureResourceReport;
}

function emptyDepthResources(): ShadowDepthTextureResourceReport {
  return {
    resources: [{ allocation: { resource: null } }],
  } as unknown as ShadowDepthTextureResourceReport;
}

function samplerResource(
  sampler: unknown = { label: "shadow-sampler" },
): ShadowSamplerResourceReport {
  return { resource: { sampler } } as unknown as ShadowSamplerResourceReport;
}

function missingSamplerResource(): ShadowSamplerResourceReport {
  return { resource: null } as unknown as ShadowSamplerResourceReport;
}

function submission(
  submittedCommandBuffers = 1,
): ShadowPassCommandBufferSubmissionReport {
  return {
    counts: { submittedCommandBuffers },
  } as unknown as ShadowPassCommandBufferSubmissionReport;
}

interface FakeDeviceOptions {
  readonly readbackValues?: readonly number[];
  readonly pipelineReturnsUndefined?: boolean;
  readonly bindGroupReturnsUndefined?: boolean;
  readonly buffersReturnUndefined?: boolean;
  readonly finishReturnsUndefined?: boolean;
  readonly mappedRangeUndefined?: boolean;
  readonly shaderModuleThrows?: boolean;
}

function fakeDevice(options: FakeDeviceOptions = {}): {
  readonly device: ShadowDepthProbeDeviceLike;
  readonly events: string[];
  readonly writtenInput: () => Float32Array | null;
} {
  const events: string[] = [];
  let written: Float32Array | null = null;
  const readback = new Float32Array(options.readbackValues ?? []);

  const device: ShadowDepthProbeDeviceLike = {
    createShaderModule: (descriptor) => {
      if (options.shaderModuleThrows === true) {
        throw new Error("shader module exploded");
      }
      events.push("shader");
      return descriptor;
    },
    createComputePipeline: () => {
      events.push("pipeline");
      if (options.pipelineReturnsUndefined === true) {
        return undefined as unknown as ReturnType<
          NonNullable<ShadowDepthProbeDeviceLike["createComputePipeline"]>
        >;
      }
      return { getBindGroupLayout: () => ({ layout: true }) };
    },
    createBindGroup: () => {
      events.push("bind-group");
      return options.bindGroupReturnsUndefined === true
        ? (undefined as unknown as object)
        : { bindGroup: true };
    },
    createBuffer: (descriptor) => {
      events.push(`buffer:${(descriptor as { label?: string }).label}`);
      if (options.buffersReturnUndefined === true) {
        return undefined as unknown as ReturnType<
          NonNullable<ShadowDepthProbeDeviceLike["createBuffer"]>
        >;
      }
      return {
        mapAsync: async () => {
          events.push("map");
        },
        getMappedRange: () =>
          options.mappedRangeUndefined === true
            ? (undefined as unknown as ArrayBuffer)
            : (readback.buffer as ArrayBuffer),
        unmap: () => events.push("unmap"),
      };
    },
    createCommandEncoder: () => ({
      beginComputePass: () => ({
        setPipeline: () => events.push("pass:pipeline"),
        setBindGroup: () => events.push("pass:bind"),
        dispatchWorkgroups: (x: number) => events.push(`pass:dispatch:${x}`),
        end: () => events.push("pass:end"),
      }),
      copyBufferToBuffer: () => events.push("copy"),
      finish: () => {
        events.push("finish");
        return options.finishReturnsUndefined === true
          ? undefined
          : { commandBuffer: true };
      },
    }),
    queue: {
      writeBuffer: (_buffer, _offset, data) => {
        written = new Float32Array(data as ArrayBuffer | Float32Array);
        events.push("write");
      },
      submit: () => events.push("submit"),
      onSubmittedWorkDone: async () => {
        events.push("done");
      },
    },
  };

  return { device, events, writtenInput: () => written };
}

function probeOptions(
  overrides: Partial<CreateShadowDepthProbeReportOptions> = {},
): CreateShadowDepthProbeReportOptions {
  return {
    device: fakeDevice().device,
    samples: [sample({ key: "r" })],
    depthTextureResources: depthResources(),
    samplerResource: samplerResource(),
    commandBufferSubmission: submission(),
    ...overrides,
  };
}

function diagnosticCodes(report: {
  readonly diagnostics: readonly { readonly code: string }[];
}): readonly string[] {
  return report.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("shadow depth probe preconditions", () => {
  it("reports not-required when there are no samples at all", async () => {
    const report = await createShadowDepthProbeReport(
      probeOptions({ samples: [] }),
    );

    expect(report.status).toBe("not-required");
    expect(report.ready).toBe(true);
    expect(report.sampleCount).toBe(0);
    expect(report.probedSampleCount).toBe(0);
    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.missingProjectionSamples",
    );
    expect(report.sections.projectionCoverage).toBe(false);
  });

  it("reports missing when samples exist but none fall inside the projection", async () => {
    const report = await createShadowDepthProbeReport(
      probeOptions({
        samples: [sample({ key: "outside", insideProjection: false })],
      }),
    );

    expect(report.status).toBe("missing");
    expect(report.ready).toBe(false);
    expect(report.sampleCount).toBe(1);
    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.missingProjectionSamples",
    );
  });

  it("diagnoses a missing shadow depth texture resource", async () => {
    const report = await createShadowDepthProbeReport(
      probeOptions({ depthTextureResources: emptyDepthResources() }),
    );

    expect(report.status).toBe("missing");
    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.missingDepthTextureResource",
    );
    expect(report.sections.depthTextureResource).toBe(false);
    expect(report.sections.projectionCoverage).toBe(true);
  });

  it("diagnoses a missing comparison sampler resource", async () => {
    const report = await createShadowDepthProbeReport(
      probeOptions({ samplerResource: missingSamplerResource() }),
    );

    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.missingSamplerResource",
    );
    expect(report.sections.samplerResource).toBe(false);
  });

  it("diagnoses an unsubmitted shadow pass", async () => {
    const report = await createShadowDepthProbeReport(
      probeOptions({ commandBufferSubmission: submission(0) }),
    );

    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.shadowPassNotSubmitted",
    );
    expect(report.sections.commandBufferSubmission).toBe(false);
  });

  it("diagnoses missing device support before attempting the probe", async () => {
    const report = await createShadowDepthProbeReport(
      probeOptions({
        device: { queue: {} } as unknown as ShadowDepthProbeDeviceLike,
      }),
    );

    expect(report.status).toBe("missing");
    expect(diagnosticCodes(report)).toEqual([
      "shadowDepthProbe.missingDeviceSupport",
    ]);
    expect(report.sections.probeShader).toBe(false);
  });
});

describe("shadow depth probe GPU failure paths", () => {
  it("diagnoses compute pipeline creation failure", async () => {
    const { device } = fakeDevice({ pipelineReturnsUndefined: true });
    const report = await createShadowDepthProbeReport(probeOptions({ device }));

    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.pipelineCreationFailed",
    );
    expect(report.sections.probeShader).toBe(false);
    expect(report.sections.readback).toBe(false);
  });

  it("diagnoses buffer creation failure as missing device support", async () => {
    const { device } = fakeDevice({ buffersReturnUndefined: true });
    const report = await createShadowDepthProbeReport(probeOptions({ device }));

    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.missingDeviceSupport",
    );
  });

  it("diagnoses bind group creation failure", async () => {
    const { device } = fakeDevice({ bindGroupReturnsUndefined: true });
    const report = await createShadowDepthProbeReport(probeOptions({ device }));

    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.bindGroupCreationFailed",
    );
    expect(report.sections.probeShader).toBe(false);
  });

  it("diagnoses command encoding failure", async () => {
    const { device } = fakeDevice({ finishReturnsUndefined: true });
    const report = await createShadowDepthProbeReport(probeOptions({ device }));

    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.commandSubmissionFailed",
    );
    expect(report.sections.probeShader).toBe(true);
  });

  it("diagnoses a readback buffer without mapped data", async () => {
    const { device } = fakeDevice({
      readbackValues: [0, 0, 0, 0],
      mappedRangeUndefined: true,
    });
    const report = await createShadowDepthProbeReport(probeOptions({ device }));

    expect(diagnosticCodes(report)).toContain(
      "shadowDepthProbe.readbackFailed",
    );
  });

  it("converts thrown device errors into a readback diagnostic with the message", async () => {
    const { device } = fakeDevice({ shaderModuleThrows: true });
    const report = await createShadowDepthProbeReport(probeOptions({ device }));

    const diagnostic = report.diagnostics.find(
      (entry) => entry.code === "shadowDepthProbe.readbackFailed",
    );
    expect(diagnostic?.message).toBe("shader module exploded");
  });
});

describe("shadow depth probe happy path", () => {
  const receiver = sample({ key: "receiver", role: "receiver", depth: 0.62 });
  const caster = sample({
    key: "caster",
    role: "caster",
    uv: [0.55, 0.5],
    depth: 0.3,
  });
  const outside = sample({
    key: "outside",
    role: "receiver",
    insideProjection: false,
  });

  it("probes inside samples, finds a strict pair, and reports ready", async () => {
    // Per-sample readback stride is [sampledDepth, compareResult, texelX, texelY].
    const { device, events, writtenInput } = fakeDevice({
      readbackValues: [0.3, 0, 256, 256, 0.3, 1, 281, 256],
    });
    const report = await createShadowDepthProbeReport(
      probeOptions({
        device,
        samples: [receiver, caster, outside],
        depthBias: 0.02,
      }),
    );

    expect(report.status).toBe("ready");
    expect(report.ready).toBe(true);
    expect(report.sampleCount).toBe(3);
    expect(report.probedSampleCount).toBe(2);
    expect(report.sections).toEqual({
      projectionCoverage: true,
      depthTextureResource: true,
      samplerResource: true,
      commandBufferSubmission: true,
      probeShader: true,
      readback: true,
    });

    const receiverRecord = report.records.find(
      (record) => record.key === "receiver",
    );
    expect(receiverRecord).toMatchObject({
      role: "receiver",
      expected: "shadowed",
      compareResult: 0,
      texel: [256, 256],
    });
    expect(receiverRecord?.sampledDepth).toBeCloseTo(0.3, 5);
    expect(receiverRecord?.receiverCompareDepth).toBeCloseTo(0.6, 5);

    expect(report.strictPair).toMatchObject({
      receiverKey: "receiver",
      casterKey: "caster",
      expectedReceiver: "shadowed",
      receiverCompareResult: 0,
    });
    expect(report.strictPair?.uvDistance).toBeCloseTo(0.05, 5);

    // The probe input packs uv, biased depth, and the inside flag per sample.
    const packed = writtenInput();
    expect(packed).not.toBeNull();
    expect(packed?.[2]).toBeCloseTo(0.6, 5);
    expect(packed?.[3]).toBe(1);
    expect(events).toContain("pass:dispatch:2");
    expect(events).toContain("submit");
    expect(events).toContain("unmap");
  });

  it("reports missing with a noStrictPair diagnostic when nothing is shadowed", async () => {
    const { device } = fakeDevice({
      readbackValues: [0.9, 1, 256, 256, 0.9, 1, 281, 256],
    });
    const report = await createShadowDepthProbeReport(
      probeOptions({ device, samples: [receiver, caster] }),
    );

    expect(report.status).toBe("missing");
    expect(report.ready).toBe(false);
    expect(diagnosticCodes(report)).toContain("shadowDepthProbe.noStrictPair");
    expect(report.strictPair).toBeNull();
  });

  it("reports missing without a strict pair when no caster sample exists", async () => {
    const { device } = fakeDevice({ readbackValues: [0.3, 0, 256, 256] });
    const report = await createShadowDepthProbeReport(
      probeOptions({ device, samples: [receiver] }),
    );

    expect(report.strictPair).toBeNull();
    expect(diagnosticCodes(report)).toContain("shadowDepthProbe.noStrictPair");
  });

  it("round-trips through the JSON projection", async () => {
    const { device } = fakeDevice({
      readbackValues: [0.3, 0, 256, 256, 0.3, 1, 281, 256],
    });
    const report = await createShadowDepthProbeReport(
      probeOptions({ device, samples: [receiver, caster] }),
    );

    const jsonValue = shadowDepthProbeReportToJsonValue(report);
    expect(jsonValue.records).not.toBe(report.records);
    expect(JSON.parse(shadowDepthProbeReportToJson(report))).toEqual(
      JSON.parse(JSON.stringify(jsonValue)),
    );
  });
});
