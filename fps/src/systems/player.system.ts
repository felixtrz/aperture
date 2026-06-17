import {
  AppEntityKey,
  AudioSimulationSpace,
  Enabled,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  serializeEntityRef,
  type Entity,
  type InputAxis2dAction,
  type InputButtonAction,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import type {
  PhysicsCharacterControllerSettings,
  PhysicsRaycastHit,
} from "@aperture-engine/physics";
import { Collider } from "@aperture-engine/physics";
import { Sprite } from "@aperture-engine/render";
import {
  SOURCE_FOOTSTEP_GAIN,
  SOURCE_ONE_SHOT_GAIN,
  sourceEnemyDamageAudioEvents,
  sourceFootstepAudible,
  sourceOneShotTimeScale,
} from "../lib/fps-audio.js";
import {
  ENEMIES,
  ENEMY_HITBOX_OFFSET,
  ENEMY_MUZZLE_OFFSETS,
  GRAVITY,
  IMPACT_EFFECT_SLOT_COUNT,
  JUMP_STRENGTH,
  MAX_JUMPS,
  PLAYER_BODY_EYE_OFFSET,
  PLAYER_BODY_KEY,
  PLAYER_BODY_START,
  PLAYER_EYE_HEIGHT,
  PLAYER_SHADOW_KEY,
  PLAYER_SHADOW_SURFACE_OFFSET,
  PLAYER_SPEED,
  PLAYER_START,
  WEAPONS,
  enemyMuzzleEffectKey,
  impactEffectKey,
  type WeaponSpec,
} from "../lib/fps-data.js";
import {
  cameraForwardFromYawPitch,
  cameraRecoilVelocityFromYaw,
  cameraRelativeMovementDelta,
  enemyLookAngles,
  hasCeilingCollision,
  horizontalRightFromYaw,
  snapToGroundDistanceForMove,
  shouldConsumeBufferedJump,
  sourceChildPositionFromLook,
  sourceEnemyLookTarget,
  sourceEnemyAttackers,
  sourceGroundedAfterMove,
  sourceShotDirection,
  weaponViewmodelOffsetTarget,
  type SourceEnemyAttackCandidate,
} from "../lib/fps-controls.js";
import {
  FpsResource,
  createEnemyDestroyed,
  createEnemyHealth,
} from "../lib/fps-resource.js";
import {
  SOURCE_ENEMY_MUZZLE_RUNTIME_SCALE,
  sourceSpriteAlphaForFrame,
  sourceSpriteFrameForLife,
  type SpriteAnimationFrame,
  type SpriteUvRect,
} from "../lib/fps-effects.js";

const LOOK_SPEED = Math.PI;
const GAMEPAD_LOOK_SPEED = 2.5;
const ENEMY_HOVER_AMPLITUDE = 0.2;
const ENEMY_HOVER_RATE = 5;
const ENEMY_ATTACK_INTERVAL = 0.25;
const ENEMY_ATTACK_DISTANCE = 5;
const ENEMY_ATTACK_DAMAGE = 5;
const PLAYER_MUZZLE_ROLL_RANGE = Math.PI / 4;
const PLAYER_MUZZLE_MIN_SCALE = 0.4;
const PLAYER_MUZZLE_MAX_SCALE = 0.75;
const ENEMY_MUZZLE_ROLL_RANGE = Math.PI / 4;
const IMPACT_NORMAL_OFFSET = 0.1;
const SPRITE_ANIMATION_FPS = 30;
const PLAYER_CONTROLLER_SETTINGS: PhysicsCharacterControllerSettings = {
  offset: 0.02,
  slide: true,
  snapToGroundDistance: 0.18,
  maxSlopeClimbAngle: Math.PI / 4,
  minSlopeSlideAngle: Math.PI / 3,
  autostep: {
    maxHeight: 0.35,
    minWidth: 0.2,
  },
};
const PLAYER_ASCENDING_CONTROLLER_SETTINGS: PhysicsCharacterControllerSettings =
  {
    ...PLAYER_CONTROLLER_SETTINGS,
    snapToGroundDistance: 0,
  };
const MUZZLE_FLASH_FRAMES: readonly SpriteAnimationFrame[] = [
  [0, 0, 0.5, 1],
  [0.5, 0, 0.5, 1],
  null,
];
const IMPACT_FLASH_FRAMES: readonly SpriteAnimationFrame[] = [
  [0, 0, 0.5, 0.5],
  [0.5, 0, 0.5, 0.5],
  [0, 0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5, 0.5],
];
const MUZZLE_FLASH_DURATION = MUZZLE_FLASH_FRAMES.length / SPRITE_ANIMATION_FPS;
const IMPACT_FLASH_DURATION = IMPACT_FLASH_FRAMES.length / SPRITE_ANIMATION_FPS;
const HIDDEN_EFFECT_POSITION: Vec3 = [0, -100, 0];
const HIDDEN_WEAPON_Y = -100;
const ENEMY_MUZZLE_FLASH_SLOT_COUNT =
  ENEMIES.length * ENEMY_MUZZLE_OFFSETS.length;
const WEAPON_SWITCH_HIDE_DURATION = 0.1;
const WEAPON_SWITCH_DROP_OFFSET = 1;
const WEAPON_SWITCH_RAISE_RATE = 10;
const WEAPON_SWITCH_COMPLETE_EPSILON = 0.01;
const WEAPON_VIEWMODEL_MOVE_SCALE = 1 / 30;
const WEAPON_VIEWMODEL_LERP_RATE = 10;
const WEAPON_VIEWMODEL_SHOT_KICK = 0.25;
const LANDING_CAMERA_BOB_OFFSET = -0.1;
const LANDING_CAMERA_BOB_RECOVERY_RATE = 5;
const WEAPON_RECOIL_IMPULSE_SCALE = 0.12;
const WEAPON_RECOIL_RECOVERY_RATE = 12;
const WEAPON_RECOIL_EPSILON = 0.001;
const JUMP_BUFFER_DURATION = 0.12;

interface ShotEnemyHit {
  readonly key: string;
  readonly point: Vec3;
  readonly distance: number;
}

export default class PlayerSystem extends createSystem({
  priority: 20,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  #previousPointer: readonly [number, number] | null = null;
  #enemyTime = 0;
  #enemyAttackTimer = 0;
  #muzzleFlashTimer = 0;
  #muzzleFlashPosition: Vec3 = HIDDEN_EFFECT_POSITION;
  #muzzleFlashRoll = 0;
  #muzzleFlashScale = PLAYER_MUZZLE_MIN_SCALE;
  #impactFlashTimers = createNumberSlots(IMPACT_EFFECT_SLOT_COUNT);
  #impactFlashPositions = createPositionSlots(IMPACT_EFFECT_SLOT_COUNT);
  #enemyMuzzleFlashTimers = createEnemyMuzzleNumberSlots();
  #enemyMuzzleFlashPositions = createEnemyMuzzlePositionSlots();
  #enemyMuzzleFlashRolls = createEnemyMuzzleNumberSlots();
  #damagePulse = 0;
  #weaponVisualIndex = 0;
  #weaponSwitchTargetIndex = 0;
  #weaponSwitchTimer = 0;
  #weaponSwitchRaiseOffset = 0;
  #weaponSwitchActive = false;
  #weaponViewOffset: Vec3 = [0, 0, 0];
  #landingBobOffset = 0;
  #landingPulse = 0;
  #weaponRecoilVelocity: Vec3 = [0, 0, 0];
  #jumpBufferTimer = 0;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#muzzleFlashTimer = Math.max(0, this.#muzzleFlashTimer - dt);
    for (let i = 0; i < this.#impactFlashTimers.length; i += 1) {
      const timer = this.#impactFlashTimers[i] ?? 0;
      this.#impactFlashTimers[i] = Math.max(0, timer - dt);
    }
    this.#jumpBufferTimer = Math.max(0, this.#jumpBufferTimer - dt);
    for (let i = 0; i < this.#enemyMuzzleFlashTimers.length; i += 1) {
      const timer = this.#enemyMuzzleFlashTimers[i] ?? 0;
      this.#enemyMuzzleFlashTimers[i] = Math.max(0, timer - dt);
    }
    this.#landingBobOffset = lerpNumber(
      this.#landingBobOffset,
      0,
      Math.min(1, dt * LANDING_CAMERA_BOB_RECOVERY_RATE),
    );

    const state = this.resources.read(FpsResource);

    let position: Vec3 = [...state.playerPosition];
    let yaw = state.yaw;
    let pitch = state.pitch;
    let verticalVelocity = state.verticalVelocity;
    let jumpsRemaining = state.jumpsRemaining;
    let grounded = state.grounded;
    let health = state.health;
    let weaponIndex = clampInt(state.weaponIndex, 0, WEAPONS.length - 1);
    let shotCooldown = Math.max(0, state.shotCooldown - dt);
    let shotsFired = state.shotsFired;
    let hits = state.hits;
    let enemyHealth = { ...state.enemyHealth };
    let enemyDestroyed = { ...state.enemyDestroyed };
    let enemyDestroyedPulse = state.enemyDestroyedPulse;
    let lastDestroyedEnemy = state.lastDestroyedEnemy;
    let skipPhysicsMove = false;
    let jumpedThisFrame = false;
    let footstepVelocityX = 0;
    let footstepVelocityZ = 0;

    if (this.#button("reset")?.down()) {
      position = [...PLAYER_START];
      yaw = 0;
      pitch = 0;
      verticalVelocity = 0;
      jumpsRemaining = MAX_JUMPS;
      grounded = true;
      health = 100;
      weaponIndex = 0;
      shotCooldown = 0;
      shotsFired = 0;
      hits = 0;
      enemyHealth = createEnemyHealth();
      enemyDestroyed = createEnemyDestroyed();
      enemyDestroyedPulse = 0;
      lastDestroyedEnemy = "";
      skipPhysicsMove = true;
      this.#resetTransientGameplayState();
      this.#damagePulse = 0;
      this.#writePlayerBody(PLAYER_BODY_START);
    }

    const lookAction = this.actions.look as InputAxis2dAction | undefined;
    if (lookAction?.kind === "axis2d") {
      yaw += lookAction.x.value * GAMEPAD_LOOK_SPEED * dt;
      pitch = clampPitch(pitch + lookAction.y.value * GAMEPAD_LOOK_SPEED * dt);
    }

    const pointer = this.input.pointer.primary;
    const pointerPosition = pointer.position.value;
    if (pointer.pressed.value) {
      if (this.#previousPointer !== null) {
        const dx = pointerPosition[0] - this.#previousPointer[0];
        const dy = pointerPosition[1] - this.#previousPointer[1];
        yaw += dx * LOOK_SPEED;
        pitch = clampPitch(pitch - dy * LOOK_SPEED);
      }
      this.#previousPointer = [pointerPosition[0], pointerPosition[1]];
    } else {
      this.#previousPointer = null;
    }

    const move = this.actions.move as InputAxis2dAction | undefined;
    const moveX = move?.kind === "axis2d" ? move.x.value : 0;
    const moveZ = move?.kind === "axis2d" ? move.y.value : 0;

    if (this.#button("jump")?.down()) {
      this.#jumpBufferTimer = JUMP_BUFFER_DURATION;
    }

    if (shouldConsumeBufferedJump(this.#jumpBufferTimer, jumpsRemaining)) {
      this.#playJumpSound();
      verticalVelocity = JUMP_STRENGTH;
      jumpsRemaining -= 1;
      grounded = false;
      jumpedThisFrame = true;
      this.#jumpBufferTimer = 0;
    }

    verticalVelocity -= GRAVITY * dt;
    const desiredTranslation = cameraRelativeMovementDelta({
      moveX,
      moveY: moveZ,
      yaw,
      speed: PLAYER_SPEED,
      dt,
      verticalVelocity,
    });
    desiredTranslation[0] += this.#weaponRecoilVelocity[0] * dt;
    desiredTranslation[2] += this.#weaponRecoilVelocity[2] * dt;
    this.#recoverWeaponRecoil(dt);

    const wasGrounded = grounded;
    const previousPosition: Vec3 = [...position];
    const playerMove = skipPhysicsMove
      ? {
          position,
          grounded,
          blockedUpward: false,
        }
      : this.#movePlayerBody(position, desiredTranslation, grounded);
    position = playerMove.position;
    if (dt > Number.EPSILON) {
      footstepVelocityX = (position[0] - previousPosition[0]) / dt;
      footstepVelocityZ = (position[2] - previousPosition[2]) / dt;
    }
    grounded = sourceGroundedAfterMove({
      jumpedThisFrame,
      verticalVelocity,
      controllerGrounded: playerMove.grounded,
    });

    if (grounded) {
      if (!wasGrounded && verticalVelocity < -1) {
        this.#playOneShot("land");
        this.#triggerLandingBob();
      }
      verticalVelocity = 0;
      jumpsRemaining = MAX_JUMPS;
    } else if (playerMove.blockedUpward && verticalVelocity > 0) {
      verticalVelocity = 0;
    }

    if (
      !jumpedThisFrame &&
      shouldConsumeBufferedJump(this.#jumpBufferTimer, jumpsRemaining)
    ) {
      this.#playJumpSound();
      verticalVelocity = JUMP_STRENGTH;
      jumpsRemaining -= 1;
      grounded = false;
      jumpedThisFrame = true;
      this.#jumpBufferTimer = 0;
    }

    if (position[1] < -10 || health < 0) {
      position = [...PLAYER_START];
      yaw = 0;
      pitch = 0;
      verticalVelocity = 0;
      jumpsRemaining = MAX_JUMPS;
      grounded = true;
      health = 100;
      enemyHealth = createEnemyHealth();
      enemyDestroyed = createEnemyDestroyed();
      enemyDestroyedPulse = 0;
      lastDestroyedEnemy = "";
      this.#resetTransientGameplayState();
      this.#damagePulse = 0;
      this.#writePlayerBody(PLAYER_BODY_START);
      footstepVelocityX = 0;
      footstepVelocityZ = 0;
    }

    if (this.#button("switchWeapon")?.down()) {
      const nextWeaponIndex = (weaponIndex + 1) % WEAPONS.length;
      if (this.#startWeaponSwitch(weaponIndex, nextWeaponIndex)) {
        shotCooldown = 0;
        this.#playOneShot("weapon-change");
      }
    }

    weaponIndex = this.#advanceWeaponSwitch(weaponIndex, dt);
    const weapon = WEAPONS[weaponIndex] ?? WEAPONS[0]!;
    const didShoot =
      this.#button("shoot")?.pressed() === true && shotCooldown <= 0;
    if (didShoot) {
      shotCooldown = weapon.cooldown;
      shotsFired += 1;
      this.#playOneShot(weapon.soundId);
      const shot = this.#shoot(position, yaw, pitch, weapon, enemyHealth);
      enemyHealth = shot.enemyHealth;
      hits += shot.hits;
      if (shot.destroyedEnemies.length > 0) {
        enemyDestroyed = { ...enemyDestroyed };
        for (const key of shot.destroyedEnemies) {
          enemyDestroyed[key] = true;
          lastDestroyedEnemy = key;
        }
        enemyDestroyedPulse += shot.destroyedEnemies.length;
      }
      this.#triggerMuzzleFlash(position, yaw, pitch, weapon);
      this.#triggerImpactFlashes(shot.impacts);
      const kick = randomWeaponKick(weapon);
      pitch = clampPitch(pitch + kick.pitch);
      yaw += kick.yaw;
      this.#addWeaponRecoil(yaw, weapon);
      this.#weaponViewOffset[2] += WEAPON_VIEWMODEL_SHOT_KICK;
    }

    this.#updateWeaponViewOffset(moveX, moveZ, dt);
    this.#enemyTime += dt;
    this.#enemyAttackTimer += dt;
    if (this.#enemyAttackTimer >= ENEMY_ATTACK_INTERVAL) {
      this.#enemyAttackTimer = 0;
      for (const attacker of this.#livingEnemyAttackers(
        position,
        enemyHealth,
      )) {
        health -= ENEMY_ATTACK_DAMAGE;
        this.#damagePulse += 1;
        this.#triggerEnemyMuzzleFlashes(
          attacker.key,
          attacker.position,
          position,
        );
        this.#playOneShot("enemy-attack");
      }
    }

    this.#writeCamera(position, yaw, pitch, this.#landingBobOffset);
    this.#writePlayerShadow(position);
    this.#writeWeapons(weaponIndex, moveX, moveZ);
    this.#writeShotEffects();
    this.#writeEnemies(position, enemyHealth);
    const enemiesRemaining = countLivingEnemies(enemyHealth);
    const destroyedEnemies = countDestroyedEnemies(enemyDestroyed);
    const gameStatus = enemiesRemaining === 0 ? "cleared" : "active";
    this.#writeSignals({
      health,
      weaponIndex,
      weapon,
      enemiesRemaining,
      destroyedEnemies,
      enemyDestroyedPulse,
      lastDestroyedEnemy,
      shotsFired,
      hits,
      grounded,
      position,
      damagePulse: this.#damagePulse,
      gameStatus,
    });
    this.#updateFootsteps(grounded, footstepVelocityX, footstepVelocityZ);

    this.resources.write(FpsResource, (next) => {
      next.playerPosition = position;
      next.yaw = yaw;
      next.pitch = pitch;
      next.verticalVelocity = verticalVelocity;
      next.jumpsRemaining = jumpsRemaining;
      next.grounded = grounded;
      next.health = health;
      next.weaponIndex = weaponIndex;
      next.weaponVisualIndex = this.#weaponVisualIndex;
      next.weaponSwitchProgress = this.#weaponSwitchProgress();
      next.weaponSwitchPhase = this.#weaponSwitchPhase();
      next.landingBob = this.#landingBobOffset;
      next.landingPulse = this.#landingPulse;
      next.shotCooldown = shotCooldown;
      next.shotsFired = shotsFired;
      next.hits = hits;
      next.enemyHealth = enemyHealth;
      next.enemyDestroyed = enemyDestroyed;
      next.enemiesRemaining = enemiesRemaining;
      next.destroyedEnemies = destroyedEnemies;
      next.enemyDestroyedPulse = enemyDestroyedPulse;
      next.lastDestroyedEnemy = lastDestroyedEnemy;
      next.gameStatus = gameStatus;
    });
  }

  #shoot(
    position: Vec3,
    yaw: number,
    pitch: number,
    weapon: WeaponSpec,
    enemyHealth: Record<string, number>,
  ): {
    readonly enemyHealth: Record<string, number>;
    readonly hits: number;
    readonly impacts: readonly Vec3[];
    readonly destroyedEnemies: readonly string[];
  } {
    let hitCount = 0;
    let nextHealth = enemyHealth;
    const destroyedEnemies: string[] = [];
    const impacts: Vec3[] = [];

    for (let i = 0; i < weapon.shotCount; i += 1) {
      const direction = spreadDirection(yaw, pitch, weapon);
      const rayHits = this.physics.raycastAll(
        {
          origin: position,
          direction,
          maxDistance: weapon.maxDistance,
        },
        this.#queryExcluding(PLAYER_BODY_KEY),
      );
      const nearestRayHit = nearestPhysicsHit(rayHits);
      if (nearestRayHit !== null) {
        impacts.push(
          offsetImpactPoint(
            cloneVec3(nearestRayHit.point),
            cloneVec3(nearestRayHit.normal),
          ),
        );
      }
      const hit = this.#firstShotEnemyHit(rayHits, nextHealth);

      if (hit === null) {
        continue;
      }

      nextHealth = { ...nextHealth };
      const current = nextHealth[hit.key] ?? 0;
      const remaining = Math.max(0, current - weapon.damage);
      nextHealth[hit.key] = remaining;
      hitCount += 1;
      if (remaining === 0 && current > 0) {
        destroyedEnemies.push(hit.key);
      }
      for (const clipId of sourceEnemyDamageAudioEvents({
        currentHealth: current,
        damage: weapon.damage,
      })) {
        this.#playOneShot(clipId);
      }
    }

    return {
      enemyHealth: nextHealth,
      hits: hitCount,
      impacts,
      destroyedEnemies,
    };
  }

  #movePlayerBody(
    position: Vec3,
    desiredTranslation: Vec3,
    fallbackGrounded: boolean,
  ): {
    readonly position: Vec3;
    readonly grounded: boolean;
    readonly blockedUpward: boolean;
  } {
    const body = this.#findByKey(PLAYER_BODY_KEY);
    if (body === null) {
      return { position, grounded: fallbackGrounded, blockedUpward: false };
    }

    const move = this.physics.moveCharacter({
      entity: serializeEntityRef(body),
      desiredTranslation,
      settings:
        snapToGroundDistanceForMove(
          PLAYER_CONTROLLER_SETTINGS.snapToGroundDistance ?? 0,
          desiredTranslation[1],
        ) === 0
          ? PLAYER_ASCENDING_CONTROLLER_SETTINGS
          : PLAYER_CONTROLLER_SETTINGS,
    });

    if (move === null) {
      return { position, grounded: fallbackGrounded, blockedUpward: false };
    }

    const target = cloneVec3(move.targetTranslation);
    this.#writePlayerBody(target);

    return {
      position: bodyToEye(target),
      grounded: move.grounded,
      blockedUpward:
        desiredTranslation[1] > 0 && hasCeilingCollision(move.collisions),
    };
  }

  #firstShotEnemyHit(
    hits: readonly PhysicsRaycastHit[],
    enemyHealth: Record<string, number>,
  ): ShotEnemyHit | null {
    for (const hit of hits) {
      const enemyKey = this.#enemyKeyForHit(hit, enemyHealth);
      if (enemyKey !== null) {
        return {
          key: enemyKey,
          point: cloneVec3(hit.point),
          distance: hit.distance,
        };
      }
      return null;
    }
    return null;
  }

  #enemyKeyForHit(
    hit: PhysicsRaycastHit,
    enemyHealth: Record<string, number>,
  ): string | null {
    for (const enemy of ENEMIES) {
      if ((enemyHealth[enemy.key] ?? 0) <= 0) continue;
      const enemyRef = this.#entityRefForKey(`${enemy.key}.hitbox`);
      if (
        enemyRef !== null &&
        (hit.entity === enemyRef || hit.collider === enemyRef)
      ) {
        return enemy.key;
      }
    }
    return null;
  }

  #enemyHasLineOfSight(
    enemyKey: string,
    enemyPosition: Vec3,
    playerTargetPosition: Vec3,
  ): boolean {
    const playerRef = this.#entityRefForKey(PLAYER_BODY_KEY);
    if (playerRef === null) return false;

    const toPlayer = subtractVec3(playerTargetPosition, enemyPosition);
    const maxDistance = Math.hypot(toPlayer[0], toPlayer[1], toPlayer[2]);
    if (maxDistance <= Number.EPSILON) return true;

    const hit = this.physics.raycastFirst(
      {
        origin: enemyPosition,
        direction: [
          toPlayer[0] / maxDistance,
          toPlayer[1] / maxDistance,
          toPlayer[2] / maxDistance,
        ],
        maxDistance: maxDistance + 0.5,
      },
      this.#queryExcluding(`${enemyKey}.hitbox`),
    );

    return (
      hit !== null && (hit.entity === playerRef || hit.collider === playerRef)
    );
  }

  #writeCamera(
    position: Vec3,
    yaw: number,
    pitch: number,
    landingBobOffset: number,
  ): void {
    const camera = this.#findByKey("camera.main");
    if (camera === null) return;
    camera
      .getVectorView(LocalTransform, "translation")
      .set([position[0], position[1] + landingBobOffset, position[2]]);
    camera
      .getVectorView(LocalTransform, "rotation")
      .set(quatFromEulerYXZ(pitch, yaw, 0));
  }

  #writePlayerShadow(position: Vec3): void {
    const shadow = this.#findByKey(PLAYER_SHADOW_KEY);
    if (shadow === null) return;

    shadow
      .getVectorView(LocalTransform, "translation")
      .set([
        position[0],
        position[1] - PLAYER_EYE_HEIGHT + PLAYER_SHADOW_SURFACE_OFFSET,
        position[2],
      ]);
  }

  #writeWeapons(weaponIndex: number, moveX: number, moveZ: number): void {
    const walkBob =
      Math.sin(this.#enemyTime * 10) * 0.025 * Math.hypot(moveX, moveZ);

    for (let i = 0; i < WEAPONS.length; i += 1) {
      const entity = this.#findByKey(`weapon.${i}`);
      const spec = WEAPONS[i];
      if (entity === null || spec === undefined) continue;
      const translation = entity.getVectorView(LocalTransform, "translation");
      if (i === weaponIndex) {
        const switchOffset = this.#weaponSwitchYOffset(i);
        translation.set([
          spec.position[0] + this.#weaponViewOffset[0],
          spec.position[1] + this.#weaponViewOffset[1] + walkBob - switchOffset,
          spec.position[2] + this.#weaponViewOffset[2],
        ]);
      } else {
        translation.set([spec.position[0], HIDDEN_WEAPON_Y, 0]);
      }
    }
  }

  #triggerMuzzleFlash(
    position: Vec3,
    yaw: number,
    pitch: number,
    weapon: WeaponSpec,
  ): void {
    this.#muzzleFlashPosition = weaponMuzzlePosition(
      position,
      yaw,
      pitch,
      weapon,
    );
    this.#muzzleFlashRoll = randomBetween(
      -PLAYER_MUZZLE_ROLL_RANGE,
      PLAYER_MUZZLE_ROLL_RANGE,
    );
    this.#muzzleFlashScale = randomBetween(
      PLAYER_MUZZLE_MIN_SCALE,
      PLAYER_MUZZLE_MAX_SCALE,
    );
    this.#muzzleFlashTimer = MUZZLE_FLASH_DURATION;
  }

  #triggerImpactFlashes(positions: readonly Vec3[]): void {
    const count = Math.min(positions.length, IMPACT_EFFECT_SLOT_COUNT);
    for (let i = 0; i < count; i += 1) {
      this.#impactFlashPositions[i] = positions[i] ?? HIDDEN_EFFECT_POSITION;
      this.#impactFlashTimers[i] = IMPACT_FLASH_DURATION;
    }
  }

  #writeShotEffects(): void {
    this.#writeEffectSprite(
      "effect.muzzle-burst",
      this.#muzzleFlashPosition,
      this.#muzzleFlashTimer / MUZZLE_FLASH_DURATION,
      this.#muzzleFlashScale,
      MUZZLE_FLASH_FRAMES,
      this.#muzzleFlashRoll,
    );
    for (let index = 0; index < IMPACT_EFFECT_SLOT_COUNT; index += 1) {
      this.#writeEffectSprite(
        impactEffectKey(index),
        this.#impactFlashPositions[index] ?? HIDDEN_EFFECT_POSITION,
        (this.#impactFlashTimers[index] ?? 0) / IMPACT_FLASH_DURATION,
        1,
        IMPACT_FLASH_FRAMES,
      );
    }
    for (const [enemyIndex, enemy] of ENEMIES.entries()) {
      for (
        let muzzleIndex = 0;
        muzzleIndex < ENEMY_MUZZLE_OFFSETS.length;
        muzzleIndex += 1
      ) {
        const slot = enemyMuzzleSlotIndex(enemyIndex, muzzleIndex);
        this.#writeEffectSprite(
          enemyMuzzleEffectKey(enemy.key, muzzleIndex),
          this.#enemyMuzzleFlashPositions[slot] ?? HIDDEN_EFFECT_POSITION,
          (this.#enemyMuzzleFlashTimers[slot] ?? 0) / MUZZLE_FLASH_DURATION,
          SOURCE_ENEMY_MUZZLE_RUNTIME_SCALE,
          MUZZLE_FLASH_FRAMES,
          this.#enemyMuzzleFlashRolls[slot] ?? 0,
        );
      }
    }
  }

  #writeEffectSprite(
    key: string,
    position: Vec3,
    normalizedLife: number,
    scale: number,
    frames: readonly SpriteAnimationFrame[],
    rotation = 0,
  ): void {
    const entity = this.#findByKey(key);
    if (entity === null) return;

    const frame = sourceSpriteFrameForLife(frames, normalizedLife);
    const alpha = sourceSpriteAlphaForFrame(frame);
    entity
      .getVectorView(LocalTransform, "translation")
      .set(alpha > 0 ? position : HIDDEN_EFFECT_POSITION);
    entity.getVectorView(LocalTransform, "scale").set([scale, scale, scale]);

    if (entity.hasComponent(Sprite)) {
      entity.getVectorView(Sprite, "color").set([1, 1, 1, alpha]);
      entity.getVectorView(Sprite, "uvRect").set(frame.uvRect);
      entity.setValue(Sprite, "atlasFrame", frame.atlasFrame);
      entity.setValue(Sprite, "rotation", rotation);
    }
  }

  #writeEnemies(
    playerPosition: Vec3,
    enemyHealth: Record<string, number>,
  ): void {
    const target = sourceEnemyLookTarget(playerPosition);

    for (const enemy of ENEMIES) {
      const alive = (enemyHealth[enemy.key] ?? 0) > 0;
      const position = alive
        ? enemyPosition(enemy.position, this.#enemyTime)
        : ([enemy.position[0], -100, enemy.position[2]] as Vec3);
      const look = enemyLookAngles({
        enemy: position,
        player: target,
        targetYOffset: 0,
      });

      for (const key of [enemy.key, `${enemy.key}.hitbox`]) {
        const entity = this.#findByKey(key);
        if (entity === null) continue;
        this.#setEnabled(entity, alive);
        entity
          .getVectorView(LocalTransform, "translation")
          .set(
            key.endsWith(".hitbox")
              ? addVec3(position, ENEMY_HITBOX_OFFSET)
              : position,
          );
        entity
          .getVectorView(LocalTransform, "rotation")
          .set(quatFromEulerYXZ(look.pitch, look.yaw, 0));
        if (key.endsWith(".hitbox") && entity.hasComponent(Collider)) {
          entity.setValue(Collider, "enabled", alive);
        }
      }
    }
  }

  #writeSignals(input: {
    readonly health: number;
    readonly weaponIndex: number;
    readonly weapon: WeaponSpec;
    readonly enemiesRemaining: number;
    readonly destroyedEnemies: number;
    readonly enemyDestroyedPulse: number;
    readonly lastDestroyedEnemy: string;
    readonly shotsFired: number;
    readonly hits: number;
    readonly grounded: boolean;
    readonly position: Vec3;
    readonly damagePulse: number;
    readonly gameStatus: "active" | "cleared";
  }): void {
    setSignal(this.signals.health, Math.round(input.health));
    setSignal(this.signals.weaponIndex, input.weaponIndex);
    setSignal(this.signals.weaponName, input.weapon.name);
    setSignal(this.signals.crosshair, input.weapon.crosshairUrl);
    setSignal(this.signals.enemiesRemaining, input.enemiesRemaining);
    setSignal(this.signals.destroyedEnemies, input.destroyedEnemies);
    setSignal(this.signals.enemyDestroyedPulse, input.enemyDestroyedPulse);
    setSignal(this.signals.lastDestroyedEnemy, input.lastDestroyedEnemy);
    setSignal(this.signals.gameStatus, input.gameStatus);
    setSignal(this.signals.shotsFired, input.shotsFired);
    setSignal(this.signals.hits, input.hits);
    setSignal(this.signals.grounded, input.grounded);
    setSignal(this.signals.damagePulse, input.damagePulse);
    setSignal(this.signals.playerX, Number(input.position[0].toFixed(2)));
    setSignal(this.signals.playerY, Number(input.position[1].toFixed(2)));
    setSignal(this.signals.playerZ, Number(input.position[2].toFixed(2)));
    setSignal(this.signals.lastShotFrame, input.shotsFired);
  }

  #triggerEnemyMuzzleFlashes(
    enemyKey: string,
    enemyPosition: Vec3,
    playerPosition: Vec3,
  ): void {
    const enemyIndex = ENEMIES.findIndex((enemy) => enemy.key === enemyKey);
    if (enemyIndex < 0) return;

    const target = sourceEnemyLookTarget(playerPosition);
    const look = enemyLookAngles({
      enemy: enemyPosition,
      player: target,
      targetYOffset: 0,
    });
    for (let i = 0; i < ENEMY_MUZZLE_OFFSETS.length; i += 1) {
      const slot = enemyMuzzleSlotIndex(enemyIndex, i);
      this.#enemyMuzzleFlashPositions[slot] = sourceChildPositionFromLook(
        enemyPosition,
        look,
        ENEMY_MUZZLE_OFFSETS[i]!,
      );
      this.#enemyMuzzleFlashRolls[slot] = randomBetween(
        -ENEMY_MUZZLE_ROLL_RANGE,
        ENEMY_MUZZLE_ROLL_RANGE,
      );
      this.#enemyMuzzleFlashTimers[slot] = MUZZLE_FLASH_DURATION;
    }
  }

  #clearEnemyMuzzleFlashes(): void {
    this.#enemyMuzzleFlashTimers = createEnemyMuzzleNumberSlots();
    this.#enemyMuzzleFlashPositions = createEnemyMuzzlePositionSlots();
    this.#enemyMuzzleFlashRolls = createEnemyMuzzleNumberSlots();
  }

  #resetTransientGameplayState(): void {
    this.#enemyTime = 0;
    this.#enemyAttackTimer = 0;
    this.#muzzleFlashTimer = 0;
    this.#muzzleFlashPosition = HIDDEN_EFFECT_POSITION;
    this.#muzzleFlashRoll = 0;
    this.#muzzleFlashScale = PLAYER_MUZZLE_MIN_SCALE;
    this.#impactFlashTimers = createNumberSlots(IMPACT_EFFECT_SLOT_COUNT);
    this.#impactFlashPositions = createPositionSlots(IMPACT_EFFECT_SLOT_COUNT);
    this.#clearEnemyMuzzleFlashes();
    this.#resetWeaponSwitch();
    this.#weaponViewOffset = [0, 0, 0];
    this.#landingBobOffset = 0;
    this.#landingPulse = 0;
    this.#weaponRecoilVelocity = [0, 0, 0];
    this.#jumpBufferTimer = 0;
  }

  #addWeaponRecoil(yaw: number, weapon: WeaponSpec): void {
    const recoil = cameraRecoilVelocityFromYaw(
      yaw,
      weapon.knockback,
      WEAPON_RECOIL_IMPULSE_SCALE,
    );
    this.#weaponRecoilVelocity = [
      this.#weaponRecoilVelocity[0] + recoil[0],
      0,
      this.#weaponRecoilVelocity[2] + recoil[2],
    ];
  }

  #recoverWeaponRecoil(dt: number): void {
    const retain = Math.max(0, 1 - dt * WEAPON_RECOIL_RECOVERY_RATE);
    const nextX = this.#weaponRecoilVelocity[0] * retain;
    const nextZ = this.#weaponRecoilVelocity[2] * retain;
    this.#weaponRecoilVelocity =
      Math.hypot(nextX, nextZ) <= WEAPON_RECOIL_EPSILON
        ? [0, 0, 0]
        : [nextX, 0, nextZ];
  }

  #updateWeaponViewOffset(moveX: number, moveZ: number, dt: number): void {
    const target = weaponViewmodelOffsetTarget({
      moveX,
      moveY: moveZ,
      speed: PLAYER_SPEED,
      scale: WEAPON_VIEWMODEL_MOVE_SCALE,
    });
    const alpha = Math.min(1, dt * WEAPON_VIEWMODEL_LERP_RATE);
    this.#weaponViewOffset = [
      lerpNumber(this.#weaponViewOffset[0], target[0], alpha),
      lerpNumber(this.#weaponViewOffset[1], target[1], alpha),
      lerpNumber(this.#weaponViewOffset[2], target[2], alpha),
    ];
  }

  #triggerLandingBob(): void {
    this.#landingBobOffset = LANDING_CAMERA_BOB_OFFSET;
    this.#landingPulse += 1;
  }

  #startWeaponSwitch(currentIndex: number, targetIndex: number): boolean {
    if (
      this.#weaponSwitchActive ||
      targetIndex === currentIndex ||
      WEAPONS.length <= 1
    ) {
      return false;
    }

    this.#weaponVisualIndex = currentIndex;
    this.#weaponSwitchTargetIndex = targetIndex;
    this.#weaponSwitchTimer = 0;
    this.#weaponSwitchRaiseOffset = 0;
    this.#weaponSwitchActive = true;
    return true;
  }

  #advanceWeaponSwitch(activeIndex: number, dt: number): number {
    if (!this.#weaponSwitchActive) {
      this.#weaponVisualIndex = activeIndex;
      this.#weaponSwitchTargetIndex = activeIndex;
      this.#weaponSwitchTimer = 0;
      this.#weaponSwitchRaiseOffset = 0;
      return activeIndex;
    }

    this.#weaponSwitchTimer += dt;

    if (
      this.#weaponVisualIndex !== this.#weaponSwitchTargetIndex &&
      this.#weaponSwitchTimer >= WEAPON_SWITCH_HIDE_DURATION
    ) {
      this.#weaponVisualIndex = this.#weaponSwitchTargetIndex;
      this.#weaponSwitchRaiseOffset = WEAPON_SWITCH_DROP_OFFSET;
    }

    if (this.#weaponVisualIndex !== this.#weaponSwitchTargetIndex) {
      return this.#weaponVisualIndex;
    }

    const decay = Math.min(1, dt * WEAPON_SWITCH_RAISE_RATE);
    this.#weaponSwitchRaiseOffset *= 1 - decay;

    if (this.#weaponSwitchRaiseOffset <= WEAPON_SWITCH_COMPLETE_EPSILON) {
      this.#weaponSwitchRaiseOffset = 0;
      this.#weaponSwitchActive = false;
      this.#weaponSwitchTimer = 0;
    }

    return this.#weaponVisualIndex;
  }

  #weaponSwitchYOffset(index: number): number {
    if (!this.#weaponSwitchActive) return 0;

    if (this.#weaponVisualIndex !== this.#weaponSwitchTargetIndex) {
      if (index !== this.#weaponVisualIndex) return 0;
      return (
        WEAPON_SWITCH_DROP_OFFSET *
        smoothstep(
          Math.min(1, this.#weaponSwitchTimer / WEAPON_SWITCH_HIDE_DURATION),
        )
      );
    }

    return index === this.#weaponVisualIndex
      ? this.#weaponSwitchRaiseOffset
      : 0;
  }

  #weaponSwitchProgress(): number {
    if (!this.#weaponSwitchActive) return 1;

    if (this.#weaponVisualIndex !== this.#weaponSwitchTargetIndex) {
      return (
        0.5 * Math.min(1, this.#weaponSwitchTimer / WEAPON_SWITCH_HIDE_DURATION)
      );
    }

    return (
      0.5 +
      0.5 * (1 - this.#weaponSwitchRaiseOffset / WEAPON_SWITCH_DROP_OFFSET)
    );
  }

  #weaponSwitchPhase(): string {
    if (!this.#weaponSwitchActive) return "ready";
    return this.#weaponVisualIndex === this.#weaponSwitchTargetIndex
      ? "raising"
      : "hiding";
  }

  #resetWeaponSwitch(): void {
    this.#weaponVisualIndex = 0;
    this.#weaponSwitchTargetIndex = 0;
    this.#weaponSwitchTimer = 0;
    this.#weaponSwitchRaiseOffset = 0;
    this.#weaponSwitchActive = false;
  }

  #updateFootsteps(
    grounded: boolean,
    velocityX: number,
    velocityZ: number,
  ): void {
    const audible = sourceFootstepAudible({ grounded, velocityX, velocityZ });
    this.audio.loop("fps.walking", {
      clip: this.audio.clip("walking"),
      busId: "sfx",
      gain: SOURCE_FOOTSTEP_GAIN,
      muted: !audible,
      simulationSpace: AudioSimulationSpace.Local,
    });
  }

  #livingEnemyAttackers(
    position: Vec3,
    enemyHealth: Record<string, number>,
  ): Array<{ readonly key: string; readonly position: Vec3 }> {
    const target = sourceEnemyLookTarget(position);
    const candidates: SourceEnemyAttackCandidate[] = [];
    for (const enemy of ENEMIES) {
      const enemyPos = enemyPosition(enemy.position, this.#enemyTime);
      const alive = (enemyHealth[enemy.key] ?? 0) > 0;
      const inRange =
        alive && distance(enemyPos, target) < ENEMY_ATTACK_DISTANCE;
      const hasLineOfSight =
        inRange && this.#enemyHasLineOfSight(enemy.key, enemyPos, target);
      candidates.push({
        key: enemy.key,
        position: enemyPos,
        alive,
        hasLineOfSight,
      });
    }

    return sourceEnemyAttackers({
      playerPosition: target,
      attackDistance: ENEMY_ATTACK_DISTANCE,
      enemies: candidates,
    }).map((attacker) => ({
      key: attacker.key,
      position: attacker.position,
    }));
  }

  #playOneShot(clipId: string): void {
    this.audio.playOneShot(`fps.${clipId}.${Math.random()}`, {
      clip: this.audio.clip(clipId),
      busId: "sfx",
      gain: SOURCE_ONE_SHOT_GAIN,
      timeScale: sourceOneShotTimeScale(Math.random()),
      simulationSpace: AudioSimulationSpace.Local,
    });
  }

  #playJumpSound(): void {
    this.#playOneShot(randomJumpSound());
  }

  #writePlayerBody(translation: Vec3): void {
    const body = this.#findByKey(PLAYER_BODY_KEY);
    if (body === null) return;

    body.getVectorView(LocalTransform, "translation").set(translation);
    body.getVectorView(LocalTransform, "rotation").set([0, 0, 0, 1]);
    this.physics.setKinematicTarget(body, {
      translation,
      rotation: [0, 0, 0, 1],
    });
  }

  #queryExcluding(key: string): { readonly excludeEntity: string } | undefined {
    const ref = this.#entityRefForKey(key);
    return ref === null ? undefined : { excludeEntity: ref };
  }

  #entityRefForKey(key: string): string | null {
    const entity = this.#findByKey(key);
    return entity === null ? null : serializeEntityRef(entity);
  }

  #button(name: string): InputButtonAction | null {
    const action = this.actions[name];
    return action?.kind === "button" ? action : null;
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.actors.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) return entity;
    }
    return null;
  }

  #setEnabled(entity: Entity, enabled: boolean): void {
    if (entity.hasComponent(Enabled)) {
      entity.setValue(Enabled, "value", enabled);
    }
  }
}

function setSignal(
  signal: { value: unknown } | undefined,
  value: unknown,
): void {
  if (signal !== undefined) signal.value = value;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampPitch(value: number): number {
  const limit = Math.PI / 2 - 0.01;
  return Math.max(-limit, Math.min(limit, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerpNumber(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function randomWeaponKick(weapon: WeaponSpec): {
  readonly pitch: number;
  readonly yaw: number;
} {
  return {
    pitch: randomBetween(weapon.minKnockback[0], weapon.maxKnockback[0]),
    yaw:
      randomBetween(weapon.minKnockback[1], weapon.maxKnockback[1]) *
      randomSign(),
  };
}

function randomBetween(min: number, max: number): number {
  return min + (max - min) * Math.random();
}

function randomSign(): 1 | -1 {
  return Math.random() < 0.5 ? -1 : 1;
}

function createNumberSlots(length: number): number[] {
  return Array.from({ length }, () => 0);
}

function createPositionSlots(length: number): Vec3[] {
  return Array.from({ length }, () => HIDDEN_EFFECT_POSITION);
}

function createEnemyMuzzleNumberSlots(): number[] {
  return createNumberSlots(ENEMY_MUZZLE_FLASH_SLOT_COUNT);
}

function createEnemyMuzzlePositionSlots(): Vec3[] {
  return createPositionSlots(ENEMY_MUZZLE_FLASH_SLOT_COUNT);
}

function enemyMuzzleSlotIndex(enemyIndex: number, muzzleIndex: number): number {
  return enemyIndex * ENEMY_MUZZLE_OFFSETS.length + muzzleIndex;
}

function cloneVec3(value: readonly [number, number, number]): Vec3 {
  return [value[0], value[1], value[2]];
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function offsetImpactPoint(point: Vec3, normal: Vec3): Vec3 {
  return [
    point[0] + normal[0] * IMPACT_NORMAL_OFFSET,
    point[1] + normal[1] * IMPACT_NORMAL_OFFSET,
    point[2] + normal[2] * IMPACT_NORMAL_OFFSET,
  ];
}

function bodyToEye(bodyPosition: Vec3): Vec3 {
  return [
    bodyPosition[0],
    bodyPosition[1] + PLAYER_BODY_EYE_OFFSET,
    bodyPosition[2],
  ];
}

function subtractVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function spreadDirection(yaw: number, pitch: number, weapon: WeaponSpec): Vec3 {
  return sourceShotDirection({
    yaw,
    pitch,
    maxDistance: weapon.maxDistance,
    spreadOffsetX: randomBetween(-weapon.spread, weapon.spread),
    spreadOffsetY: randomBetween(-weapon.spread, weapon.spread),
  });
}

function weaponMuzzlePosition(
  position: Vec3,
  yaw: number,
  pitch: number,
  weapon: WeaponSpec,
): Vec3 {
  const forward = cameraForwardFromYawPitch(yaw, pitch);
  const right = horizontalRightFromYaw(yaw);
  const local = weapon.muzzlePosition;
  const forwardOffset = Math.max(0.7, Math.abs(local[2]) * 0.45);
  return [
    position[0] + right[0] * local[0] + forward[0] * forwardOffset,
    position[1] + local[1] + forward[1] * forwardOffset,
    position[2] + right[2] * local[0] + forward[2] * forwardOffset,
  ];
}

function enemyPosition(base: Vec3, time: number): Vec3 {
  return [
    base[0],
    base[1] + Math.sin(time * ENEMY_HOVER_RATE) * ENEMY_HOVER_AMPLITUDE,
    base[2],
  ];
}

function countLivingEnemies(enemyHealth: Record<string, number>): number {
  return ENEMIES.reduce(
    (count, enemy) => count + ((enemyHealth[enemy.key] ?? 0) > 0 ? 1 : 0),
    0,
  );
}

function countDestroyedEnemies(
  enemyDestroyed: Record<string, boolean>,
): number {
  return ENEMIES.reduce(
    (count, enemy) => count + (enemyDestroyed[enemy.key] === true ? 1 : 0),
    0,
  );
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function nearestPhysicsHit(
  hits: readonly PhysicsRaycastHit[],
): PhysicsRaycastHit | null {
  let nearest: PhysicsRaycastHit | null = null;
  for (const hit of hits) {
    if (nearest === null || hit.distance < nearest.distance) {
      nearest = hit;
    }
  }
  return nearest;
}

function randomJumpSound(): string {
  const sounds = ["jump-a", "jump-b", "jump-c"] as const;
  return sounds[Math.floor(Math.random() * sounds.length)] ?? "jump-a";
}
