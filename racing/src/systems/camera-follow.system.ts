import {
  LocalTransform,
  Name,
  createFollowCameraController,
  createSystem,
  type ApertureQuery,
  type FollowCameraController,
  type SimulationFixedStepContext,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import { CAMERA } from "../lib/tuning.js";
import {
  VEHICLE_INITIAL_SPHERE,
  VehicleResource,
} from "../lib/vehicle-resource.js";

type QueryEntity = ApertureQuery["entities"] extends Set<infer T> ? T : never;

export default class CameraFollowSystem extends createSystem({
  priority: 120,
  queries: { cams: { required: [Name, LocalTransform] } },
}) {
  #camera: QueryEntity | null = null;
  #follow: FollowCameraController | null = null;

  override fixedUpdate(context: SimulationFixedStepContext): void {
    this.#step(context.fixedDelta);
  }

  #step(delta: number): void {
    const vehicle = this.resources.read(VehicleResource);

    if (!vehicle.ready) return;
    if (this.#camera === null) this.#camera = this.#findNamed("main-camera");
    if (this.#camera === null) return;
    if (this.#follow === null) {
      this.#follow = createFollowCameraController({
        offset: CAMERA.offset,
        initialTarget: VEHICLE_INITIAL_SPHERE,
        leadFactor: CAMERA.leadFactor,
        smoothing: CAMERA.smoothing,
        deadzoneRadius: CAMERA.deadzoneRadius,
        screenShiftUp: CAMERA.screenShiftUp,
      });
    }

    const target = vehicle.sphere;

    // Lead = forward * horizontal speed (main.js _camLead).
    const mv = vehicle.modelVelocity;
    const horizSpeed = Math.hypot(mv[0], mv[2]);
    const velocity: Vec3 = [
      vehicle.forward[0] * horizSpeed,
      0,
      vehicle.forward[2] * horizSpeed,
    ];

    this.#follow.writeTo(this.#camera, {
      delta,
      target,
      leadVelocity: velocity,
    });
  }

  #findNamed(name: string): QueryEntity | null {
    for (const entity of this.queries.cams.entities) {
      if (entity.getValue(Name, "value") === name) return entity;
    }
    return null;
  }
}
