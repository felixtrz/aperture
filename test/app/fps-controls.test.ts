import { describe, expect, it } from "vitest";
import {
  cameraForwardFromYawPitch,
  cameraRelativeMovementDelta,
  normalizedMoveAxis,
  snapToGroundDistanceForMove,
} from "../../fps/src/lib/fps-controls.js";

describe("Starter Kit FPS controls", () => {
  it("moves W relative to the camera yaw on the horizontal plane", () => {
    expect(
      cameraRelativeMovementDelta({
        moveX: 0,
        moveY: 1,
        yaw: 0,
        speed: 5,
        dt: 0.1,
        verticalVelocity: 0,
      }),
    ).toEqual([0, 0, -0.5]);

    const turnedRight = cameraRelativeMovementDelta({
      moveX: 0,
      moveY: 1,
      yaw: Math.PI / 2,
      speed: 5,
      dt: 0.1,
      verticalVelocity: 0,
    });

    expect(turnedRight[0]).toBeCloseTo(0.5, 10);
    expect(turnedRight[1]).toBe(0);
    expect(turnedRight[2]).toBeCloseTo(0, 10);
  });

  it("keeps strafing relative to camera yaw and normalizes diagonals", () => {
    expect(normalizedMoveAxis(1, 1)).toEqual([
      1 / Math.SQRT2,
      1 / Math.SQRT2,
    ]);

    const strafeRightAfterTurn = cameraRelativeMovementDelta({
      moveX: 1,
      moveY: 0,
      yaw: Math.PI / 2,
      speed: 5,
      dt: 0.1,
      verticalVelocity: 0,
    });

    expect(strafeRightAfterTurn[0]).toBeCloseTo(0, 10);
    expect(strafeRightAfterTurn[2]).toBeCloseTo(0.5, 10);
  });

  it("uses pitch for shooting direction without pulling movement downward", () => {
    const lookingUp = cameraForwardFromYawPitch(0, Math.PI / 4);

    expect(lookingUp[0]).toBeCloseTo(0, 10);
    expect(lookingUp[1]).toBeCloseTo(Math.SQRT1_2, 10);
    expect(lookingUp[2]).toBeCloseTo(-Math.SQRT1_2, 10);
  });

  it("disables snap-to-ground for upward character movement", () => {
    expect(snapToGroundDistanceForMove(0.18, 0.12)).toBe(0);
    expect(snapToGroundDistanceForMove(0.18, 0)).toBe(0.18);
    expect(snapToGroundDistanceForMove(0.18, -0.12)).toBe(0.18);
  });
});
