import { describe, expect, it } from "vitest";
import {
  UI_IMAGE_WGSL,
  UI_PANEL_WGSL,
} from "@aperture-engine/webgpu/test-support";

describe("UI quad SDF border shader", () => {
  it("declares the rounded-rect + border instance fields and helpers", () => {
    for (const wgsl of [UI_PANEL_WGSL, UI_IMAGE_WGSL]) {
      expect(wgsl).toContain("cornerRadii: vec4f");
      expect(wgsl).toContain("borderWidths: vec4f");
      expect(wgsl).toContain("borderColor: vec4f");
      expect(wgsl).toContain("fn uiRoundBox(");
      expect(wgsl).toContain("fn uiShade(");
      expect(wgsl).toContain("fwidth(");
      // Exactly one fragment entry point (the output-stage transform relies on it).
      expect(wgsl.match(/@fragment/g)).toHaveLength(1);
    }
  });

  it("routes both fill paths through uiShade", () => {
    expect(UI_PANEL_WGSL).toContain("return uiShade(input, input.color);");
    expect(UI_IMAGE_WGSL).toContain("return uiShade(input, sampled);");
  });
});
