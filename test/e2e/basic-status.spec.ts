import { expect, test } from "@playwright/test";

import type {
  ClearExampleStatus,
  SingleDrawExampleStatus,
} from "./example-status-types.js";
import {
  expectClearReadbackStatus,
  expectSceneReadbackStatus,
} from "./readback-status.js";
import { loadExampleStatus } from "./webgpu-status.js";

test("WebGPU clear example publishes ready status", async ({ page }) => {
  const status = await loadExampleStatus<ClearExampleStatus>(
    page,
    "/",
    "webgpu-clear-status-only",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "webgpu-clear",
    ok: true,
    phase: "clear",
    renderingBackend: "webgpu-explicit",
    clearColor: { r: 0.08, g: 0.28, b: 0.64, a: 1 },
  });
  expectClearReadbackStatus(status.readback, JSON.stringify(status, null, 2));
});

test("ECS triangle example publishes one-draw ready status", async ({
  page,
}) => {
  const status = await loadExampleStatus<SingleDrawExampleStatus>(
    page,
    "/examples/triangle.html",
    "ecs-triangle-status-only",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-triangle",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
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
  expectSceneReadbackStatus(
    status.readback,
    1,
    JSON.stringify(status, null, 2),
  );
});
