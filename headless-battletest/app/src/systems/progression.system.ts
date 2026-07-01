import { createSystem } from "@aperture-engine/app/systems";

// Derives level from score and flips gameOver when misses hit the cap. Runs
// after catch (priority 30) so it sees this frame's score/miss updates. Level
// ramps difficulty in director.system; gameOver gates director + catch.
const MISS_LIMIT = 10;
const SCORE_PER_LEVEL = 8;

export default class ProgressionSystem extends createSystem({ priority: 40 }) {
  override update(): void {
    const score = Number(this.signals.score?.value ?? 0);
    const missed = Number(this.signals.missed?.value ?? 0);

    const level = this.signals.level;
    if (level !== undefined) {
      level.value = 1 + Math.floor(score / SCORE_PER_LEVEL);
    }

    const gameOver = this.signals.gameOver;
    if (gameOver !== undefined && missed >= MISS_LIMIT && gameOver.value !== true) {
      gameOver.value = true;
      this.diagnostics.info("starfall.gameOver", { score, missed });
    }
  }
}
