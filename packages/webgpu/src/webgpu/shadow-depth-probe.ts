import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowPassCommandBufferSubmissionReport } from "./shadow-pass-command-buffer-submission-report.js";
import type { ShadowSamplerResourceReport } from "./standard-material-shadow-bind-group.js";

export type ShadowDepthProbeStatus = "ready" | "missing" | "not-required";

export type ShadowDepthProbeDiagnosticCode =
  | "shadowDepthProbe.missingProjectionSamples"
  | "shadowDepthProbe.missingDepthTextureResource"
  | "shadowDepthProbe.missingSamplerResource"
  | "shadowDepthProbe.shadowPassNotSubmitted"
  | "shadowDepthProbe.missingDeviceSupport"
  | "shadowDepthProbe.pipelineCreationFailed"
  | "shadowDepthProbe.bindGroupCreationFailed"
  | "shadowDepthProbe.commandSubmissionFailed"
  | "shadowDepthProbe.readbackFailed"
  | "shadowDepthProbe.noStrictPair";

export interface ShadowDepthProbeDiagnostic {
  readonly code: ShadowDepthProbeDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly sampleKey?: string;
}

export interface ShadowDepthProbeProjectionSample {
  readonly key: string;
  readonly role: string;
  readonly shape: string;
  readonly uv: readonly [number, number];
  readonly depth: number;
  readonly insideProjection: boolean;
  readonly projectionDistance: number;
}

export interface ShadowDepthProbeRecord {
  readonly key: string;
  readonly role: string;
  readonly shape: string;
  readonly uv: readonly [number, number];
  readonly texel: readonly [number, number];
  readonly projectionDepth: number;
  readonly receiverCompareDepth: number;
  readonly sampledDepth: number;
  readonly compareResult: number;
  readonly expected: "lit" | "shadowed";
  readonly insideProjection: boolean;
  readonly projectionDistance: number;
}

export interface ShadowDepthProbeStrictPair {
  readonly receiverKey: string;
  readonly casterKey: string;
  readonly receiverCompareDepth: number;
  readonly receiverSampledDepth: number;
  readonly receiverCompareResult: number;
  readonly casterProjectionDepth: number;
  readonly uvDistance: number;
  readonly expectedReceiver: "shadowed";
}

export interface ShadowDepthProbeReport {
  readonly ready: boolean;
  readonly status: ShadowDepthProbeStatus;
  readonly sampleCount: number;
  readonly probedSampleCount: number;
  readonly sections: {
    readonly projectionCoverage: boolean;
    readonly depthTextureResource: boolean;
    readonly samplerResource: boolean;
    readonly commandBufferSubmission: boolean;
    readonly probeShader: boolean;
    readonly readback: boolean;
  };
  readonly records: readonly ShadowDepthProbeRecord[];
  readonly strictPair: ShadowDepthProbeStrictPair | null;
  readonly diagnostics: readonly ShadowDepthProbeDiagnostic[];
}

export type ShadowDepthProbeReportJsonValue = ShadowDepthProbeReport;

export interface ShadowDepthProbeDeviceLike {
  readonly createShaderModule?: (descriptor: unknown) => unknown;
  readonly createComputePipeline?: (descriptor: unknown) => {
    getBindGroupLayout?: (index: number) => unknown;
  };
  readonly createBindGroup?: (descriptor: unknown) => unknown;
  readonly createBuffer?: (descriptor: unknown) => ShadowDepthProbeBufferLike;
  readonly createCommandEncoder?: () => ShadowDepthProbeCommandEncoderLike;
  readonly queue?: {
    readonly writeBuffer?: (
      buffer: unknown,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ) => void;
    readonly submit?: (commandBuffers: Iterable<unknown>) => void;
    readonly onSubmittedWorkDone?: () => Promise<void>;
  };
}

export interface ShadowDepthProbeBufferLike {
  readonly mapAsync?: (mode: number) => Promise<void>;
  readonly getMappedRange?: () => ArrayBuffer;
  readonly unmap?: () => void;
}

export interface ShadowDepthProbeCommandEncoderLike {
  readonly beginComputePass?: (descriptor?: unknown) => {
    setPipeline?: (pipeline: unknown) => void;
    setBindGroup?: (index: number, bindGroup: unknown) => void;
    dispatchWorkgroups?: (x: number, y?: number, z?: number) => void;
    end?: () => void;
  };
  readonly copyBufferToBuffer?: (
    source: unknown,
    sourceOffset: number,
    destination: unknown,
    destinationOffset: number,
    size: number,
  ) => void;
  readonly finish?: () => unknown;
}

export interface CreateShadowDepthProbeReportOptions {
  readonly device: ShadowDepthProbeDeviceLike;
  readonly samples: readonly ShadowDepthProbeProjectionSample[];
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly samplerResource: ShadowSamplerResourceReport;
  readonly commandBufferSubmission: ShadowPassCommandBufferSubmissionReport;
  readonly depthBias?: number;
  readonly mapModeRead?: number;
}

const PROBE_STRIDE_FLOATS = 4;
const PROBE_STRIDE_BYTES = PROBE_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE_COPY_SRC = 0x4;
const GPU_BUFFER_USAGE_COPY_DST = 0x8;
const GPU_BUFFER_USAGE_STORAGE = 0x80;
const GPU_BUFFER_USAGE_MAP_READ = 0x1;

const SHADOW_DEPTH_PROBE_WGSL = /* wgsl */ `
struct ProbeInput {
  values: array<vec4f>,
};

struct ProbeOutput {
  values: array<vec4f>,
};

@group(0) @binding(0) var shadowDepth: texture_depth_2d;
@group(0) @binding(1) var shadowSampler: sampler_comparison;
@group(0) @binding(2) var<storage, read> probeInput: ProbeInput;
@group(0) @binding(3) var<storage, read_write> probeOutput: ProbeOutput;

@compute @workgroup_size(1)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= arrayLength(&probeInput.values)) {
    return;
  }

  let sample = probeInput.values[index];
  let uv = clamp(sample.xy, vec2f(0.0), vec2f(1.0));
  let receiverDepth = clamp(sample.z, 0.0, 1.0);
  let textureSize = textureDimensions(shadowDepth);
  let maxTexel = textureSize - vec2u(1u);
  let texel = min(vec2u(uv * vec2f(textureSize)), maxTexel);
  let sampledDepth = textureLoad(shadowDepth, vec2i(texel), 0);
  let compareResult = textureSampleCompareLevel(
    shadowDepth,
    shadowSampler,
    uv,
    receiverDepth,
  );

  probeOutput.values[index] = vec4f(sampledDepth, compareResult, f32(texel.x), f32(texel.y));
}
`;

export async function createShadowDepthProbeReport(
  options: CreateShadowDepthProbeReportOptions,
): Promise<ShadowDepthProbeReport> {
  const insideSamples = options.samples.filter(
    (sample) => sample.insideProjection,
  );
  const diagnostics: ShadowDepthProbeDiagnostic[] = [];

  if (options.samples.length === 0 || insideSamples.length === 0) {
    diagnostics.push({
      code: "shadowDepthProbe.missingProjectionSamples",
      severity: "warning",
      message:
        "Shadow depth probing requires projection coverage samples inside the light projection.",
    });
  }

  const depthResource = options.depthTextureResources.resources.find(
    (resource) => resource.allocation.resource !== null,
  );
  if (depthResource === undefined) {
    diagnostics.push({
      code: "shadowDepthProbe.missingDepthTextureResource",
      severity: "warning",
      message:
        "Shadow depth probing requires a renderer-owned shadow depth texture resource.",
    });
  }

  if (options.samplerResource.resource === null) {
    diagnostics.push({
      code: "shadowDepthProbe.missingSamplerResource",
      severity: "warning",
      message:
        "Shadow depth probing requires a renderer-owned comparison sampler.",
    });
  }

  if (options.commandBufferSubmission.counts.submittedCommandBuffers === 0) {
    diagnostics.push({
      code: "shadowDepthProbe.shadowPassNotSubmitted",
      severity: "warning",
      message:
        "Shadow depth probing requires the shadow pass command buffer to be submitted before probing.",
    });
  }

  if (
    diagnostics.length > 0 ||
    depthResource === undefined ||
    options.samplerResource.resource === null ||
    insideSamples.length === 0
  ) {
    return report({
      status: options.samples.length === 0 ? "not-required" : "missing",
      sampleCount: options.samples.length,
      records: [],
      strictPair: null,
      diagnostics,
      sections: {
        projectionCoverage: insideSamples.length > 0,
        depthTextureResource: depthResource !== undefined,
        samplerResource: options.samplerResource.resource !== null,
        commandBufferSubmission:
          options.commandBufferSubmission.counts.submittedCommandBuffers > 0,
        probeShader: false,
        readback: false,
      },
    });
  }

  const deviceDiagnostics = validateDevice(options.device);
  if (deviceDiagnostics.length > 0) {
    return report({
      status: "missing",
      sampleCount: options.samples.length,
      records: [],
      strictPair: null,
      diagnostics: [...diagnostics, ...deviceDiagnostics],
      sections: {
        projectionCoverage: true,
        depthTextureResource: true,
        samplerResource: true,
        commandBufferSubmission: true,
        probeShader: false,
        readback: false,
      },
    });
  }

  const probe = await runProbe({
    device: options.device,
    depthView: depthResource.allocation.resource?.view,
    sampler: options.samplerResource.resource.sampler,
    samples: insideSamples,
    depthBias: options.depthBias ?? 0,
    mapModeRead: options.mapModeRead ?? 1,
  });

  if ("diagnostic" in probe) {
    return report({
      status: "missing",
      sampleCount: options.samples.length,
      records: [],
      strictPair: null,
      diagnostics: [...diagnostics, probe.diagnostic],
      sections: {
        projectionCoverage: true,
        depthTextureResource: true,
        samplerResource: true,
        commandBufferSubmission: true,
        probeShader:
          probe.diagnostic.code !== "shadowDepthProbe.pipelineCreationFailed" &&
          probe.diagnostic.code !== "shadowDepthProbe.bindGroupCreationFailed",
        readback: false,
      },
    });
  }

  const records = createRecords(
    insideSamples,
    probe.values,
    options.depthBias ?? 0,
  );
  const strictPair = findStrictPair(records);
  if (strictPair === null) {
    diagnostics.push({
      code: "shadowDepthProbe.noStrictPair",
      severity: "warning",
      message:
        "Shadow depth probe did not find a receiver/caster pair with a strict shadowed receiver compare result.",
    });
  }

  return report({
    status: strictPair === null ? "missing" : "ready",
    sampleCount: options.samples.length,
    records,
    strictPair,
    diagnostics,
    sections: {
      projectionCoverage: true,
      depthTextureResource: true,
      samplerResource: true,
      commandBufferSubmission: true,
      probeShader: true,
      readback: true,
    },
  });
}

export function shadowDepthProbeReportToJsonValue(
  report: ShadowDepthProbeReport,
): ShadowDepthProbeReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    sampleCount: report.sampleCount,
    probedSampleCount: report.probedSampleCount,
    sections: { ...report.sections },
    records: report.records.map((record) => ({
      ...record,
      uv: [...record.uv] as [number, number],
      texel: [...record.texel] as [number, number],
    })),
    strictPair: report.strictPair === null ? null : { ...report.strictPair },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowDepthProbeReportToJson(
  report: ShadowDepthProbeReport,
): string {
  return JSON.stringify(shadowDepthProbeReportToJsonValue(report));
}

function validateDevice(
  device: ShadowDepthProbeDeviceLike,
): ShadowDepthProbeDiagnostic[] {
  const missing =
    device.createShaderModule === undefined ||
    device.createComputePipeline === undefined ||
    device.createBindGroup === undefined ||
    device.createBuffer === undefined ||
    device.createCommandEncoder === undefined ||
    device.queue?.writeBuffer === undefined ||
    device.queue.submit === undefined;

  return missing
    ? [
        {
          code: "shadowDepthProbe.missingDeviceSupport",
          severity: "warning",
          message:
            "Shadow depth probing requires shader, compute pipeline, buffer, command encoder, and queue support.",
        },
      ]
    : [];
}

async function runProbe(input: {
  readonly device: ShadowDepthProbeDeviceLike;
  readonly depthView: unknown;
  readonly sampler: unknown;
  readonly samples: readonly ShadowDepthProbeProjectionSample[];
  readonly depthBias: number;
  readonly mapModeRead: number;
}): Promise<
  | { readonly values: readonly [number, number, number, number][] }
  | { readonly diagnostic: ShadowDepthProbeDiagnostic }
> {
  try {
    const shaderModule = input.device.createShaderModule?.({
      label: "shadow-depth-probe",
      code: SHADOW_DEPTH_PROBE_WGSL,
    });
    const pipeline = input.device.createComputePipeline?.({
      label: "shadow-depth-probe",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "cs_main",
      },
    });
    const layout = pipeline?.getBindGroupLayout?.(0);

    if (pipeline === undefined || layout === undefined) {
      return {
        diagnostic: {
          code: "shadowDepthProbe.pipelineCreationFailed",
          severity: "warning",
          message: "Shadow depth probe compute pipeline creation failed.",
        },
      };
    }

    const inputBuffer = input.device.createBuffer?.({
      label: "shadow-depth-probe-input",
      size: input.samples.length * PROBE_STRIDE_BYTES,
      usage: GPU_BUFFER_USAGE_STORAGE | GPU_BUFFER_USAGE_COPY_DST,
    });
    const outputBuffer = input.device.createBuffer?.({
      label: "shadow-depth-probe-output",
      size: input.samples.length * PROBE_STRIDE_BYTES,
      usage: GPU_BUFFER_USAGE_STORAGE | GPU_BUFFER_USAGE_COPY_SRC,
    });
    const readbackBuffer = input.device.createBuffer?.({
      label: "shadow-depth-probe-readback",
      size: input.samples.length * PROBE_STRIDE_BYTES,
      usage: GPU_BUFFER_USAGE_MAP_READ | GPU_BUFFER_USAGE_COPY_DST,
    });

    if (
      inputBuffer === undefined ||
      outputBuffer === undefined ||
      readbackBuffer === undefined
    ) {
      return {
        diagnostic: {
          code: "shadowDepthProbe.missingDeviceSupport",
          severity: "warning",
          message: "Shadow depth probe could not create GPU buffers.",
        },
      };
    }

    input.device.queue?.writeBuffer?.(
      inputBuffer,
      0,
      packProbeSamples(input.samples, input.depthBias),
    );

    const bindGroup = input.device.createBindGroup?.({
      label: "shadow-depth-probe",
      layout,
      entries: [
        { binding: 0, resource: input.depthView },
        { binding: 1, resource: input.sampler },
        { binding: 2, resource: { buffer: inputBuffer } },
        { binding: 3, resource: { buffer: outputBuffer } },
      ],
    });

    if (bindGroup === undefined) {
      return {
        diagnostic: {
          code: "shadowDepthProbe.bindGroupCreationFailed",
          severity: "warning",
          message: "Shadow depth probe bind group creation failed.",
        },
      };
    }

    const encoder = input.device.createCommandEncoder?.();
    const pass = encoder?.beginComputePass?.({
      label: "shadow-depth-probe",
    });
    pass?.setPipeline?.(pipeline);
    pass?.setBindGroup?.(0, bindGroup);
    pass?.dispatchWorkgroups?.(input.samples.length);
    pass?.end?.();
    encoder?.copyBufferToBuffer?.(
      outputBuffer,
      0,
      readbackBuffer,
      0,
      input.samples.length * PROBE_STRIDE_BYTES,
    );
    const commandBuffer = encoder?.finish?.();

    if (commandBuffer === undefined) {
      return {
        diagnostic: {
          code: "shadowDepthProbe.commandSubmissionFailed",
          severity: "warning",
          message: "Shadow depth probe command encoding failed.",
        },
      };
    }

    input.device.queue?.submit?.([commandBuffer]);
    await input.device.queue?.onSubmittedWorkDone?.();
    await readbackBuffer.mapAsync?.(input.mapModeRead);
    const mapped = readbackBuffer.getMappedRange?.();

    if (mapped === undefined) {
      return {
        diagnostic: {
          code: "shadowDepthProbe.readbackFailed",
          severity: "warning",
          message:
            "Shadow depth probe readback buffer did not expose mapped data.",
        },
      };
    }

    const values = unpackProbeValues(mapped, input.samples.length);
    readbackBuffer.unmap?.();

    return { values };
  } catch (error) {
    return {
      diagnostic: {
        code: "shadowDepthProbe.readbackFailed",
        severity: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Shadow depth probe failed during GPU readback.",
      },
    };
  }
}

function packProbeSamples(
  samples: readonly ShadowDepthProbeProjectionSample[],
  depthBias: number,
): Float32Array {
  const values = new Float32Array(samples.length * PROBE_STRIDE_FLOATS);

  samples.forEach((sample, index) => {
    const offset = index * PROBE_STRIDE_FLOATS;
    values[offset] = sample.uv[0];
    values[offset + 1] = sample.uv[1];
    values[offset + 2] = Math.min(Math.max(sample.depth - depthBias, 0), 1);
    values[offset + 3] = sample.insideProjection ? 1 : 0;
  });

  return values;
}

function unpackProbeValues(
  mapped: ArrayBuffer,
  sampleCount: number,
): readonly [number, number, number, number][] {
  const data = new Float32Array(mapped);
  const values: [number, number, number, number][] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const offset = index * PROBE_STRIDE_FLOATS;
    values.push([
      sanitizeNumber(data[offset] ?? 0),
      sanitizeNumber(data[offset + 1] ?? 0),
      sanitizeNumber(data[offset + 2] ?? 0),
      sanitizeNumber(data[offset + 3] ?? 0),
    ]);
  }

  return values;
}

function createRecords(
  samples: readonly ShadowDepthProbeProjectionSample[],
  values: readonly [number, number, number, number][],
  depthBias: number,
): readonly ShadowDepthProbeRecord[] {
  return samples.map((sample, index) => {
    const value = values[index] ?? [1, 1, 0, 0];
    const compareResult = clamp01(value[1]);
    const receiverCompareDepth = clamp01(sample.depth - depthBias);

    return {
      key: sample.key,
      role: sample.role,
      shape: sample.shape,
      uv: [sanitizeNumber(sample.uv[0]), sanitizeNumber(sample.uv[1])],
      texel: [
        Math.max(0, Math.round(value[2])),
        Math.max(0, Math.round(value[3])),
      ],
      projectionDepth: sanitizeNumber(sample.depth),
      receiverCompareDepth: sanitizeNumber(receiverCompareDepth),
      sampledDepth: sanitizeNumber(value[0]),
      compareResult: sanitizeNumber(compareResult),
      expected: compareResult < 0.5 ? "shadowed" : "lit",
      insideProjection: sample.insideProjection,
      projectionDistance: sanitizeNumber(sample.projectionDistance),
    };
  });
}

function findStrictPair(
  records: readonly ShadowDepthProbeRecord[],
): ShadowDepthProbeStrictPair | null {
  const receivers = records.filter(
    (record) => record.role === "receiver" && record.expected === "shadowed",
  );
  const casters = records.filter((record) => record.role === "caster");

  if (receivers.length === 0 || casters.length === 0) {
    return null;
  }

  const receiver = receivers[0];

  if (receiver === undefined) {
    return null;
  }

  const caster = casters
    .map((candidate) => ({
      candidate,
      uvDistance: Math.hypot(
        candidate.uv[0] - receiver.uv[0],
        candidate.uv[1] - receiver.uv[1],
      ),
    }))
    .sort((left, right) => left.uvDistance - right.uvDistance)[0];

  if (caster === undefined) {
    return null;
  }

  return {
    receiverKey: receiver.key,
    casterKey: caster.candidate.key,
    receiverCompareDepth: receiver.receiverCompareDepth,
    receiverSampledDepth: receiver.sampledDepth,
    receiverCompareResult: receiver.compareResult,
    casterProjectionDepth: caster.candidate.projectionDepth,
    uvDistance: sanitizeNumber(caster.uvDistance),
    expectedReceiver: "shadowed",
  };
}

function report(input: {
  readonly status: ShadowDepthProbeStatus;
  readonly sampleCount: number;
  readonly records: readonly ShadowDepthProbeRecord[];
  readonly strictPair: ShadowDepthProbeStrictPair | null;
  readonly diagnostics: readonly ShadowDepthProbeDiagnostic[];
  readonly sections: ShadowDepthProbeReport["sections"];
}): ShadowDepthProbeReport {
  return {
    ready: input.status === "ready" || input.status === "not-required",
    status: input.status,
    sampleCount: input.sampleCount,
    probedSampleCount: input.records.length,
    sections: input.sections,
    records: input.records,
    strictPair: input.strictPair,
    diagnostics: input.diagnostics,
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function sanitizeNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
