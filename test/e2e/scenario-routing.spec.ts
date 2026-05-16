import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example routes unknown scenarios to scenario failure status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "not-a-scenario",
    "not-a-scenario-route",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "not-a-scenario",
    ok: false,
    phase: "scenario",
    reason: "unknown-scenario",
    renderingBackend: "webgpu",
    extraction: { views: 0, meshDraws: 0, diagnostics: 0 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
  expectNoDrawSubmissionStatus(status);
});
