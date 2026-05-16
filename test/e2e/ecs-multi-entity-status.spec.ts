import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { expectSceneReadbackStatus } from "./readback-status.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("ECS multi-entity example publishes three-draw frame status", async ({
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
    extraction: { views: 1, meshDraws: 3, diagnostics: 1 },
    resources: { materials: 3, bindGroups: 5 },
    binding: { planned: 3, applied: 3, ready: 3, diagnostics: 0 },
    renderWorld: { active: 3, ready: 3, blocked: 0 },
    draw: { packages: 3, descriptors: 3, drawList: 3, resolved: 3 },
    geometry: {
      primitive: "plane",
      meshLabel: "SharedPrimitivePlane",
      vertexStreams: 1,
      vertexCount: 4,
      indexCount: 6,
      topology: "triangle-list",
      source: "aperture.createPlaneMeshAsset",
    },
    visibility: {
      authored: 4,
      extracted: 3,
      skipped: 1,
      hiddenMaterialKey: "material:hidden-magenta-plane",
      hiddenMaterialColor: [1, 0, 1, 1],
      diagnostics: ["render.invisible"],
    },
    command: { drawCount: 3, indexedDrawCount: 3 },
    submission: { commandBuffers: 1, drawCalls: 3, indexedDrawCalls: 3 },
    diagnosticCounts: {
      extraction: 1,
      resources: 0,
      binding: 0,
      draw: 0,
      submission: 0,
    },
  });
  expect(
    status.command?.commands,
    JSON.stringify(status, null, 2),
  ).toBeGreaterThan(0);
  expect(status.submission?.commands, JSON.stringify(status, null, 2)).toBe(
    status.command?.commands,
  );
  expect(status.draw?.renderIds, JSON.stringify(status, null, 2)).toHaveLength(
    3,
  );
  expect(
    [...(status.command?.firstInstances ?? [])].sort(),
    JSON.stringify(status, null, 2),
  ).toEqual([0, 1, 2]);
  expectSceneReadbackStatus(
    status.readback,
    9,
    JSON.stringify(status, null, 2),
  );
});
