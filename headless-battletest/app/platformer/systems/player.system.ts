import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";
import {
  COINS,
  DEATH_Y,
  GOAL_X,
  PLAYER_SPAWN,
  groundTopAt,
} from "./level.ts";

const MOVE_SPEED = 5;
const GRAVITY = -22;
const JUMP_VELOCITY = 9;
const MAX_JUMPS = 2;
const PLAYER_HALF_H = 0.45;
const COIN_RADIUS = 0.5;

export default class PlayerSystem extends createSystem({
  priority: 10,
  queries: { actors: { required: [AppEntityKey, LocalTransform] } },
}) {
  #vy = 0;
  #jumps = MAX_JUMPS;
  #collected = new Set<string>();

  override update(delta: number): void {
    const player = this.#find("player");
    if (player === null) return;
    const t = player.getVectorView(LocalTransform, "translation");

    // Horizontal.
    const move = this.actions.move;
    const dir = move?.kind === "axis2d" ? move.x.value : 0;
    const nextX = Math.max(-9.5, Math.min(9.7, (t[0] ?? 0) + dir * MOVE_SPEED * delta));

    // Vertical: gravity + landing on the platform top beneath the player's feet.
    const feetY = (t[1] ?? 0) - PLAYER_HALF_H;
    const jump = this.actions.jump;
    if (jump?.kind === "button" && jump.down() && this.#jumps > 0) {
      this.#vy = JUMP_VELOCITY;
      this.#jumps -= 1;
    }
    this.#vy += GRAVITY * delta;
    let nextFeet = feetY + this.#vy * delta;

    const surface = groundTopAt(nextX, feetY);
    let grounded = false;
    if (this.#vy <= 0 && surface > -Infinity && nextFeet <= surface) {
      // Landed on (or standing on) the platform top.
      nextFeet = surface;
      this.#vy = 0;
      grounded = true;
      this.#jumps = MAX_JUMPS;
    }

    let nextY = nextFeet + PLAYER_HALF_H;

    // Fall-death.
    if (nextY < DEATH_Y) {
      this.#die(t);
      return;
    }

    t[0] = nextX;
    t[1] = nextY;

    this.#publish(nextX, nextY, grounded);
    this.#collectCoins(nextX, nextY);
    this.#checkWin(nextX, grounded);
  }

  #die(t: { [index: number]: number }): void {
    t[0] = PLAYER_SPAWN[0];
    t[1] = PLAYER_SPAWN[1];
    this.#vy = 0;
    this.#jumps = MAX_JUMPS;
    const deaths = this.signals.deaths;
    if (deaths) deaths.value = Number(deaths.value) + 1;
    this.#publish(PLAYER_SPAWN[0], PLAYER_SPAWN[1], false);
  }

  #publish(x: number, y: number, grounded: boolean): void {
    const sx = this.signals.playerX;
    const sy = this.signals.playerY;
    const sg = this.signals.grounded;
    if (sx) sx.value = x;
    if (sy) sy.value = y;
    if (sg) sg.value = grounded;
  }

  #collectCoins(px: number, py: number): void {
    const coins = this.signals.coins;
    for (const coin of COINS) {
      if (this.#collected.has(coin.key)) continue;
      if (Math.abs(px - coin.x) < COIN_RADIUS && Math.abs(py - coin.y) < COIN_RADIUS + 0.4) {
        this.#collected.add(coin.key);
        const ce = this.#find(coin.key);
        if (ce !== null) ce.getVectorView(LocalTransform, "translation")[1] = -100;
        if (coins) coins.value = this.#collected.size;
      }
    }
  }

  #checkWin(px: number, grounded: boolean): void {
    const won = this.signals.won;
    if (won && grounded && Math.abs(px - GOAL_X) < 0.6) won.value = true;
  }

  #find(key: string) {
    for (const e of this.queries.actors.entities) {
      if (e.getValue(AppEntityKey, "value") === key) return e;
    }
    return null;
  }
}
