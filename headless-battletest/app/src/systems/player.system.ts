import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

const GROUND_Y = 0.55;
const GRAVITY = -18;
const JUMP_VELOCITY = 7;
const MAX_JUMPS = 2;

export default class PlayerSystem extends createSystem({
  priority: 20,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  #verticalVelocity = 0;
  #jumpsRemaining = MAX_JUMPS;

  override update(delta: number): void {
    const player = this.findByKey("player");
    const gem = this.findByKey("collectible.goal");
    const score = this.signals.score;
    const playerX = this.signals.playerX;
    const goalReached = this.signals.goalReached;

    if (
      player === null ||
      score === undefined ||
      playerX === undefined ||
      goalReached === undefined
    ) {
      return;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");

    const reset = this.actions.reset;
    if (reset?.kind === "button" && reset.down()) {
      playerTranslation[0] = -3.5;
      score.value = 0;
      goalReached.value = false;
      if (gem !== null) {
        gem.getVectorView(LocalTransform, "translation")[1] = 0.65;
      }
    }

    const move = this.actions.move;
    const direction = move?.kind === "axis2d" ? move.x.value : 0;
    const playerCurrentX = playerTranslation[0] ?? -3.5;
    const playerNextX = Math.max(
      -4,
      Math.min(4.2, playerCurrentX + direction * delta * 3),
    );
    playerTranslation[0] = playerNextX;
    playerX.value = playerNextX;

    // Vertical jump + gravity. The `jump` button is a button action, so it can
    // be driven from both `aperture headless --inject` and the warm serve
    // `inject` command. Integration uses the fixed delta for deterministic arcs.
    const currentY = playerTranslation[1] ?? GROUND_Y;
    const grounded = currentY <= GROUND_Y + 1e-4 && this.#verticalVelocity <= 0;
    if (grounded) {
      this.#jumpsRemaining = MAX_JUMPS;
    }
    const jump = this.actions.jump;
    if (jump?.kind === "button" && jump.down() && this.#jumpsRemaining > 0) {
      this.#verticalVelocity = JUMP_VELOCITY;
      this.#jumpsRemaining -= 1;
    }
    this.#verticalVelocity += GRAVITY * delta;
    let nextY = currentY + this.#verticalVelocity * delta;
    if (nextY <= GROUND_Y) {
      nextY = GROUND_Y;
      this.#verticalVelocity = 0;
      this.#jumpsRemaining = MAX_JUMPS;
    }
    playerTranslation[1] = nextY;

    if (
      gem !== null &&
      Number(score.value) === 0 &&
      Math.abs(playerNextX - 1.8) < 0.45
    ) {
      score.value = 1;
      gem.getVectorView(LocalTransform, "translation")[1] = -10;
      this.diagnostics.info("game.collectible.collected", {
        score: score.value,
      });
    }

    if (Number(score.value) > 0 && playerNextX > 3.5) {
      goalReached.value = true;
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
