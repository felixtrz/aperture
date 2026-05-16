import { test } from "@playwright/test";

import {
  expectMultiEntityRouteFailureStatus,
  expectStatusJsonSafeForGpu,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

for (const fixture of [
  {
    scenario: "missing-texture-asset",
    reason: "texture-asset-missing",
    missing: "texture",
    diagnostic: "render.texture.missing",
    meshDraws: 0,
  },
  {
    scenario: "loading-texture-asset",
    reason: "texture-asset-loading",
    missing: "texture",
    diagnostic: "render.texture.loading",
    meshDraws: 0,
  },
  {
    scenario: "failed-texture-asset",
    reason: "texture-asset-failed",
    missing: "texture",
    diagnostic: "render.texture.failed",
    meshDraws: 0,
  },
  {
    scenario: "missing-sampler-asset",
    reason: "sampler-asset-missing",
    missing: "sampler",
    diagnostic: "render.sampler.missing",
    meshDraws: 0,
  },
  {
    scenario: "loading-sampler-asset",
    reason: "sampler-asset-loading",
    missing: "sampler",
    diagnostic: "render.sampler.loading",
    meshDraws: 0,
  },
  {
    scenario: "failed-sampler-asset",
    reason: "sampler-asset-failed",
    missing: "sampler",
    diagnostic: "render.sampler.failed",
    meshDraws: 0,
  },
  {
    scenario: "multi-textured-missing-texture-asset",
    reason: "multi-textured-missing-texture-asset",
    missing: "texture",
    diagnostic: "render.texture.missing",
    meshDraws: 1,
  },
  {
    scenario: "multi-textured-missing-sampler-asset",
    reason: "multi-textured-missing-sampler-asset",
    missing: "sampler",
    diagnostic: "render.sampler.missing",
    meshDraws: 1,
  },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to texture dependency extraction status`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      fixture.scenario,
      `${fixture.scenario}-texture-dependency-route`,
    );

    if (status === undefined) {
      return;
    }

    expectMultiEntityRouteFailureStatus(status, {
      scenario: fixture.scenario,
      phase: "extract",
      reason: fixture.reason,
      diagnosticCounts: { extraction: 1 },
      matchObject: {
        extraction: {
          views: 1,
          meshDraws: fixture.meshDraws,
          diagnostics: 1,
        },
        assetStatus: {
          diagnostics: [fixture.diagnostic],
        },
        resources: { materials: 0, bindGroups: 0, missing: fixture.missing },
      },
    });
    expectStatusJsonSafeForGpu(status);
  });
}
