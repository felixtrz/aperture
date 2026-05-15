import {
  mat4 as wgpuMat4,
  vec3 as wgpuVec3,
  type Mat4Arg as WgpuMat4Arg,
  type QuatArg as WgpuQuatArg,
  type Vec3Arg as WgpuVec3Arg,
} from "wgpu-matrix";

import { EPSILON } from "./constants.js";
import { mat4, vec3 } from "./constructors.js";
import type { Mat4, Mat4Like, QuatLike, Vec3, Vec3Like } from "./types.js";

export function composeTransform(
  out: Mat4,
  translation: Vec3Like,
  rotation: QuatLike,
  scale: Vec3Like,
): Mat4 {
  return composeTrsMatrix(translation, rotation, scale, out);
}

export function composeTrsMatrix(
  translation: Vec3Like = [0, 0, 0],
  rotation: QuatLike = [0, 0, 0, 1],
  scale: Vec3Like = [1, 1, 1],
  out: Mat4 = mat4(),
): Mat4 {
  wgpuMat4.fromQuat(asWgpuQuatArg(rotation), out);
  wgpuMat4.scale(out, asWgpuVec3Arg(scale), out);
  return wgpuMat4.setTranslation(out, asWgpuVec3Arg(translation), out);
}

export function multiplyMat4(
  a: Mat4Like,
  b: Mat4Like,
  out: Mat4 = mat4(),
): Mat4 {
  return wgpuMat4.multiply(asWgpuMat4Arg(a), asWgpuMat4Arg(b), out);
}

export function invertMat4(matrix: Mat4Like, out: Mat4 = mat4()): Mat4 | null {
  const matrixArg = asWgpuMat4Arg(matrix);
  const determinant = wgpuMat4.determinant(matrixArg);

  if (Math.abs(determinant) <= EPSILON) {
    return null;
  }

  return wgpuMat4.inverse(matrixArg, out);
}

export function transformPoint(
  matrix: Mat4Like,
  point: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  return wgpuVec3.transformMat4(
    asWgpuVec3Arg(point),
    asWgpuMat4Arg(matrix),
    out,
  );
}

export function transformVector(
  matrix: Mat4Like,
  vector: Vec3Like,
  out: Vec3 = vec3(),
): Vec3 {
  return wgpuVec3.transformMat4Upper3x3(
    asWgpuVec3Arg(vector),
    asWgpuMat4Arg(matrix),
    out,
  );
}

function asWgpuMat4Arg(value: Mat4Like): WgpuMat4Arg {
  return value as WgpuMat4Arg;
}

function asWgpuQuatArg(value: QuatLike): WgpuQuatArg {
  return value as WgpuQuatArg;
}

function asWgpuVec3Arg(value: Vec3Like): WgpuVec3Arg {
  return value as WgpuVec3Arg;
}
