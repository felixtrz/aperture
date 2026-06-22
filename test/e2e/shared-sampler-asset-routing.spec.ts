import { test } from "@playwright/test";

import {
  expectTextureAssetRouteStatus,
  type TextureAssetRouteFixture,
} from "./texture-asset-routing.js";

for (const fixture of [
  {
    scenario: "shared-sampler-missing-texture-asset",
    missing: "texture",
    diagnostics: 1,
    meshDraws: 1,
    active: 1,
    blocked: 1,
    renderWorldDiagnostics: [
      "renderWorld.missingMeshResource",
      "renderWorld.missingMaterialResource",
    ],
  },
  {
    scenario: "shared-sampler-missing-sampler-asset",
    missing: "sampler",
    diagnostics: 2,
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
