import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
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
    await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(`${fixture.scenario}-primitive-route`, status);

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
      geometry: { primitive: fixture.primitive },
      diagnosticCounts: expectedDiagnosticCounts({}),
    });
  });
}
