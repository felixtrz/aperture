import { expect, test, type Page } from "@playwright/test";

import { loadExampleStatus } from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

/**
 * F1 (Animation mixer v2) end-to-end. Drives a `speed` signal into a locomotion
 * blend space (idle/walk/run) plus a `look` signal into an ADDITIVE head-look
 * layer, and asserts the sampled bone pose at a fixed deterministic frame:
 *  - low speed → idle-dominant pose (hip parked low; idle weight ≈ 1),
 *  - mid speeds → idle↔walk and walk↔run blends (hip height is the weighted
 *    average; two lanes contribute),
 *  - the additive head-look rotates the head bone by the same amount regardless
 *    of locomotion speed (proving additive layers are independent of the base),
 *  - the same input replays to a bit-identical pose (determinism).
 */
interface LaneStatus {
  readonly id: string;
  readonly clipId: string;
  readonly additive: boolean;
  readonly effectiveWeight: number;
}

interface LocomotionStatus extends ExampleStatusBase {
  readonly speed?: number;
  readonly look?: number;
  readonly animation?: {
    readonly speed: number;
    readonly look: number;
    readonly weights: { idle: number; walk: number; run: number };
    readonly pose: {
      readonly hip: readonly number[];
      readonly head: readonly number[];
      readonly expectedHipHeight: number;
    };
    readonly lanes: readonly LaneStatus[];
    readonly clipIds: readonly string[];
  };
}

async function load(
  page: Page,
  speed: number,
  look: number,
): Promise<LocomotionStatus | null> {
  const status = await loadExampleStatus<LocomotionStatus>(
    page,
    `/examples/locomotion-blend.html?speed=${speed}&look=${look}`,
    `locomotion-blend-s${speed}-l${look}`,
  );
  return status ?? null;
}

function laneWeight(status: LocomotionStatus, clipId: string): number {
  const lane = status.animation?.lanes.find((entry) => entry.clipId === clipId);
  return lane?.effectiveWeight ?? 0;
}

test("locomotion blend space + additive head-look drive a deterministic pose (F1)", async ({
  page,
}) => {
  const idle = await load(page, 0, 0);
  const walkBlend = await load(page, 1.5, 0);
  const runBlend = await load(page, 4.5, 0);
  const idleLook = await load(page, 0, 1);
  const runLook = await load(page, 4.5, 1);
  const halfLook = await load(page, 4.5, 0.5);

  if (
    idle === null ||
    walkBlend === null ||
    runBlend === null ||
    idleLook === null ||
    runLook === null ||
    halfLook === null
  ) {
    return;
  }

  // The mixer's N-lane API is engine-owned (four lanes, one of them additive).
  expect(idle.ok, JSON.stringify(idle, null, 2)).toBe(true);
  expect(idle.animation?.clipIds).toEqual(
    expect.arrayContaining(["idle", "walk", "run", "headLook"]),
  );
  expect(idle.animation?.lanes.length).toBe(4);
  expect(
    idle.animation?.lanes.find((lane) => lane.clipId === "headLook")?.additive,
  ).toBe(true);

  // Low speed → idle-dominant pose: the idle lane owns the blend and the hip is
  // parked at its lowest corner.
  expect(laneWeight(idle, "idle")).toBeCloseTo(1, 4);
  expect(laneWeight(idle, "walk")).toBeCloseTo(0, 4);
  expect(laneWeight(idle, "run")).toBeCloseTo(0, 4);
  expect(idle.animation?.pose.hip[1]).toBeCloseTo(0, 4);

  // Mid speed (1.5) → idle↔walk blend: both lanes contribute, hip at the
  // weighted average height (0.25).
  expect(laneWeight(walkBlend, "idle")).toBeCloseTo(0.5, 4);
  expect(laneWeight(walkBlend, "walk")).toBeCloseTo(0.5, 4);
  expect(walkBlend.animation?.pose.hip[1]).toBeCloseTo(0.25, 4);

  // Higher speed (4.5) → walk↔run blend: the hip climbs to 0.75, run now
  // contributes and idle is fully out.
  expect(laneWeight(runBlend, "walk")).toBeCloseTo(0.5, 4);
  expect(laneWeight(runBlend, "run")).toBeCloseTo(0.5, 4);
  expect(laneWeight(runBlend, "idle")).toBeCloseTo(0, 4);
  expect(runBlend.animation?.pose.hip[1]).toBeCloseTo(0.75, 4);
  expect(runBlend.animation?.pose.hip[1]).toBeGreaterThan(
    walkBlend.animation!.pose.hip[1]!,
  );

  // Additive head-look: at look 0 the head bone stays at rest identity...
  expect(idle.animation?.pose.head[1]).toBeCloseTo(0, 4); // no yaw
  expect(idle.animation?.pose.head[3]).toBeCloseTo(1, 4); // identity w

  // ...at look 1 the head yaws ~40° about +Y, and CRUCIALLY the same rotation
  // appears at idle AND at the walk/run blend — the additive layer is
  // independent of the locomotion base pose.
  const yaw = Math.sin((40 * Math.PI) / 360); // sin(20°)
  expect(idleLook.animation?.pose.head[1]).toBeCloseTo(yaw, 3);
  expect(runLook.animation?.pose.head[1]).toBeCloseTo(yaw, 3);
  expect(idleLook.animation!.pose.head[1]!).toBeCloseTo(
    runLook.animation!.pose.head[1]!,
    5,
  );
  // ...yet locomotion still differs underneath (hip height unchanged by look).
  expect(idleLook.animation?.pose.hip[1]).toBeCloseTo(0, 4);
  expect(runLook.animation?.pose.hip[1]).toBeCloseTo(0.75, 4);

  // Half look weight → half the yaw (slerp from identity), proving the additive
  // lane scales by its effective weight.
  const halfYaw = Math.sin((20 * Math.PI) / 360); // sin(10°)
  expect(halfLook.animation?.pose.head[1]).toBeCloseTo(halfYaw, 3);

  // Determinism: the same input replays to a bit-identical pose.
  const replay = await load(page, 4.5, 1);
  if (replay !== null) {
    expect(replay.animation?.pose.hip).toEqual(runLook.animation?.pose.hip);
    expect(replay.animation?.pose.head).toEqual(runLook.animation?.pose.head);
  }
});
