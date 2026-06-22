import type {
  Mat4 as KernelMat4,
  Quat as KernelQuat,
  Vec2 as KernelVec2,
  Vec3 as KernelVec3,
  Vec4 as KernelVec4,
} from "./kernel/index.js";
import type { StorageArg } from "./kernel/storage.js";

export type Vec2 = KernelVec2;
export type Vec3 = KernelVec3;
export type Vec4 = KernelVec4;
export type Quat = KernelQuat;
export type Mat4 = KernelMat4;
export type Color = Vec4;

export type Vec2Tuple = [number, number];
export type Vec3Tuple = [number, number, number];
export type Vec4Tuple = [number, number, number, number];
export type QuatTuple = [number, number, number, number];
export type ColorTuple = Vec4Tuple;

// `*Like` input types mirror the previous backend's "arg" types: a typed array
// (the common case) or a readonly tuple literal for authoring convenience.
export type Vec2Like = StorageArg | readonly [number, number];
export type Vec3Like = StorageArg | readonly [number, number, number];
export type Vec4Like = StorageArg | readonly [number, number, number, number];
export type QuatLike = StorageArg | readonly [number, number, number, number];
export type Mat4Like = StorageArg | ArrayLike<number>;

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
