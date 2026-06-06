import type RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsQuat, PhysicsVec3 } from "@aperture-engine/physics";

export function addScaledVec3(
  origin: PhysicsVec3,
  direction: PhysicsVec3,
  scale: number,
): PhysicsVec3 {
  return [
    origin[0] + direction[0] * scale,
    origin[1] + direction[1] * scale,
    origin[2] + direction[2] * scale,
  ];
}

export function addVec3(left: PhysicsVec3, right: PhysicsVec3): PhysicsVec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function cloneVec3(value: PhysicsVec3): PhysicsVec3 {
  return [value[0], value[1], value[2]];
}

export function subtractVec3(
  left: PhysicsVec3,
  right: PhysicsVec3,
): PhysicsVec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

export function distanceVec3(left: PhysicsVec3, right: PhysicsVec3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

export function normalizeVec3(value: PhysicsVec3): PhysicsVec3 {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length === 0) {
    return [0, 1, 0];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

export function vec3(value: RAPIER.Vector): PhysicsVec3 {
  return [value.x, value.y, value.z];
}

export function colliderLocalPointToWorld(
  collider: RAPIER.Collider,
  point: RAPIER.Vector,
): PhysicsVec3 {
  const rotated = rotateVec3(vec3(point), collider.rotation());
  const translation = collider.translation();

  return [
    rotated[0] + translation.x,
    rotated[1] + translation.y,
    rotated[2] + translation.z,
  ];
}

export function colliderLocalVectorToWorld(
  collider: RAPIER.Collider,
  value: RAPIER.Vector,
): PhysicsVec3 {
  return rotateVec3(vec3(value), collider.rotation());
}

export function bodyLocalPointToWorld(
  body: RAPIER.RigidBody,
  point: PhysicsVec3,
): PhysicsVec3 {
  const rotated = bodyLocalVectorToWorld(body, point);
  const translation = body.translation();

  return [
    rotated[0] + translation.x,
    rotated[1] + translation.y,
    rotated[2] + translation.z,
  ];
}

export function bodyLocalVectorToWorld(
  body: RAPIER.RigidBody,
  value: PhysicsVec3,
): PhysicsVec3 {
  return rotateVec3(value, body.rotation());
}

export function rotateVec3(
  value: PhysicsVec3,
  rotation: RAPIER.Rotation,
): PhysicsVec3 {
  return rotateVec3ByQuat(value, [
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  ]);
}

export function rotateVec3ByQuat(
  value: PhysicsVec3,
  rotation: PhysicsQuat,
): PhysicsVec3 {
  const qx = rotation[0];
  const qy = rotation[1];
  const qz = rotation[2];
  const qw = rotation[3];
  const x = value[0];
  const y = value[1];
  const z = value[2];
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

export function normalizeQuat(value: PhysicsQuat): PhysicsQuat {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);

  if (!Number.isFinite(length) || length === 0) {
    return [0, 0, 0, 1];
  }

  return [
    value[0] / length,
    value[1] / length,
    value[2] / length,
    value[3] / length,
  ];
}

export function multiplyQuat(
  left: PhysicsQuat,
  right: PhysicsQuat,
): PhysicsQuat {
  const leftNormalized = normalizeQuat(left);
  const rightNormalized = normalizeQuat(right);
  const lx = leftNormalized[0];
  const ly = leftNormalized[1];
  const lz = leftNormalized[2];
  const lw = leftNormalized[3];
  const rx = rightNormalized[0];
  const ry = rightNormalized[1];
  const rz = rightNormalized[2];
  const rw = rightNormalized[3];

  return normalizeQuat([
    lw * rx + lx * rw + ly * rz - lz * ry,
    lw * ry - lx * rz + ly * rw + lz * rx,
    lw * rz + lx * ry - ly * rx + lz * rw,
    lw * rw - lx * rx - ly * ry - lz * rz,
  ]);
}

export function vec(value: PhysicsVec3): RAPIER.Vector3 {
  return { x: value[0], y: value[1], z: value[2] };
}

export function quat(
  value: readonly [number, number, number, number],
): RAPIER.Rotation {
  return { x: value[0], y: value[1], z: value[2], w: value[3] };
}

export function quatFromRapierRotation(rotation: RAPIER.Rotation): PhysicsQuat {
  return [rotation.x, rotation.y, rotation.z, rotation.w];
}
