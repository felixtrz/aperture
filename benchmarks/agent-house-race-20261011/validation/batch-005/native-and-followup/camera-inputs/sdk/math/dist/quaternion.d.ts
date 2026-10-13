import type { Quat, QuatLike, Vec3, Vec3Like } from "./types.js";
export type EulerRotationOrder = "XYZ" | "XZY" | "YXZ" | "YZX" | "ZXY" | "ZYX" | "xyz" | "xzy" | "yxz" | "yzx" | "zxy" | "zyx";
export declare function quatFromAxisAngle(axis: Vec3Like, radians: number, out?: Quat): Quat;
export declare function quatMultiply(a: QuatLike, b: QuatLike, out?: Quat): Quat;
export declare function quatNormalize(value: QuatLike, out?: Quat): Quat;
export declare function quatFromEuler(x: number, y: number, z: number, order?: EulerRotationOrder, out?: Quat): Quat;
export declare function quatFromEulerYXZ(x: number, y: number, z: number, out?: Quat): Quat;
export declare function rotateVec3ByQuat(value: Vec3Like, rotation: QuatLike, out?: Vec3): Vec3;
export declare function quatLookAt(eye: Vec3Like, target: Vec3Like, up?: Vec3Like, out?: Quat): Quat;
//# sourceMappingURL=quaternion.d.ts.map