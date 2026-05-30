import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel, type RgbaPixel } from "./png.js";
import { loadExampleStatus } from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

/**
 * M2-T7 done-when #3: a mesh with 3+ morph targets renders through the N-target
 * storage-buffer path, and the GPU readback differs from the 2-target-only
 * result — proving target>=3 contributes.
 *
 * The `morph-targets` route renders one 3-target box. Target 2 translates the
 * whole mesh out of the camera center, so `?w2=0` keeps the lit box centered
 * while `?w2=1` morphs it away (center = clear color). The 3rd-target weight is
 * the only difference between the two captures.
 */
interface MorphStatus extends ExampleStatusBase {
  readonly morphTargetWeight?: number;
  readonly extraction?: {
    readonly meshDraws: number;
    readonly morphedDraws: number;
    readonly morphTargetCount: number;
  };
  readonly clearColor?: { r: number; g: number; b: number; a: number };
  readonly readback?: {
    readonly ok: boolean;
    readonly samples: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

async function centerSample(page: Page, w2: number) {
  const status = await loadExampleStatus<MorphStatus>(
    page,
    `/examples/morph-targets.html?w2=${w2}`,
    `morph-targets-w2-${w2}`,
  );
  if (status === undefined) {
    return null;
  }

  expect(status.ok, JSON.stringify(status, null, 2)).toBe(true);
  // The route must genuinely render a single morphed draw carrying all 3 targets.
  expect(status.extraction?.morphedDraws).toBe(1);
  expect(status.extraction?.morphTargetCount).toBe(3);

  if (!status.readback?.ok) {
    test.skip(true, "GPU readback unavailable in this browser");
    return null;
  }

  const center = status.readback.samples.find((s) => s.id === "center");
  expect(center, "missing center readback sample").toBeDefined();
  return { pixel: center?.pixel ?? null, clearColor: status.clearColor };
}

test("a 3rd morph target changes the rendered pixels vs 2-target-only (M2-T7 #3)", async ({
  page,
}) => {
  const twoTarget = await centerSample(page, 0);
  const threeTarget = await centerSample(page, 1);

  if (
    twoTarget?.pixel == null ||
    threeTarget?.pixel == null ||
    twoTarget.clearColor === undefined
  ) {
    return;
  }

  const clearPixel = rgbaColorToPixel(twoTarget.clearColor);

  // Targets 0/1 only: the lit box covers the center (far from clear).
  expect(
    pixelDistance(twoTarget.pixel, clearPixel),
    `w2=0 center should be the lit box; ${JSON.stringify(twoTarget)}`,
  ).toBeGreaterThan(40);

  // Activating target 2 morphs the box out of the center → clear color.
  expect(
    pixelDistance(threeTarget.pixel, clearPixel),
    `w2=1 center should be clear (box morphed away); ${JSON.stringify(threeTarget)}`,
  ).toBeLessThan(40);

  // The defining proof: the 3rd morph target genuinely alters the pixels.
  expect(
    pixelDistance(twoTarget.pixel, threeTarget.pixel),
    "the 3rd morph target must change the rendered center pixel",
  ).toBeGreaterThan(40);
});
