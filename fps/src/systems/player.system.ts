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
  ENEMIES,
  ENEMY_MUZZLE_OFFSETS,
  GRAVITY,
  JUMP_STRENGTH,
  MAX_JUMPS,
  PLAYER_BODY_EYE_OFFSET,
  PLAYER_BODY_KEY,
  PLAYER_BODY_START,
  PLAYER_SPEED,
  PLAYER_START,
  WEAPONS,
  type WeaponSpec,
} from "../lib/fps-data.js";
import {
  cameraForwardFromYawPitch,
  cameraRelativeMovementDelta,
  horizontalRightFromYaw,
  normalizedMoveAxis,
  snapToGroundDistanceForMove,
} from "../lib/fps-controls.js";
import {
  FpsResource,
  createEnemyDestroyed,
  createEnemyHealth,
} from "../lib/fps-resource.js";

const LOOK_SPEED = Math.PI;
const GAMEPAD_LOOK_SPEED = 2.5;
const ENEMY_HOVER_AMPLITUDE = 0.2;
const ENEMY_HOVER_RATE = 5;
const ENEMY_ATTACK_INTERVAL = 0.8;
const ENEMY_ATTACK_DISTANCE = 14;
const ENEMY_ATTACK_DAMAGE = 5;
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
const FULL_SPRITE_UV: SpriteUvRect = [0, 0, 1, 1];
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
const MUZZLE_FLASH_DURATION =
  MUZZLE_FLASH_FRAMES.length / SPRITE_ANIMATION_FPS;
const IMPACT_FLASH_DURATION =
  IMPACT_FLASH_FRAMES.length / SPRITE_ANIMATION_FPS;
const HIDDEN_EFFECT_POSITION: Vec3 = [0, -100, 0];

interface ShotEnemyHit {
  readonly key: string;
  readonly point: Vec3;
  readonly distance: number;
}

type SpriteUvRect = readonly [number, number, number, number];
type SpriteAnimationFrame = SpriteUvRect | null;

interface SpriteFrameSelection {
  readonly atlasFrame: number;
  readonly visible: boolean;
  readonly uvRect: SpriteUvRect;
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
  #footstepLoop = false;
  #muzzleFlashTimer = 0;
  #impactFlashTimer = 0;
  #muzzleFlashPosition: Vec3 = HIDDEN_EFFECT_POSITION;
  #impactFlashPosition: Vec3 = HIDDEN_EFFECT_POSITION;
  #enemyMuzzleFlashTimers: [number, number] = [0, 0];
  #enemyMuzzleFlashPositions: [Vec3, Vec3] = [
    HIDDEN_EFFECT_POSITION,
    HIDDEN_EFFECT_POSITION,
  ];
  #damagePulse = 0;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#muzzleFlashTimer = Math.max(0, this.#muzzleFlashTimer - dt);
    this.#impactFlashTimer = Math.max(0, this.#impactFlashTimer - dt);
    for (let i = 0; i < this.#enemyMuzzleFlashTimers.length; i += 1) {
      const timer = this.#enemyMuzzleFlashTimers[i] ?? 0;
      this.#enemyMuzzleFlashTimers[i] = Math.max(0, timer - dt);
    }

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
    const movement = normalizedMoveAxis(moveX, moveZ);

    if (this.#button("jump")?.down() && jumpsRemaining > 0) {
      this.#playOneShot(randomJumpSound(), 0.45);
      verticalVelocity = JUMP_STRENGTH;
      jumpsRemaining -= 1;
      grounded = false;
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
    const wasGrounded = grounded;
    const playerMove = skipPhysicsMove
      ? {
          position,
          grounded,
          blockedVertical: false,
        }
      : this.#movePlayerBody(position, desiredTranslation, grounded);
    position = playerMove.position;
    grounded = playerMove.grounded;

    if (grounded) {
      if (!wasGrounded && verticalVelocity < -1) {
        this.#playOneShot("land", 0.35);
      }
      verticalVelocity = 0;
      jumpsRemaining = MAX_JUMPS;
    } else if (playerMove.blockedVertical && verticalVelocity > 0) {
      verticalVelocity = 0;
    }

    if (position[1] < -10 || health <= 0) {
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
    }

    if (this.#button("switchWeapon")?.down()) {
      weaponIndex = (weaponIndex + 1) % WEAPONS.length;
      shotCooldown = 0;
      this.#playOneShot("weapon-change", 0.35);
    }

    const weapon = WEAPONS[weaponIndex] ?? WEAPONS[0]!;
    const didShoot =
      this.#button("shoot")?.pressed() === true && shotCooldown <= 0;
    if (didShoot) {
      shotCooldown = weapon.cooldown;
      shotsFired += 1;
      this.#playOneShot(
        weapon.soundId,
        weapon.name === "Blaster" ? 0.45 : 0.28,
      );
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
      if (shot.impact !== null) {
        this.#triggerImpactFlash(shot.impact);
      }
      pitch = clampPitch(pitch + 0.012 + weapon.knockback * 0.00035);
    }

    this.#enemyTime += dt;
    this.#enemyAttackTimer += dt;
    if (this.#enemyAttackTimer >= ENEMY_ATTACK_INTERVAL) {
      this.#enemyAttackTimer = 0;
      const attacker = this.#nearestLivingEnemy(position, enemyHealth);
      if (
        attacker !== null &&
        distance(attacker.position, position) < ENEMY_ATTACK_DISTANCE &&
        this.#enemyHasLineOfSight(attacker.key, attacker.position, position)
      ) {
        health = Math.max(0, health - ENEMY_ATTACK_DAMAGE);
        this.#damagePulse += 1;
        this.#triggerEnemyMuzzleFlashes(attacker.position, position);
        this.#playOneShot("enemy-attack", 0.35);
      }
    }

    this.#writeCamera(position, yaw, pitch);
    this.#writeWeapons(weaponIndex, weapon, dt, moveX, moveZ, shotCooldown);
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
    this.#updateFootsteps(grounded, movement[0] !== 0 || movement[1] !== 0);

    this.resources.write(FpsResource, (next) => {
      next.playerPosition = position;
      next.yaw = yaw;
      next.pitch = pitch;
      next.verticalVelocity = verticalVelocity;
      next.jumpsRemaining = jumpsRemaining;
      next.grounded = grounded;
      next.health = health;
      next.weaponIndex = weaponIndex;
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
    readonly impact: Vec3 | null;
    readonly destroyedEnemies: readonly string[];
  } {
    let hitCount = 0;
    let nextHealth = enemyHealth;
    const destroyedEnemies: string[] = [];
    let nearestImpact: {
      readonly point: Vec3;
      readonly distance: number;
    } | null = null;

    for (let i = 0; i < weapon.shotCount; i += 1) {
      const direction = spreadDirection(yaw, pitch, weapon.spread);
      const rayHits = this.physics.raycastAll(
        {
          origin: position,
          direction,
          maxDistance: weapon.maxDistance,
        },
        this.#queryExcluding(PLAYER_BODY_KEY),
      );
      const nearestRayHit = nearestPhysicsHit(rayHits);
      if (
        nearestRayHit !== null &&
        (nearestImpact === null ||
          nearestRayHit.distance < nearestImpact.distance)
      ) {
        nearestImpact = {
          point: cloneVec3(nearestRayHit.point),
          distance: nearestRayHit.distance,
        };
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
      this.#playOneShot(remaining === 0 ? "enemy-destroy" : "enemy-hurt", 0.4);
    }

    return {
      enemyHealth: nextHealth,
      hits: hitCount,
      impact: nearestImpact?.point ?? null,
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
    readonly blockedVertical: boolean;
  } {
    const body = this.#findByKey(PLAYER_BODY_KEY);
    if (body === null) {
      return { position, grounded: fallbackGrounded, blockedVertical: false };
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
      return { position, grounded: fallbackGrounded, blockedVertical: false };
    }

    const target = cloneVec3(move.targetTranslation);
    this.#writePlayerBody(target);

    return {
      position: bodyToEye(target),
      grounded: move.grounded,
      blockedVertical:
        Math.abs(move.movement[1] - desiredTranslation[1]) > 0.001,
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
    playerPosition: Vec3,
  ): boolean {
    const playerRef = this.#entityRefForKey(PLAYER_BODY_KEY);
    if (playerRef === null) return false;

    const toPlayer = subtractVec3(playerPosition, enemyPosition);
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

  #writeCamera(position: Vec3, yaw: number, pitch: number): void {
    const camera = this.#findByKey("camera.main");
    if (camera === null) return;
    camera.getVectorView(LocalTransform, "translation").set(position);
    camera
      .getVectorView(LocalTransform, "rotation")
      .set(quatFromEulerYXZ(pitch, yaw, 0));
  }

  #writeWeapons(
    weaponIndex: number,
    weapon: WeaponSpec,
    dt: number,
    moveX: number,
    moveZ: number,
    shotCooldown: number,
  ): void {
    const walkBob =
      Math.sin(this.#enemyTime * 10) * 0.025 * Math.hypot(moveX, moveZ);
    const recoil =
      Math.max(0, Math.min(0.22, shotCooldown / weapon.cooldown)) * 0.18;

    for (let i = 0; i < WEAPONS.length; i += 1) {
      const entity = this.#findByKey(`weapon.${i}`);
      const spec = WEAPONS[i];
      if (entity === null || spec === undefined) continue;
      const translation = entity.getVectorView(LocalTransform, "translation");
      if (i === weaponIndex) {
        translation.set([
          spec.position[0],
          spec.position[1] + walkBob,
          spec.position[2] + recoil,
        ]);
      } else {
        translation.set([spec.position[0], -100, 0]);
      }
    }

    void dt;
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
    this.#muzzleFlashTimer = MUZZLE_FLASH_DURATION;
  }

  #triggerImpactFlash(position: Vec3): void {
    this.#impactFlashPosition = position;
    this.#impactFlashTimer = IMPACT_FLASH_DURATION;
  }

  #writeShotEffects(): void {
    this.#writeEffectSprite(
      "effect.muzzle-burst",
      this.#muzzleFlashPosition,
      this.#muzzleFlashTimer / MUZZLE_FLASH_DURATION,
      1,
      MUZZLE_FLASH_FRAMES,
    );
    this.#writeEffectSprite(
      "effect.impact-hit",
      this.#impactFlashPosition,
      this.#impactFlashTimer / IMPACT_FLASH_DURATION,
      1,
      IMPACT_FLASH_FRAMES,
    );
    for (let i = 0; i < this.#enemyMuzzleFlashTimers.length; i += 1) {
      this.#writeEffectSprite(
        `effect.enemy-muzzle.${i}`,
        this.#enemyMuzzleFlashPositions[i]!,
        (this.#enemyMuzzleFlashTimers[i] ?? 0) / MUZZLE_FLASH_DURATION,
        0.72,
        MUZZLE_FLASH_FRAMES,
      );
    }
  }

  #writeEffectSprite(
    key: string,
    position: Vec3,
    normalizedLife: number,
    scale: number,
    frames: readonly SpriteAnimationFrame[],
  ): void {
    const entity = this.#findByKey(key);
    if (entity === null) return;

    const frame = spriteFrameForLife(frames, normalizedLife);
    const alpha = frame.visible ? clamp01(normalizedLife) : 0;
    entity
      .getVectorView(LocalTransform, "translation")
      .set(alpha > 0 ? position : HIDDEN_EFFECT_POSITION);
    entity.getVectorView(LocalTransform, "scale").set([scale, scale, scale]);

    if (entity.hasComponent(Sprite)) {
      entity.getVectorView(Sprite, "color").set([1, 1, 1, alpha]);
      entity.getVectorView(Sprite, "uvRect").set(frame.uvRect);
      entity.setValue(Sprite, "atlasFrame", frame.atlasFrame);
    }
  }

  #writeEnemies(
    playerPosition: Vec3,
    enemyHealth: Record<string, number>,
  ): void {
    for (const enemy of ENEMIES) {
      const alive = (enemyHealth[enemy.key] ?? 0) > 0;
      const position = alive
        ? enemyPosition(enemy.position, this.#enemyTime)
        : ([enemy.position[0], -100, enemy.position[2]] as Vec3);
      const yaw = enemyYaw(position, playerPosition);

      for (const key of [enemy.key, `${enemy.key}.hitbox`]) {
        const entity = this.#findByKey(key);
        if (entity === null) continue;
        this.#setEnabled(entity, alive);
        entity.getVectorView(LocalTransform, "translation").set(position);
        entity
          .getVectorView(LocalTransform, "rotation")
          .set(quatFromEulerYXZ(0, yaw, 0));
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

  #triggerEnemyMuzzleFlashes(enemyPosition: Vec3, playerPosition: Vec3): void {
    const yaw = enemyYaw(enemyPosition, playerPosition);
    for (let i = 0; i < ENEMY_MUZZLE_OFFSETS.length; i += 1) {
      this.#enemyMuzzleFlashPositions[i] = enemyMuzzlePosition(
        enemyPosition,
        yaw,
        ENEMY_MUZZLE_OFFSETS[i]!,
      );
      this.#enemyMuzzleFlashTimers[i] = MUZZLE_FLASH_DURATION;
    }
  }

  #clearEnemyMuzzleFlashes(): void {
    this.#enemyMuzzleFlashTimers = [0, 0];
    this.#enemyMuzzleFlashPositions = [
      HIDDEN_EFFECT_POSITION,
      HIDDEN_EFFECT_POSITION,
    ];
  }

  #resetTransientGameplayState(): void {
    this.#enemyTime = 0;
    this.#enemyAttackTimer = 0;
    this.#footstepLoop = false;
    this.#muzzleFlashTimer = 0;
    this.#impactFlashTimer = 0;
    this.#muzzleFlashPosition = HIDDEN_EFFECT_POSITION;
    this.#impactFlashPosition = HIDDEN_EFFECT_POSITION;
    this.#clearEnemyMuzzleFlashes();
  }

  #updateFootsteps(grounded: boolean, moving: boolean): void {
    const shouldLoop = grounded && moving;
    if (shouldLoop === this.#footstepLoop) return;
    this.#footstepLoop = shouldLoop;
    if (shouldLoop) {
      this.audio.loop("fps.walking", {
        clip: this.audio.clip("walking"),
        busId: "sfx",
        gain: 0.18,
        simulationSpace: AudioSimulationSpace.Local,
      });
    } else {
      this.audio.stop("fps.walking");
    }
  }

  #nearestLivingEnemy(
    position: Vec3,
    enemyHealth: Record<string, number>,
  ): { readonly key: string; readonly position: Vec3 } | null {
    let best: { key: string; position: Vec3; distance: number } | null = null;
    for (const enemy of ENEMIES) {
      if ((enemyHealth[enemy.key] ?? 0) <= 0) continue;
      const enemyPos = enemyPosition(enemy.position, this.#enemyTime);
      const d = distance(position, enemyPos);
      if (best === null || d < best.distance) {
        best = { key: enemy.key, position: enemyPos, distance: d };
      }
    }
    return best;
  }

  #playOneShot(clipId: string, gain: number): void {
    this.audio.playOneShot(`fps.${clipId}.${Math.random()}`, {
      clip: this.audio.clip(clipId),
      busId: "sfx",
      gain,
      simulationSpace: AudioSimulationSpace.Local,
    });
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

function spriteFrameForLife(
  frames: readonly SpriteAnimationFrame[],
  normalizedLife: number,
): SpriteFrameSelection {
  if (frames.length === 0 || normalizedLife <= 0) {
    return {
      atlasFrame: 0,
      visible: false,
      uvRect: FULL_SPRITE_UV,
    };
  }

  const elapsed = 1 - clamp01(normalizedLife);
  const atlasFrame = Math.min(
    frames.length - 1,
    Math.max(0, Math.floor(elapsed * frames.length)),
  );
  const uvRect = frames[atlasFrame] ?? null;

  return {
    atlasFrame,
    visible: uvRect !== null,
    uvRect: uvRect ?? FULL_SPRITE_UV,
  };
}

function cloneVec3(value: readonly [number, number, number]): Vec3 {
  return [value[0], value[1], value[2]];
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

function spreadDirection(yaw: number, pitch: number, spread: number): Vec3 {
  const forward = cameraForwardFromYawPitch(yaw, pitch);
  const right = horizontalRightFromYaw(yaw);
  const up: Vec3 = [0, 1, 0];
  const spreadScale = spread * 0.035;
  const rx = (Math.random() * 2 - 1) * spreadScale;
  const ry = (Math.random() * 2 - 1) * spreadScale;
  return normalize3([
    forward[0] + right[0] * rx + up[0] * ry,
    forward[1] + right[1] * rx + up[1] * ry,
    forward[2] + right[2] * rx + up[2] * ry,
  ]);
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

function enemyYaw(enemy: Vec3, player: Vec3): number {
  return Math.atan2(player[0] - enemy[0], player[2] - enemy[2]);
}

function enemyMuzzlePosition(enemy: Vec3, yaw: number, offset: Vec3): Vec3 {
  const right: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const forward: Vec3 = [Math.sin(yaw), 0, Math.cos(yaw)];
  return [
    enemy[0] + right[0] * offset[0] + forward[0] * offset[2],
    enemy[1] + offset[1],
    enemy[2] + right[2] * offset[0] + forward[2] * offset[2],
  ];
}

function countLivingEnemies(enemyHealth: Record<string, number>): number {
  return ENEMIES.reduce(
    (count, enemy) => count + ((enemyHealth[enemy.key] ?? 0) > 0 ? 1 : 0),
    0,
  );
}

function countDestroyedEnemies(enemyDestroyed: Record<string, boolean>): number {
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

function normalize3(value: Vec3): Vec3 {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= Number.EPSILON) return [0, 0, -1];
  return [value[0] / length, value[1] / length, value[2] / length];
}

function randomJumpSound(): string {
  const sounds = ["jump-a", "jump-b", "jump-c"] as const;
  return sounds[Math.floor(Math.random() * sounds.length)] ?? "jump-a";
}
