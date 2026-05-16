import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

const nearMaterial = { r: 0.16, g: 0.9, b: 0.32, a: 1 };
const farMaterial = { r: 1, g: 0.08, b: 0.04, a: 1 };

test("ECS browser example depth-tests overlapping 3D renderables", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "depth-overlap",
    "depth-overlap-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "depth-overlap",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, bindGroups: 4 },
    binding: { planned: 2, applied: 2, ready: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    depth: { format: "depth24plus" },
    renderOrder: {
      front: 0,
      back: 10,
      expectedTopMaterial: "depth-near-green",
    },
    command: { drawCount: 2, indexedDrawCount: 2 },
    submission: { commandBuffers: 1, drawCalls: 2, indexedDrawCalls: 2 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined || !status.readback?.ok) {
    test.skip(true, "Depth overlap pixel assertion requires readback.");
    return;
  }

  const centerSample = status.readback.samples.find(
    (sample) => sample.id === "center",
  );

  expect(
    centerSample,
    `expected center GPU readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (centerSample === undefined) {
    return;
  }

  expect(
    pixelDistance(centerSample.pixel, rgbaColorToPixel(nearMaterial)),
    `near object should win the depth-tested overlap; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(90);
  expect(
    pixelDistance(centerSample.pixel, rgbaColorToPixel(farMaterial)),
    `far object should not overwrite the nearer object; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(80);
});
