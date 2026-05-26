import {
  LocalTransform,
  Name,
  WorldTransform,
  createSystem,
  type ApertureQuery,
} from "@aperture-engine/app/systems";
import { CAMERA, PLAYER } from "../level";

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
    const playerX = Number(playerTranslation[0] ?? PLAYER.start[0]);
    const playerY = Number(playerTranslation[1] ?? PLAYER.start[1]);
    const cameraY = Math.max(CAMERA.minY, playerY + CAMERA.yOffset);
    const cameraTranslation = [playerX, cameraY, CAMERA.distance] as const;

    camera.getVectorView(LocalTransform, "translation").set(cameraTranslation);

    if (camera.hasComponent(WorldTransform)) {
      camera
        .getVectorView(WorldTransform, "col3")
        .set([
          cameraTranslation[0],
          cameraTranslation[1],
          cameraTranslation[2],
          1,
        ]);
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
