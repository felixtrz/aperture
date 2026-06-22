import { expect, test } from "@playwright/test";

import {
  expectMultiEntityRouteFailureStatus,
  expectStatusJsonSafeForGpu,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

for (const fixture of [
  {
    scenario: "invalid-texture-upload",
    diagnosticCode: "textureResource.invalidBytesPerRow",
  },
  {
    scenario: "short-texture-upload",
    diagnosticCode: "textureResource.uploadDataTooSmall",
  },
  {
    scenario: "invalid-texture-rows-per-image",
    diagnosticCode: "textureResource.invalidRowsPerImage",
  },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to resource status`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      fixture.scenario,
      `${fixture.scenario}-texture-upload-route`,
    );

    if (status === undefined) {
      return;
    }

    expectMultiEntityRouteFailureStatus(status, {
      scenario: fixture.scenario,
      phase: "resources",
      reason: "texture-resources-unavailable",
      expectRenderingBackend: false,
      diagnosticCounts: { resources: 1 },
      matchObject: {
        extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
        texture: {
          materialKey: "material:textured-unlit",
          textureKey: "texture:checker-albedo",
          samplerKey: "sampler:nearest-clamp",
        },
      },
    });
    expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual([
      expect.objectContaining({ code: fixture.diagnosticCode }),
    ]);
    expect(status.submission).toBeUndefined();
    expect(status.command).toBeUndefined();
    expectStatusJsonSafeForGpu(status);
  });
}
