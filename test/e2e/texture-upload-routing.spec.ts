import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectNoDrawSubmissionStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
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
    await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(
      `${fixture.scenario}-texture-upload-route`,
      status,
    );

    expect(status, "example status should be published").toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);

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
      diagnosticCounts: {
        extraction: 0,
        resources: 1,
        binding: 0,
        draw: 0,
        submission: 0,
        readback: 0,
      },
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
