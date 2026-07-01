import { LocalTransform, clamp, createSystem } from "@aperture-engine/app/systems";
import type { Entity } from "@aperture-engine/app/systems";
import { Basket, Star } from "../components.ts";

const BASKET_LIMIT = 6.5;
const STAR_HALF = 0.25;
// Vertical band (star center y) where a star overlaps the basket lid.
const CATCH_Y_TOP = 0.95;
const CATCH_Y_BOTTOM = 0.2;
// Below this the star is unrecoverable.
const MISS_Y = -1.8;

// Drives the basket from the `move` axis and resolves catches/misses. Despawns
// are collected first, then applied after iteration so we never mutate the
// query set mid-loop.
export default class CatchSystem extends createSystem({
  priority: 30,
  queries: {
    baskets: { required: [Basket, LocalTransform] },
    stars: { required: [Star, LocalTransform] },
  },
}) {
  override update(delta: number): void {
    const basket = this.first(this.queries.baskets.entities);
    if (basket === null) {
      return;
    }

    const basketPos = basket.getVectorView(LocalTransform, "translation");
    const speed = basket.getValue(Basket, "speed") ?? 6;
    const halfWidth = basket.getValue(Basket, "halfWidth") ?? 1;

    const move = this.actions.move;
    const direction = move?.kind === "axis2d" ? Number(move.x.value) : 0;
    const nextX = clamp(
      (basketPos[0] ?? 0) + direction * speed * delta,
      -BASKET_LIMIT,
      BASKET_LIMIT,
    );
    basketPos[0] = nextX;
    const basketXSignal = this.signals.basketX;
    if (basketXSignal !== undefined) {
      basketXSignal.value = nextX;
    }

    const catchReach = halfWidth + STAR_HALF;
    const caughtStars: Entity[] = [];
    const missedStars: Entity[] = [];

    for (const star of this.queries.stars.entities) {
      const pos = star.getVectorView(LocalTransform, "translation");
      const y = pos[1] ?? 0;
      const x = pos[0] ?? 0;

      if (y <= CATCH_Y_TOP && y >= CATCH_Y_BOTTOM && Math.abs(x - nextX) <= catchReach) {
        caughtStars.push(star);
        continue;
      }
      if (y <= MISS_Y) {
        missedStars.push(star);
      }
    }

    for (const star of caughtStars) {
      this.hierarchy.despawnRecursive(star);
    }
    for (const star of missedStars) {
      this.hierarchy.despawnRecursive(star);
    }

    const score = this.signals.score;
    const lastCatchFrame = this.signals.lastCatchFrame;
    if (caughtStars.length > 0 && score !== undefined) {
      score.value = Number(score.value ?? 0) + caughtStars.length;
      if (lastCatchFrame !== undefined) {
        lastCatchFrame.value = this.time.frame;
      }
    }
    const missed = this.signals.missed;
    if (missedStars.length > 0 && missed !== undefined) {
      missed.value = Number(missed.value ?? 0) + missedStars.length;
    }
  }

  private first<E>(entities: Set<E>): E | null {
    for (const entity of entities) {
      return entity;
    }
    return null;
  }
}
