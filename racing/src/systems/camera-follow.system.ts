import {
  LocalTransform,
  Name,
  createSystem,
  type ApertureQuery,
} from "@aperture-engine/app/systems";
import { quatLookAt, type Quat, type Vec3 } from "../lib/math.js";
import { CAMERA } from "../lib/tuning.js";
import { vehicleState } from "../lib/vehicle-state.js";

type QueryEntity = ApertureQuery["entities"] extends Set<infer T> ? T : never;

// Camera-aligned ground basis derived from the fixed offset (Camera.js):
// camRightXZ = normalize(offset.z, 0, -offset.x); camForwardXZ = normalize(-offset.x, 0, -offset.z)
const OFF = CAMERA.offset;
const RIGHT_XZ = normalize([OFF[2], 0, -OFF[0]]);
const FWD_XZ = normalize([-OFF[0], 0, -OFF[2]]);

export default class CameraFollowSystem extends createSystem({
  priority: 120,
  queries: { cams: { required: [Name, LocalTransform] } },
}) {
  #disposeFixedStep: (() => void) | null = null;
  #camera: QueryEntity | null = null;
  #smoothed: Vec3 = [...vehicleState.sphere];
  #initialized = false;

  override init(): void {
    this.#disposeFixedStep = this.fixedStep.register((context) => {
      this.#step(context.fixedDelta);
    });
  }

  override update(delta: number): void {
    void delta;
  }

  override destroy(): void {
    this.#disposeFixedStep?.();
    this.#disposeFixedStep = null;
    super.destroy();
  }

  #step(delta: number): void {
    if (!vehicleState.ready) return;
    if (this.#camera === null) this.#camera = this.#findNamed("main-camera");
    if (this.#camera === null) return;

    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    const target = vehicleState.sphere;

    // Lead = forward * horizontal speed (main.js _camLead).
    const mv = vehicleState.modelVelocity;
    const horizSpeed = Math.hypot(mv[0], mv[2]);
    const velocity: Vec3 = [
      vehicleState.forward[0] * horizSpeed,
      0,
      vehicleState.forward[2] * horizSpeed,
    ];

    const radius = CAMERA.deadzoneRadius;
    const radiusSq = radius * radius;

    let leadX = dot(velocity, RIGHT_XZ) * CAMERA.leadFactor;
    let leadY = dot(velocity, FWD_XZ) * CAMERA.leadFactor;
    const leadLenSq = leadX * leadX + leadY * leadY;
    if (leadLenSq > radiusSq) {
      const k = radius / Math.sqrt(leadLenSq);
      leadX *= k;
      leadY *= k;
    }

    const desired: Vec3 = [
      target[0] + RIGHT_XZ[0] * leadX + FWD_XZ[0] * leadY,
      target[1] + RIGHT_XZ[1] * leadX + FWD_XZ[1] * leadY,
      target[2] + RIGHT_XZ[2] * leadX + FWD_XZ[2] * leadY,
    ];

    const alpha = this.#initialized ? 1 - Math.exp(-dt * CAMERA.smoothing) : 1;
    this.#smoothed = [
      lerp(this.#smoothed[0], desired[0], alpha),
      lerp(this.#smoothed[1], desired[1], alpha),
      lerp(this.#smoothed[2], desired[2], alpha),
    ];
    this.#initialized = true;

    // Hard clamp: car stays within the deadzone disk.
    const dx = target[0] - this.#smoothed[0];
    const dy = target[1] - this.#smoothed[1];
    const dz = target[2] - this.#smoothed[2];
    const delta3: Vec3 = [dx, dy, dz];
    const offX = dot(delta3, RIGHT_XZ);
    const offY = dot(delta3, FWD_XZ);
    const offLenSq = offX * offX + offY * offY;
    if (offLenSq > radiusSq) {
      const offLen = Math.sqrt(offLenSq);
      const k = (offLen - radius) / offLen;
      this.#smoothed = [
        this.#smoothed[0] + RIGHT_XZ[0] * offX * k + FWD_XZ[0] * offY * k,
        this.#smoothed[1] + RIGHT_XZ[1] * offX * k + FWD_XZ[1] * offY * k,
        this.#smoothed[2] + RIGHT_XZ[2] * offX * k + FWD_XZ[2] * offY * k,
      ];
    }

    // Shift the whole view up-screen, then place camera at lookPoint + offset.
    const lookPoint: Vec3 = [
      this.#smoothed[0] - FWD_XZ[0] * CAMERA.screenShiftUp,
      this.#smoothed[1] - FWD_XZ[1] * CAMERA.screenShiftUp,
      this.#smoothed[2] - FWD_XZ[2] * CAMERA.screenShiftUp,
    ];
    const eye: Vec3 = [
      lookPoint[0] + OFF[0],
      lookPoint[1] + OFF[1],
      lookPoint[2] + OFF[2],
    ];

    this.#camera.getVectorView(LocalTransform, "translation").set(eye);
    this.#camera
      .getVectorView(LocalTransform, "rotation")
      .set(quatLookAt(eye, lookPoint) as Quat);
  }

  #findNamed(name: string): QueryEntity | null {
    for (const entity of this.queries.cams.entities) {
      if (entity.getValue(Name, "value") === name) return entity;
    }
    return null;
  }
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
