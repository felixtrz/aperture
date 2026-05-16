import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example reports missing renderer mesh resource without submitting draws", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "missing-mesh-resource",
    "missing-mesh-resource-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "missing-mesh-resource",
    ok: false,
    phase: "resource-bindings",
    reason: "missing-mesh-resource",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 0, bindGroups: 0, missing: "mesh" },
    binding: {
      planned: 1,
      applied: 1,
      ready: 0,
      diagnostics: 1,
      diagnosticCodes: ["renderFrameSnapshotBinding.missingMeshResource"],
    },
    renderWorld: {
      active: 1,
      ready: 0,
      blocked: 1,
      blockedReasons: ["missing-mesh-resource"],
      diagnostics: ["renderWorld.missingMeshResource"],
    },
    diagnosticCounts: expectedDiagnosticCounts({ binding: 1, draw: 1 }),
  });
  expectNoDrawSubmissionStatus(status);
  expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "renderFrameSnapshotBinding.missingMeshResource",
        assetKey: "missing-resource-plane",
      }),
      expect.objectContaining({
        code: "renderWorld.missingMeshResource",
      }),
    ]),
  );
});
