import { defineResource, resource } from "@aperture-engine/app/systems";
import { ENEMIES, PLAYER_START } from "./fps-data.js";

export type EnemyHealthByKey = Record<string, number>;
export type EnemyDestroyedByKey = Record<string, boolean>;

export const FpsResource = defineResource("fps.state", {
  playerPosition: resource.vec3(PLAYER_START),
  yaw: resource.number(0),
  pitch: resource.number(0),
  verticalVelocity: resource.number(0),
  jumpsRemaining: resource.number(2),
  grounded: resource.boolean(true),
  health: resource.number(100),
  weaponIndex: resource.number(0),
  weaponVisualIndex: resource.number(0),
  weaponSwitchProgress: resource.number(1),
  weaponSwitchPhase: resource.string("ready"),
  shotCooldown: resource.number(0),
  shotsFired: resource.number(0),
  hits: resource.number(0),
  enemyHealth: resource.value<EnemyHealthByKey>(createEnemyHealth, {
    kind: "enemy-health",
    summarize: (value) => ({ ...value }),
  }),
  enemyDestroyed: resource.value<EnemyDestroyedByKey>(createEnemyDestroyed, {
    kind: "enemy-destroyed",
    summarize: (value) => ({ ...value }),
  }),
  enemiesRemaining: resource.number(ENEMIES.length),
  destroyedEnemies: resource.number(0),
  enemyDestroyedPulse: resource.number(0),
  lastDestroyedEnemy: resource.string(""),
  gameStatus: resource.string("active"),
});

export function createEnemyHealth(): EnemyHealthByKey {
  return Object.fromEntries(ENEMIES.map((enemy) => [enemy.key, 100]));
}

export function createEnemyDestroyed(): EnemyDestroyedByKey {
  return Object.fromEntries(ENEMIES.map((enemy) => [enemy.key, false]));
}
