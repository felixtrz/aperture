import { describe, expect, it } from "vitest";

import { input, validateApertureConfig } from "@aperture-engine/app/config";

function configWithPointer(pointer: "primary" | "secondary" | "middle") {
  return {
    mode: "headless",
    input: { actions: { fire: [input.pointer(pointer)] } },
  } as const;
}

describe("input pointer-binding validation", () => {
  it("accepts a primary pointer binding", () => {
    expect(() =>
      validateApertureConfig(configWithPointer("primary")),
    ).not.toThrow();
  });

  it("accepts a secondary pointer binding", () => {
    expect(() =>
      validateApertureConfig(configWithPointer("secondary")),
    ).not.toThrow();
  });

  it("accepts a middle pointer binding", () => {
    expect(() =>
      validateApertureConfig(configWithPointer("middle")),
    ).not.toThrow();
  });

  it("still rejects unsupported pointer bindings with the invalid-input-binding config error code", () => {
    try {
      validateApertureConfig(configWithPointer("tertiary" as "primary"));
      expect.unreachable("unsupported pointer binding should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe(
        "aperture.config.invalidInputBinding",
      );
    }
  });
});
