import { describe, expect, it } from "vitest";

import {
  SharedSnapshotTransportUnsupportedError,
  createSharedSnapshotTransport,
} from "@aperture-engine/core";

describe("createSharedSnapshotTransport", () => {
  it("allocates double-buffered shared snapshot views", () => {
    const transport = createSharedSnapshotTransport({
      maxEntities: 2,
      maxViews: 1,
      requireCrossOriginIsolated: false,
    });

    expect(transport.mode).toBe("shared-array-buffer");
    expect(transport.layout).toMatchObject({
      buffers: 2,
      maxEntities: 2,
      maxViews: 1,
      transformFloatsPerBuffer: 32,
      viewMatrixFloatsPerBuffer: 48,
    });
    expect(transport.writer.transforms.buffer).toBe(transport.transformBuffer);
    expect(transport.reader.transforms.buffer).toBe(transport.transformBuffer);
    expect(transport.writer.viewMatrices.buffer).toBe(
      transport.viewMatrixBuffer,
    );
  });

  it("simulates an interval writer and animation-frame reader without torn data", async () => {
    const transport = createSharedSnapshotTransport({
      maxEntities: 2,
      maxViews: 1,
      requireCrossOriginIsolated: false,
    });
    let lastFrame = 0;
    let nextFrame = 1;
    let lastSequence = 0;

    await new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        try {
          if (nextFrame > 1_000) {
            clearInterval(interval);
            return;
          }

          transport.writer.writeFrame(createFrameInput(nextFrame));
          nextFrame += 1;
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, 0);

      const readAnimationFrame = () => {
        try {
          const read = transport.reader.readLatestFrame();

          if (read !== null && read.frame > lastFrame) {
            expect(read.frame).toBeGreaterThan(lastFrame);
            expect(read.sequence).toBeGreaterThan(lastSequence);
            expect(read.transforms[0]).toBe(read.frame);
            expect(read.transforms.at(-1)).toBe(read.frame);
            expect(read.viewMatrices[0]).toBe(read.frame * 2);
            expect(read.viewMatrices.at(-1)).toBe(read.frame * 2);
            lastFrame = read.frame;
            lastSequence = read.sequence;
          }

          if (lastFrame >= 1_000) {
            clearInterval(interval);
            resolve();
            return;
          }

          requestAnimationFrameShim(readAnimationFrame);
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      };

      requestAnimationFrameShim(readAnimationFrame);
    });
  });

  it("returns null while a writer has an incomplete sequence", () => {
    const transport = createSharedSnapshotTransport({
      maxEntities: 1,
      maxViews: 1,
      requireCrossOriginIsolated: false,
    });

    Atomics.store(transport.writer.header, 0, 1);

    expect(transport.reader.readLatestFrame()).toBeNull();
  });

  it("throws a typed unsupported error when SharedArrayBuffer is unavailable", () => {
    expect(() =>
      createSharedSnapshotTransport({
        maxEntities: 1,
        maxViews: 1,
        sharedArrayBufferConstructor: null,
        requireCrossOriginIsolated: false,
      }),
    ).toThrow(SharedSnapshotTransportUnsupportedError);

    try {
      createSharedSnapshotTransport({
        maxEntities: 1,
        maxViews: 1,
        sharedArrayBufferConstructor: null,
        requireCrossOriginIsolated: false,
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "shared-snapshot-transport-unsupported",
        reason: "shared-array-buffer-unavailable",
      });
    }
  });

  it("throws a typed unsupported error when cross-origin isolation is required", () => {
    try {
      createSharedSnapshotTransport({
        maxEntities: 1,
        maxViews: 1,
        requireCrossOriginIsolated: true,
        crossOriginIsolated: false,
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "shared-snapshot-transport-unsupported",
        reason: "cross-origin-isolation-required",
      });
      return;
    }

    throw new Error("Expected cross-origin isolation failure.");
  });

  it("rejects frames that exceed the allocated capacity", () => {
    const transport = createSharedSnapshotTransport({
      maxEntities: 1,
      maxViews: 1,
      requireCrossOriginIsolated: false,
    });

    expect(() =>
      transport.writer.writeFrame({
        frame: 1,
        transforms: new Float32Array(17),
        viewMatrices: new Float32Array(48),
      }),
    ).toThrow(/capacity is 16/);
  });
});

function createFrameInput(frame: number) {
  return {
    frame,
    transforms: new Float32Array(32).fill(frame),
    viewMatrices: new Float32Array(48).fill(frame * 2),
  };
}

function requestAnimationFrameShim(callback: () => void): void {
  const requestFrame = globalThis.requestAnimationFrame;

  if (typeof requestFrame === "function") {
    requestFrame(() => callback());
    return;
  }

  setTimeout(callback, 0);
}
