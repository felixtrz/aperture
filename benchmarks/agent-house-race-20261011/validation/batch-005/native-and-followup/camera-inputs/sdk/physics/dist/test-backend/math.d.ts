import type { PhysicsTransform } from "../backend.js";
import type { PhysicsVec3 } from "../components.js";
export { multiplyQuat, normalizeQuat, rotateVec3ByQuat } from "../math.js";
export declare function cloneVec3(values: PhysicsVec3): [number, number, number];
export declare function addScaled(a: PhysicsVec3, b: PhysicsVec3, scale: number): [number, number, number];
export declare function add(a: PhysicsVec3, b: PhysicsVec3): [number, number, number];
export declare function scale(a: PhysicsVec3, value: number): [number, number, number];
export declare function subtract(a: PhysicsVec3, b: PhysicsVec3): [number, number, number];
export declare function transformLocalPoint(transform: PhysicsTransform, point: PhysicsVec3): [number, number, number];
export declare function transformLocalVector(transform: PhysicsTransform, value: PhysicsVec3): [number, number, number];
export declare function dot(a: PhysicsVec3, b: PhysicsVec3): number;
export declare function distance(a: PhysicsVec3, b: PhysicsVec3): number;
export declare function normalize(value: PhysicsVec3): [number, number, number];
export declare function finitePositive(value: number | undefined, fallback: number): number;
export declare function finiteNonNegative(value: number | undefined): number;
//# sourceMappingURL=math.d.ts.map