import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS browser example reports unknown query scenarios without submitting draws", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=not-a-scenario");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("unknown-scenario-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

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
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
    diagnosticCounts: {
      extraction: 0,
      resources: 0,
      binding: 0,
      draw: 0,
      submission: 0,
      readback: 0,
    },
    diagnostics: [],
  });
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
