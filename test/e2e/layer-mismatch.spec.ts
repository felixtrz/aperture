import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS browser example reports layer mismatch without submitting draws", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=layer-mismatch");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("layer-mismatch-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "layer-mismatch",
    ok: false,
    phase: "extract",
    reason: "layer-mismatch",
    renderingBackend: "webgpu",
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
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: { commands: 0, drawCount: 0, indexedDrawCount: 0 },
    submission: { commandBuffers: 0, commands: 0, drawCalls: 0 },
  });
  expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual([
    expect.objectContaining({
      code: "render.layerMismatch",
    }),
  ]);
});
