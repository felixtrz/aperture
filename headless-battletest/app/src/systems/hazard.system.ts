import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";

// A deterministic patrolling hazard. It oscillates along X using sim time
// (context.time), so replay is bit-identical for a given step schedule. On
// contact with the player it knocks the player back to spawn and increments
// the `hits` signal — all logic readable from a headless snapshot.
const PATROL_CENTER = 1;
const PATROL_AMPLITUDE = 2.5;
const PATROL_RATE = 1.6; // radians/second
const HAZARD_Y = 0.55;
const PLAYER_SPAWN_X = -3.5;
const HIT_RADIUS = 0.55;

export default class HazardSystem extends createSystem({
  priority: 30,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override init(): void {
    this.spawn.mesh({
      key: "hazard.patrol",
      name: "Patrol Hazard",
      tags: ["hazard"],
      mesh: mesh.box({ size: [0.6, 0.6, 0.6] }),
      material: material.standard({
        baseColor: [0.95, 0.35, 0.1, 1],
        roughness: 0.4,
      }),
      transform: { translation: [PATROL_CENTER, HAZARD_Y, 0] },
    });
  }

  override update(): void {
    const hazard = this.findByKey("hazard.patrol");
    const player = this.findByKey("player");
    const hazardX = this.signals.hazardX;
    const hits = this.signals.hits;

    if (hazard === null || player === null) {
      return;
    }

    // Deterministic oscillation: position is a pure function of sim time.
    const x =
      PATROL_CENTER +
      PATROL_AMPLITUDE * Math.sin(this.time.elapsed * PATROL_RATE);
    const hazardTranslation = hazard.getVectorView(LocalTransform, "translation");
    hazardTranslation[0] = x;
    if (hazardX !== undefined) {
      hazardX.value = x;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");
    const playerX = playerTranslation[0] ?? PLAYER_SPAWN_X;

    if (Math.abs(playerX - x) < HIT_RADIUS) {
      playerTranslation[0] = PLAYER_SPAWN_X;
      if (hits !== undefined) {
        hits.value = Number(hits.value) + 1;
      }
      this.diagnostics.info("game.hazard.hit", {
        at: x,
        hits: hits?.value ?? null,
      });
    }
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
