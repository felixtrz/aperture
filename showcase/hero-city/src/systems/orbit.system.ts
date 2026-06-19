import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  type Entity,
} from "@aperture-engine/app/systems";
import {
  CAMERA_ORBIT_SPEED,
  CAMERA_PITCH,
  CAMERA_START_YAW,
  CAMERA_ZOOM,
  cameraOffset,
} from "../lib/city-layout.js";

// Slowly drifts the isometric camera around the town center so the hero scene
// feels alive without any user input. The focus point is fixed at the origin.
export default class OrbitSystem extends createSystem({
  priority: 10,
  queries: { keyed: { required: [AppEntityKey, LocalTransform] } },
}) {
  #yaw = CAMERA_START_YAW;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#yaw += dt * CAMERA_ORBIT_SPEED;

    const camera = this.#findByKey("camera.main");
    if (camera === null) {
      return;
    }

    const offset = cameraOffset(this.#yaw, CAMERA_ZOOM);
    camera.getVectorView(LocalTransform, "translation").set(offset);
    camera
      .getVectorView(LocalTransform, "rotation")
      .set(quatFromEulerYXZ(-CAMERA_PITCH, this.#yaw, 0));
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.keyed.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }
    return null;
  }
}
