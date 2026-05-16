import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
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

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: false,
      phase: "resources",
      reason: "texture-resources-unavailable",
      extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
      texture: {
        materialKey: "material:textured-unlit",
        textureKey: "texture:checker-albedo",
        samplerKey: "sampler:nearest-clamp",
      },
      diagnosticCounts: expectedDiagnosticCounts({ resources: 1 }),
    });
    expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual([
      expect.objectContaining({ code: fixture.diagnosticCode }),
    ]);
    expectNoDrawSubmissionStatus(status);
    expect(status.submission).toBeUndefined();
    expect(status.command).toBeUndefined();
    expectStatusJsonSafeForGpu(status);
  });
}
