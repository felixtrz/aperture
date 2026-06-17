import type { Vec3Tuple as Vec3 } from "@aperture-engine/app/systems";

export interface CameraRelativeMoveInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly yaw: number;
  readonly speed: number;
  readonly dt: number;
  readonly verticalVelocity: number;
}

export function cameraForwardFromYawPitch(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch);
  return [cosPitch * Math.sin(yaw), Math.sin(pitch), -cosPitch * Math.cos(yaw)];
}

export function horizontalForwardFromYaw(yaw: number): Vec3 {
  return [Math.sin(yaw), 0, -Math.cos(yaw)];
}

export function horizontalRightFromYaw(yaw: number): Vec3 {
  return [Math.cos(yaw), 0, Math.sin(yaw)];
}

export function horizontalBackwardFromYaw(yaw: number): Vec3 {
  const forward = horizontalForwardFromYaw(yaw);
  return [-forward[0], 0, -forward[2]];
}

export function cameraRecoilVelocityFromYaw(
  yaw: number,
  knockback: number,
  impulseScale: number,
): Vec3 {
  const backward = horizontalBackwardFromYaw(yaw);
  const impulse = knockback * impulseScale;
  return [backward[0] * impulse, 0, backward[2] * impulse];
}

export function normalizedMoveAxis(
  moveX: number,
  moveY: number,
): readonly [number, number] {
  const length = Math.hypot(moveX, moveY);
  return length > 1 ? [moveX / length, moveY / length] : [moveX, moveY];
}

export function cameraRelativeMovementDelta(
  input: CameraRelativeMoveInput,
): Vec3 {
  const forward = horizontalForwardFromYaw(input.yaw);
  const right = horizontalRightFromYaw(input.yaw);
  const movement = normalizedMoveAxis(input.moveX, input.moveY);

  return [
    (right[0] * movement[0] + forward[0] * movement[1]) *
      input.speed *
      input.dt,
    input.verticalVelocity * input.dt,
    (right[2] * movement[0] + forward[2] * movement[1]) *
      input.speed *
      input.dt,
  ];
}

export function snapToGroundDistanceForMove(
  configuredDistance: number,
  desiredVerticalTranslation: number,
): number {
  return desiredVerticalTranslation > 0 ? 0 : configuredDistance;
}
