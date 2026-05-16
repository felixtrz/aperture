import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example reports missing renderer resource without submitting draws", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "missing-resource",
    "missing-resource-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "missing-resource",
    ok: false,
    phase: "resource-bindings",
    reason: "missing-material-resource",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 0, bindGroups: 0, missing: "material" },
    binding: {
      planned: 1,
      applied: 1,
      ready: 0,
      diagnostics: 1,
      diagnosticCodes: ["renderFrameSnapshotBinding.missingMaterialResource"],
    },
    renderWorld: {
      active: 1,
      ready: 0,
      blocked: 1,
      blockedReasons: ["missing-material-resource"],
      diagnostics: ["renderWorld.missingMaterialResource"],
    },
    diagnosticCounts: expectedDiagnosticCounts({ binding: 1, draw: 1 }),
  });
  expectNoDrawSubmissionStatus(status);
  expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "renderFrameSnapshotBinding.missingMaterialResource",
        assetKey: "unbound-material",
      }),
      expect.objectContaining({
        code: "renderWorld.missingMaterialResource",
      }),
    ]),
  );
});
