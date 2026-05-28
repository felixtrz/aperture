import { describe, expect, it } from "vitest";

import { createCommandEncoderResource } from "@aperture-engine/webgpu/test-support";

describe("command encoder creation helper", () => {
  it("creates renderer-owned command encoder records through injected devices", () => {
    const encoder = { label: "encoder" };
    const result = createCommandEncoderResource({
      device: { createCommandEncoder: () => encoder },
      label: "frame-1",
    });

    expect(result).toEqual({
      valid: true,
      resource: {
        resourceKey: "command-encoder:frame-1",
        encoder,
      },
      diagnostics: [],
    });
  });

  it("diagnoses missing createCommandEncoder support", () => {
    expect(
      createCommandEncoderResource({ device: {}, label: "frame-1" }),
    ).toEqual({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "commandEncoder.missingCreateCommandEncoder",
          message: "WebGPU device cannot create command encoders.",
        },
      ],
    });
  });
});
