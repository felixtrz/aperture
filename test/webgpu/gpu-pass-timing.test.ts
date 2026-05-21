import { describe, expect, it } from "vitest";

import {
  assembleFrameBoundary,
  createGpuPassTimingReport,
  createGpuTimestampQueryResources,
  createShadowPassCommandBufferSubmissionReport,
  createShadowPassEncoderAssemblyReport,
  readGpuTimestampQueryResults,
  type GpuTimestampBufferLike,
  type RenderPassCommand,
  type ShadowCasterFrameResourceReadinessReport,
  type ShadowPassAttachmentDescriptorReport,
  type ShadowPassCommandEncodingReport,
} from "@aperture-engine/webgpu";

describe("GPU pass timing instrumentation", () => {
  it("writes and resolves a named main render pass timing around frame submission", async () => {
    const device = new FakePassTimingDevice();
    const created = createGpuTimestampQueryResources({
      device,
      label: "unit-main-pass",
      queryCount: 2,
    });

    expect(created.supported).toBe(true);
    expect(created.resources).not.toBeNull();

    if (created.resources === null) {
      return;
    }

    const boundary = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device,
      queue: device.queue,
      commands: [drawCommand()],
      label: "main-frame",
      gpuTiming: {
        passName: "main",
        resources: created.resources,
      },
    });

    await device.queue.onSubmittedWorkDone();
    const timing = createGpuPassTimingReport({
      passNames: ["main"],
      readback: await readGpuTimestampQueryResults(created.resources),
      diagnostics: boundary.gpuTiming?.diagnostics ?? [],
    });

    expect(boundary.valid).toBe(true);
    expect(boundary.gpuTiming).toMatchObject({
      pass: "main",
      startQuery: 0,
      endQuery: 1,
      writeStart: { valid: true },
      writeEnd: { valid: true },
      resolve: { valid: true },
      diagnostics: [],
    });
    expect(timing).toMatchObject({
      ready: true,
      supported: true,
      queryCount: 2,
      passes: [
        {
          pass: "main",
          startQuery: 0,
          endQuery: 1,
        },
      ],
      diagnostics: [],
    });
    expect(timing.passes[0]?.microseconds).toBeGreaterThan(0);
  });

  it("writes shadow-pass timing only when shadow passes are assembled", async () => {
    const device = new FakePassTimingDevice();
    const created = createGpuTimestampQueryResources({
      device,
      label: "unit-shadow-pass",
      queryCount: 2,
    });

    expect(created.resources).not.toBeNull();

    if (created.resources === null) {
      return;
    }

    const encoder = device.createCommandEncoder();
    const assembly = createShadowPassEncoderAssemblyReport({
      attachments: shadowAttachments(1),
      frameResources: shadowFrameResources("ready"),
      commandEncoding: shadowCommandEncoding("ready"),
      commands: [{ passKey: "shadow-pass:7:light:11", commands: commands() }],
      encoder,
      resolveDepthView: () => "shadow-depth-view",
      gpuTiming: { resources: created.resources },
    });
    const submission = createShadowPassCommandBufferSubmissionReport({
      assembly,
      encoder,
      queue: device.queue,
      submit: true,
      gpuTiming: { resources: created.resources },
    });

    await device.queue.onSubmittedWorkDone();
    const timing = createGpuPassTimingReport({
      passNames: ["shadow-pass"],
      readback: await readGpuTimestampQueryResults(created.resources),
      diagnostics: [
        ...(assembly.gpuTiming?.diagnostics ?? []),
        ...(submission.gpuTiming?.diagnostics ?? []),
      ],
    });

    expect(assembly.gpuTiming).toMatchObject({
      queryCount: 2,
      records: [
        {
          passKey: "shadow-pass:7:light:11",
          startQuery: 0,
          endQuery: 1,
          writeStart: { valid: true },
          writeEnd: { valid: true },
          diagnostics: [],
        },
      ],
      diagnostics: [],
    });
    expect(submission.gpuTiming).toMatchObject({
      queryCount: 2,
      resolve: { valid: true },
      diagnostics: [],
    });
    expect(timing.passes[0]?.pass).toBe("shadow-pass");
    expect(timing.passes[0]?.microseconds).toBeGreaterThan(0);

    const noShadowAssembly = createShadowPassEncoderAssemblyReport({
      attachments: shadowAttachments(0),
      frameResources: shadowFrameResources("ready"),
      commandEncoding: shadowCommandEncoding("not-required"),
      commands: [],
      encoder: device.createCommandEncoder(),
      gpuTiming: { resources: created.resources },
    });
    const noShadowSubmission = createShadowPassCommandBufferSubmissionReport({
      assembly: noShadowAssembly,
      gpuTiming: { resources: created.resources },
    });

    expect(noShadowAssembly.gpuTiming).toBeUndefined();
    expect(noShadowSubmission.status).toBe("not-required");
    expect(noShadowSubmission.gpuTiming).toBeUndefined();
  });

  it("reports a minimum positive duration when a valid readback is quantized to zero", () => {
    expect(
      createGpuPassTimingReport({
        passNames: ["main"],
        readback: {
          valid: true,
          timestamps: [100n, 100n],
          durations: [{ startQuery: 0, endQuery: 1, nanoseconds: 0n }],
          diagnostics: [],
        },
      }),
    ).toMatchObject({
      ready: true,
      supported: true,
      passes: [{ pass: "main", microseconds: 0.001 }],
      diagnostics: [],
    });
  });
});

function contextWithView(view: unknown) {
  return {
    getCurrentTexture: () => ({
      createView: () => view,
    }),
  };
}

function drawCommand(): RenderPassCommand {
  return {
    kind: "draw",
    renderId: 1,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}

function commands(): readonly RenderPassCommand[] {
  return [
    {
      kind: "setPipeline",
      renderId: 101,
      pipelineKey: "shadow-pipeline",
      pipeline: "pipeline",
    },
    {
      kind: "setBindGroup",
      renderId: 101,
      index: 0,
      resourceKey: "shadow-matrix-bind-group",
      bindGroup: "matrix-bind-group",
    },
    {
      kind: "setVertexBuffer",
      renderId: 101,
      slot: 0,
      resourceKey: "shadow-vertex-buffer",
      buffer: "vertex-buffer",
    },
    {
      kind: "setIndexBuffer",
      renderId: 101,
      resourceKey: "shadow-index-buffer",
      buffer: "index-buffer",
      format: "uint16",
    },
    {
      kind: "drawIndexed",
      renderId: 101,
      indexCount: 6,
      instanceCount: 1,
      firstIndex: 0,
      baseVertex: 0,
      firstInstance: 0,
    },
  ];
}

function shadowAttachments(
  passCount: number,
): ShadowPassAttachmentDescriptorReport {
  return {
    ready: passCount > 0,
    status: passCount > 0 ? "ready" : "not-required",
    passCount,
    attachmentCount: passCount,
    sections: {
      passPlans: true,
      depthTextureResources: passCount > 0,
      depthAttachments: passCount > 0,
      commandEncoder: false,
      passSubmission: false,
      shaderSampling: false,
    },
    attachments:
      passCount === 0
        ? []
        : [
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

function shadowFrameResources(
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

function shadowCommandEncoding(
  status: ShadowPassCommandEncodingReport["status"],
): ShadowPassCommandEncodingReport {
  const hasRecords = status === "ready";

  return {
    ready: status === "ready" || status === "not-required",
    status,
    counts: {
      passes: hasRecords ? 1 : 0,
      depthViews: hasRecords ? 1 : 0,
      matrixBuffers: hasRecords ? 1 : 0,
      casterLists: hasRecords ? 1 : 0,
      commandPlans: hasRecords ? 1 : 0,
      commandRecords: hasRecords ? 1 : 0,
      drawCommands: hasRecords ? 1 : 0,
    },
    sections: {
      passPlans: true,
      depthTextureResources: hasRecords,
      matrixBufferResource: hasRecords,
      casterDrawLists: hasRecords,
      commandPlans: hasRecords,
      commandEncoding: hasRecords,
      passSubmission: false,
      shaderSampling: false,
    },
    records: hasRecords
      ? [
          {
            passKey: "shadow-pass:7:light:11",
            shadowId: 7,
            lightId: 11,
            depthTextureKey: "shadow-map:7:light:11:texture",
            depthViewKey: "shadow-map:7:light:11:view",
            matrixResourceKey: "shadow-matrix-buffer",
            commandKey: "shadow-pass:7:light:11:caster-commands",
            drawCount: 1,
            commandEncoding: "ready",
          },
        ]
      : [],
    diagnostics: [],
  };
}

class FakePassTimingDevice {
  readonly features = {
    has: (feature: string) => feature === "timestamp-query",
  };
  readonly queue = {
    submit: (commandBuffers: readonly unknown[]) => {
      this.submittedCommandBuffers += commandBuffers.length;
    },
    onSubmittedWorkDone: async () => {},
  };

  submittedCommandBuffers = 0;
  private timestamp = 1_000n;

  createQuerySet(descriptor: {
    readonly label?: string;
    readonly type: "timestamp";
    readonly count: number;
  }): FakePassTimingQuerySet {
    return new FakePassTimingQuerySet(descriptor.count);
  }

  createBuffer(descriptor: unknown): FakePassTimingBuffer {
    const size =
      typeof descriptor === "object" &&
      descriptor !== null &&
      typeof (descriptor as { readonly size?: unknown }).size === "number"
        ? (descriptor as { readonly size: number }).size
        : 0;

    return new FakePassTimingBuffer(size);
  }

  createCommandEncoder(): FakePassTimingCommandEncoder {
    return new FakePassTimingCommandEncoder(this);
  }

  nextTimestamp(): bigint {
    this.timestamp += 1_000n;
    return this.timestamp;
  }
}

class FakePassTimingQuerySet {
  readonly timestamps: bigint[];

  constructor(count: number) {
    this.timestamps = Array.from({ length: count }, () => 0n);
  }
}

class FakePassTimingBuffer implements GpuTimestampBufferLike {
  readonly bytes: ArrayBuffer;

  constructor(size: number) {
    this.bytes = new ArrayBuffer(size);
  }

  async mapAsync(): Promise<void> {}

  getMappedRange(offset = 0, size = this.bytes.byteLength): ArrayBuffer {
    return this.bytes.slice(offset, offset + size);
  }

  unmap(): void {}
}

class FakePassTimingCommandEncoder {
  constructor(private readonly device: FakePassTimingDevice) {}

  writeTimestamp(querySet: unknown, queryIndex: number): void {
    (querySet as FakePassTimingQuerySet).timestamps[queryIndex] =
      this.device.nextTimestamp();
  }

  beginRenderPass(): {
    readonly setPipeline: (pipeline: unknown) => void;
    readonly setBindGroup: (index: number, bindGroup: unknown) => void;
    readonly setVertexBuffer: (slot: number, buffer: unknown) => void;
    readonly setIndexBuffer: (buffer: unknown, format: string) => void;
    readonly draw: (
      vertexCount: number,
      instanceCount: number,
      firstVertex: number,
      firstInstance: number,
    ) => void;
    readonly drawIndexed: (
      indexCount: number,
      instanceCount: number,
      firstIndex: number,
      baseVertex: number,
      firstInstance: number,
    ) => void;
    readonly end: () => void;
  } {
    return {
      setPipeline: () => {},
      setBindGroup: () => {},
      setVertexBuffer: () => {},
      setIndexBuffer: () => {},
      draw: () => {},
      drawIndexed: () => {},
      end: () => {},
    };
  }

  resolveQuerySet(
    querySet: unknown,
    firstQuery: number,
    queryCount: number,
    destination: unknown,
  ): void {
    const timestamps = (querySet as FakePassTimingQuerySet).timestamps;
    const destinationValues = new BigUint64Array(
      (destination as FakePassTimingBuffer).bytes,
    );

    for (let index = 0; index < queryCount; index += 1) {
      destinationValues[index] = timestamps[firstQuery + index] ?? 0n;
    }
  }

  copyBufferToBuffer(
    source: unknown,
    sourceOffset: number,
    destination: unknown,
    destinationOffset: number,
    size: number,
  ): void {
    const sourceBytes = new Uint8Array(
      (source as FakePassTimingBuffer).bytes,
      sourceOffset,
      size,
    );
    const destinationBytes = new Uint8Array(
      (destination as FakePassTimingBuffer).bytes,
      destinationOffset,
      size,
    );

    destinationBytes.set(sourceBytes);
  }

  finish(): { readonly commandBuffer: true } {
    return { commandBuffer: true };
  }
}
