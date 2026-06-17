import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  type Entity,
} from "@aperture-engine/app/systems";
import { sourceCloudHoverPosition } from "../lib/fps-controls.js";
import { CLOUDS } from "../lib/fps-data.js";

export default class CloudsSystem extends createSystem({
  priority: 10,
  queries: {
    cloudRoots: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  #time = 0;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#time += dt;

    for (const cloud of CLOUDS) {
      const entity = this.#findByKey(cloud.key);
      if (entity === null) continue;
      entity
        .getVectorView(LocalTransform, "translation")
        .set(
          sourceCloudHoverPosition({
            basePosition: cloud.position,
            hoverVelocity: cloud.hoverVelocity,
            hoverRate: cloud.hoverRate,
            time: this.#time,
          }),
        );
    }
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.cloudRoots.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) return entity;
    }
    return null;
  }
}
