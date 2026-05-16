import { expect, test } from "@playwright/test";

import type {
  ClearExampleStatus,
  SingleDrawExampleStatus,
} from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("WebGPU clear example publishes ready status", async ({ page }) => {
  await page.goto("/");
  const status = await waitForExampleStatus<ClearExampleStatus>(page);

  await attachExampleStatus("webgpu-clear-status-only", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "webgpu-clear",
    ok: true,
    phase: "clear",
    renderingBackend: "webgpu",
    clearColor: { r: 0.08, g: 0.28, b: 0.64, a: 1 },
  });
});

test("ECS triangle example publishes one-draw ready status", async ({
  page,
}) => {
  await page.goto("/examples/triangle.html");
  const status = await waitForExampleStatus<SingleDrawExampleStatus>(page);

  await attachExampleStatus("ecs-triangle-status-only", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-triangle",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    binding: { planned: 1, applied: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
  });
  expect(
    status.command?.commands,
    JSON.stringify(status, null, 2),
  ).toBeGreaterThan(0);
});
