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

  it("rejects a secondary pointer binding as not-yet-delivered", () => {
    expect(() =>
      validateApertureConfig(configWithPointer("secondary")),
    ).toThrowError(/'secondary' is not delivered yet/);
  });

  it("rejects a middle pointer binding as not-yet-delivered", () => {
    expect(() =>
      validateApertureConfig(configWithPointer("middle")),
    ).toThrowError(/'middle' is not delivered yet/);
  });

  it("surfaces the rejection through the invalid-input-binding config error code", () => {
    try {
      validateApertureConfig(configWithPointer("secondary"));
      expect.unreachable("secondary pointer binding should have thrown");
    } catch (error) {
      expect((error as { code?: string }).code).toBe(
        "aperture.config.invalidInputBinding",
      );
    }
  });
});
