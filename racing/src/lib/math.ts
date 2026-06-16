// Small math helpers for the racing port. The aperture public systems surface
// exports quatFromAxisAngle but not quaternion composition / lookAt, so we
// provide the pieces the port needs (porting three.js Math behavior 1:1).

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Shortest-arc angular lerp (three.js Vehicle.lerpAngle). */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle / 2;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

/** Hamilton product a*b (apply b first, then a — same order as three.js). */
export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatNormalize(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

/** Euler in YXZ order (three.js default rotation.order for vehicle nodes). */
export function quatFromEulerYXZ(x: number, y: number, z: number): Quat {
  const qy = quatFromAxisAngle([0, 1, 0], y);
  const qx = quatFromAxisAngle([1, 0, 0], x);
  const qz = quatFromAxisAngle([0, 0, 1], z);
  // YXZ: R = Ry * Rx * Rz
  return quatNormalize(quatMultiply(quatMultiply(qy, qx), qz));
}

export function rotateVecByQuat(v: Vec3, q: Quat): Vec3 {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  // v + qw * t + cross(q.xyz, t)
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Quaternion that looks from `eye` toward `target` with +Y up (camera faces -Z). */
export function quatLookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Quat {
  // Camera forward is -Z; build basis where -Z points at target.
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl;
  zy /= zl;
  zz /= zl;
  // x = normalize(cross(up, z))
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  let xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl;
  xy /= xl;
  xz /= xl;
  // y = cross(z, x)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return matBasisToQuat(xx, xy, xz, yx, yy, yz, zx, zy, zz);
}

/** Quaternion from a column-major basis (right, up, forward columns). */
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
  // Standard Shepperd extraction. NOTE: the off-diagonal differences must follow
  // the (row,col) order m{i}{j}=R[i][j]; an earlier version flipped every sign and
  // returned the CONJUGATE (inverse) rotation, which made quatLookAt aim the camera
  // away from its target — see racing/docs/PORT_PROGRESS.md green-screen bug.
  const trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    w = 0.25 / s;
    x = (m21 - m12) * s;
    y = (m02 - m20) * s;
    z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return quatNormalize([x, y, z, w]);
}

/** Convert an sRGB hex color (0xRRGGBB) to a normalized [r,g,b,a] tuple. */
export function hexColor(hex: number, alpha = 1): [number, number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
    alpha,
  ];
}
