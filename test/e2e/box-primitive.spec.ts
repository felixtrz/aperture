import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import { sampleCanvasCenterPresentation } from "./webgpu-presentation.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

const boxMaterial = { r: 1, g: 0.64, b: 0.08, a: 1 };

test("ECS browser example renders built-in box primitive through readback", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "box-primitive",
    "box-primitive-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "box-primitive",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    geometry: {
      primitive: "box",
      meshLabel: "BoxPrimitive",
      vertexStreams: 1,
      vertexCount: 24,
      indexCount: 36,
      topology: "triangle-list",
      source: "aperture.createBoxMeshAsset",
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
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
      pixelDistance(centerSample.pixel, rgbaColorToPixel(boxMaterial)),
      `center GPU readback sample should match box material; status=${JSON.stringify(
        status,
        null,
        2,
      )}`,
    ).toBeLessThan(90);
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
  await attachExampleStatus("box-primitive-presentation", presentation);
  test.skip(presentation.samplesCssBackground, presentation.diagnostic);

  expect(
    pixelDistance(presentation.centerPixel, rgbaColorToPixel(boxMaterial)),
    `center pixel should match box material; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(90);
  expect(
    pixelDistance(presentation.centerPixel, clearPixel),
    `center pixel should differ from clear color; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(40);
});
