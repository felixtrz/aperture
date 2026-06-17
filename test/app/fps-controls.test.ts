import { describe, expect, it } from "vitest";
import {
  quatFromEulerYXZ,
  rotateVec3ByQuat,
} from "@aperture-engine/app/systems";
import {
  cameraForwardFromYawPitch,
  cameraRecoilVelocityFromYaw,
  cameraRelativeMovementDelta,
  enemyLookAngles,
  horizontalBackwardFromYaw,
  horizontalForwardFromYaw,
  horizontalRightFromYaw,
  normalizedMoveAxis,
  snapToGroundDistanceForMove,
  shouldConsumeBufferedJump,
  sourceChildPositionFromLook,
  sourceEnemyAttackers,
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

    expect(turnedRight[0]).toBeCloseTo(-0.5, 10);
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
    expect(strafeRightAfterTurn[2]).toBeCloseTo(-0.5, 10);
  });

  it("matches the camera quaternion forward and right vectors", () => {
    const yaw = Math.PI / 2;
    const pitch = Math.PI / 4;
    const rotation = quatFromEulerYXZ(pitch, yaw, 0);
    const cameraForward = rotateVec3ByQuat([0, 0, -1], rotation);
    const horizontalForward = rotateVec3ByQuat(
      [0, 0, -1],
      quatFromEulerYXZ(0, yaw, 0),
    );
    const cameraRight = rotateVec3ByQuat([1, 0, 0], rotation);

    const helperForward = cameraForwardFromYawPitch(yaw, pitch);
    const helperHorizontalForward = horizontalForwardFromYaw(yaw);
    const helperRight = horizontalRightFromYaw(yaw);

    expect(helperForward[0]).toBeCloseTo(cameraForward[0], 5);
    expect(helperForward[1]).toBeCloseTo(cameraForward[1], 5);
    expect(helperForward[2]).toBeCloseTo(cameraForward[2], 5);
    expect(helperHorizontalForward[0]).toBeCloseTo(horizontalForward[0], 5);
    expect(helperHorizontalForward[1]).toBeCloseTo(horizontalForward[1], 5);
    expect(helperHorizontalForward[2]).toBeCloseTo(horizontalForward[2], 5);
    expect(helperRight[0]).toBeCloseTo(cameraRight[0], 5);
    expect(helperRight[1]).toBeCloseTo(cameraRight[1], 5);
    expect(helperRight[2]).toBeCloseTo(cameraRight[2], 5);
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
    expect(turnedRight[0]).toBeCloseTo(1, 10);
    expect(turnedRight[1]).toBe(0);
    expect(turnedRight[2]).toBeCloseTo(0, 10);

    const recoil = cameraRecoilVelocityFromYaw(Math.PI / 2, 40, 0.12);
    expect(recoil[0]).toBeCloseTo(4.8, 10);
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

  it("pitches enemies toward the player's upper-body look target", () => {
    const enemy: [number, number, number] = [0, 3, 0];
    const player: [number, number, number] = [0, 1.5, 5];
    const look = enemyLookAngles({
      enemy,
      player,
      targetYOffset: 0.5,
    });
    const expectedDirection: [number, number, number] = [
      0,
      -1 / Math.sqrt(26),
      5 / Math.sqrt(26),
    ];
    const forward = rotateVec3ByQuat(
      [0, 0, 1],
      quatFromEulerYXZ(look.pitch, look.yaw, 0),
    );

    expect(look.yaw).toBeCloseTo(0, 10);
    expect(look.pitch).toBeGreaterThan(0);
    expect(forward[0]).toBeCloseTo(expectedDirection[0], 5);
    expect(forward[1]).toBeCloseTo(expectedDirection[1], 5);
    expect(forward[2]).toBeCloseTo(expectedDirection[2], 5);
  });

  it("places enemy muzzle child offsets through the source look transform", () => {
    const enemy: [number, number, number] = [0, 3, 0];
    const player: [number, number, number] = [0, 1.5, 5];
    const localOffset: [number, number, number] = [-0.45, 0.3, 0.4];
    const look = enemyLookAngles({
      enemy,
      player,
      targetYOffset: 0.5,
    });
    const muzzle = sourceChildPositionFromLook(enemy, look, localOffset);
    const expectedOffset = rotateVec3ByQuat(
      localOffset,
      quatFromEulerYXZ(look.pitch, look.yaw, 0),
    );

    expect(muzzle[0]).toBeCloseTo(enemy[0] + expectedOffset[0], 10);
    expect(muzzle[1]).toBeCloseTo(enemy[1] + expectedOffset[1], 10);
    expect(muzzle[2]).toBeCloseTo(enemy[2] + expectedOffset[2], 10);
    expect(muzzle[1]).toBeLessThan(enemy[1] + localOffset[1]);
  });

  it("disables snap-to-ground for upward character movement", () => {
    expect(snapToGroundDistanceForMove(0.18, 0.12)).toBe(0);
    expect(snapToGroundDistanceForMove(0.18, 0)).toBe(0.18);
    expect(snapToGroundDistanceForMove(0.18, -0.12)).toBe(0.18);
  });

  it("keeps buffered jumps eligible after ground contact refreshes jump count", () => {
    expect(shouldConsumeBufferedJump(0.08, 0)).toBe(false);
    expect(shouldConsumeBufferedJump(0.08, 2)).toBe(true);
    expect(shouldConsumeBufferedJump(0, 2)).toBe(false);
  });

  it("keeps all source enemy timers that can raycast the player", () => {
    const attackers = sourceEnemyAttackers({
      playerPosition: [0, 1.5, 0],
      attackDistance: 5,
      enemies: [
        {
          key: "enemy.near-a",
          position: [0, 1.5, 4.9],
          alive: true,
          hasLineOfSight: true,
        },
        {
          key: "enemy.near-b",
          position: [3, 1.5, 0],
          alive: true,
          hasLineOfSight: true,
        },
        {
          key: "enemy.dead",
          position: [0, 1.5, 2],
          alive: false,
          hasLineOfSight: true,
        },
        {
          key: "enemy.blocked",
          position: [0, 1.5, 3],
          alive: true,
          hasLineOfSight: false,
        },
        {
          key: "enemy.far",
          position: [0, 1.5, 5],
          alive: true,
          hasLineOfSight: true,
        },
      ],
    });

    expect(attackers.map((enemy) => enemy.key)).toEqual([
      "enemy.near-a",
      "enemy.near-b",
    ]);
  });
});
