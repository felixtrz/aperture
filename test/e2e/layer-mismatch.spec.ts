import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example reports layer mismatch without submitting draws", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "layer-mismatch",
    "layer-mismatch-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "layer-mismatch",
    ok: false,
    phase: "extract",
    reason: "layer-mismatch",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 0, diagnostics: 1 },
    layerFiltering: {
      cameraLayerMask: 1,
      renderableLayerMask: 2,
      diagnostics: ["render.layerMismatch"],
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
      code: "render.layerMismatch",
    }),
  ]);
});
