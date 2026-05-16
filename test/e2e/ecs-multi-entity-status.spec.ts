import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { expectSceneReadbackStatus } from "./readback-status.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS multi-entity example publishes two-draw frame status", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("ecs-multi-entity-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, bindGroups: 4 },
    binding: { planned: 2, applied: 2, ready: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    command: { drawCount: 2, indexedDrawCount: 2 },
    submission: { commandBuffers: 1, drawCalls: 2, indexedDrawCalls: 2 },
  });
  expect(
    status.command?.commands,
    JSON.stringify(status, null, 2),
  ).toBeGreaterThan(0);
  expect(status.submission?.commands, JSON.stringify(status, null, 2)).toBe(
    status.command?.commands,
  );
  expect(status.draw?.renderIds, JSON.stringify(status, null, 2)).toHaveLength(
    2,
  );
  expect(
    [...(status.command?.firstInstances ?? [])].sort(),
    JSON.stringify(status, null, 2),
  ).toEqual([0, 1]);
  expectSceneReadbackStatus(
    status.readback,
    6,
    JSON.stringify(status, null, 2),
  );
});
