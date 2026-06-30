import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";

// A deterministic coin spawner. Every SPAWN_INTERVAL steps it spawns a coin at
// a seeded-random X (context.random), capped at MAX_COINS. Walking the player
// over a coin despawns it and increments the `coins` signal. Because positions
// come from context.random, the same seed + step schedule reproduces the exact
// same coin layout — verifiable headlessly via ecs_query/ecs_get_entity.
const SPAWN_INTERVAL = 20;
const MAX_COINS = 4;
const COIN_Y = 0.6;
const PICKUP_RADIUS = 0.5;
const FIELD_MIN_X = -4;
const FIELD_MAX_X = 4.2;

interface Coin {
  readonly ref: { index: number; generation: number };
  readonly x: number;
}

export default class SpawnerSystem extends createSystem({
  priority: 25,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  #coins: Coin[] = [];
  #spawnCount = 0;

  override update(): void {
    const frame = this.time.frame;
    const coins = this.signals.coins;

    if (
      frame > 0 &&
      frame % SPAWN_INTERVAL === 0 &&
      this.#coins.length < MAX_COINS
    ) {
      this.#spawnCoin();
    }

    const player = this.findByKey("player");
    if (player === null || coins === undefined) {
      return;
    }
    const playerX = player.getVectorView(LocalTransform, "translation")[0] ?? 0;

    const remaining: Coin[] = [];
    for (const coin of this.#coins) {
      if (Math.abs(playerX - coin.x) < PICKUP_RADIUS) {
        this.hierarchy.despawnRecursive(coin.ref);
        coins.value = Number(coins.value) + 1;
        this.diagnostics.info("game.coin.collected", {
          x: coin.x,
          coins: coins.value,
        });
      } else {
        remaining.push(coin);
      }
    }
    this.#coins = remaining;
  }

  #spawnCoin(): void {
    const x = this.random.range(FIELD_MIN_X, FIELD_MAX_X);
    const entity = this.spawn.mesh({
      key: `coin.${this.#spawnCount}`,
      name: `Coin ${this.#spawnCount}`,
      tags: ["coin", "collectible"],
      mesh: mesh.box({ size: [0.3, 0.3, 0.3] }),
      material: material.standard({
        baseColor: [1, 0.85, 0.2, 1],
        metallic: 0.8,
        roughness: 0.2,
      }),
      transform: { translation: [x, COIN_Y, 0] },
    });
    this.#coins.push({
      ref: { index: entity.index, generation: entity.generation },
      x,
    });
    this.#spawnCount += 1;
    this.diagnostics.info("game.coin.spawned", { index: this.#spawnCount - 1, x });
  }

  private findByKey(key: string) {
    for (const entity of this.queries.actors.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }

    return null;
  }
}
