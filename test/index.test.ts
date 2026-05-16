import { describe, expect, it } from "vitest";

import * as core from "@aperture-engine/core";
import { APERTURE_IDENTITY, APERTURE_VERSION } from "@aperture-engine/core";

describe("Aperture public entrypoint", () => {
  it("exports the runtime identity", () => {
    expect(APERTURE_IDENTITY).toEqual({
      name: "Aperture",
      version: APERTURE_VERSION,
      renderingBackend: "webgpu-explicit",
      worldModel: "ecs-authoritative",
      renderingModel: "derived-view",
    });
  });

  it("keeps the core package headless-safe", () => {
    expect("clearWebGpuCanvas" in core).toBe(false);
    expect("createExtractionApp" in core).toBe(true);
  });
});
