import { describe, expect, it } from "vitest";

import {
  writeBufferData,
  writeBufferSubData,
} from "../../packages/webgpu/src/app/app-frame-resource-utils.js";

// AI-66 (readiness roadmap R5): the dirty-range buffer-upload primitive.

interface RecordedWrite {
  readonly buffer: unknown;
  readonly bufferOffset: number;
  readonly dataOffset: number | undefined;
  readonly size: number | undefined;
}

function recordingDevice(backing?: Uint8Array): {
  readonly device: unknown;
  readonly writes: RecordedWrite[];
} {
  const writes: RecordedWrite[] = [];
  const device = {
    queue: {
      writeBuffer: (
        buffer: unknown,
        bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) => {
        writes.push({ buffer, bufferOffset, dataOffset, size });

        if (backing !== undefined) {
          const sourceBuffer =
            data instanceof ArrayBuffer
              ? data
              : (data as ArrayBufferView).buffer;
          const source = new Uint8Array(
            sourceBuffer as ArrayBuffer,
            dataOffset ?? 0,
            size ?? 0,
          );
          backing.set(source, bufferOffset);
        }
      },
    },
  };

  return { device, writes };
}

describe("writeBufferSubData (AI-66)", () => {
  it("issues exactly one writeBuffer call with the requested range", () => {
    const { device, writes } = recordingDevice();
    const data = new Float32Array(64);
    const gpuBuffer = { label: "transforms" };

    const ok = writeBufferSubData(device, gpuBuffer, data, {
      bufferByteOffset: 128,
      dataByteOffset: 128,
      byteLength: 64,
    });

    expect(ok).toBe(true);
    expect(writes).toEqual([
      {
        buffer: gpuBuffer,
        bufferOffset: 128,
        dataOffset: 128,
        size: 64,
      },
    ]);
  });

  it("writes only the dirty bytes into a simulated GPU buffer", () => {
    const backing = new Uint8Array(64).fill(0xaa);
    const { device } = recordingDevice(backing);
    const source = new Uint8Array(64);
    for (let index = 0; index < source.length; index += 1) {
      source[index] = index;
    }

    const ok = writeBufferSubData(device, {}, source, {
      bufferByteOffset: 16,
      dataByteOffset: 16,
      byteLength: 8,
    });

    expect(ok).toBe(true);
    // Before the range: untouched.
    expect(Array.from(backing.subarray(0, 16))).toEqual(
      Array.from({ length: 16 }, () => 0xaa),
    );
    // The range matches the source slice.
    expect(Array.from(backing.subarray(16, 24))).toEqual([
      16, 17, 18, 19, 20, 21, 22, 23,
    ]);
    // After the range: untouched.
    expect(Array.from(backing.subarray(24, 32))).toEqual(
      Array.from({ length: 8 }, () => 0xaa),
    );
  });

  it("treats an empty dirty range as a successful no-op", () => {
    const { device, writes } = recordingDevice();

    const ok = writeBufferSubData(device, {}, new Float32Array(4), {
      bufferByteOffset: 0,
      byteLength: 0,
    });

    expect(ok).toBe(true);
    expect(writes).toEqual([]);
  });

  it("rejects out-of-range and invalid windows instead of clamping", () => {
    const { device, writes } = recordingDevice();
    const data = new Float32Array(4); // 16 bytes

    expect(
      writeBufferSubData(device, {}, data, {
        bufferByteOffset: 0,
        dataByteOffset: 8,
        byteLength: 16,
      }),
    ).toBe(false);
    expect(
      writeBufferSubData(device, {}, data, {
        bufferByteOffset: -4,
        byteLength: 8,
      }),
    ).toBe(false);
    expect(
      writeBufferSubData(device, {}, data, {
        bufferByteOffset: 0,
        byteLength: 8.5,
      }),
    ).toBe(false);
    expect(writes).toEqual([]);
  });

  it("honors the source view's own byte offset", () => {
    const { device, writes } = recordingDevice();
    const backing = new ArrayBuffer(64);
    const view = new Float32Array(backing, 32, 8); // byteOffset 32

    const ok = writeBufferSubData(device, {}, view, {
      bufferByteOffset: 0,
      dataByteOffset: 4,
      byteLength: 8,
    });

    expect(ok).toBe(true);
    expect(writes[0]).toMatchObject({ dataOffset: 36, size: 8 });
  });

  it("keeps the full-buffer write path byte-identical (regression)", () => {
    const { device, writes } = recordingDevice();
    const backing = new ArrayBuffer(32);
    const view = new Float32Array(backing, 8, 4);

    const ok = writeBufferData(device, { label: "full" }, view);

    expect(ok).toBe(true);
    expect(writes).toEqual([
      {
        buffer: { label: "full" },
        bufferOffset: 0,
        dataOffset: 8,
        size: 16,
      },
    ]);
  });

  it("reports failure when the device has no writeBuffer queue", () => {
    expect(
      writeBufferSubData({}, {}, new Float32Array(4), {
        bufferByteOffset: 0,
        byteLength: 4,
      }),
    ).toBe(false);
  });
});
