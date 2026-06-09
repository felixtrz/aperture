import RAPIER from "@dimforge/rapier3d-compat";
import type {
  PhysicsColliderDescriptor,
  PhysicsQuat,
  PhysicsShape,
} from "@aperture-engine/physics";
import { multiplyQuat, normalizeQuat } from "./math.js";

export function queryShape(shape: PhysicsShape): RAPIER.Shape {
  switch (shape.kind) {
    case "box":
      return new RAPIER.Cuboid(...shape.halfExtents);
    case "sphere":
      return new RAPIER.Ball(shape.radius);
    case "capsule":
      return new RAPIER.Capsule(shape.halfHeight, shape.radius);
    case "cylinder":
      return new RAPIER.Cylinder(shape.halfHeight, shape.radius);
    case "cone":
      return new RAPIER.Cone(shape.halfHeight, shape.radius);
    case "convexHull":
    case "trimesh":
    case "heightfield":
      throw new Error(
        `Rapier backend does not support '${shape.kind}' overlap queries in this slice.`,
      );
  }
}

export function colliderShapeRotation(
  collider: PhysicsColliderDescriptor,
): PhysicsQuat | null {
  const axisRotation = primitiveAxisRotation(collider.shape);

  if (collider.offsetRotation === undefined) {
    return axisRotation;
  }

  const offsetRotation = normalizeQuat(collider.offsetRotation);

  if (axisRotation === null) {
    return offsetRotation;
  }

  return multiplyQuat(offsetRotation, axisRotation);
}

export function queryShapeRotation(
  rotation: PhysicsQuat,
  shape: PhysicsShape,
): PhysicsQuat {
  const axisRotation = primitiveAxisRotation(shape);
  const normalized = normalizeQuat(rotation);

  return axisRotation === null
    ? normalized
    : multiplyQuat(normalized, axisRotation);
}

function primitiveAxisRotation(shape: PhysicsShape): PhysicsQuat | null {
  switch (shape.kind) {
    case "capsule":
    case "cylinder":
    case "cone":
      switch (shape.axis) {
        case "x":
          return [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
        case "z":
          return [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
        case "y":
        case undefined:
          return null;
      }
      return null;
    case "box":
    case "sphere":
    case "convexHull":
    case "trimesh":
    case "heightfield":
      return null;
  }
}
