import {
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
  type ApertureQuery,
} from "@aperture-engine/app/systems";
import { LEVEL, PLAYER, TOTAL_GEMS, type Rect } from "../level.js";

type QueryEntity = ApertureQuery["entities"] extends Set<infer T> ? T : never;

const PLAYER_ASSET_VISUAL = {
  name: "player.asset",
  scale: PLAYER.assetScale,
  z: -0.05,
} as const;

export default class PlayerSystem extends createSystem({
  priority: 40,
  queries: {
    transforms: {
      required: [Name, LocalTransform],
    },
  },
}) {
  #velocityY = 0;
  #grounded = false;
  #lastDirection = 1;
  #wasJumpPressed = false;
  #wasResetPressed = false;
  #elapsed = 0;
  #complete = false;
  #deaths = 0;
  readonly #collected = new Set<number>();

  override update(delta: number): void {
    const player = this.#findNamedEntity("player");
    if (player === null) {
      return;
    }

    const resetPressed = this.#isPressed("reset");
    if (resetPressed && !this.#wasResetPressed) {
      this.#reset(player, "Reset run");
    }
    this.#wasResetPressed = resetPressed;

    if (this.#complete) {
      this.#writeSignals("clear", "Clear. Press R to replay.");
      return;
    }

    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#elapsed += dt;

    const translation = player.getVectorView(LocalTransform, "translation");
    const previousX = Number(translation[0] ?? PLAYER.start[0]);
    const previousY = Number(translation[1] ?? PLAYER.start[1]);
    const moveAxis =
      (this.#isPressed("moveRight") ? 1 : 0) -
      (this.#isPressed("moveLeft") ? 1 : 0);

    if (moveAxis !== 0) {
      this.#lastDirection = moveAxis;
    }

    let nextX = previousX + moveAxis * PLAYER.speed * dt;
    nextX = clamp(nextX, LEVEL.startX - 0.3, LEVEL.goalX + 1.25);

    const jumpPressed = this.#isPressed("jump");
    if (jumpPressed && !this.#wasJumpPressed && this.#grounded) {
      this.#velocityY = PLAYER.jumpSpeed;
      this.#grounded = false;
    }
    this.#wasJumpPressed = jumpPressed;

    if (this.#touchesSpring(previousX, previousY)) {
      this.#velocityY = Math.max(this.#velocityY, PLAYER.jumpSpeed * 1.16);
      this.#grounded = false;
    }

    this.#velocityY += PLAYER.gravity * dt;
    let nextY = previousY + this.#velocityY * dt;

    const landingY = this.#landingY(previousX, nextX, previousY, nextY);
    if (landingY !== null) {
      nextY = landingY;
      this.#velocityY = 0;
      this.#grounded = true;
    } else {
      this.#grounded = false;
    }

    if (nextY < PLAYER.fallLimit || this.#touchesHazard(nextX, nextY)) {
      this.#deaths += 1;
      this.#reset(player, "Try again. Watch the spikes.");
      return;
    }

    this.#writePlayerTransform(player, nextX, nextY);
    this.#collectGems(nextX, nextY);

    if (this.#collected.size === TOTAL_GEMS && nextX >= LEVEL.goalX) {
      this.#complete = true;
      this.#velocityY = 0;
      this.#writeSignals("clear", "All gems collected. Level clear.");
      return;
    }

    this.#writeSignals(
      "run",
      this.#collected.size === TOTAL_GEMS
        ? "Reach the flag"
        : "Collect every gem and reach the flag",
    );
  }

  #isPressed(action: string): boolean {
    return this.input.actions[action]?.pressed.value === true;
  }

  #findNamedEntity(name: string): QueryEntity | null {
    for (const entity of this.queries.transforms.entities) {
      if (entity.getValue(Name, "value") === name) {
        return entity;
      }
    }

    return null;
  }

  #landingY(
    previousX: number,
    nextX: number,
    previousY: number,
    nextY: number,
  ): number | null {
    for (const platform of LEVEL.platforms) {
      const top = platform.bounds.y + platform.bounds.height / 2;
      const previousFeetY = previousY - PLAYER.feetOffset;
      const nextFeetY = nextY - PLAYER.feetOffset;
      const wasAbove = previousFeetY >= top - 0.08;
      const crossedTop = nextFeetY <= top;
      const withinX = rectsOverlap(
        playerFootRect((previousX + nextX) * 0.5, top),
        platform.bounds,
      );

      if (wasAbove && crossedTop && withinX) {
        return top + PLAYER.feetOffset;
      }
    }

    return null;
  }

  #touchesHazard(x: number, y: number): boolean {
    const feetY = y - PLAYER.feetOffset;
    const playerRect = {
      x,
      y: feetY + PLAYER.height * 0.45,
      width: PLAYER.width,
      height: PLAYER.height * 0.7,
    };

    return LEVEL.hazards.some((hazard) =>
      rectsOverlap(playerRect, hazard.bounds),
    );
  }

  #touchesSpring(x: number, y: number): boolean {
    const dx = Math.abs(x - -0.52);
    const dy = Math.abs(y - 1.15);

    return dx < 0.34 && dy < 0.28 && this.#velocityY <= 0;
  }

  #collectGems(playerX: number, playerY: number): void {
    LEVEL.gems.forEach((gem, index) => {
      if (this.#collected.has(index)) {
        return;
      }
      const distance = Math.hypot(
        playerX - gem.position[0],
        playerY - gem.position[1],
      );

      if (distance <= gem.radius) {
        this.#collected.add(index);
        this.#setGemCollected(index, true);
      }
    });
  }

  #reset(player: QueryEntity, message: string): void {
    this.#velocityY = 0;
    this.#grounded = false;
    this.#lastDirection = 1;
    this.#elapsed = 0;
    this.#complete = false;
    this.#collected.clear();
    this.#writePlayerTransform(player, PLAYER.start[0], PLAYER.start[1]);

    LEVEL.gems.forEach((_gem, index) => {
      this.#setGemCollected(index, false);
    });

    this.#writeSignals("run", message);
  }

  #setGemCollected(index: number, collected: boolean): void {
    const gem = LEVEL.gems[index];
    if (gem === undefined) {
      return;
    }

    for (const entity of this.queries.transforms.entities) {
      const name = entity.getValue(Name, "value");
      if (!isGemEntityName(name, index)) {
        continue;
      }

      const isAsset = name.includes(".asset.");
      const prefix = collected ? "collected" : "gem";
      entity.setValue(
        Name,
        "value",
        `${prefix}.${isAsset ? "asset." : ""}${index}`,
      );
      entity
        .getVectorView(LocalTransform, "translation")
        .set(
          collected ? [gem.position[0], -20, gem.position[2]] : gem.position,
        );
      entity
        .getVectorView(LocalTransform, "scale")
        .set(collected ? [0.001, 0.001, 0.001] : gem.scale);
    }
  }

  #writePlayerTransform(player: QueryEntity, x: number, y: number): void {
    const rotation = quatFromAxisAngle(
      [0, 1, 0],
      this.#lastDirection > 0 ? 0.36 : -0.36,
    );

    player.getVectorView(LocalTransform, "translation").set([x, y, 0.12]);
    player.getVectorView(LocalTransform, "scale").set(PLAYER.visualScale);
    player.getVectorView(LocalTransform, "rotation").set(rotation);

    const asset = this.#findNamedEntity(PLAYER_ASSET_VISUAL.name);
    if (asset !== null) {
      asset
        .getVectorView(LocalTransform, "translation")
        .set([x, y, PLAYER_ASSET_VISUAL.z]);
      asset
        .getVectorView(LocalTransform, "scale")
        .set(PLAYER_ASSET_VISUAL.scale);
      asset.getVectorView(LocalTransform, "rotation").set(rotation);
    }
  }

  #writeSignals(state: "run" | "clear", message: string): void {
    const playerTranslation = this.#findNamedEntity("player")?.getVectorView(
      LocalTransform,
      "translation",
    );

    this.#setSignal("gems", this.#collected.size);
    this.#setSignal("totalGems", TOTAL_GEMS);
    this.#setSignal("runState", state);
    this.#setSignal("time", Number(this.#elapsed.toFixed(1)));
    this.#setSignal(
      "playerX",
      Number((playerTranslation?.[0] ?? PLAYER.start[0]).toFixed(2)),
    );
    this.#setSignal(
      "playerY",
      Number((playerTranslation?.[1] ?? PLAYER.start[1]).toFixed(2)),
    );
    this.#setSignal("deaths", this.#deaths);
    this.#setSignal("message", message);
  }

  #setSignal(name: string, value: number | string): void {
    const signal = this.signals[name];

    if (signal !== undefined) {
      signal.value = value;
    }
  }
}

function playerFootRect(x: number, y: number): Rect {
  return {
    x,
    y,
    width: PLAYER.width,
    height: 0.12,
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isGemEntityName(value: unknown, index: number): value is string {
  return (
    value === `gem.${index}` ||
    value === `gem.asset.${index}` ||
    value === `collected.${index}` ||
    value === `collected.asset.${index}`
  );
}
