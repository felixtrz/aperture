import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

for (const fixture of [
  { scenario: "box-primitive", primitive: "box" },
  { scenario: "sphere-primitive", primitive: "sphere" },
  { scenario: "cylinder-primitive", primitive: "cylinder" },
  { scenario: "cone-primitive", primitive: "cone" },
  { scenario: "capsule-primitive", primitive: "capsule" },
  { scenario: "torus-primitive", primitive: "torus" },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to submit status`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      fixture.scenario,
      `${fixture.scenario}-primitive-route`,
    );

    if (status === undefined) {
      return;
    }

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: true,
      phase: "submit",
      renderingBackend: "webgpu",
      extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
      renderWorld: { active: 1, ready: 1, blocked: 0 },
      geometry: { primitive: fixture.primitive },
      diagnosticCounts: expectedDiagnosticCounts({}),
    });
  });
}
