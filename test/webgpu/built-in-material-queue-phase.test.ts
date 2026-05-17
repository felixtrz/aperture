import { describe, expect, it } from "vitest";

import { createUnsupportedBuiltInMaterialQueuePhaseDiagnostic } from "@aperture-engine/webgpu";

describe("built-in material queue phase diagnostics", () => {
  it("allows opaque draws for built-in material families", () => {
    expect(diagnostic("unlit", "opaque")).toBeNull();
    expect(diagnostic("matcap", "opaque")).toBeNull();
    expect(diagnostic("standard", "opaque")).toBeNull();
  });

  it("allows StandardMaterial alpha-test and alpha-blend transparent draws", () => {
    expect(diagnostic("standard", "alpha-test")).toBeNull();
    expect(
      diagnostic("standard", "transparent", "standard|blend|back|less|alpha"),
    ).toBeNull();
  });

  it("diagnoses unsupported alpha-test and transparent families", () => {
    expect(diagnostic("unlit", "alpha-test")).toMatchObject({
      code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
      renderId: 7,
      drawIndex: 3,
      renderPhase: "alpha-test",
      materialFamily: "unlit",
      entity: { index: 7, generation: 1 },
    });
    expect(diagnostic("matcap", "transparent")).toMatchObject({
      code: "webGpuApp.unsupportedMaterialQueueTransparentFamily",
      renderPhase: "transparent",
      materialFamily: "matcap",
    });
  });

  it("diagnoses unsupported StandardMaterial transparent blend presets", () => {
    expect(
      diagnostic(
        "standard",
        "transparent",
        "standard|blend|back|less|additive",
      ),
    ).toMatchObject({
      code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
      renderPhase: "transparent",
      materialFamily: "standard",
      blendPreset: "additive",
    });
  });

  it("diagnoses unknown render phases", () => {
    expect(diagnostic("standard", "depth-prepass")).toMatchObject({
      code: "webGpuApp.unsupportedMaterialQueuePhase",
      renderPhase: "depth-prepass",
      materialFamily: "standard",
    });
  });
});

function diagnostic(
  materialFamily: string,
  renderPhase: string,
  pipelineKey = `${materialFamily}|opaque|back|less|none`,
) {
  return createUnsupportedBuiltInMaterialQueuePhaseDiagnostic({
    renderId: 7,
    drawIndex: 3,
    materialFamily,
    renderPhase,
    pipelineKey,
    entity: { index: 7, generation: 1 },
  });
}
