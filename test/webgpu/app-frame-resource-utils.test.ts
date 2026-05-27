import { describe, expect, it } from "vitest";

import * as webgpu from "@aperture-engine/webgpu";
import {
  sameStringList,
  writeBufferData,
} from "../../packages/webgpu/src/app/app-frame-resource-utils.js";

describe("app frame-resource utilities", () => {
  it("compares string lists by length and ordered values", () => {
    expect(sameStringList([], [])).toBe(true);
    expect(sameStringList(["mesh", "material"], ["mesh", "material"])).toBe(
      true,
    );
    expect(sameStringList(["mesh"], ["mesh", "material"])).toBe(false);
    expect(sameStringList(["material", "mesh"], ["mesh", "material"])).toBe(
      false,
    );
    expect(sameStringList(["mesh", "other"], ["mesh", "material"])).toBe(false);
  });

  it("writes buffer data through a WebGPU-like queue", () => {
    const source = new Float32Array([1, 2, 3, 4]);
    const view = source.subarray(1, 3);
    const writes: unknown[][] = [];
    const device = {
      queue: {
        writeBuffer: (...args: unknown[]) => {
          writes.push(args);
        },
      },
    };

    expect(writeBufferData(device, "dynamic-buffer", view)).toBe(true);
    expect(writes).toEqual([
      ["dynamic-buffer", 0, view.buffer, view.byteOffset, view.byteLength],
    ]);
  });

  it("reports missing queue write support without throwing", () => {
    const data = new Uint8Array([1, 2, 3, 4]);

    expect(writeBufferData({}, "dynamic-buffer", data)).toBe(false);
    expect(writeBufferData({ queue: {} }, "dynamic-buffer", data)).toBe(false);
  });

  it("keeps utility helpers off the public WebGPU package surface", () => {
    expect("sameStringList" in webgpu).toBe(false);
    expect("writeBufferData" in webgpu).toBe(false);
  });
});
