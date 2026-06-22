import { describe, expect, it } from "vitest";

import {
  submitCommandBuffers,
  type CommandBufferResource,
} from "@aperture-engine/webgpu/test-support";

describe("queue command buffer submission helper", () => {
  it("submits command buffers in stable input order", () => {
    const submitted: unknown[][] = [];
    const first = commandBuffer("command-buffer:first", { id: 1 });
    const second = commandBuffer("command-buffer:second", { id: 2 });
    const report = submitCommandBuffers({
      queue: {
        submit: (commandBuffers) => submitted.push([...commandBuffers]),
      },
      commandBuffers: [first, second],
    });

    expect(report).toEqual({
      valid: true,
      submitted: 2,
      skipped: 0,
      commandBufferKeys: ["command-buffer:first", "command-buffer:second"],
      diagnostics: [],
    });
    expect(submitted).toEqual([[first.commandBuffer, second.commandBuffer]]);
  });

  it("diagnoses missing submit support", () => {
    expect(
      submitCommandBuffers({
        queue: {},
        commandBuffers: [commandBuffer("command-buffer:first", {})],
      }),
    ).toMatchObject({
      valid: false,
      submitted: 0,
      skipped: 1,
      diagnostics: [{ code: "queueSubmit.missingSubmit" }],
    });
  });

  it("diagnoses empty command buffer input", () => {
    expect(
      submitCommandBuffers({
        queue: { submit: () => {} },
        commandBuffers: [],
      }),
    ).toEqual({
      valid: false,
      submitted: 0,
      skipped: 0,
      commandBufferKeys: [],
      diagnostics: [
        {
          code: "queueSubmit.emptyCommandBuffers",
          message: "Queue submission requires at least one command buffer.",
        },
      ],
    });
  });
});

function commandBuffer(
  resourceKey: string,
  commandBuffer: unknown,
): CommandBufferResource {
  return { resourceKey, commandBuffer };
}
