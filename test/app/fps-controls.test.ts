import { describe, expect, it } from "vitest";
import {
  cameraForwardFromYawPitch,
  cameraRecoilVelocityFromYaw,
  cameraRelativeMovementDelta,
  horizontalBackwardFromYaw,
  normalizedMoveAxis,
  snapToGroundDistanceForMove,
  weaponViewmodelOffsetTarget,
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

  it("applies weapon recoil backward relative to camera yaw", () => {
    const facingForward = horizontalBackwardFromYaw(0);
    expect(facingForward[0]).toBeCloseTo(0, 10);
    expect(facingForward[1]).toBe(0);
    expect(facingForward[2]).toBeCloseTo(1, 10);

    const turnedRight = horizontalBackwardFromYaw(Math.PI / 2);
    expect(turnedRight[0]).toBeCloseTo(-1, 10);
    expect(turnedRight[1]).toBe(0);
    expect(turnedRight[2]).toBeCloseTo(0, 10);

    const recoil = cameraRecoilVelocityFromYaw(Math.PI / 2, 40, 0.12);
    expect(recoil[0]).toBeCloseTo(-4.8, 10);
    expect(recoil[1]).toBe(0);
    expect(recoil[2]).toBeCloseTo(0, 10);
  });

  it("moves the weapon viewmodel opposite local movement like the source container", () => {
    const scale = 1 / 30;
    const forward = weaponViewmodelOffsetTarget({
      moveX: 0,
      moveY: 1,
      speed: 5,
      scale,
    });

    expect(forward[0]).toBe(0);
    expect(forward[1]).toBe(0);
    expect(forward[2]).toBeCloseTo(1 / 6, 10);

    const strafeRight = weaponViewmodelOffsetTarget({
      moveX: 1,
      moveY: 0,
      speed: 5,
      scale,
    });

    expect(strafeRight[0]).toBeCloseTo(-1 / 6, 10);
    expect(strafeRight[1]).toBe(0);
    expect(strafeRight[2]).toBe(0);

    const diagonal = weaponViewmodelOffsetTarget({
      moveX: 1,
      moveY: 1,
      speed: 5,
      scale,
    });

    expect(diagonal[0]).toBeCloseTo(-1 / (6 * Math.SQRT2), 10);
    expect(diagonal[1]).toBe(0);
    expect(diagonal[2]).toBeCloseTo(1 / (6 * Math.SQRT2), 10);
  });

  it("disables snap-to-ground for upward character movement", () => {
    expect(snapToGroundDistanceForMove(0.18, 0.12)).toBe(0);
    expect(snapToGroundDistanceForMove(0.18, 0)).toBe(0.18);
    expect(snapToGroundDistanceForMove(0.18, -0.12)).toBe(0.18);
  });
});
