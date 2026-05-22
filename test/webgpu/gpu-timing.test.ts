import { describe, expect, it } from "vitest";

import {
  createGpuTimestampQueryResources,
  createGpuTimestampQueryResourcesChecked,
  readGpuTimestampQueryResults,
  resolveGpuTimestampQueries,
  writeGpuTimestampQuery,
  type GpuTimestampBufferLike,
  type GpuTimestampCommandEncoderLike,
} from "@aperture-engine/webgpu";

describe("GPU timestamp query infrastructure", () => {
  it("creates timestamp query resources when the feature is available", () => {
    const device = new FakeTimestampDevice();
    const created = createGpuTimestampQueryResources({
      device,
      label: "unit-gpu-timing",
      queryCount: 4,
    });

    expect(created).toMatchObject({
      supported: true,
      diagnostics: [],
      resources: {
        label: "unit-gpu-timing",
        queryCount: 4,
        byteLength: 32,
      },
    });
    expect(device.querySetDescriptors).toEqual([
      { label: "unit-gpu-timing/queries", type: "timestamp", count: 4 },
    ]);
    expect(device.bufferDescriptors).toMatchObject([
      {
        label: "unit-gpu-timing/resolve",
        size: 32,
      },
      {
        label: "unit-gpu-timing/readback",
        size: 32,
      },
    ]);
  });

  it("writes, resolves, and reads distinct positive timestamps around a no-op compute dispatch", async () => {
    const device = new FakeTimestampDevice();
    const created = createGpuTimestampQueryResources({
      device,
      label: "unit-gpu-timing",
      queryCount: 2,
    });

    expect(created.supported).toBe(true);
    expect(created.resources).not.toBeNull();

    if (created.resources === null) {
      return;
    }

    const encoder = device.createCommandEncoder();

    expect(writeGpuTimestampQuery(encoder, created.resources, 0)).toEqual({
      valid: true,
      diagnostics: [],
    });
    const pass = encoder.beginComputePass({ label: "noop-compute" });
    pass.dispatchWorkgroups(1);
    pass.end();
    expect(writeGpuTimestampQuery(encoder, created.resources, 1)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(resolveGpuTimestampQueries(encoder, created.resources)).toEqual({
      valid: true,
      diagnostics: [],
    });

    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    const readback = await readGpuTimestampQueryResults(created.resources);

    expect(readback.valid).toBe(true);
    expect(readback.diagnostics).toEqual([]);
    expect(readback.timestamps).toHaveLength(2);
    expect(readback.timestamps[0]).toBeGreaterThan(0n);
    expect(readback.timestamps[1]).toBeGreaterThan(
      readback.timestamps[0] ?? 0n,
    );
    expect(readback.durations).toEqual([
      {
        startQuery: 0,
        endQuery: 1,
        nanoseconds:
          (readback.timestamps[1] ?? 0n) - (readback.timestamps[0] ?? 0n),
      },
    ]);
  });

  it("falls back gracefully when timestamp-query is unavailable", () => {
    const device = new FakeTimestampDevice({ timestampFeature: false });
    const created = createGpuTimestampQueryResources({ device });

    expect(created).toEqual({
      supported: false,
      resources: null,
      diagnostics: [
        {
          code: "gpuTiming.timestampQueryUnavailable",
          severity: "warning",
          message:
            "WebGPU timestamp queries require the 'timestamp-query' device feature.",
        },
      ],
    });
    expect(device.querySetDescriptors).toEqual([]);
    expect(device.bufferDescriptors).toEqual([]);
  });

  it("uses validation error scopes to reject invalid timestamp resources", async () => {
    const device = new FakeTimestampDevice({
      validationError: "Cannot allocate sample buffer",
    });
    const created = await createGpuTimestampQueryResourcesChecked({
      device,
      label: "unit-gpu-timing",
      queryCount: 2,
    });

    expect(created).toEqual({
      supported: false,
      resources: null,
      diagnostics: [
        {
          code: "gpuTiming.resourceCreationFailed",
          severity: "warning",
          message:
            "GPU timestamp query resource creation failed validation: Cannot allocate sample buffer",
        },
      ],
    });
    expect(device.errorScopes).toEqual(["validation"]);
    expect(device.querySetDescriptors).toEqual([
      { label: "unit-gpu-timing/queries", type: "timestamp", count: 2 },
    ]);
  });
});

interface FakeTimestampDeviceOptions {
  readonly timestampFeature?: boolean;
  readonly validationError?: string | null;
}

class FakeTimestampDevice {
  readonly querySetDescriptors: unknown[] = [];
  readonly bufferDescriptors: unknown[] = [];
  readonly errorScopes: string[] = [];
  readonly features = {
    has: (feature: string) =>
      feature === "timestamp-query" && this.timestampFeature,
  };
  readonly queue = {
    submit: (commandBuffers: readonly unknown[]) => {
      this.submittedCommandBuffers += commandBuffers.length;
    },
    onSubmittedWorkDone: async () => {},
  };

  submittedCommandBuffers = 0;
  private timestamp = 1_000n;
  private readonly timestampFeature: boolean;
  private readonly validationError: string | null;

  constructor(options: FakeTimestampDeviceOptions = {}) {
    this.timestampFeature = options.timestampFeature ?? true;
    this.validationError = options.validationError ?? null;
  }

  pushErrorScope(filter: "validation"): void {
    this.errorScopes.push(filter);
  }

  async popErrorScope(): Promise<{ readonly message?: string } | null> {
    return this.validationError === null
      ? null
      : { message: this.validationError };
  }

  createQuerySet(descriptor: {
    readonly label?: string;
    readonly type: "timestamp";
    readonly count: number;
  }): FakeTimestampQuerySet {
    this.querySetDescriptors.push(descriptor);
    return new FakeTimestampQuerySet(descriptor.count);
  }

  createBuffer(descriptor: {
    readonly label?: string;
    readonly size: number;
    readonly usage: number;
  }): FakeTimestampBuffer {
    this.bufferDescriptors.push(descriptor);
    return new FakeTimestampBuffer(descriptor.size);
  }

  createCommandEncoder(): FakeTimestampCommandEncoder {
    return new FakeTimestampCommandEncoder(this);
  }

  nextTimestamp(): bigint {
    this.timestamp += 1_000n;
    return this.timestamp;
  }
}

class FakeTimestampQuerySet {
  readonly timestamps: bigint[];

  constructor(count: number) {
    this.timestamps = Array.from({ length: count }, () => 0n);
  }
}

class FakeTimestampBuffer implements GpuTimestampBufferLike {
  readonly bytes: ArrayBuffer;
  mapped = false;

  constructor(size: number) {
    this.bytes = new ArrayBuffer(size);
  }

  async mapAsync(): Promise<void> {
    this.mapped = true;
  }

  getMappedRange(offset = 0, size = this.bytes.byteLength): ArrayBuffer {
    return this.bytes.slice(offset, offset + size);
  }

  unmap(): void {
    this.mapped = false;
  }
}

class FakeTimestampCommandEncoder implements GpuTimestampCommandEncoderLike {
  constructor(private readonly device: FakeTimestampDevice) {}

  writeTimestamp(querySet: unknown, queryIndex: number): void {
    (querySet as FakeTimestampQuerySet).timestamps[queryIndex] =
      this.device.nextTimestamp();
  }

  beginComputePass(_descriptor?: unknown): {
    readonly dispatchWorkgroups: (x: number) => void;
    readonly end: () => void;
  } {
    return {
      dispatchWorkgroups: () => {
        this.device.nextTimestamp();
      },
      end: () => {},
    };
  }

  resolveQuerySet(
    querySet: unknown,
    firstQuery: number,
    queryCount: number,
    destination: unknown,
  ): void {
    const timestamps = (querySet as FakeTimestampQuerySet).timestamps;
    const destinationValues = new BigUint64Array(
      (destination as FakeTimestampBuffer).bytes,
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
      (source as FakeTimestampBuffer).bytes,
      sourceOffset,
      size,
    );
    const destinationBytes = new Uint8Array(
      (destination as FakeTimestampBuffer).bytes,
      destinationOffset,
      size,
    );

    destinationBytes.set(sourceBytes);
  }

  finish(): unknown {
    return { label: "fake-gpu-timing-command-buffer" };
  }
}
