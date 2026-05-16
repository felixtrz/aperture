import { expect, test } from "@playwright/test";

import type { SingleDrawExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import { sampleCanvasCenterPresentation } from "./webgpu-presentation.js";
import { attachExampleStatus, loadExampleStatus } from "./webgpu-status.js";

test("ECS triangle example extracts, submits, and renders non-background pixels", async ({
  page,
}) => {
  const status = await loadExampleStatus<SingleDrawExampleStatus>(
    page,
    "/examples/triangle.html",
    "ecs-triangle-status",
  );

  if (status === undefined) {
    return;
  }

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
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined) {
    return;
  }

  const clearPixel = rgbaColorToPixel(status.clearColor);

  if (status.readback?.ok) {
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
      pixelDistance(centerSample.pixel, clearPixel),
      `center GPU readback sample should differ from clear color; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeGreaterThan(40);
    return;
  }

  const presentation = await sampleCanvasCenterPresentation(
    page.locator("#aperture-canvas"),
  );
  await attachExampleStatus("ecs-triangle-presentation", presentation);
  test.skip(presentation.samplesCssBackground, presentation.diagnostic);
  const centerPixel = presentation.centerPixel;

  expect(
    pixelDistance(centerPixel, clearPixel),
    `center pixel should differ from clear color; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(40);
});
