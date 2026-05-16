import { describe, expect, it } from "vitest";

import { finishCommandEncoder } from "@aperture-engine/webgpu";

describe("command buffer finish helper", () => {
  it("finishes command encoders into renderer-owned command buffer resources", () => {
    const commandBuffer = { label: "command-buffer" };
    const result = finishCommandEncoder({
      encoder: { finish: () => commandBuffer },
      label: "frame-1",
    });

    expect(result).toEqual({
      valid: true,
      resource: {
        resourceKey: "command-buffer:frame-1",
        commandBuffer,
      },
      diagnostics: [],
    });
  });

  it("diagnoses missing finish support", () => {
    expect(finishCommandEncoder({ encoder: {}, label: "frame-1" })).toEqual({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "commandBuffer.missingFinish",
          message: "Command encoder cannot finish command buffers.",
        },
      ],
    });
  });
});
