import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

const GROUND_Y = 0.55;
const GRAVITY = -18;
const JUMP_VELOCITY = 7;
const MAX_JUMPS = 2;
const DASH_SPEED = 12;
const DASH_FRAMES = 6;
const DASH_COOLDOWN = 30;

export default class PlayerSystem extends createSystem({
  priority: 20,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  #verticalVelocity = 0;
  #jumpsRemaining = MAX_JUMPS;
  #dashFrames = 0;
  #dashCooldown = 0;
  #dashDir = 1;

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

    // Dash: a button-triggered horizontal burst on a cooldown. Direction is the
    // current move direction (defaults to facing right).
    if (this.#dashCooldown > 0) {
      this.#dashCooldown -= 1;
    }
    const dash = this.actions.dash;
    if (
      dash?.kind === "button" &&
      dash.down() &&
      this.#dashFrames <= 0 &&
      this.#dashCooldown <= 0
    ) {
      this.#dashFrames = DASH_FRAMES;
      this.#dashCooldown = DASH_COOLDOWN;
      this.#dashDir = direction >= 0 ? 1 : -1;
    }
    let dashContribution = 0;
    if (this.#dashFrames > 0) {
      dashContribution = this.#dashDir * DASH_SPEED;
      this.#dashFrames -= 1;
    }

    const playerCurrentX = playerTranslation[0] ?? -3.5;
    const playerNextX = Math.max(
      -4,
      Math.min(4.2, playerCurrentX + (direction * 3 + dashContribution) * delta),
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
