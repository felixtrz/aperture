import { PhysicsColliderAxis, type PhysicsShape } from "./components.js";
import type { PhysicsVec3 } from "./components.js";

const SCALE_EPSILON = 0.000001;

function approxEqual(a: number, b: number): boolean {
  return (
    Math.abs(a - b) <= SCALE_EPSILON * Math.max(1, Math.abs(a), Math.abs(b))
  );
}

export function isNonUnitScale(scale: PhysicsVec3): boolean {
  return (
    !approxEqual(scale[0], 1) ||
    !approxEqual(scale[1], 1) ||
    !approxEqual(scale[2], 1)
  );
}

/**
 * Splits an entity scale into the component along a primitive's length `axis`
 * and the two components in its radial cross-section, all as magnitudes.
 * Capsule/cylinder/cone are authored with `halfHeight` along `axis` and a single
 * `radius` in the perpendicular plane.
 */
function axisScaleComponents(
  scale: PhysicsVec3,
  axis: PhysicsColliderAxis,
): { readonly radial: readonly [number, number]; readonly axial: number } {
  const sx = Math.abs(scale[0]);
  const sy = Math.abs(scale[1]);
  const sz = Math.abs(scale[2]);

  switch (axis) {
    case PhysicsColliderAxis.X:
      return { radial: [sy, sz], axial: sx };
    case PhysicsColliderAxis.Z:
      return { radial: [sx, sy], axial: sz };
    case PhysicsColliderAxis.Y:
    default:
      return { radial: [sx, sz], axial: sy };
  }
}

/**
 * Bakes an entity scale into a primitive collider shape's dimensions so the
 * collider matches the scaled render geometry (mirrors PlayCanvas applying the
 * world scale to its collision shapes). Box scale is exact per-axis; shapes with
 * a single radius use an enclosing (largest-axis) approximation when the scale is
 * non-uniform on the relevant axes — see `isColliderScaleApproximated`. Asset
 * shapes (convexHull/trimesh/heightfield) are returned unchanged; their scale is
 * handled separately by the asset cooking path.
 */
export function scaleColliderShape(
  shape: PhysicsShape,
  scale: PhysicsVec3,
): PhysicsShape {
  const sx = Math.abs(scale[0]);
  const sy = Math.abs(scale[1]);
  const sz = Math.abs(scale[2]);

  switch (shape.kind) {
    case "box":
      return {
        kind: "box",
        halfExtents: [
          shape.halfExtents[0] * sx,
          shape.halfExtents[1] * sy,
          shape.halfExtents[2] * sz,
        ],
      };
    case "sphere":
      return { kind: "sphere", radius: shape.radius * Math.max(sx, sy, sz) };
    case "capsule":
    case "cylinder":
    case "cone": {
      const { radial, axial } = axisScaleComponents(
        scale,
        shape.axis ?? PhysicsColliderAxis.Y,
      );

      return {
        ...shape,
        radius: shape.radius * Math.max(radial[0], radial[1]),
        halfHeight: shape.halfHeight * axial,
      };
    }
    case "convexHull":
    case "trimesh":
    case "heightfield":
      return shape;
  }
}

/**
 * True when `scale` cannot be represented exactly by `shape` and the baked shape
 * is therefore an enclosing approximation. Box can represent any scale exactly; a
 * sphere needs uniform scale; capsule/cylinder/cone need uniform scale across the
 * two radial axes (the length axis is always exact).
 */
export function isColliderScaleApproximated(
  shape: PhysicsShape,
  scale: PhysicsVec3,
): boolean {
  const sx = Math.abs(scale[0]);
  const sy = Math.abs(scale[1]);
  const sz = Math.abs(scale[2]);

  switch (shape.kind) {
    case "box":
      return false;
    case "sphere":
      return !(approxEqual(sx, sy) && approxEqual(sy, sz));
    case "capsule":
    case "cylinder":
    case "cone": {
      const { radial } = axisScaleComponents(
        scale,
        shape.axis ?? PhysicsColliderAxis.Y,
      );

      return !approxEqual(radial[0], radial[1]);
    }
    case "convexHull":
    case "trimesh":
    case "heightfield":
      return false;
  }
}
