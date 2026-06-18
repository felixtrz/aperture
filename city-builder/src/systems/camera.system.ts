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
  CAMERA_DEFAULT_YAW,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CAMERA_PAN_SPEED,
  CAMERA_PITCH,
  CAMERA_POSITION_LERP,
  CAMERA_ROTATION_LERP,
  CAMERA_YAW_RADIANS_PER_PIXEL,
  CAMERA_ZOOM_LERP,
  CAMERA_ZOOM_STEP,
  CITY_CAMERA_CHANNEL,
  cameraOffset,
  lerp,
  type CityCameraCommand,
} from "../lib/city-data.js";

// Smooth isometric orbit rig (scripts/view.gd). A focus point glides over the
// ground; the camera sits back along the rig direction by `zoom` metres and
// always looks at the focus. WASD pans the focus in screen-space, the wheel
// zooms, and a middle-mouse drag yaws the rig.
export default class CameraSystem extends createSystem({
  priority: 10,
  queries: { keyed: { required: [AppEntityKey, LocalTransform] } },
}) {
  #focus: Vec3 = [0, 0, 0];
  #targetFocus: Vec3 = [0, 0, 0];
  #yaw = CAMERA_DEFAULT_YAW;
  #targetYaw = CAMERA_DEFAULT_YAW;
  #zoom = CAMERA_DEFAULT_ZOOM;
  #targetZoom = CAMERA_DEFAULT_ZOOM;
  #centerWasPressed = false;
  #zoomInWasPressed = false;
  #zoomOutWasPressed = false;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);

    // --- browser camera commands (wheel zoom + middle-drag yaw) -------------
    for (const command of this.commands.drain<CityCameraCommand>(
      CITY_CAMERA_CHANNEL,
    )) {
      if (command.kind === "zoom") {
        this.#targetZoom = Math.max(
          CAMERA_MIN_ZOOM,
          Math.min(
            CAMERA_MAX_ZOOM,
            this.#targetZoom + command.delta * CAMERA_ZOOM_STEP,
          ),
        );
      } else if (command.kind === "yaw") {
        // view.gd: camera_rotation.y -= relative.x / 10
        this.#targetYaw -= command.delta * CAMERA_YAW_RADIANS_PER_PIXEL;
      }
    }

    // --- keyboard / gamepad zoom (same step + clamp as the wheel) ----------
    if (
      this.#edge(
        "zoomIn",
        () => this.#zoomInWasPressed,
        (v) => (this.#zoomInWasPressed = v),
      )
    ) {
      this.#targetZoom = Math.max(
        CAMERA_MIN_ZOOM,
        this.#targetZoom - CAMERA_ZOOM_STEP,
      );
    }
    if (
      this.#edge(
        "zoomOut",
        () => this.#zoomOutWasPressed,
        (v) => (this.#zoomOutWasPressed = v),
      )
    ) {
      this.#targetZoom = Math.min(
        CAMERA_MAX_ZOOM,
        this.#targetZoom + CAMERA_ZOOM_STEP,
      );
    }

    // --- WASD pan (screen-relative, rotated into the rig's yaw) -------------
    const pan = this.actions.pan;
    const panX =
      pan?.kind === "axis2d" ? (pan as InputAxis2dAction).x.value : 0;
    const panY =
      pan?.kind === "axis2d" ? (pan as InputAxis2dAction).y.value : 0;
    if (panX !== 0 || panY !== 0) {
      // forward = away from camera along the ground; right = camera right.
      const forward: Vec3 = [-Math.sin(this.#yaw), 0, -Math.cos(this.#yaw)];
      const right: Vec3 = [Math.cos(this.#yaw), 0, -Math.sin(this.#yaw)];
      const forwardAmount = -panY; // W (negativeY) pushes the focus forward
      const rightAmount = panX; // D (positiveX) pushes the focus right
      const step = CAMERA_PAN_SPEED * dt;
      this.#targetFocus = [
        this.#targetFocus[0] +
          (right[0] * rightAmount + forward[0] * forwardAmount) * step,
        0,
        this.#targetFocus[2] +
          (right[2] * rightAmount + forward[2] * forwardAmount) * step,
      ];
    }

    // --- F recentres the focus (camera_center) ------------------------------
    if (
      this.#edge(
        "center",
        () => this.#centerWasPressed,
        (v) => (this.#centerWasPressed = v),
      )
    ) {
      this.#targetFocus = [0, 0, 0];
    }

    // --- smooth toward targets ---------------------------------------------
    this.#focus = [
      lerp(this.#focus[0], this.#targetFocus[0], dt * CAMERA_POSITION_LERP),
      0,
      lerp(this.#focus[2], this.#targetFocus[2], dt * CAMERA_POSITION_LERP),
    ];
    this.#yaw = lerp(this.#yaw, this.#targetYaw, dt * CAMERA_ROTATION_LERP);
    this.#zoom = lerp(this.#zoom, this.#targetZoom, dt * CAMERA_ZOOM_LERP);

    // --- write the camera transform ----------------------------------------
    const camera = this.#findByKey("camera.main");
    if (camera !== null) {
      const offset = cameraOffset(this.#yaw, this.#zoom);
      camera
        .getVectorView(LocalTransform, "translation")
        .set([
          this.#focus[0] + offset[0],
          this.#focus[1] + offset[1],
          this.#focus[2] + offset[2],
        ]);
      // Look down at the focus: euler pitch = -CAMERA_PITCH, yaw = rig yaw.
      camera
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromEulerYXZ(-CAMERA_PITCH, this.#yaw, 0));
    }

    if (this.signals.cameraZoom !== undefined) {
      this.signals.cameraZoom.value = this.#zoom;
    }
  }

  #edge(
    name: string,
    get: () => boolean,
    set: (value: boolean) => void,
  ): boolean {
    const action = this.actions[name];
    const button =
      action?.kind === "button" ? (action as InputButtonAction) : null;
    const down = button?.down() === true;
    const pressed = button?.pressed() === true;
    const edge = down || (pressed && !get());
    set(pressed);
    return edge;
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.keyed.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) return entity;
    }
    return null;
  }
}
