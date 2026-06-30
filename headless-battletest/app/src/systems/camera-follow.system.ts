import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

export default class CameraFollowSystem extends createSystem({
  priority: 80,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(): void {
    const player = this.findByKey("player");
    const camera = this.findByKey("camera.main");

    if (player === null || camera === null) {
      return;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");
    const cameraTranslation = camera.getVectorView(LocalTransform, "translation");
    cameraTranslation[0] = playerTranslation[0] ?? 0;
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
