import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

for (const fixture of [
  {
    scenario: "loading-material-asset",
    status: "loading",
    reason: "material-asset-loading",
    diagnostic: "render.material.loading",
  },
  {
    scenario: "failed-material-asset",
    status: "failed",
    reason: "material-asset-failed",
    diagnostic: "render.material.failed",
  },
] as const) {
  test(`ECS browser example reports ${fixture.status} material asset without submitting draws`, async ({
    page,
  }) => {
    await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(`${fixture.scenario}-status`, status);

    expect(status, "example status should be published").toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: false,
      phase: "extract",
      reason: fixture.reason,
      renderingBackend: "webgpu",
      extraction: { views: 1, meshDraws: 0, diagnostics: 1 },
      assetStatus: {
        material: fixture.status,
        diagnostics: [fixture.diagnostic],
      },
      resources: { materials: 0, bindGroups: 0, missing: "material" },
      binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
      renderWorld: {
        active: 0,
        ready: 0,
        blocked: 0,
        diagnostics: ["renderWorld.empty"],
      },
      draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
      command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
      submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
    });
    expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual([
      expect.objectContaining({
        code: fixture.diagnostic,
      }),
    ]);
  });
}
