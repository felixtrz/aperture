import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  type Entity,
  type InputAxis2dAction,
  type InputButtonAction,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import {
  CAMERA_FOLLOW_RATE,
  CAMERA_KEY,
  CAMERA_PITCH_MAX_DEG,
  CAMERA_PITCH_MIN_DEG,
  CAMERA_ROTATE_LERP,
  CAMERA_ROTATE_SPEED_DEG,
  CAMERA_TARGET_Y_OFFSET,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_SPEED,
} from "../lib/platformer-data.js";
import {
  approachVec3,
  cameraOffset,
  clamp,
  clamp01,
  degToRad,
  lerp,
  lerpAngle,
} from "../lib/platformer-controls.js";
import { PlatformerResource } from "../lib/platformer-resource.js";

const ROTATE_SPEED = degToRad(CAMERA_ROTATE_SPEED_DEG);
const PITCH_MIN = degToRad(CAMERA_PITCH_MIN_DEG);
const PITCH_MAX = degToRad(CAMERA_PITCH_MAX_DEG);

export default class CameraSystem extends createSystem({
  priority: 80,
  queries: { keyed: { required: [AppEntityKey] } },
}) {
  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    const state = this.resources.read(PlatformerResource);

    const rotate = this.actions.cameraRotate;
    const rx = rotate?.kind === "axis2d" ? (rotate as InputAxis2dAction).x.value : 0;
    const ry = rotate?.kind === "axis2d" ? (rotate as InputAxis2dAction).y.value : 0;
    const zoomDelta =
      (this.#held("zoomOut") ? 1 : 0) - (this.#held("zoomIn") ? 1 : 0);

    const targetYaw = state.cameraTargetYaw + rx * ROTATE_SPEED * dt;
    const targetPitch = clamp(
      state.cameraTargetPitch + ry * ROTATE_SPEED * dt,
      PITCH_MIN,
      PITCH_MAX,
    );
    const zoom = clamp(
      state.cameraZoom + zoomDelta * CAMERA_ZOOM_SPEED * dt,
      CAMERA_ZOOM_MIN,
      CAMERA_ZOOM_MAX,
    );

    const yaw = lerpAngle(state.cameraYaw, targetYaw, clamp01(CAMERA_ROTATE_LERP * dt));
    const pitch = lerp(state.cameraPitch, targetPitch, clamp01(CAMERA_ROTATE_LERP * dt));

    const followTarget: Vec3 = [
      state.bodyPosition[0],
      state.bodyPosition[1] + CAMERA_TARGET_Y_OFFSET,
      state.bodyPosition[2],
    ];
    const follow = approachVec3(state.cameraFollow, followTarget, CAMERA_FOLLOW_RATE, dt);

    const offset = cameraOffset(yaw, pitch, zoom);
    const camera = this.#findByKey(CAMERA_KEY);
    if (camera !== null) {
      camera
        .getVectorView(LocalTransform, "translation")
        .set([follow[0] + offset[0], follow[1] + offset[1], follow[2] + offset[2]]);
      camera
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromEulerYXZ(pitch, yaw, 0));
    }

    this.resources.write(PlatformerResource, (next) => {
      next.cameraYaw = yaw;
      next.cameraPitch = pitch;
      next.cameraZoom = zoom;
      next.cameraTargetYaw = targetYaw;
      next.cameraTargetPitch = targetPitch;
      next.cameraFollow = follow;
    });
  }

  #held(name: string): boolean {
    const action = this.actions[name];
    return action?.kind === "button"
      ? (action as InputButtonAction).pressed() === true
      : false;
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.keyed.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) return entity;
    }
    return null;
  }
}
