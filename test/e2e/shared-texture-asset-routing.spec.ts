import { test } from "@playwright/test";

import {
  expectTextureAssetRouteStatus,
  type TextureAssetRouteFixture,
} from "./texture-asset-routing.js";

for (const fixture of [
  {
    scenario: "shared-texture-missing-texture-asset",
    missing: "texture",
    diagnostics: 2,
    meshDraws: 0,
    active: 0,
    blocked: 0,
    renderWorldDiagnostics: ["renderWorld.empty"],
  },
  {
    scenario: "shared-texture-missing-sampler-asset",
    missing: "sampler",
    diagnostics: 2,
    meshDraws: 0,
    active: 0,
    blocked: 0,
    renderWorldDiagnostics: ["renderWorld.empty"],
  },
  {
    scenario: "shared-texture-missing-texture-sampler-assets",
    missing: "texture/sampler",
    diagnostics: 4,
    meshDraws: 0,
    active: 0,
    blocked: 0,
    renderWorldDiagnostics: ["renderWorld.empty"],
  },
] satisfies readonly TextureAssetRouteFixture[]) {
  test(`ECS browser example routes ${fixture.scenario} to extraction status`, async ({
    page,
  }) => {
    await expectTextureAssetRouteStatus(page, fixture);
  });
}
