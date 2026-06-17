import { describe, expect, it } from "vitest";
import {
  quatFromEulerYXZ,
  rotateVec3ByQuat,
} from "@aperture-engine/app/systems";
import {
  cameraForwardFromYawPitch,
  cameraRelativeMovementDelta,
  clampSourceLookPitch,
  enemyLookAngles,
  hasCeilingCollision,
  horizontalBackwardFromYaw,
  horizontalForwardFromYaw,
  horizontalRightFromYaw,
  normalizedMoveAxis,
  snapToGroundDistanceForMove,
  sourceButtonPressedThisFrame,
  shouldConsumeBufferedJump,
  shouldConsumeBufferedShot,
  sourceCloudHoverPosition,
  sourceChildPositionFromLook,
  sourceControllerLookStep,
  sourceEnemyAttackers,
  sourceEnemyHoverPosition,
  sourceEnemyLookTarget,
  sourceGroundedAfterMove,
  sourceMouseLookStep,
  sourceMovementTargetVelocity,
  sourceNearestShotHit,
  sourcePlayerShouldRespawn,
  sourcePointerDragLookStep,
  sourceShotDirection,
  sourceSmoothedMovementStep,
  sourceWeaponMuzzleLocalPosition,
  sourceWeaponMuzzleWorldPosition,
  weaponViewmodelOffsetTarget,
} from "../../fps/src/lib/fps-controls.js";
import {
  SOURCE_GAMEPAD_LOOK_SENSITIVITY,
  SOURCE_ENEMY_HOVER_AMPLITUDE,
  SOURCE_ENEMY_HOVER_RATE,
  SOURCE_ENEMY_HOVER_VELOCITY,
  SOURCE_LOOK_LERP_RATE,
  SOURCE_LOOK_PITCH_LIMIT,
  SOURCE_MOVEMENT_LERP_RATE,
  SOURCE_POINTER_LOCK_LOOK_RADIANS_PER_UNIT,
  SOURCE_WEAPON_CONTAINER_OFFSET,
  WEAPONS,
} from "../../fps/src/lib/fps-data.js";

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

  it("keeps source mouse-look-right yaw relative for forward movement", () => {
    const mouseLookRightYaw = -Math.PI / 2;
    const forward = sourceMovementTargetVelocity({
      moveX: 0,
      moveY: 1,
      yaw: mouseLookRightYaw,
      speed: 5,
    });
    const strafeRight = sourceMovementTargetVelocity({
      moveX: 1,
      moveY: 0,
      yaw: mouseLookRightYaw,
      speed: 5,
    });

    expect(forward[0]).toBeCloseTo(5, 10);
    expect(forward[2]).toBeCloseTo(0, 10);
    expect(strafeRight[0]).toBeCloseTo(0, 10);
    expect(strafeRight[2]).toBeCloseTo(5, 10);
  });

  it("keeps strafing relative to camera yaw and normalizes diagonals", () => {
    expect(normalizedMoveAxis(1, 1)).toEqual([1 / Math.SQRT2, 1 / Math.SQRT2]);

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

  it("matches source controller look target accumulation and lerp", () => {
    const look = sourceControllerLookStep({
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
      axisX: 1,
      axisY: 0,
      sensitivity: SOURCE_GAMEPAD_LOOK_SENSITIVITY,
      lerpRate: SOURCE_LOOK_LERP_RATE,
      pitchLimit: SOURCE_LOOK_PITCH_LIMIT,
      dt: 1 / 60,
    });

    expect(look.targetYaw).toBeCloseTo(0.075, 10);
    expect(look.targetPitch).toBe(0);
    expect(look.yaw).toBeCloseTo(0.075 * (25 / 60), 10);
    expect(look.pitch).toBe(0);
  });

  it("limits source controller diagonal look before sensitivity is applied", () => {
    const look = sourceControllerLookStep({
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
      axisX: 1,
      axisY: 1,
      sensitivity: SOURCE_GAMEPAD_LOOK_SENSITIVITY,
      lerpRate: SOURCE_LOOK_LERP_RATE,
      pitchLimit: SOURCE_LOOK_PITCH_LIMIT,
      dt: 1 / 60,
    });

    expect(look.targetYaw).toBeCloseTo(0.075 / Math.SQRT2, 10);
    expect(look.targetPitch).toBeCloseTo(0.075 / Math.SQRT2, 10);
  });

  it("applies source pointer-lock mouse look immediately through the rotation target", () => {
    const look = sourceMouseLookStep({
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
      axisX: -1,
      axisY: 0.5,
      radiansPerUnit: SOURCE_POINTER_LOCK_LOOK_RADIANS_PER_UNIT,
      pitchLimit: SOURCE_LOOK_PITCH_LIMIT,
    });

    expect(look.targetYaw).toBeCloseTo(-26 / 700, 10);
    expect(look.targetPitch).toBeCloseTo(13 / 700, 10);
    expect(look.yaw).toBe(look.targetYaw);
    expect(look.pitch).toBe(look.targetPitch);
  });

  it("preserves raw pointer-lock deltas beyond generated axis limits", () => {
    const look = sourceMouseLookStep({
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
      axisX: -10,
      axisY: 2,
      radiansPerUnit: SOURCE_POINTER_LOCK_LOOK_RADIANS_PER_UNIT,
      pitchLimit: SOURCE_LOOK_PITCH_LIMIT,
    });

    expect(look.yaw).toBeCloseTo((-10 * 26) / 700, 10);
    expect(look.pitch).toBeCloseTo((2 * 26) / 700, 10);
  });

  it("keeps fallback pointer drag yaw aligned with source mouse look", () => {
    const look = sourcePointerDragLookStep({
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
      deltaX: 0.25,
      deltaY: 0.125,
      radiansPerUnit: Math.PI,
      pitchLimit: SOURCE_LOOK_PITCH_LIMIT,
    });

    expect(look.yaw).toBeCloseTo(-Math.PI / 4, 10);
    expect(look.pitch).toBeCloseTo(-Math.PI / 8, 10);
    expect(look.targetYaw).toBe(look.yaw);
    expect(look.targetPitch).toBe(look.pitch);

    const forward = sourceMovementTargetVelocity({
      moveX: 0,
      moveY: 1,
      yaw: look.yaw,
      speed: 5,
    });
    expect(forward[0]).toBeGreaterThan(0);
    expect(forward[2]).toBeLessThan(0);
  });

  it("clamps source look pitch to the source +/-90 degree limit", () => {
    expect(clampSourceLookPitch(Math.PI, SOURCE_LOOK_PITCH_LIMIT)).toBeCloseTo(
      Math.PI / 2,
      10,
    );
    expect(
      sourceControllerLookStep({
        yaw: 0,
        pitch: 0,
        targetYaw: 0,
        targetPitch: SOURCE_LOOK_PITCH_LIMIT - 0.01,
        axisX: 0,
        axisY: 1,
        sensitivity: SOURCE_GAMEPAD_LOOK_SENSITIVITY,
        lerpRate: SOURCE_LOOK_LERP_RATE,
        pitchLimit: SOURCE_LOOK_PITCH_LIMIT,
        dt: 1,
      }).targetPitch,
    ).toBeCloseTo(Math.PI / 2, 10);
  });

  it("matches source RayCast target spread for pellet directions", () => {
    const centered = sourceShotDirection({
      yaw: 0,
      pitch: 0,
      maxDistance: 10,
      spreadOffsetX: 0,
      spreadOffsetY: 0,
    });

    expect(centered[0]).toBeCloseTo(0, 10);
    expect(centered[1]).toBeCloseTo(0, 10);
    expect(centered[2]).toBeCloseTo(-1, 10);

    const corner = sourceShotDirection({
      yaw: 0,
      pitch: 0,
      maxDistance: 10,
      spreadOffsetX: 1,
      spreadOffsetY: 1,
    });
    const length = Math.sqrt(102);

    expect(corner[0]).toBeCloseTo(1 / length, 10);
    expect(corner[1]).toBeCloseTo(1 / length, 10);
    expect(corner[2]).toBeCloseTo(-10 / length, 10);
  });

  it("rotates source pellet spread through the camera basis", () => {
    const yaw = Math.PI / 2;
    const pitch = Math.PI / 6;
    const direction = sourceShotDirection({
      yaw,
      pitch,
      maxDistance: 10,
      spreadOffsetX: 0.5,
      spreadOffsetY: -0.25,
    });
    const expected = rotateVec3ByQuat(
      [0.5, -0.25, -10],
      quatFromEulerYXZ(pitch, yaw, 0),
    );
    const expectedLength = Math.hypot(expected[0], expected[1], expected[2]);

    expect(direction[0]).toBeCloseTo(expected[0] / expectedLength, 10);
    expect(direction[1]).toBeCloseTo(expected[1] / expectedLength, 10);
    expect(direction[2]).toBeCloseTo(expected[2] / expectedLength, 10);
  });

  it("uses the nearest physics hit as the source raycast collision", () => {
    const enemyBehindUnsortedWall = sourceNearestShotHit([
      { id: "wall", distance: 6, enemyKey: null },
      { id: "enemy.0", distance: 2, enemyKey: "enemy.0" },
    ]);
    expect(enemyBehindUnsortedWall?.id).toBe("enemy.0");

    const blockedEnemy = sourceNearestShotHit([
      { id: "enemy.0", distance: 8, enemyKey: "enemy.0" },
      { id: "wall", distance: 3, enemyKey: null },
    ]);
    expect(blockedEnemy?.id).toBe("wall");
    expect(blockedEnemy?.enemyKey).toBeNull();

    expect(
      sourceNearestShotHit([
        { id: "invalid", distance: Number.NaN },
        { id: "behind", distance: -1 },
      ]),
    ).toBeNull();
  });

  it("applies source shot body knockback through the movement lerp", () => {
    const forwardRamp = sourceSmoothedMovementStep({
      moveX: 0,
      moveY: 1,
      yaw: 0,
      speed: 5,
      dt: 1 / 60,
      verticalVelocity: -1,
      currentVelocity: [0, 0, 0],
      lerpRate: SOURCE_MOVEMENT_LERP_RATE,
    });
    expect(forwardRamp.targetVelocity).toEqual([0, 0, -5]);
    expect(forwardRamp.velocity[2]).toBeCloseTo(-5 * (10 / 60), 10);
    expect(forwardRamp.translation[1]).toBeCloseTo(-1 / 60, 10);
    expect(forwardRamp.translation[2]).toBeCloseTo((-5 * (10 / 60)) / 60, 10);

    const facingForward = horizontalBackwardFromYaw(0);
    expect(facingForward[0]).toBeCloseTo(0, 10);
    expect(facingForward[1]).toBe(0);
    expect(facingForward[2]).toBeCloseTo(1, 10);

    const turnedRight = horizontalBackwardFromYaw(Math.PI / 2);
    expect(turnedRight[0]).toBeCloseTo(1, 10);
    expect(turnedRight[1]).toBe(0);
    expect(turnedRight[2]).toBeCloseTo(0, 10);

    const target = sourceMovementTargetVelocity({
      moveX: 0,
      moveY: 0,
      yaw: Math.PI / 2,
      speed: 5,
      bodyKnockback: 40,
    });
    expect(target[0]).toBeCloseTo(40, 10);
    expect(target[1]).toBe(0);
    expect(target[2]).toBeCloseTo(0, 10);

    const forwardWithShot = sourceMovementTargetVelocity({
      moveX: 0,
      moveY: 1,
      yaw: 0,
      speed: 5,
      bodyKnockback: 40,
    });
    expect(forwardWithShot[0]).toBeCloseTo(0, 10);
    expect(forwardWithShot[1]).toBe(0);
    expect(forwardWithShot[2]).toBeCloseTo(35, 10);

    const recoil = sourceSmoothedMovementStep({
      moveX: 0,
      moveY: 0,
      yaw: Math.PI / 2,
      speed: 5,
      dt: 1 / 60,
      verticalVelocity: 0,
      currentVelocity: [0, 0, 0],
      lerpRate: SOURCE_MOVEMENT_LERP_RATE,
      bodyKnockback: 40,
    });
    expect(recoil.targetVelocity[0]).toBeCloseTo(40, 10);
    expect(recoil.velocity[0]).toBeCloseTo(40 * (10 / 60), 10);
    expect(recoil.velocity[1]).toBe(0);
    expect(recoil.velocity[2]).toBeCloseTo(0, 10);
    expect(recoil.translation[0]).toBeCloseTo((40 * (10 / 60)) / 60, 10);

    const clamped = sourceSmoothedMovementStep({
      moveX: 0,
      moveY: 0,
      yaw: 0,
      speed: 5,
      dt: 1,
      verticalVelocity: 0,
      currentVelocity: [0, 0, 0],
      lerpRate: SOURCE_MOVEMENT_LERP_RATE,
      bodyKnockback: 40,
    });
    expect(clamped.velocity[2]).toBeCloseTo(40, 10);
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

  it("derives player muzzle position from the source weapon container", () => {
    const weapon = WEAPONS[0]!;
    const local = sourceWeaponMuzzleLocalPosition({
      containerOffset: SOURCE_WEAPON_CONTAINER_OFFSET,
      weaponMuzzlePosition: weapon.muzzlePosition,
    });

    expect(local[0]).toBeCloseTo(1.1, 10);
    expect(local[1]).toBeCloseTo(-0.7, 10);
    expect(local[2]).toBeCloseTo(-4.25, 10);

    const movedLocal = sourceWeaponMuzzleLocalPosition({
      containerOffset: SOURCE_WEAPON_CONTAINER_OFFSET,
      weaponMuzzlePosition: weapon.muzzlePosition,
      viewOffset: [-1 / 6, 0, 1 / 6],
    });

    expect(movedLocal[0]).toBeCloseTo(1.1 - 1 / 6, 10);
    expect(movedLocal[1]).toBeCloseTo(-0.7, 10);
    expect(movedLocal[2]).toBeCloseTo(-4.25 + 1 / 6, 10);

    const yaw = Math.PI / 2;
    const pitch = Math.PI / 6;
    const eye: [number, number, number] = [0, 1.5, 0];
    const world = sourceWeaponMuzzleWorldPosition({
      playerEyePosition: eye,
      yaw,
      pitch,
      containerOffset: SOURCE_WEAPON_CONTAINER_OFFSET,
      weaponMuzzlePosition: weapon.muzzlePosition,
    });
    const expectedOffset = rotateVec3ByQuat(
      local,
      quatFromEulerYXZ(pitch, yaw, 0),
    );

    expect(world[0]).toBeCloseTo(eye[0] + expectedOffset[0], 10);
    expect(world[1]).toBeCloseTo(eye[1] + expectedOffset[1], 10);
    expect(world[2]).toBeCloseTo(eye[2] + expectedOffset[2], 10);
  });

  it("pitches enemies toward the source upper-body look target", () => {
    const enemy: [number, number, number] = [0, 3, 0];
    const playerEye: [number, number, number] = [0, 1.5, 5];
    const target = sourceEnemyLookTarget(playerEye);
    const look = enemyLookAngles({
      enemy,
      player: target,
      targetYOffset: 0,
    });
    const expectedDirection: [number, number, number] = [
      0,
      -2 / Math.sqrt(29),
      5 / Math.sqrt(29),
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
    const playerEye: [number, number, number] = [0, 1.5, 5];
    const localOffset: [number, number, number] = [-0.45, 0.3, 0.4];
    const target = sourceEnemyLookTarget(playerEye);
    const look = enemyLookAngles({
      enemy,
      player: target,
      targetYOffset: 0,
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

  it("recovers button edges when generated input already reports pressed", () => {
    expect(
      sourceButtonPressedThisFrame({
        pressed: true,
        down: false,
        wasPressed: false,
      }),
    ).toBe(true);
    expect(
      sourceButtonPressedThisFrame({
        pressed: true,
        down: false,
        wasPressed: true,
      }),
    ).toBe(false);
    expect(
      sourceButtonPressedThisFrame({
        pressed: false,
        down: true,
        wasPressed: true,
      }),
    ).toBe(true);
    expect(
      sourceButtonPressedThisFrame({
        pressed: false,
        down: true,
        wasPressed: false,
      }),
    ).toBe(true);
  });

  it("keeps fast shoot clicks eligible until the weapon can consume them", () => {
    expect(shouldConsumeBufferedShot(false, 0.04, 0)).toBe(true);
    expect(shouldConsumeBufferedShot(true, 0, 0)).toBe(true);
    expect(shouldConsumeBufferedShot(false, 0, 0)).toBe(false);
    expect(shouldConsumeBufferedShot(false, 0.04, 0.1)).toBe(false);
    expect(shouldConsumeBufferedShot(true, 0, 0.1)).toBe(false);
  });

  it("only treats overhead character collisions as upward jump blocks", () => {
    expect(
      hasCeilingCollision([
        {
          normal: [0, 1, 0],
        },
        {
          normal: [1, 0, 0],
        },
      ]),
    ).toBe(false);

    expect(
      hasCeilingCollision([
        {
          normal: [0, -0.75, 0],
        },
      ]),
    ).toBe(true);
  });

  it("keeps source jumps airborne while upward velocity is active", () => {
    expect(
      sourceGroundedAfterMove({
        jumpedThisFrame: true,
        verticalVelocity: 7,
        controllerGrounded: true,
      }),
    ).toBe(false);
    expect(
      sourceGroundedAfterMove({
        jumpedThisFrame: false,
        verticalVelocity: 2,
        controllerGrounded: true,
      }),
    ).toBe(false);
    expect(
      sourceGroundedAfterMove({
        jumpedThisFrame: false,
        verticalVelocity: -1,
        controllerGrounded: true,
      }),
    ).toBe(true);
  });

  it("matches source player reload thresholds for falling and damage", () => {
    expect(sourcePlayerShouldRespawn({ positionY: -10.01, health: 100 })).toBe(
      true,
    );
    expect(sourcePlayerShouldRespawn({ positionY: -10, health: 100 })).toBe(
      false,
    );
    expect(sourcePlayerShouldRespawn({ positionY: 1.5, health: -1 })).toBe(
      true,
    );
    expect(sourcePlayerShouldRespawn({ positionY: 1.5, health: 0 })).toBe(
      false,
    );
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

  it("integrates source cloud cosine hover into a sine position offset", () => {
    const base: [number, number, number] = [1, 2, 3];

    expect(
      sourceCloudHoverPosition({
        basePosition: base,
        hoverVelocity: 0.55,
        hoverRate: 1.1,
        time: 0,
      }),
    ).toEqual(base);

    const quarterCycle = sourceCloudHoverPosition({
      basePosition: base,
      hoverVelocity: 0.55,
      hoverRate: 1.1,
      time: Math.PI / (2 * 1.1),
    });
    expect(quarterCycle[0]).toBe(1);
    expect(quarterCycle[1]).toBeCloseTo(2 + 0.55 / 1.1, 10);
    expect(quarterCycle[2]).toBe(3);
  });

  it("integrates source enemy cosine hover into the scripted sine offset", () => {
    const base: [number, number, number] = [-3.5, 2.5, -6];

    expect(
      sourceEnemyHoverPosition({
        basePosition: base,
        hoverVelocity: SOURCE_ENEMY_HOVER_VELOCITY,
        hoverRate: SOURCE_ENEMY_HOVER_RATE,
        time: 0,
      }),
    ).toEqual(base);

    const quarterCycle = sourceEnemyHoverPosition({
      basePosition: base,
      hoverVelocity: SOURCE_ENEMY_HOVER_VELOCITY,
      hoverRate: SOURCE_ENEMY_HOVER_RATE,
      time: Math.PI / (2 * SOURCE_ENEMY_HOVER_RATE),
    });
    expect(quarterCycle[0]).toBe(base[0]);
    expect(quarterCycle[1]).toBeCloseTo(
      base[1] + SOURCE_ENEMY_HOVER_AMPLITUDE,
      10,
    );
    expect(quarterCycle[2]).toBe(base[2]);
  });
});
