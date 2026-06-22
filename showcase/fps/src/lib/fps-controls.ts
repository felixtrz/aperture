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

export interface SourceMovementTargetInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly yaw: number;
  readonly speed: number;
  readonly bodyKnockback?: number | undefined;
}

export interface SourceSmoothedMovementInput extends SourceMovementTargetInput {
  readonly currentVelocity: Vec3;
  readonly verticalVelocity: number;
  readonly dt: number;
  readonly lerpRate: number;
}

export interface SourceSmoothedMovementStep {
  readonly targetVelocity: Vec3;
  readonly velocity: Vec3;
  readonly translation: Vec3;
}

export interface WeaponViewmodelOffsetInput {
  readonly moveX: number;
  readonly moveY: number;
  readonly speed: number;
  readonly scale: number;
}

export interface SourceWeaponMuzzleLocalInput {
  readonly containerOffset: Vec3;
  readonly weaponMuzzlePosition: Vec3;
  readonly viewOffset?: Vec3 | undefined;
}

export interface SourceWeaponMuzzleWorldInput extends SourceWeaponMuzzleLocalInput {
  readonly playerEyePosition: Vec3;
  readonly yaw: number;
  readonly pitch: number;
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

export interface SourceShotDirectionInput {
  readonly yaw: number;
  readonly pitch: number;
  readonly maxDistance: number;
  readonly spreadOffsetX: number;
  readonly spreadOffsetY: number;
}

export interface SourceShotHitCandidate {
  readonly distance: number;
}

export interface SourceCloudHoverInput {
  readonly basePosition: Vec3;
  readonly hoverVelocity: number;
  readonly hoverRate: number;
  readonly time: number;
}

export interface SourceEnemyHoverInput {
  readonly basePosition: Vec3;
  readonly hoverVelocity: number;
  readonly hoverRate: number;
  readonly time: number;
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

export interface SourcePlayerRespawnInput {
  readonly positionY: number;
  readonly health: number;
}

export interface SourceLookStateInput {
  readonly yaw: number;
  readonly pitch: number;
  readonly targetYaw: number;
  readonly targetPitch: number;
}

export interface SourceControllerLookInput extends SourceLookStateInput {
  readonly axisX: number;
  readonly axisY: number;
  readonly sensitivity: number;
  readonly lerpRate: number;
  readonly dt: number;
  readonly pitchLimit: number;
}

export interface SourceMouseLookInput extends SourceLookStateInput {
  readonly axisX: number;
  readonly axisY: number;
  readonly radiansPerUnit: number;
  readonly pitchLimit: number;
}

export interface SourceLookStep {
  readonly yaw: number;
  readonly pitch: number;
  readonly targetYaw: number;
  readonly targetPitch: number;
}

export interface SourceButtonEdgeInput {
  readonly pressed: boolean;
  readonly down: boolean;
  readonly wasPressed: boolean;
}

export interface SourcePointerDragLookInput extends SourceLookStateInput {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly radiansPerUnit: number;
  readonly pitchLimit: number;
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
  const velocity = sourceMovementTargetVelocity(input);

  return [
    velocity[0] * input.dt,
    input.verticalVelocity * input.dt,
    velocity[2] * input.dt,
  ];
}

export function sourceMovementTargetVelocity(
  input: SourceMovementTargetInput,
): Vec3 {
  const forward = horizontalForwardFromYaw(input.yaw);
  const right = horizontalRightFromYaw(input.yaw);
  const backward = horizontalBackwardFromYaw(input.yaw);
  const movement = normalizedMoveAxis(input.moveX, input.moveY);
  const bodyKnockback = input.bodyKnockback ?? 0;

  return [
    (right[0] * movement[0] + forward[0] * movement[1]) * input.speed +
      backward[0] * bodyKnockback,
    0,
    (right[2] * movement[0] + forward[2] * movement[1]) * input.speed +
      backward[2] * bodyKnockback,
  ];
}

export function sourceSmoothedMovementStep(
  input: SourceSmoothedMovementInput,
): SourceSmoothedMovementStep {
  const targetVelocity = sourceMovementTargetVelocity(input);
  const alpha = clamp01(input.dt * input.lerpRate);
  const velocity: Vec3 = [
    lerpNumber(input.currentVelocity[0], targetVelocity[0], alpha),
    0,
    lerpNumber(input.currentVelocity[2], targetVelocity[2], alpha),
  ];

  return {
    targetVelocity,
    velocity,
    translation: [
      velocity[0] * input.dt,
      input.verticalVelocity * input.dt,
      velocity[2] * input.dt,
    ],
  };
}

function lerpNumber(from: number, to: number, alpha: number): number {
  return from + (to - from) * clamp01(alpha);
}

export function sourceControllerLookStep(
  input: SourceControllerLookInput,
): SourceLookStep {
  const [axisX, axisY] = normalizedMoveAxis(input.axisX, input.axisY);
  const targetYaw = input.targetYaw + axisX * input.sensitivity;
  const targetPitch = clampSourceLookPitch(
    input.targetPitch + axisY * input.sensitivity,
    input.pitchLimit,
  );
  const alpha = clamp01(input.dt * input.lerpRate);

  return {
    yaw: lerpAngle(input.yaw, targetYaw, alpha),
    pitch: lerpAngle(input.pitch, targetPitch, alpha),
    targetYaw,
    targetPitch,
  };
}

export function sourceMouseLookStep(
  input: SourceMouseLookInput,
): SourceLookStep {
  const targetYaw = input.targetYaw + input.axisX * input.radiansPerUnit;
  const targetPitch = clampSourceLookPitch(
    input.targetPitch + input.axisY * input.radiansPerUnit,
    input.pitchLimit,
  );

  return {
    yaw: targetYaw,
    pitch: targetPitch,
    targetYaw,
    targetPitch,
  };
}

export function sourcePointerDragLookStep(
  input: SourcePointerDragLookInput,
): SourceLookStep {
  return sourceMouseLookStep({
    yaw: input.yaw,
    pitch: input.pitch,
    targetYaw: input.targetYaw,
    targetPitch: input.targetPitch,
    axisX: -input.deltaX,
    axisY: -input.deltaY,
    radiansPerUnit: input.radiansPerUnit,
    pitchLimit: input.pitchLimit,
  });
}

export function sourceButtonPressedThisFrame(
  input: SourceButtonEdgeInput,
): boolean {
  return input.down || (input.pressed && !input.wasPressed);
}

export function clampSourceLookPitch(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

export function sourceShotDirection(input: SourceShotDirectionInput): Vec3 {
  return normalize3(
    rotateVec3ByQuat(
      [input.spreadOffsetX, input.spreadOffsetY, -input.maxDistance],
      quatFromEulerYXZ(input.pitch, input.yaw, 0),
    ),
  );
}

export function sourceNearestShotHit<THit extends SourceShotHitCandidate>(
  hits: readonly THit[],
): THit | null {
  let nearest: THit | null = null;
  for (const hit of hits) {
    if (!Number.isFinite(hit.distance) || hit.distance < 0) continue;
    if (nearest === null || hit.distance < nearest.distance) {
      nearest = hit;
    }
  }
  return nearest;
}

export function sourceCloudHoverPosition(input: SourceCloudHoverInput): Vec3 {
  return sourceIntegratedCosineHoverPosition(input);
}

export function sourceEnemyHoverPosition(input: SourceEnemyHoverInput): Vec3 {
  return sourceIntegratedCosineHoverPosition(input);
}

function sourceIntegratedCosineHoverPosition(input: {
  readonly basePosition: Vec3;
  readonly hoverVelocity: number;
  readonly hoverRate: number;
  readonly time: number;
}): Vec3 {
  const hoverOffset =
    Math.sin(input.time * input.hoverRate) *
    (input.hoverVelocity / input.hoverRate);
  return [
    input.basePosition[0],
    input.basePosition[1] + hoverOffset,
    input.basePosition[2],
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

export function sourceWeaponMuzzleLocalPosition(
  input: SourceWeaponMuzzleLocalInput,
): Vec3 {
  const viewOffset = input.viewOffset ?? [0, 0, 0];
  return [
    input.containerOffset[0] + viewOffset[0] - input.weaponMuzzlePosition[0],
    input.containerOffset[1] + viewOffset[1] - input.weaponMuzzlePosition[1],
    input.containerOffset[2] + viewOffset[2] - input.weaponMuzzlePosition[2],
  ];
}

export function sourceWeaponMuzzleWorldPosition(
  input: SourceWeaponMuzzleWorldInput,
): Vec3 {
  const local = sourceWeaponMuzzleLocalPosition(input);
  const rotated = rotateVec3ByQuat(
    local,
    quatFromEulerYXZ(input.pitch, input.yaw, 0),
  );
  return [
    input.playerEyePosition[0] + rotated[0],
    input.playerEyePosition[1] + rotated[1],
    input.playerEyePosition[2] + rotated[2],
  ];
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

export function sourceEnemyLookTarget(playerEyePosition: Vec3): Vec3 {
  return [
    playerEyePosition[0],
    playerEyePosition[1] - 0.5,
    playerEyePosition[2],
  ];
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

export function shouldConsumeBufferedShot(
  shootPressed: boolean,
  shootBufferTimer: number,
  shotCooldown: number,
): boolean {
  return (shootPressed || shootBufferTimer > 0) && shotCooldown <= 0;
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

export function sourcePlayerShouldRespawn(
  input: SourcePlayerRespawnInput,
): boolean {
  return input.positionY < -10 || input.health < 0;
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

function normalize3(value: Vec3): Vec3 {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= Number.EPSILON) return [0, 0, -1];
  return [value[0] / length, value[1] / length, value[2] / length];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerpAngle(from: number, to: number, alpha: number): number {
  const t = clamp01(alpha);
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * t;
}
