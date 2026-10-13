import type { PhysicsQuat, PhysicsVec3 } from "./components.js";
export declare const PHYSICS_QUAT_EPSILON = 1e-8;
export declare function normalizeQuat(value: ArrayLike<number>): PhysicsQuat;
export declare function multiplyQuat(left: ArrayLike<number>, right: ArrayLike<number>): PhysicsQuat;
export declare function rotateVec3ByQuat(value: ArrayLike<number>, rotation: ArrayLike<number>): PhysicsVec3;
export declare function slerpQuat(previous: ArrayLike<number>, current: ArrayLike<number>, alpha: number): PhysicsQuat;
//# sourceMappingURL=math.d.ts.map