import { expect, test, type Page } from "@playwright/test";

import { loadExampleStatus } from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

/**
 * F2 (IK — two-bone + CCD) end-to-end. A leg rig (hip → knee → foot) is planted
 * onto a tilted static ramp found by a PHYSICS RAYCAST: the worker casts a
 * downward ray under the foot, sets the two-bone IK target to the hit point, and
 * the fixed-step IK system bends the knee so the foot lands on the surface.
 * Asserts AC1 pose facts at a fixed frame:
 *  - the foot lands on the ground plane at the raycast hit height (within tol),
 *  - moving the foot along the ramp moves it to a new (raycast-found) height,
 *  - the pole hint controls which way the knee bends (front vs back flips it),
 *  - the same input replays to a bit-identical pose (determinism).
 */
interface FootPlacementStatus extends ExampleStatusBase {
  readonly footX?: number;
  readonly pole?: string;
  readonly ik?: {
    readonly footX: number;
    readonly pole: string;
    readonly rayHit: {
      readonly point: readonly number[];
      readonly distance: number;
    } | null;
    readonly pose: {
      readonly hip: readonly number[];
      readonly knee: readonly number[];
      readonly foot: readonly number[];
      readonly target: readonly number[];
      readonly footError: number;
      readonly planted: boolean;
    };
  };
}

async function load(
  page: Page,
  footX: number,
  pole: "front" | "back",
): Promise<FootPlacementStatus | null> {
  const status = await loadExampleStatus<FootPlacementStatus>(
    page,
    `/examples/foot-placement-ik.html?footX=${footX}&pole=${pole}`,
    `foot-placement-ik-x${footX}-${pole}`,
  );
  return status ?? null;
}

test("two-bone IK plants the foot on raycast-found ground; pole controls the bend (F2)", async ({
  page,
}) => {
  const front = await load(page, 1, "front");
  const back = await load(page, 1, "back");
  const highGround = await load(page, 1.2, "front");
  const lowGround = await load(page, -1.2, "front");

  if (
    front === null ||
    back === null ||
    highGround === null ||
    lowGround === null
  ) {
    return;
  }

  expect(front.ok, JSON.stringify(front, null, 2)).toBe(true);

  // The raycast found the ground and the foot planted on it.
  expect(front.ik?.rayHit).not.toBeNull();
  const rayY = front.ik!.rayHit!.point[1]!;
  const footY = front.ik!.pose.foot[1]!;
  const targetY = front.ik!.pose.target[1]!;
  // The foot rests on the raycast surface height (target sits a foot-radius
  // above the hit point; the effector reaches the target within tolerance).
  expect(targetY).toBeGreaterThan(rayY);
  expect(footY).toBeCloseTo(targetY, 2);
  expect(front.ik?.pose.planted).toBe(true);
  expect(front.ik!.pose.footError).toBeLessThan(0.02);
  // The foot sits directly under the hip in x (target ray was cast there).
  expect(front.ik!.pose.foot[0]).toBeCloseTo(1, 2);

  // Moving the foot along the tilted ramp changes the raycast-found height, so
  // the planted foot lands higher on the +x side than the -x side.
  const highFootY = highGround.ik!.pose.foot[1]!;
  const lowFootY = lowGround.ik!.pose.foot[1]!;
  expect(highGround.ik?.pose.planted).toBe(true);
  expect(lowGround.ik?.pose.planted).toBe(true);
  expect(highFootY).toBeGreaterThan(lowFootY + 0.15);
  // Each foot matches its own raycast hit.
  expect(highGround.ik!.pose.foot[1]).toBeCloseTo(
    highGround.ik!.pose.target[1]!,
    2,
  );
  expect(lowGround.ik!.pose.foot[1]).toBeCloseTo(
    lowGround.ik!.pose.target[1]!,
    2,
  );

  // The pole hint controls the bend: the knee points toward +z (front) or -z
  // (back) — opposite signs, same foot placement.
  const frontKneeZ = front.ik!.pose.knee[2]!;
  const backKneeZ = back.ik!.pose.knee[2]!;
  expect(frontKneeZ).toBeGreaterThan(0.3);
  expect(backKneeZ).toBeLessThan(-0.3);
  // ...yet both still plant the foot at the same spot.
  expect(back.ik!.pose.foot[1]).toBeCloseTo(front.ik!.pose.foot[1]!, 3);

  // Determinism: the same input replays to a bit-identical pose.
  const replay = await load(page, 1, "front");
  if (replay !== null) {
    expect(replay.ik?.pose.foot).toEqual(front.ik?.pose.foot);
    expect(replay.ik?.pose.knee).toEqual(front.ik?.pose.knee);
  }
});
