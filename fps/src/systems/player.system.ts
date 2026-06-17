import {
  AppEntityKey,
  AudioSimulationSpace,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  type Entity,
  type InputAxis2dAction,
  type InputButtonAction,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import {
  ENEMIES,
  GRAVITY,
  JUMP_STRENGTH,
  LEVEL_COLLIDERS,
  MAX_JUMPS,
  PLAYER_EYE_HEIGHT,
  PLAYER_SPEED,
  PLAYER_START,
  WEAPONS,
  type WeaponSpec,
} from "../lib/fps-data.js";
import { FpsResource, createEnemyHealth } from "../lib/fps-resource.js";

const LOOK_SPEED = Math.PI;
const GAMEPAD_LOOK_SPEED = 2.5;
const ENEMY_RADIUS = 0.75;
const ENEMY_HOVER_AMPLITUDE = 0.2;
const ENEMY_HOVER_RATE = 5;
const ENEMY_ATTACK_INTERVAL = 0.8;
const ENEMY_ATTACK_DISTANCE = 14;
const ENEMY_ATTACK_DAMAGE = 5;
const GROUND_MARGIN = 0.35;

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

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
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
    const forward = horizontalForward(yaw);
    const right = horizontalRight(yaw);
    const movement = normalize2(moveX, moveZ);
    position[0] +=
      (right[0] * movement[0] + forward[0] * movement[1]) * PLAYER_SPEED * dt;
    position[2] +=
      (right[2] * movement[0] + forward[2] * movement[1]) * PLAYER_SPEED * dt;

    if (this.#button("jump")?.down() && jumpsRemaining > 0) {
      this.#playOneShot(randomJumpSound(), 0.45);
      verticalVelocity = JUMP_STRENGTH;
      jumpsRemaining -= 1;
      grounded = false;
    }

    verticalVelocity -= GRAVITY * dt;
    position[1] += verticalVelocity * dt;
    const groundY = groundHeightAt(position[0], position[2]);
    const eyeGroundY = groundY + PLAYER_EYE_HEIGHT;
    if (position[1] <= eyeGroundY) {
      if (!grounded && verticalVelocity < -1) {
        this.#playOneShot("land", 0.35);
      }
      position[1] = eyeGroundY;
      verticalVelocity = 0;
      jumpsRemaining = MAX_JUMPS;
      grounded = true;
    } else {
      grounded = false;
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
      pitch = clampPitch(pitch + 0.012 + weapon.knockback * 0.00035);
    }

    this.#enemyTime += dt;
    this.#enemyAttackTimer += dt;
    if (this.#enemyAttackTimer >= ENEMY_ATTACK_INTERVAL) {
      this.#enemyAttackTimer = 0;
      const attacker = this.#nearestLivingEnemy(position, enemyHealth);
      if (
        attacker !== null &&
        distance(attacker.position, position) < ENEMY_ATTACK_DISTANCE
      ) {
        health = Math.max(0, health - ENEMY_ATTACK_DAMAGE);
        this.#playOneShot("enemy-attack", 0.35);
      }
    }

    this.#writeCamera(position, yaw, pitch);
    this.#writeWeapons(weaponIndex, weapon, dt, moveX, moveZ, shotCooldown);
    this.#writeEnemies(position, enemyHealth);
    this.#writeSignals({
      health,
      weaponIndex,
      weapon,
      enemiesRemaining: countLivingEnemies(enemyHealth),
      shotsFired,
      hits,
      grounded,
      position,
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
    });
  }

  #shoot(
    position: Vec3,
    yaw: number,
    pitch: number,
    weapon: WeaponSpec,
    enemyHealth: Record<string, number>,
  ): { readonly enemyHealth: Record<string, number>; readonly hits: number } {
    let hitCount = 0;
    let nextHealth = enemyHealth;

    for (let i = 0; i < weapon.shotCount; i += 1) {
      const direction = spreadDirection(yaw, pitch, weapon.spread);
      const hit = nearestEnemyHit(
        position,
        direction,
        weapon.maxDistance,
        nextHealth,
        this.#enemyTime,
      );

      if (hit === null) {
        this.physics.raycastFirst({
          origin: position,
          direction,
          maxDistance: weapon.maxDistance,
        });
        continue;
      }

      nextHealth = { ...nextHealth };
      const current = nextHealth[hit.key] ?? 0;
      const remaining = Math.max(0, current - weapon.damage);
      nextHealth[hit.key] = remaining;
      hitCount += 1;
      this.#playOneShot(remaining === 0 ? "enemy-destroy" : "enemy-hurt", 0.4);
    }

    return { enemyHealth: nextHealth, hits: hitCount };
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
        entity.getVectorView(LocalTransform, "translation").set(position);
        entity
          .getVectorView(LocalTransform, "rotation")
          .set(quatFromEulerYXZ(0, yaw, 0));
      }
    }
  }

  #writeSignals(input: {
    readonly health: number;
    readonly weaponIndex: number;
    readonly weapon: WeaponSpec;
    readonly enemiesRemaining: number;
    readonly shotsFired: number;
    readonly hits: number;
    readonly grounded: boolean;
    readonly position: Vec3;
  }): void {
    setSignal(this.signals.health, Math.round(input.health));
    setSignal(this.signals.weaponIndex, input.weaponIndex);
    setSignal(this.signals.weaponName, input.weapon.name);
    setSignal(this.signals.crosshair, input.weapon.crosshairUrl);
    setSignal(this.signals.enemiesRemaining, input.enemiesRemaining);
    setSignal(this.signals.shotsFired, input.shotsFired);
    setSignal(this.signals.hits, input.hits);
    setSignal(this.signals.grounded, input.grounded);
    setSignal(this.signals.playerX, Number(input.position[0].toFixed(2)));
    setSignal(this.signals.playerY, Number(input.position[1].toFixed(2)));
    setSignal(this.signals.playerZ, Number(input.position[2].toFixed(2)));
    setSignal(this.signals.lastShotFrame, input.shotsFired);
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

function horizontalForward(yaw: number): Vec3 {
  return [Math.sin(yaw), 0, -Math.cos(yaw)];
}

function horizontalRight(yaw: number): Vec3 {
  return [Math.cos(yaw), 0, Math.sin(yaw)];
}

function normalize2(x: number, z: number): readonly [number, number] {
  const length = Math.hypot(x, z);
  return length > 1 ? [x / length, z / length] : [x, z];
}

function groundHeightAt(x: number, z: number): number {
  let best = -0.5;
  for (const collider of LEVEL_COLLIDERS) {
    if (collider.surface !== true) continue;
    const dx = x - collider.position[0];
    const dz = z - collider.position[2];
    if (
      Math.abs(dx) <= collider.halfExtents[0] + GROUND_MARGIN &&
      Math.abs(dz) <= collider.halfExtents[2] + GROUND_MARGIN
    ) {
      best = Math.max(best, collider.position[1] + collider.halfExtents[1]);
    }
  }
  return best;
}

function spreadDirection(yaw: number, pitch: number, spread: number): Vec3 {
  const forward = cameraForward(yaw, pitch);
  const right = horizontalRight(yaw);
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

function cameraForward(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch);
  return [cosPitch * Math.sin(yaw), Math.sin(pitch), -cosPitch * Math.cos(yaw)];
}

function nearestEnemyHit(
  origin: Vec3,
  direction: Vec3,
  maxDistance: number,
  enemyHealth: Record<string, number>,
  time: number,
): { readonly key: string; readonly distance: number } | null {
  let best: { key: string; distance: number } | null = null;
  for (const enemy of ENEMIES) {
    if ((enemyHealth[enemy.key] ?? 0) <= 0) continue;
    const hit = raySphere(
      origin,
      direction,
      enemyPosition(enemy.position, time),
      ENEMY_RADIUS,
    );
    if (hit === null || hit > maxDistance) continue;
    if (best === null || hit < best.distance) {
      best = { key: enemy.key, distance: hit };
    }
  }
  return best;
}

function raySphere(
  origin: Vec3,
  direction: Vec3,
  center: Vec3,
  radius: number,
): number | null {
  const oc: Vec3 = [
    origin[0] - center[0],
    origin[1] - center[1],
    origin[2] - center[2],
  ];
  const b = dot(oc, direction);
  const c = dot(oc, oc) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const t = -b - Math.sqrt(discriminant);
  return t >= 0 ? t : null;
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

function countLivingEnemies(enemyHealth: Record<string, number>): number {
  return ENEMIES.reduce(
    (count, enemy) => count + ((enemyHealth[enemy.key] ?? 0) > 0 ? 1 : 0),
    0,
  );
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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
