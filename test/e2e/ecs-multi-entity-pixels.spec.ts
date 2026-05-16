import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  pixelDistance,
  readPngPixel,
  rgbaColorToPixel,
  type RgbaColor,
  type RgbaPixel,
} from "./png.js";
import { sampleCanvasCenterPresentation } from "./webgpu-presentation.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

const redMaterial: RgbaColor = { r: 1, g: 0.16, b: 0.06, a: 1 };
const greenMaterial: RgbaColor = { r: 0.1, g: 0.9, b: 0.24, a: 1 };
const blueMaterial: RgbaColor = { r: 0.05, g: 0.48, b: 1, a: 1 };
const hiddenMaterial: RgbaColor = { r: 1, g: 0, b: 1, a: 1 };
const regionSamplePoints = [
  { x: 0.31, y: 0.48 },
  { x: 0.34, y: 0.5 },
  { x: 0.37, y: 0.52 },
  { x: 0.48, y: 0.48 },
  { x: 0.5, y: 0.5 },
  { x: 0.52, y: 0.52 },
  { x: 0.63, y: 0.48 },
  { x: 0.66, y: 0.5 },
  { x: 0.69, y: 0.52 },
];

test("ECS multi-entity example renders three colored regions when pixels are capturable", async ({
  page,
}) => {
  await page.goto("/examples/multi-entity.html");
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("ecs-multi-entity-pixel-status", status);

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
    resources: { materials: 3 },
    binding: { applied: 3, ready: 3, diagnostics: 0 },
    draw: { packages: 3 },
    geometry: {
      primitive: "plane",
      vertexCount: 4,
      indexCount: 6,
      source: "aperture.createPlaneMeshAsset",
    },
    visibility: {
      authored: 4,
      extracted: 3,
      skipped: 1,
      diagnostics: ["render.invisible"],
    },
    submission: { drawCalls: 3 },
  });
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined) {
    return;
  }

  const clearPixel = rgbaColorToPixel(status.clearColor);

  if (status.readback?.ok) {
    const samples = status.readback.samples.map((sample) => sample.pixel);
    const redDistance = nearestDistance(samples, rgbaColorToPixel(redMaterial));
    const greenDistance = nearestDistance(
      samples,
      rgbaColorToPixel(greenMaterial),
    );
    const blueDistance = nearestDistance(
      samples,
      rgbaColorToPixel(blueMaterial),
    );
    const hiddenDistance = nearestDistance(
      samples,
      rgbaColorToPixel(hiddenMaterial),
    );
    const clearDistances = samples.map((sample) =>
      pixelDistance(sample, clearPixel),
    );

    await attachExampleStatus("ecs-multi-entity-readback-samples", {
      samples: status.readback.samples,
      redDistance,
      greenDistance,
      blueDistance,
      hiddenDistance,
      clearDistances,
    });

    expect(
      redDistance,
      `expected one GPU readback sample to match red material; samples=${JSON.stringify(
        status.readback.samples,
      )}`,
    ).toBeLessThan(90);
    expect(
      greenDistance,
      `expected one GPU readback sample to match green material; samples=${JSON.stringify(
        status.readback.samples,
      )}`,
    ).toBeLessThan(90);
    expect(
      blueDistance,
      `expected one GPU readback sample to match blue material; samples=${JSON.stringify(
        status.readback.samples,
      )}`,
    ).toBeLessThan(90);
    expect(
      hiddenDistance,
      `expected hidden material color to be absent from GPU readback samples; samples=${JSON.stringify(
        status.readback.samples,
      )}`,
    ).toBeGreaterThan(120);
    expect(
      clearDistances.filter((distance) => distance > 40).length,
      `expected at least three GPU readback samples to differ from clear color; samples=${JSON.stringify(
        status.readback.samples,
      )}`,
    ).toBeGreaterThanOrEqual(3);
    return;
  }

  const canvas = page.locator("#aperture-canvas");
  const presentation = await sampleCanvasCenterPresentation(canvas);

  await attachExampleStatus("ecs-multi-entity-presentation", presentation);
  test.skip(presentation.samplesCssBackground, presentation.diagnostic);

  const screenshot = await canvas.screenshot();
  const samples = regionSamplePoints.map(({ x, y }) =>
    readPngPixel(screenshot, x, y),
  );
  const redDistance = nearestDistance(samples, rgbaColorToPixel(redMaterial));
  const greenDistance = nearestDistance(
    samples,
    rgbaColorToPixel(greenMaterial),
  );
  const blueDistance = nearestDistance(samples, rgbaColorToPixel(blueMaterial));
  const hiddenDistance = nearestDistance(
    samples,
    rgbaColorToPixel(hiddenMaterial),
  );
  const clearDistances = samples.map((sample) =>
    pixelDistance(sample, clearPixel),
  );

  await attachExampleStatus("ecs-multi-entity-pixel-samples", {
    samples,
    redDistance,
    greenDistance,
    blueDistance,
    hiddenDistance,
    clearDistances,
  });

  expect(
    redDistance,
    `expected one sampled region to match red material; samples=${JSON.stringify(
      samples,
    )}`,
  ).toBeLessThan(90);
  expect(
    hiddenDistance,
    `expected hidden material color to be absent from sampled regions; samples=${JSON.stringify(
      samples,
    )}`,
  ).toBeGreaterThan(120);
  expect(
    greenDistance,
    `expected one sampled region to match green material; samples=${JSON.stringify(
      samples,
    )}`,
  ).toBeLessThan(90);
  expect(
    blueDistance,
    `expected one sampled region to match blue material; samples=${JSON.stringify(
      samples,
    )}`,
  ).toBeLessThan(90);
  expect(
    clearDistances.filter((distance) => distance > 40).length,
    `expected at least three sampled regions to differ from clear color; samples=${JSON.stringify(
      samples,
    )}`,
  ).toBeGreaterThanOrEqual(3);
});

function nearestDistance(
  samples: readonly RgbaPixel[],
  target: RgbaPixel,
): number {
  return Math.min(...samples.map((sample) => pixelDistance(sample, target)));
}
