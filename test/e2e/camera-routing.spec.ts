import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

for (const fixture of [
  { scenario: "perspective-fov-camera", projection: "perspective" },
  { scenario: "orthographic-camera", projection: "orthographic" },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to camera submit status`, async ({
    page,
  }) => {
    await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(`${fixture.scenario}-camera-route`, status);

    expect(status, "example status should be published").toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: true,
      phase: "submit",
      renderingBackend: "webgpu",
      extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
      renderWorld: { active: 1, ready: 1, blocked: 0 },
      camera: { projection: fixture.projection },
      diagnosticCounts: expectedDiagnosticCounts({}),
    });
  });
}
