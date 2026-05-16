import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

for (const fixture of [
  { scenario: "perspective-fov-camera", projection: "perspective" },
  { scenario: "orthographic-camera", projection: "orthographic" },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to camera submit status`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      fixture.scenario,
      `${fixture.scenario}-camera-route`,
    );

    if (status === undefined) {
      return;
    }

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: true,
      phase: "submit",
      renderingBackend: "webgpu-explicit",
      extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
      renderWorld: { active: 1, ready: 1, blocked: 0 },
      camera: { projection: fixture.projection },
      diagnosticCounts: expectedDiagnosticCounts({}),
    });
  });
}
