import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

const frontMaterial = { r: 0.08, g: 0.35, b: 1, a: 1 };

test("ECS browser example renders overlapping primitives in explicit order", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=render-order-overlap");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("render-order-overlap-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "render-order-overlap",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, bindGroups: 4 },
    binding: { planned: 2, applied: 2, ready: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    geometry: {
      primitive: "plane",
      meshLabel: "RenderOrderPlane",
      vertexStreams: 1,
      vertexCount: 4,
      indexCount: 6,
      topology: "triangle-list",
      source: "aperture.createPlaneMeshAsset",
    },
    renderOrder: {
      back: 0,
      front: 10,
      expectedTopMaterial: "order-front-blue",
    },
    command: { drawCount: 2, indexedDrawCount: 2 },
    submission: { commandBuffers: 1, drawCalls: 2, indexedDrawCalls: 2 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined || !status.readback?.ok) {
    test.skip(true, "Render-order overlap pixel assertion requires readback.");
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
    pixelDistance(centerSample.pixel, rgbaColorToPixel(frontMaterial)),
    `center GPU readback sample should match the front render-order material; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(90);
  expect(
    pixelDistance(centerSample.pixel, rgbaColorToPixel(status.clearColor)),
    `center GPU readback sample should differ from clear color; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(40);
});
