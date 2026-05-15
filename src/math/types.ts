import type {
  Mat4 as WgpuMat4,
  Mat4Arg as WgpuMat4Arg,
  Quat as WgpuQuat,
  QuatArg as WgpuQuatArg,
  Vec2 as WgpuVec2,
  Vec2Arg as WgpuVec2Arg,
  Vec3 as WgpuVec3,
  Vec3Arg as WgpuVec3Arg,
  Vec4 as WgpuVec4,
  Vec4Arg as WgpuVec4Arg,
} from "wgpu-matrix";

export type Vec2 = WgpuVec2;
export type Vec3 = WgpuVec3;
export type Vec4 = WgpuVec4;
export type Quat = WgpuQuat;
export type Mat4 = WgpuMat4;
export type Color = Vec4;

export type Vec2Like = WgpuVec2Arg | readonly [number, number];
export type Vec3Like = WgpuVec3Arg | readonly [number, number, number];
export type Vec4Like = WgpuVec4Arg | readonly [number, number, number, number];
export type QuatLike = WgpuQuatArg | readonly [number, number, number, number];
export type Mat4Like = WgpuMat4Arg | ArrayLike<number>;

export interface Ray {
  readonly origin: Vec3Like;
  readonly direction: Vec3Like;
}

export interface Aabb {
  readonly min: Vec3Like;
  readonly max: Vec3Like;
}

export interface BoundingSphere {
  readonly center: Vec3Like;
  readonly radius: number;
}

export interface Plane {
  readonly normal: Vec3Like;
  readonly constant: number;
}

export type FrustumPlanes = readonly [Plane, Plane, Plane, Plane, Plane, Plane];

export interface Frustum {
  readonly planes: FrustumPlanes;
}

export interface TransformValues {
  readonly translation: Vec3;
  readonly rotation: Quat;
  readonly scale: Vec3;
}

export interface RayHit {
  readonly distance: number;
  readonly point: Vec3;
}
