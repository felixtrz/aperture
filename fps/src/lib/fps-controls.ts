import {
  quatFromEulerYXZ,
  rotateVec3ByQuat,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";

export interface CameraRelativeMoveInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly yaw: number;
  readonly speed: number;
  readonly dt: number;
  readonly verticalVelocity: number;
}

export interface WeaponViewmodelOffsetInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly speed: number;
  readonly scale: number;
}

export interface EnemyLookAnglesInput {
  readonly enemy: Vec3;
  readonly player: Vec3;
  readonly targetYOffset: number;
}

export interface EnemyLookAngles {
  readonly pitch: number;
  readonly yaw: number;
}

export interface SourceEnemyAttackCandidate {
  readonly key: string;
  readonly position: Vec3;
  readonly alive: boolean;
  readonly hasLineOfSight: boolean;
}

export interface SourceEnemyAttackInput {
  readonly playerPosition: Vec3;
  readonly attackDistance: number;
  readonly enemies: readonly SourceEnemyAttackCandidate[];
}

export interface CharacterCollisionLike {
  readonly normal: readonly [number, number, number];
}

export interface SourceGroundedAfterMoveInput {
  readonly jumpedThisFrame: boolean;
  readonly verticalVelocity: number;
  readonly controllerGrounded: boolean;
}

export function cameraForwardFromYawPitch(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch);
  return [
    -cosPitch * Math.sin(yaw),
    Math.sin(pitch),
    -cosPitch * Math.cos(yaw),
  ];
}

export function horizontalForwardFromYaw(yaw: number): Vec3 {
  return [-Math.sin(yaw), 0, -Math.cos(yaw)];
}

export function horizontalRightFromYaw(yaw: number): Vec3 {
  return [Math.cos(yaw), 0, -Math.sin(yaw)];
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

export function weaponViewmodelOffsetTarget(
  input: WeaponViewmodelOffsetInput,
): Vec3 {
  const movement = normalizedMoveAxis(input.moveX, input.moveY);
  const x = -movement[0] * input.speed * input.scale;
  const z = movement[1] * input.speed * input.scale;
  return [x === 0 ? 0 : x, 0, z === 0 ? 0 : z];
}

export function enemyLookAngles(input: EnemyLookAnglesInput): EnemyLookAngles {
  const dx = input.player[0] - input.enemy[0];
  const dz = input.player[2] - input.enemy[2];
  const dy = input.player[1] + input.targetYOffset - input.enemy[1];
  const horizontalDistance = Math.hypot(dx, dz);

  return {
    yaw: Math.atan2(dx, dz),
    pitch:
      horizontalDistance <= Number.EPSILON
        ? verticalLookPitch(dy)
        : -Math.atan2(dy, horizontalDistance),
  };
}

export function sourceChildPositionFromLook(
  origin: Vec3,
  look: EnemyLookAngles,
  localOffset: Vec3,
): Vec3 {
  const rotatedOffset = rotateVec3ByQuat(
    localOffset,
    quatFromEulerYXZ(look.pitch, look.yaw, 0),
  );
  return [
    origin[0] + rotatedOffset[0],
    origin[1] + rotatedOffset[1],
    origin[2] + rotatedOffset[2],
  ];
}

export function snapToGroundDistanceForMove(
  configuredDistance: number,
  desiredVerticalTranslation: number,
): number {
  return desiredVerticalTranslation > 0 ? 0 : configuredDistance;
}

export function shouldConsumeBufferedJump(
  jumpBufferTimer: number,
  jumpsRemaining: number,
): boolean {
  return jumpBufferTimer > 0 && jumpsRemaining > 0;
}

export function hasCeilingCollision(
  collisions: readonly CharacterCollisionLike[],
): boolean {
  return collisions.some((collision) => collision.normal[1] < -0.5);
}

export function sourceGroundedAfterMove(
  input: SourceGroundedAfterMoveInput,
): boolean {
  return input.jumpedThisFrame || input.verticalVelocity > 0
    ? false
    : input.controllerGrounded;
}

export function sourceEnemyAttackers(
  input: SourceEnemyAttackInput,
): SourceEnemyAttackCandidate[] {
  return input.enemies.filter(
    (enemy) =>
      enemy.alive &&
      enemy.hasLineOfSight &&
      distance3(enemy.position, input.playerPosition) < input.attackDistance,
  );
}

function verticalLookPitch(dy: number): number {
  if (dy > 0) return -Math.PI / 2;
  if (dy < 0) return Math.PI / 2;
  return 0;
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
