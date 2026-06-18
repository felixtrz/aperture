import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  type Entity,
} from "@aperture-engine/app/systems";
import { CLOUDS } from "../lib/platformer-data.js";
import { hoverOffset } from "../lib/platformer-controls.js";

export default class DecorSystem extends createSystem({
  priority: 10,
  queries: { keyed: { required: [AppEntityKey] } },
}) {
  #time = 0;

  override update(delta: number): void {
    this.#time += Math.min(Math.max(delta, 0), 1 / 30);

    for (const cloud of CLOUDS) {
      const entity = this.#findByKey(cloud.key);
      if (entity === null) continue;
      const y =
        cloud.position[1] +
        hoverOffset(this.#time, cloud.hoverRate, cloud.hoverVelocity);
      entity
        .getVectorView(LocalTransform, "translation")
        .set([cloud.position[0], y, cloud.position[2]]);
    }
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.keyed.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) return entity;
    }
    return null;
  }
}
