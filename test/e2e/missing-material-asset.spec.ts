import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example reports missing material asset without submitting draws", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "missing-material-asset",
    "missing-material-asset-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "missing-material-asset",
    ok: false,
    phase: "extract",
    reason: "missing-material-asset",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 0, diagnostics: 1 },
    resources: { materials: 0, bindGroups: 0, missing: "material" },
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
      code: "render.missingMaterialHandle",
    }),
  ]);
});
