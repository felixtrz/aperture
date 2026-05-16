import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example reports unknown query scenarios without submitting draws", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "not-a-scenario",
    "unknown-scenario-status",
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
    resources: { materials: 0, bindGroups: 0, missing: "none" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    diagnosticCounts: expectedDiagnosticCounts({}),
    diagnostics: [],
  });
  expectNoDrawSubmissionStatus(status);
  expect(status.availableScenarios, JSON.stringify(status, null, 2)).toEqual(
    expect.arrayContaining([
      "default",
      "box-primitive",
      "orthographic-camera",
      "render-order-overlap",
      "missing-resource",
      "textured-unlit",
      "sampler-filter-address",
      "multi-textured-unlit",
      "multi-textured-missing-texture-asset",
      "multi-textured-missing-sampler-asset",
      "shared-sampler-missing-texture-asset",
      "shared-sampler-missing-sampler-asset",
      "shared-texture-missing-texture-asset",
      "shared-texture-missing-sampler-asset",
      "shared-texture-missing-texture-sampler-assets",
      "shared-texture-missing-texture-resource",
      "shared-texture-missing-sampler-resource",
      "shared-sampler-missing-texture-resource",
      "shared-sampler-missing-sampler-resource",
      "shared-sampler-missing-texture-sampler-resources",
      "multi-textured-missing-texture-sampler-resources",
      "invalid-texture-upload",
    ]),
  );
});
