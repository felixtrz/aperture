import { type PhysicsShape } from "./components.js";
import type { PhysicsVec3 } from "./components.js";
export declare function isNonUnitScale(scale: PhysicsVec3): boolean;
/**
 * Bakes an entity scale into a primitive collider shape's dimensions so the
 * collider matches the scaled render geometry (mirrors PlayCanvas applying the
 * world scale to its collision shapes). Box scale is exact per-axis; shapes with
 * a single radius use an enclosing (largest-axis) approximation when the scale is
 * non-uniform on the relevant axes — see `isColliderScaleApproximated`. Asset
 * shapes (convexHull/trimesh/heightfield) are returned unchanged; their scale is
 * handled separately by the asset cooking path.
 */
export declare function scaleColliderShape(shape: PhysicsShape, scale: PhysicsVec3): PhysicsShape;
/**
 * True when `scale` cannot be represented exactly by `shape` and the baked shape
 * is therefore an enclosing approximation. Box can represent any scale exactly; a
 * sphere needs uniform scale; capsule/cylinder/cone need uniform scale across the
 * two radial axes (the length axis is always exact).
 */
export declare function isColliderScaleApproximated(shape: PhysicsShape, scale: PhysicsVec3): boolean;
//# sourceMappingURL=collider-scale.d.ts.map