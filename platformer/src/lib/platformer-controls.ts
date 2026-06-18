import {
  quatFromEulerYXZ,
  rotateVec3ByQuat,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

/** Frame-rate independent exponential approach toward `to` at `rate` per second. */
export function approach(
  from: number,
  to: number,
  rate: number,
  dt: number,
): number {
  return lerp(from, to, clamp01(rate * dt));
}

export function approachVec3(
  from: Vec3,
  to: Vec3,
  rate: number,
  dt: number,
): Vec3 {
  const alpha = clamp01(rate * dt);
  return [
    lerp(from[0], to[0], alpha),
    lerp(from[1], to[1], alpha),
    lerp(from[2], to[2], alpha),
  ];
}

export function lerpAngle(from: number, to: number, alpha: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * clamp01(alpha);
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function horizontalForwardFromYaw(yaw: number): Vec3 {
  return [-Math.sin(yaw), 0, -Math.cos(yaw)];
}

export function horizontalRightFromYaw(yaw: number): Vec3 {
  return [Math.cos(yaw), 0, -Math.sin(yaw)];
}

export function normalizedMoveAxis(
  moveX: number,
  moveY: number,
): readonly [number, number] {
  const length = Math.hypot(moveX, moveY);
  return length > 1 ? [moveX / length, moveY / length] : [moveX, moveY];
}

export interface MovementTargetInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly yaw: number;
  readonly speed: number;
}

/** Camera-relative ground velocity (source: input.rotated(UP, view.rotation.y)). */
export function movementTargetVelocity(input: MovementTargetInput): Vec3 {
  const forward = horizontalForwardFromYaw(input.yaw);
  const right = horizontalRightFromYaw(input.yaw);
  const [mx, my] = normalizedMoveAxis(input.moveX, input.moveY);
  return [
    (right[0] * mx + forward[0] * my) * input.speed,
    0,
    (right[2] * mx + forward[2] * my) * input.speed,
  ];
}

export interface SmoothedMovementInput extends MovementTargetInput {
  readonly currentVelocity: Vec3;
  readonly verticalVelocity: number;
  readonly dt: number;
  readonly lerpRate: number;
}

export interface SmoothedMovementStep {
  readonly velocity: Vec3;
  readonly translation: Vec3;
}

/** Lerp horizontal velocity toward the camera-relative target, integrate dt. */
export function smoothedMovementStep(
  input: SmoothedMovementInput,
): SmoothedMovementStep {
  const target = movementTargetVelocity(input);
  const alpha = clamp01(input.dt * input.lerpRate);
  const velocity: Vec3 = [
    lerp(input.currentVelocity[0], target[0], alpha),
    0,
    lerp(input.currentVelocity[2], target[2], alpha),
  ];
  return {
    velocity,
    translation: [
      velocity[0] * input.dt,
      input.verticalVelocity * input.dt,
      velocity[2] * input.dt,
    ],
  };
}

/** Integrated cosine hover (source coin/cloud: pos.y += cos(t·rate)·vel·dt). */
export function hoverOffset(
  time: number,
  rate: number,
  velocity: number,
): number {
  return Math.sin(time * rate) * (velocity / rate);
}

/** Orbit camera offset from the follow target: R_y(yaw)·R_x(pitch)·(0,0,zoom). */
export function cameraOffset(yaw: number, pitch: number, zoom: number): Vec3 {
  return rotateVec3ByQuat([0, 0, zoom], quatFromEulerYXZ(pitch, yaw, 0));
}

/** Source: rotation.y = Vector2(velocity.z, velocity.x).angle() = atan2(vx, vz). */
export function facingYawFromVelocity(vx: number, vz: number): number {
  return Math.atan2(vx, vz);
}

export function horizontalSpeed(velocity: Vec3): number {
  return Math.hypot(velocity[0], velocity[2]);
}

export function distanceXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
