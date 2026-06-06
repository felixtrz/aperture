import { describe, expect, it } from "vitest";
import {
  SharedSnapshotTransportUnsupportedError,
  createSharedSnapshotTransport,
  createSharedSnapshotTransportViews,
} from "@aperture-engine/runtime";

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
      maxInstanceTints: 2,
      transformFloatsPerBuffer: 32,
      instanceTintFloatsPerBuffer: 8,
      viewMatrixFloatsPerBuffer: 48,
      quadInstanceFloatsPerBuffer: 0,
      quadInstanceWordsPerBuffer: 0,
      packetWordsPerBuffer: 0,
    });
    expect(transport.writer.transforms.buffer).toBe(transport.transformBuffer);
    expect(transport.writer.instanceTints.buffer).toBe(
      transport.instanceTintBuffer,
    );
    expect(transport.reader.transforms.buffer).toBe(transport.transformBuffer);
    expect(transport.writer.viewMatrices.buffer).toBe(
      transport.viewMatrixBuffer,
    );
    expect(transport.writer.quadInstanceFloats.buffer).toBe(
      transport.quadInstanceFloatBuffer,
    );
    expect(transport.writer.quadInstanceWords.buffer).toBe(
      transport.quadInstanceWordBuffer,
    );
    expect(transport.writer.packetWords.buffer).toBe(transport.packetBuffer);
  });

  it("publishes optional instance tint, quad, and packet-word buffers", () => {
    const transport = createSharedSnapshotTransport({
      maxEntities: 2,
      maxViews: 1,
      maxQuadInstances: 1,
      maxPacketWords: 8,
      requireCrossOriginIsolated: false,
    });
    const report = transport.writer.writeFrame({
      frame: 1,
      transforms: new Float32Array(32).fill(1),
      instanceTints: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
      viewMatrices: new Float32Array(48).fill(2),
      quadInstanceFloats: new Float32Array(24).fill(3),
      quadInstanceWords: new Uint32Array(8).fill(4),
      packetWords: new Uint32Array([0x4150_5350, 1, 1, 2, 3, 4, 5, 6]),
    });
    const read = transport.reader.readLatestFrame();

    expect(report).toMatchObject({
      frame: 1,
      transformFloats: 32,
      instanceTintFloats: 8,
      viewMatrixFloats: 48,
      quadInstanceFloats: 24,
      quadInstanceWords: 8,
      packetWords: 8,
    });
    expect(read?.instanceTints).toEqual(
      new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
    );
    expect(read?.packetWords).toEqual(
      new Uint32Array([0x4150_5350, 1, 1, 2, 3, 4, 5, 6]),
    );
    expect(read?.quadInstanceFloats).toEqual(new Float32Array(24).fill(3));
    expect(read?.quadInstanceWords).toEqual(new Uint32Array(8).fill(4));
  });

  it("reconstructs writer and reader views from transferred shared buffers", () => {
    const source = createSharedSnapshotTransport({
      maxEntities: 1,
      maxViews: 1,
      maxPacketWords: 4,
      requireCrossOriginIsolated: false,
    });
    const attached = createSharedSnapshotTransportViews({
      layout: source.layout,
      headerBuffer: source.headerBuffer,
      transformBuffer: source.transformBuffer,
      instanceTintBuffer: source.instanceTintBuffer,
      viewMatrixBuffer: source.viewMatrixBuffer,
      quadInstanceFloatBuffer: source.quadInstanceFloatBuffer,
      quadInstanceWordBuffer: source.quadInstanceWordBuffer,
      packetBuffer: source.packetBuffer,
    });

    attached.writer.writeFrame({
      frame: 3,
      transforms: new Float32Array(16).fill(3),
      viewMatrices: new Float32Array(48).fill(4),
      packetWords: new Uint32Array([1, 2, 3, 4]),
    });

    expect(source.reader.readLatestFrame()).toMatchObject({
      frame: 3,
      transforms: new Float32Array(16).fill(3),
      viewMatrices: new Float32Array(48).fill(4),
      packetWords: new Uint32Array([1, 2, 3, 4]),
    });
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
      maxQuadInstances: 1,
      maxPacketWords: 1,
      requireCrossOriginIsolated: false,
    });

    expect(() =>
      transport.writer.writeFrame({
        frame: 1,
        transforms: new Float32Array(17),
        viewMatrices: new Float32Array(48),
      }),
    ).toThrow(/capacity is 16/);
    expect(() =>
      transport.writer.writeFrame({
        frame: 1,
        transforms: new Float32Array(16),
        instanceTints: new Float32Array(8),
        viewMatrices: new Float32Array(48),
      }),
    ).toThrow(/capacity is 4/);
    expect(() =>
      transport.writer.writeFrame({
        frame: 1,
        transforms: new Float32Array(16),
        viewMatrices: new Float32Array(48),
        quadInstanceFloats: new Float32Array(25),
      }),
    ).toThrow(/capacity is 24/);
    expect(() =>
      transport.writer.writeFrame({
        frame: 1,
        transforms: new Float32Array(16),
        viewMatrices: new Float32Array(48),
        quadInstanceWords: new Uint32Array(9),
      }),
    ).toThrow(/capacity is 8/);
    expect(() =>
      transport.writer.writeFrame({
        frame: 1,
        transforms: new Float32Array(16),
        viewMatrices: new Float32Array(48),
        packetWords: new Uint32Array(2),
      }),
    ).toThrow(/capacity is 1/);
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
