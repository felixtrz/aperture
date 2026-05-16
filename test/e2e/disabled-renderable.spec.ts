import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS browser example reports disabled renderable without submitting draws", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=disabled-renderable");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("disabled-renderable-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "disabled-renderable",
    ok: false,
    phase: "extract",
    reason: "disabled-renderable",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 0, diagnostics: 1 },
    disabled: {
      authored: 1,
      extracted: 0,
      diagnostics: ["render.disabled"],
    },
    resources: { materials: 0, bindGroups: 0, missing: "none" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 0,
      ready: 0,
      blocked: 0,
      diagnostics: ["renderWorld.empty"],
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expectNoDrawSubmissionStatus(status);
  expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual([
    expect.objectContaining({
      code: "render.disabled",
    }),
  ]);
});
