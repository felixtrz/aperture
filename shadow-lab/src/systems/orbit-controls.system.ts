import {
  LocalTransform,
  Name,
  createSystem,
  type ApertureQuery,
} from "@aperture-engine/app/systems";

type QueryEntity = ApertureQuery["entities"] extends Set<infer T> ? T : never;
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

// Debug orbit controls: drag the mouse to orbit the camera around the scene,
// scroll to zoom. Owns the "main-camera" LocalTransform each frame (spherical
// target + azimuth/elevation/distance), so you can fly around and inspect the
// scene orientation yourself. Pointer position is normalized [0,1].
const ROTATE_SPEED = 3.0; // radians per full-screen drag
const ZOOM_SPEED = 0.02; // distance units per wheel tick
const POLE = Math.PI / 2 - 0.01;

export default class OrbitControlsSystem extends createSystem({
  priority: 200,
  queries: { cams: { required: [Name, LocalTransform] } },
}) {
  #camera: QueryEntity | null = null;
  // Minimal scene: near-top-down so the ground cast-shadow can't hide behind
  // the caster (debugging the protrusion case).
  #azimuth = 0.8;
  #elevation = 1.15;
  #distance = 20;
  readonly #target: Vec3 = [0, 0, 0];
  #prev: readonly [number, number] | null = null;

  override update(): void {
    // DISABLED: the split-screen three.js comparison harness
    // (src/compare/three-compare.ts) owns the camera and drives BOTH renderers
    // from the main thread so the panes stay frame-locked. Re-enable by removing
    // this early return if running the lab without the comparison harness.
    return;

    if (this.#camera === null) this.#camera = this.#findNamed("main-camera");
    if (this.#camera === null) return;

    const pointer = this.input.pointer.primary;
    const pos = pointer.position.value;
    const pressed = pointer.pressed.value;

    if (pressed && this.#prev !== null) {
      const dx = pos[0] - this.#prev[0];
      const dy = pos[1] - this.#prev[1];
      this.#azimuth -= dx * ROTATE_SPEED;
      this.#elevation = clamp(this.#elevation - dy * ROTATE_SPEED, -POLE, POLE);
    }
    this.#prev = pressed ? pos : null;

    const wheel = this.input.wheel.deltaY.value;
    if (wheel !== 0) {
      this.#distance = clamp(this.#distance + wheel * ZOOM_SPEED, 2, 120);
    }

    const cosEl = Math.cos(this.#elevation);
    const eye: Vec3 = [
      this.#target[0] + this.#distance * cosEl * Math.sin(this.#azimuth),
      this.#target[1] + this.#distance * Math.sin(this.#elevation),
      this.#target[2] + this.#distance * cosEl * Math.cos(this.#azimuth),
    ];
    this.#camera.getVectorView(LocalTransform, "translation").set(eye);
    this.#camera
      .getVectorView(LocalTransform, "rotation")
      .set(quatLookAt(eye, this.#target));
  }

  #findNamed(name: string): QueryEntity | null {
    for (const entity of this.queries.cams.entities) {
      if (entity.getValue(Name, "value") === name) return entity;
    }
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Camera forward is -Z; build a basis where -Z points at the target (up = +Y).
function quatLookAt(eye: Vec3, target: Vec3): Quat {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  const zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl;
  zy /= zl;
  zz /= zl;
  // x = normalize(cross(up, z)) with up = [0,1,0]
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl;
  xy /= xl;
  xz /= xl;
  // y = cross(z, x)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return matBasisToQuat(xx, xy, xz, yx, yy, yz, zx, zy, zz);
}

function matBasisToQuat(
  m00: number,
  m10: number,
  m20: number,
  m01: number,
  m11: number,
  m21: number,
  m02: number,
  m12: number,
  m22: number,
): Quat {
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}
