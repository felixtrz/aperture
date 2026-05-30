import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, type RgbaPixel } from "./png.js";
import { loadExampleStatus } from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

/**
 * M2-T9: end-to-end skinned + animated GLB route through createApertureApp +
 * the public spawn.gltf / spawn.animation API. Proves:
 *  - a CUBICSPLINE clip animating the skin moves the mesh (pixels at clip time
 *    0 differ from time 0.5) — done-when #1 + #3 (CUBICSPLINE),
 *  - a >2-target morph contributes (pixels with the 3rd target weight 0 vs 1
 *    differ) — done-when #3,
 *  - engine-owned animation status (active clip / time / jointCount / morph
 *    targetCount) is surfaced from the engine, not a hand-rolled sampler — #2.
 */
interface AnimationStatus extends ExampleStatusBase {
  readonly animation?: {
    readonly activeClip?: string;
    readonly time?: number;
    readonly jointCount?: number;
    readonly morphTargetCount?: number;
    readonly clipIds?: readonly string[];
  };
  readonly extraction?: {
    readonly morphedDraws: number;
    readonly skinnedDraws: number;
    readonly bones: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly samples: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

async function load(page: Page, time: number, morph: number) {
  const status = await loadExampleStatus<AnimationStatus>(
    page,
    `/examples/animation-skinning.html?t=${time}&morph=${morph}`,
    `animation-skinning-t${time}-m${morph}`,
  );
  return status ?? null;
}

function maxSampleDistance(
  a: NonNullable<AnimationStatus["readback"]>,
  b: NonNullable<AnimationStatus["readback"]>,
): number {
  let max = 0;
  for (const sample of a.samples) {
    const other = b.samples.find((candidate) => candidate.id === sample.id);
    if (other !== undefined) {
      max = Math.max(max, pixelDistance(sample.pixel, other.pixel));
    }
  }
  return max;
}

test("skinned + CUBICSPLINE-animated + morphed GLB renders end-to-end (M2-T9)", async ({
  page,
}) => {
  const restPose = await load(page, 0, 1);
  const bentPose = await load(page, 0.5, 1);
  const noMorph = await load(page, 0, 0);

  if (restPose === null || bentPose === null || noMorph === null) {
    return;
  }

  // Engine-owned animation status (done-when #2 + CUBICSPLINE clip plays, #3).
  expect(restPose.ok, JSON.stringify(restPose, null, 2)).toBe(true);
  expect(restPose.animation?.activeClip).toBe("Bend");
  expect(restPose.animation?.clipIds).toContain("Bend");
  expect(restPose.animation?.jointCount).toBe(2);
  expect(restPose.animation?.morphTargetCount).toBe(3);
  expect(bentPose.animation?.time).toBeCloseTo(0.5, 3);
  expect(restPose.extraction?.skinnedDraws).toBeGreaterThanOrEqual(1);
  expect(restPose.extraction?.morphedDraws).toBeGreaterThanOrEqual(1);
  expect(restPose.extraction?.bones).toBe(2);

  if (
    !restPose.readback?.ok ||
    !bentPose.readback?.ok ||
    !noMorph.readback?.ok
  ) {
    test.skip(true, "GPU readback unavailable in this browser");
    return;
  }

  // done-when #1: the CUBICSPLINE skin animation visibly moves the mesh.
  expect(
    maxSampleDistance(restPose.readback, bentPose.readback),
    "clip time 0 vs 0.5 must change the rendered pixels (skin animates)",
  ).toBeGreaterThan(25);

  // done-when #3: the >2-target morph (3rd target weight 0 vs 1) contributes.
  expect(
    maxSampleDistance(restPose.readback, noMorph.readback),
    "3rd morph target weight 0 vs 1 must change the rendered pixels",
  ).toBeGreaterThan(25);
});
