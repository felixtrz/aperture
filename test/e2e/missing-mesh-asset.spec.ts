import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS browser example reports missing mesh asset without submitting draws", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=missing-mesh-asset");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("missing-mesh-asset-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "missing-mesh-asset",
    ok: false,
    phase: "extract",
    reason: "missing-mesh-asset",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 0, diagnostics: 1 },
    resources: { materials: 0, bindGroups: 0, missing: "mesh" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    renderWorld: {
      active: 0,
      ready: 0,
      blocked: 0,
      diagnostics: ["renderWorld.empty"],
    },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
    diagnosticCounts: {
      extraction: 1,
      resources: 0,
      binding: 0,
      draw: 0,
      submission: 0,
      readback: 0,
    },
  });
  expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual([
    expect.objectContaining({
      code: "render.missingMeshHandle",
    }),
  ]);
});
