import { describe, expect, it, vi } from "vitest";
import { createWebGpuFrameOutput } from "../../packages/webgpu/src/gpu/output-target.js";
import { createWebGpuResourceScope } from "../../packages/webgpu/src/gpu/resource-scope.js";

describe("renderer device/output ownership", () => {
  it("acquires one output per frame and reacquires after release/resize", () => {
    let width = 64;
    const acquire = vi.fn(() => ({
      createView() {
        return {};
      },
    }));
    const frame = createWebGpuFrameOutput({
      get width() {
        return width;
      },
      height: 32,
      format: "rgba8unorm",
      colorSpace: "srgb",
      alphaMode: "opaque",
      sampleCount: 1,
      acquire,
    });
    expect(frame.output.acquire()).toBe(frame.output.acquire());
    expect(acquire).toHaveBeenCalledTimes(1);
    frame.release();
    width = 127;
    expect(frame.output.width).toBe(127);
    frame.output.acquire();
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it("keeps native method receivers and releases only allocated resources", () => {
    const buffer = { destroy: vi.fn() };
    const external = { destroy: vi.fn() };
    const device = {
      destroy: vi.fn(),
      createBuffer() {
        expect(this).toBe(device);
        return buffer;
      },
      get features() {
        expect(this).toBe(device);
        return new Set(["timestamp-query"]);
      },
    };
    const scope = createWebGpuResourceScope(device);
    expect(scope.device.createBuffer()).toBe(buffer);
    expect(scope.device.features.has("timestamp-query")).toBe(true);
    expect(() => scope.device.destroy()).toThrow("borrowed device");
    scope.dispose();
    scope.dispose();
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
    expect(device.destroy).not.toHaveBeenCalled();
    expect(external.destroy).not.toHaveBeenCalled();
    expect(() => scope.device.createBuffer()).toThrow("disposed");
  });

  it("continues releasing other allocations when one cleanup fails", () => {
    const released = vi.fn();
    const scope = createWebGpuResourceScope({
      createBuffer: () => ({
        destroy() {
          throw new Error("broken buffer");
        },
      }),
      createTexture: () => ({ destroy: released }),
    });
    const buffer = scope.device.createBuffer();
    const texture = scope.device.createTexture();
    expect(() => scope.dispose()).toThrow(AggregateError);
    expect(released).toHaveBeenCalledTimes(1);
    expect(buffer).toBeDefined();
    expect(texture).toBeDefined();
  });
});
