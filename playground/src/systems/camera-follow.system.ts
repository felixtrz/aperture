import {
  LocalTransform,
  Name,
  WorldTransform,
  createSystem,
  type ApertureQuery,
} from "@aperture-engine/app/systems";
import { CAMERA, PLAYER } from "../level.js";

type QueryEntity = ApertureQuery["entities"] extends Set<infer T> ? T : never;

export default class CameraFollowSystem extends createSystem({
  priority: 120,
  queries: {
    transforms: {
      required: [Name, LocalTransform],
    },
  },
}) {
  override update(): void {
    const player = this.#findNamedEntity("player");
    const camera = this.#findNamedEntity("main-camera");
    if (player === null || camera === null) {
      return;
    }

    const playerTranslation = player.getVectorView(
      LocalTransform,
      "translation",
    );
    const cameraTranslation = camera.getVectorView(
      LocalTransform,
      "translation",
    );
    const playerX = Number(playerTranslation[0] ?? PLAYER.start[0]);
    const playerY = Number(playerTranslation[1] ?? PLAYER.start[1]);
    const currentX = Number(cameraTranslation[0] ?? playerX);
    const currentY = Number(cameraTranslation[1] ?? CAMERA.minY);
    const targetY = Math.max(CAMERA.minY, playerY + CAMERA.yOffset);
    const nextX = lerp(currentX, playerX, CAMERA.smoothing);
    const nextY = lerp(currentY, targetY, CAMERA.smoothing);
    const nextTranslation = [nextX, nextY, CAMERA.distance] as const;

    cameraTranslation.set(nextTranslation);

    if (camera.hasComponent(WorldTransform)) {
      camera
        .getVectorView(WorldTransform, "col3")
        .set([nextTranslation[0], nextTranslation[1], nextTranslation[2], 1]);
    }
  }

  #findNamedEntity(name: string): QueryEntity | null {
    for (const entity of this.queries.transforms.entities) {
      if (entity.getValue(Name, "value") === name) {
        return entity;
      }
    }

    return null;
  }
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}
