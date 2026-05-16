import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

const visibleMaterial = { r: 0.12, g: 0.9, b: 0.36, a: 1 };
const skippedMaterial = { r: 1, g: 0.06, b: 0.06, a: 1 };

test("ECS browser example renders matching layer and skips mismatched peer", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html?scenario=render-layer-filter");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("render-layer-filter-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "render-layer-filter",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 1 },
    resources: { materials: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    layerFiltering: {
      cameraLayerMask: 1,
      visibleLayerMask: 1,
      skippedLayerMask: 2,
      skippedMaterialKey: "material:layer-skipped-red",
      skippedMaterialColor: [1, 0.06, 0.06, 1],
      extracted: 1,
      skipped: 1,
      diagnostics: ["render.layerMismatch"],
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: { extraction: 1, draw: 0, submission: 0 },
  });
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined || !status.readback?.ok) {
    test.skip(true, "Render layer filter pixel assertion requires readback.");
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
    pixelDistance(centerSample.pixel, rgbaColorToPixel(visibleMaterial)),
    `center GPU readback sample should match visible layer material; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(90);
  expect(
    pixelDistance(centerSample.pixel, rgbaColorToPixel(skippedMaterial)),
    `center GPU readback sample should not match skipped layer material; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(80);
});
