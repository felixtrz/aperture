import { describe, expect, it } from "vitest";

import {
  clearWebGpuCanvas,
  type WebGpuClearContextLike,
  type WebGpuClearDeviceLike,
} from "@aperture-engine/webgpu";

describe("WebGPU clear pass scaffolding", () => {
  it("encodes and submits a clear pass through injected objects", () => {
    const events: string[] = [];
    const commandBuffer = { label: "command-buffer" };
    const device: WebGpuClearDeviceLike = {
      queue: {
        submit: (commandBuffers) => {
          events.push(`submit:${commandBuffers.length}`);
        },
      },
      createCommandEncoder: () => {
        events.push("createCommandEncoder");
        return {
          beginRenderPass: () => {
            events.push("beginRenderPass");
            return {
              end: () => events.push("endPass"),
            };
          },
          finish: () => {
            events.push("finish");
            return commandBuffer;
          },
        };
      },
    };
    const context = fakeContext({
      createView: () => {
        events.push("createView");
        return { label: "view" };
      },
    });

    expect(clearWebGpuCanvas({ device, context })).toEqual({
      ok: true,
      commandBuffer,
    });
    expect(events).toEqual([
      "createView",
      "createCommandEncoder",
      "beginRenderPass",
      "endPass",
      "finish",
      "submit:1",
    ]);
  });

  it("reports missing queue, current texture, and texture view failures", () => {
    const deviceWithoutQueue: WebGpuClearDeviceLike = {
      createCommandEncoder: () => {
        throw new Error("not reached");
      },
    };
    const validDevice = fakeDevice();

    expect(
      clearWebGpuCanvas({
        device: deviceWithoutQueue,
        context: fakeContext({ createView: () => ({}) }),
      }),
    ).toMatchObject({ ok: false, reason: "queue-unavailable" });
    expect(
      clearWebGpuCanvas({
        device: validDevice,
        context: fakeContext(null),
      }),
    ).toMatchObject({ ok: false, reason: "current-texture-unavailable" });
    expect(
      clearWebGpuCanvas({
        device: validDevice,
        context: fakeContext({}),
      }),
    ).toMatchObject({ ok: false, reason: "texture-view-unavailable" });
  });

  it("reports missing command encoder support", () => {
    expect(
      clearWebGpuCanvas({
        device: { queue: { submit: () => {} } },
        context: fakeContext({ createView: () => ({}) }),
      }),
    ).toMatchObject({ ok: false, reason: "encoder-unavailable" });
  });
});

function fakeDevice(): WebGpuClearDeviceLike {
  return {
    queue: { submit: () => {} },
    createCommandEncoder: () => ({
      beginRenderPass: () => ({ end: () => {} }),
      finish: () => ({}),
    }),
  };
}

function fakeContext(
  texture: { createView?: () => unknown } | null,
): WebGpuClearContextLike {
  return {
    configure: () => {},
    getCurrentTexture: () => texture,
  };
}
