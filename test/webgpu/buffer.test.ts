import { describe, expect, it } from "vitest";

import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu";

describe("WebGPU buffer creation boundary", () => {
  it("creates buffers through an injected device", () => {
    const created: unknown[] = [];
    const buffer = { label: "buffer" };
    const device: WebGpuBufferDeviceLike = {
      createBuffer: (descriptor) => {
        created.push(descriptor);
        return buffer;
      },
    };

    expect(
      createWebGpuBuffer({
        device,
        descriptor: {
          label: "vertices",
          size: 64,
          usage: 1,
          mappedAtCreation: true,
        },
      }),
    ).toEqual({ ok: true, buffer });
    expect(created).toEqual([
      {
        label: "vertices",
        size: 64,
        usage: 1,
        mappedAtCreation: true,
      },
    ]);
  });

  it("uploads initial data after creating the buffer", () => {
    const events: string[] = [];
    const buffer = { label: "buffer" };
    const data = new Uint8Array([1, 2, 3, 4]);
    const device: WebGpuBufferDeviceLike = {
      queue: {
        writeBuffer: (target, offset, source, dataOffset, size) => {
          events.push(
            `write:${target === buffer}:${offset}:${source.byteLength}:${dataOffset}:${size}`,
          );
        },
      },
      createBuffer: () => {
        events.push("create");
        return buffer;
      },
    };

    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 8, usage: 2, initialData: data },
      }),
    ).toEqual({ ok: true, buffer });
    expect(events).toEqual(["create", "write:true:0:4:0:4"]);
  });

  it("uploads typed array views from the start of the provided view", () => {
    const writes: unknown[] = [];
    const source = new Uint8Array([0, 0, 1, 2, 3, 4]).subarray(2);
    const buffer = { label: "buffer" };
    const device: WebGpuBufferDeviceLike = {
      queue: {
        writeBuffer: (target, bufferOffset, data, dataOffset, size) => {
          writes.push({ target, bufferOffset, data, dataOffset, size });
        },
      },
      createBuffer: () => buffer,
    };

    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 4, usage: 2, initialData: source },
      }),
    ).toEqual({ ok: true, buffer });
    expect(writes).toMatchObject([
      {
        target: buffer,
        bufferOffset: 0,
        data: source.buffer,
        dataOffset: 2,
        size: 4,
      },
    ]);
  });

  it("pads unaligned initial data uploads to WebGPU write alignment", () => {
    const descriptors: unknown[] = [];
    const writes: {
      readonly data: ArrayBufferLike | ArrayBufferView;
      readonly dataOffset: number | undefined;
      readonly size: number | undefined;
    }[] = [];
    const source = new Uint16Array([0, 1, 2]);
    const buffer = { label: "index-buffer" };
    const device: WebGpuBufferDeviceLike = {
      queue: {
        writeBuffer: (_target, _bufferOffset, data, dataOffset, size) => {
          writes.push({ data, dataOffset, size });
        },
      },
      createBuffer: (descriptor) => {
        descriptors.push(descriptor);
        return buffer;
      },
    };

    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 6, usage: 2, initialData: source },
      }),
    ).toEqual({ ok: true, buffer });
    expect(descriptors).toMatchObject([{ size: 8 }]);
    expect(writes).toMatchObject([{ dataOffset: 0, size: 8 }]);
    expect(new Uint8Array(writes[0]?.data as ArrayBuffer).slice(0, 6)).toEqual(
      new Uint8Array(source.buffer),
    );
  });

  it("reports invalid sizes and empty initial data", () => {
    const device = fakeDevice();

    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 0, usage: 1 },
      }),
    ).toMatchObject({ ok: false, reason: "invalid-size" });
    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 4, usage: 1, initialData: new Uint8Array(0) },
      }),
    ).toMatchObject({ ok: false, reason: "empty-initial-data" });
    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 2, usage: 1, initialData: new Uint8Array(4) },
      }),
    ).toMatchObject({ ok: false, reason: "invalid-size" });
  });

  it("reports missing buffer creation and upload support", () => {
    expect(
      createWebGpuBuffer({
        device: {},
        descriptor: { size: 4, usage: 1 },
      }),
    ).toMatchObject({ ok: false, reason: "create-buffer-unavailable" });
    expect(
      createWebGpuBuffer({
        device: { createBuffer: () => ({}) },
        descriptor: { size: 4, usage: 1, initialData: new Uint8Array(4) },
      }),
    ).toMatchObject({ ok: false, reason: "queue-write-buffer-unavailable" });
  });
});

function fakeDevice(): WebGpuBufferDeviceLike {
  return {
    queue: { writeBuffer: () => {} },
    createBuffer: () => ({}),
  };
}
