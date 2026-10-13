import type { Vec3, Vec3Like } from "./types.js";
export declare function vec3Add(a: Vec3Like, b: Vec3Like, out?: Vec3): Vec3;
export declare function vec3Subtract(a: Vec3Like, b: Vec3Like, out?: Vec3): Vec3;
export declare function vec3Scale(value: Vec3Like, scale: number, out?: Vec3): Vec3;
export declare function vec3AddScaled(a: Vec3Like, b: Vec3Like, scale: number, out?: Vec3): Vec3;
export declare function vec3Dot(a: Vec3Like, b: Vec3Like): number;
export declare function vec3Cross(a: Vec3Like, b: Vec3Like, out?: Vec3): Vec3;
export declare function vec3Length(value: Vec3Like): number;
export declare function vec3LengthSq(value: Vec3Like): number;
export declare function vec3Distance(a: Vec3Like, b: Vec3Like): number;
export declare function vec3Normalize(value: Vec3Like, out?: Vec3): Vec3;
export declare function vec3ProjectOnPlane(value: Vec3Like, normal: Vec3Like, out?: Vec3): Vec3;
//# sourceMappingURL=vector.d.ts.map