import {
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";
import { LEVEL } from "../level.js";

export default class CollectibleAnimationSystem extends createSystem({
  priority: 80,
  queries: {
    transforms: {
      required: [Name, LocalTransform],
    },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.transforms.entities) {
      const name = entity.getValue(Name, "value");
      const index = gemIndexFromName(name);

      if (index === null) {
        continue;
      }

      const gem = LEVEL.gems[index];
      if (gem === undefined) {
        continue;
      }

      const bob = Math.sin(time * 2.8 + index * 0.75) * 0.08;
      entity
        .getVectorView(LocalTransform, "translation")
        .set([gem.position[0], gem.position[1] + bob, gem.position[2]]);
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * 2.4 + index));
    }
  }
}

function gemIndexFromName(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const prefix = value.startsWith("gem.asset.") ? "gem.asset." : "gem.";
  if (!value.startsWith(prefix)) {
    return null;
  }

  const index = Number(value.slice(prefix.length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}
