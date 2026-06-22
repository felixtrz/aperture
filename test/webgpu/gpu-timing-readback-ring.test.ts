import { describe, expect, it } from "vitest";

import {
  resolveGpuTimestampQueries,
  type GpuTimestampCommandEncoderLike,
} from "@aperture-engine/webgpu/test-support";
import {
  createWebGpuAppGpuTimingForTarget,
  readWebGpuAppGpuTimings,
  releaseWebGpuAppGpuTimingReadbacks,
} from "../../packages/webgpu/src/app/gpu-readback.js";
import type { WebGpuAppFrameBoundaryTarget } from "../../packages/webgpu/src/app/frame-target.js";
import type { WebGpuAppResourceCache } from "../../packages/webgpu/src/app/resource-cache.js";

// AI-11 keeps frames pipelined (no unconditional waitForSubmittedWork), so a
// frame's GPU-timing readback map can still be pending when the next frame
// submits. Submitting a copy into a mapped/pending readback buffer is a WebGPU
// validation error ("used in submit while mapped"); the app rotates readback
// buffers so consecutive in-flight frames never share one.
describe("WebGPU app GPU-timing readback rotation", () => {
  const target = { renderTargetKey: null } as WebGpuAppFrameBoundaryTarget;

  it("does not hand the next frame a readback buffer whose map is still pending", async () => {
    const device = new RingDevice();
    const app = { initialization: { device } };
    const cache = createRingCache();

    // Frame 1 leases the pass's readback buffer and submits a copy into it.
    const frameOne = await createWebGpuAppGpuTimingForTarget(
      app,
      cache,
      "ring-test",
      target,
    );

    expect(frameOne.resources).not.toBeNull();
    if (frameOne.resources === null) {
      return;
    }

    const frameOneBuffer = frameOne.resources.readbackBuffer as RingBuffer;

    expect(encodedReadbackDestination(frameOne.resources)).toBe(frameOneBuffer);

    // Frame 1's CPU read maps the buffer, but the map stays pending (no drain
    // serializes the frames any more).
    const frameOneRead = readWebGpuAppGpuTimings({
      readbacks: [
        {
          passName: frameOne.passName,
          resources: frameOne.resources,
          ...(frameOne.release === undefined
            ? {}
            : { release: frameOne.release }),
        },
      ],
      diagnostics: [],
    });

    expect(frameOneBuffer.mapState).toBe("pending");

    // Frame 2 assembles while frame 1's map is pending. Its leased readback
    // buffer — the copy destination its submit references — must be a
    // different buffer.
    const frameTwo = await createWebGpuAppGpuTimingForTarget(
      app,
      cache,
      "ring-test",
      target,
    );

    expect(frameTwo.resources).not.toBeNull();
    if (frameTwo.resources === null) {
      return;
    }

    expect(frameOneBuffer.mapState).toBe("pending");
    expect(frameTwo.resources.readbackBuffer).not.toBe(frameOneBuffer);
    expect(encodedReadbackDestination(frameTwo.resources)).not.toBe(
      frameOneBuffer,
    );
    // Both frames resolve the same query set; only the readback rotates.
    expect(frameTwo.resources.querySet).toBe(frameOne.resources.querySet);

    // Once frame 1's map resolves and its read unmaps, the buffer returns to
    // the ring and frame 3 can lease it again instead of allocating a third.
    frameOneBuffer.finishMap();
    const frameOneReport = await frameOneRead;

    expect(frameOneReport?.supported).toBe(true);
    expect(frameOneBuffer.mapState).toBe("unmapped");

    const frameThree = await createWebGpuAppGpuTimingForTarget(
      app,
      cache,
      "ring-test",
      target,
    );

    expect(frameThree.resources?.readbackBuffer).toBe(frameOneBuffer);
    expect(readbackBufferCount(device)).toBe(2);
  });

  it("skips GPU timing instead of growing past the rotation ring", async () => {
    const device = new RingDevice();
    const app = { initialization: { device } };
    const cache = createRingCache();
    const leases = [
      await createWebGpuAppGpuTimingForTarget(app, cache, "ring-test", target),
      await createWebGpuAppGpuTimingForTarget(app, cache, "ring-test", target),
      await createWebGpuAppGpuTimingForTarget(app, cache, "ring-test", target),
    ];

    expect(leases.map((lease) => lease.resources)).not.toContain(null);
    expect(
      new Set(leases.map((lease) => lease.resources?.readbackBuffer)).size,
    ).toBe(3);

    // A fourth overlapped frame finds every buffer busy: timing is skipped
    // (resources null, no diagnostics) rather than reusing a busy buffer.
    const saturated = await createWebGpuAppGpuTimingForTarget(
      app,
      cache,
      "ring-test",
      target,
    );

    expect(saturated.resources).toBeNull();
    expect(saturated.diagnostics).toEqual([]);
    expect(readbackBufferCount(device)).toBe(3);

    // Releasing any lease makes its buffer reusable again.
    leases[0]?.release?.();
    const reused = await createWebGpuAppGpuTimingForTarget(
      app,
      cache,
      "ring-test",
      target,
    );

    expect(reused.resources?.readbackBuffer).toBe(
      leases[0]?.resources?.readbackBuffer,
    );
  });

  it("lets non-reading frame routes return their leases unmapped", async () => {
    const device = new RingDevice();
    const app = { initialization: { device } };
    const cache = createRingCache();
    const lease = await createWebGpuAppGpuTimingForTarget(
      app,
      cache,
      "ring-test",
      target,
    );

    expect(lease.resources).not.toBeNull();
    if (lease.resources === null) {
      return;
    }

    releaseWebGpuAppGpuTimingReadbacks([
      {
        passName: lease.passName,
        resources: lease.resources,
        ...(lease.release === undefined ? {} : { release: lease.release }),
      },
    ]);

    const next = await createWebGpuAppGpuTimingForTarget(
      app,
      cache,
      "ring-test",
      target,
    );

    expect(next.resources?.readbackBuffer).toBe(lease.resources.readbackBuffer);
    expect(readbackBufferCount(device)).toBe(1);
  });
});

function createRingCache(): WebGpuAppResourceCache {
  return { gpuTimings: new Map() } as unknown as WebGpuAppResourceCache;
}

function encodedReadbackDestination(resources: {
  readonly readbackBuffer: unknown;
}): unknown {
  let destination: unknown = null;
  const encoder: GpuTimestampCommandEncoderLike = {
    resolveQuerySet: () => {},
    copyBufferToBuffer: (_source, _sourceOffset, copyDestination) => {
      destination = copyDestination;
    },
  };
  const resolved = resolveGpuTimestampQueries(
    encoder,
    resources as Parameters<typeof resolveGpuTimestampQueries>[1],
  );

  expect(resolved.valid).toBe(true);
  return destination;
}

function readbackBufferCount(device: RingDevice): number {
  return device.buffers.filter((buffer) => buffer.label.includes("/readback"))
    .length;
}

class RingBuffer {
  mapState: "unmapped" | "pending" | "mapped" = "unmapped";

  private readonly bytes: ArrayBuffer;
  private resolveMap: (() => void) | null = null;

  constructor(
    size: number,
    readonly label: string,
  ) {
    this.bytes = new ArrayBuffer(size);
  }

  mapAsync(): Promise<void> {
    this.mapState = "pending";
    return new Promise((resolve) => {
      this.resolveMap = () => {
        this.mapState = "mapped";
        resolve();
      };
    });
  }

  finishMap(): void {
    this.resolveMap?.();
    this.resolveMap = null;
  }

  getMappedRange(offset = 0, size = this.bytes.byteLength): ArrayBuffer {
    return this.bytes.slice(offset, offset + size);
  }

  unmap(): void {
    this.mapState = "unmapped";
  }
}

class RingDevice {
  readonly buffers: RingBuffer[] = [];
  readonly features = {
    has: (feature: string) => feature === "timestamp-query",
  };

  createQuerySet(descriptor: unknown): { readonly descriptor: unknown } {
    return { descriptor };
  }

  createBuffer(descriptor: {
    readonly label?: string;
    readonly size: number;
    readonly usage: number;
  }): RingBuffer {
    const buffer = new RingBuffer(descriptor.size, descriptor.label ?? "");

    this.buffers.push(buffer);
    return buffer;
  }

  pushErrorScope(_filter: "validation"): void {}

  async popErrorScope(): Promise<null> {
    return null;
  }
}
