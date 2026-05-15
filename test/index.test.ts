import { describe, expect, it } from "vitest";

import { APERTURE_IDENTITY, APERTURE_VERSION } from "../src/index.js";

describe("Aperture public entrypoint", () => {
  it("exports the runtime identity", () => {
    expect(APERTURE_IDENTITY).toEqual({
      name: "Aperture",
      version: APERTURE_VERSION,
      renderingBackend: "webgpu",
      worldModel: "ecs-authoritative",
      renderingModel: "derived-view",
    });
  });
});
