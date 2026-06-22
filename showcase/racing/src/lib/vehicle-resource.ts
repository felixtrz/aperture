import {
  defineResource,
  resource,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";

export const VEHICLE_INITIAL_SPHERE: Vec3 = [3.5, 0.5, 5];
export const VEHICLE_INITIAL_CONTAINER: Vec3 = [3.5, 0, 5];

export const VehicleResource = defineResource("racing.vehicle", {
  ready: resource.boolean(false),
  sphere: resource.vec3(VEHICLE_INITIAL_SPHERE),
  container: resource.vec3(VEHICLE_INITIAL_CONTAINER),
  yaw: resource.number(0),
  forward: resource.vec3([0, 0, 1]),
  linearSpeed: resource.number(0),
  modelVelocity: resource.vec3([0, 0, 0]),
  driftIntensity: resource.number(0),
  throttle: resource.number(0),
  hadInput: resource.boolean(false),
  wheelBL: resource.nullableVec3(),
  wheelBR: resource.nullableVec3(),
});
