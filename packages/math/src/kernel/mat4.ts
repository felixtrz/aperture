// Aperture in-house 4x4 matrix kernel.
//
// Conventions (locked by tests, matching the engine's WebGPU target):
//   - Column-major storage, 16 contiguous floats.
//   - Right-handed world space.
//   - Projections map depth to WebGPU clip space z in [0, 1].
//   - Output-parameter style: every op takes an optional `dst`; when omitted a
//     fresh Float32Array(16) is allocated. Hot paths always pass `dst` to stay
//     allocation-free.
//
// Every primitive here is bit-compatible (to f32 precision) with the previous
// `wgpu-matrix` backend so existing call sites and tests keep passing. The
// fused ops (`composeTRS`, `mulAffine`, `invertAffine`) are the additions that
// make transform propagation faster than composing a general library's
// primitives.

import { allocMat4, allocVec3 } from "./alloc.js";
import type { Mat4, NumArray, T3, T4, T16, Vec3 } from "./types.js";

export function create(): Mat4 {
  return allocMat4();
}

export function identity(dst?: Float32Array): Mat4 {
  const d = allocMat4(dst);
  d[0] = 1;
  d[1] = 0;
  d[2] = 0;
  d[3] = 0;
  d[4] = 0;
  d[5] = 1;
  d[6] = 0;
  d[7] = 0;
  d[8] = 0;
  d[9] = 0;
  d[10] = 1;
  d[11] = 0;
  d[12] = 0;
  d[13] = 0;
  d[14] = 0;
  d[15] = 1;
  return d;
}

export function copy(srcIn: NumArray, dst?: Float32Array): Mat4 {
  const src = srcIn as unknown as T16;
  const d = allocMat4(dst);
  d[0] = src[0];
  d[1] = src[1];
  d[2] = src[2];
  d[3] = src[3];
  d[4] = src[4];
  d[5] = src[5];
  d[6] = src[6];
  d[7] = src[7];
  d[8] = src[8];
  d[9] = src[9];
  d[10] = src[10];
  d[11] = src[11];
  d[12] = src[12];
  d[13] = src[13];
  d[14] = src[14];
  d[15] = src[15];
  return d;
}

export { copy as clone };

/** Multiplies `a` (left) by `b` (right): dst = a * b. */
export function multiply(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Mat4 {
  const a = aIn as unknown as T16;
  const b = bIn as unknown as T16;
  const d = allocMat4(dst);
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];
  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];
  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];
  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];
  const a33 = a[15];
  const b00 = b[0];
  const b01 = b[1];
  const b02 = b[2];
  const b03 = b[3];
  const b10 = b[4];
  const b11 = b[5];
  const b12 = b[6];
  const b13 = b[7];
  const b20 = b[8];
  const b21 = b[9];
  const b22 = b[10];
  const b23 = b[11];
  const b30 = b[12];
  const b31 = b[13];
  const b32 = b[14];
  const b33 = b[15];
  d[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
  d[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
  d[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
  d[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;
  d[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
  d[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
  d[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
  d[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;
  d[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
  d[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
  d[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
  d[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;
  d[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
  d[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
  d[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
  d[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;
  return d;
}

export { multiply as mul };

/**
 * Multiplies two affine matrices (bottom row [0,0,0,1]): dst = a * b.
 * Skips the eight multiply-adds the general path spends on the homogeneous
 * row, so transform-hierarchy propagation runs measurably faster. The result
 * is identical to {@link multiply} whenever both inputs are affine.
 */
export function mulAffine(aIn: NumArray, bIn: NumArray, dst?: Float32Array): Mat4 {
  const a = aIn as unknown as T16;
  const b = bIn as unknown as T16;
  const d = allocMat4(dst);
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];

  let c0 = b[0];
  let c1 = b[1];
  let c2 = b[2];
  d[0] = a00 * c0 + a10 * c1 + a20 * c2;
  d[1] = a01 * c0 + a11 * c1 + a21 * c2;
  d[2] = a02 * c0 + a12 * c1 + a22 * c2;
  d[3] = 0;

  c0 = b[4];
  c1 = b[5];
  c2 = b[6];
  d[4] = a00 * c0 + a10 * c1 + a20 * c2;
  d[5] = a01 * c0 + a11 * c1 + a21 * c2;
  d[6] = a02 * c0 + a12 * c1 + a22 * c2;
  d[7] = 0;

  c0 = b[8];
  c1 = b[9];
  c2 = b[10];
  d[8] = a00 * c0 + a10 * c1 + a20 * c2;
  d[9] = a01 * c0 + a11 * c1 + a21 * c2;
  d[10] = a02 * c0 + a12 * c1 + a22 * c2;
  d[11] = 0;

  c0 = b[12];
  c1 = b[13];
  c2 = b[14];
  d[12] = a00 * c0 + a10 * c1 + a20 * c2 + a30;
  d[13] = a01 * c0 + a11 * c1 + a21 * c2 + a31;
  d[14] = a02 * c0 + a12 * c1 + a22 * c2 + a32;
  d[15] = 1;
  return d;
}

/** Determinant of a 4x4 matrix. */
export function determinant(mIn: NumArray): number {
  const m = mIn as unknown as T16;
  const m00 = m[0];
  const m01 = m[1];
  const m02 = m[2];
  const m03 = m[3];
  const m10 = m[4];
  const m11 = m[5];
  const m12 = m[6];
  const m13 = m[7];
  const m20 = m[8];
  const m21 = m[9];
  const m22 = m[10];
  const m23 = m[11];
  const m30 = m[12];
  const m31 = m[13];
  const m32 = m[14];
  const m33 = m[15];
  const tmp0 = m22 * m33;
  const tmp1 = m32 * m23;
  const tmp2 = m12 * m33;
  const tmp3 = m32 * m13;
  const tmp4 = m12 * m23;
  const tmp5 = m22 * m13;
  const tmp6 = m02 * m33;
  const tmp7 = m32 * m03;
  const tmp8 = m02 * m23;
  const tmp9 = m22 * m03;
  const tmp10 = m02 * m13;
  const tmp11 = m12 * m03;
  const t0 =
    tmp0 * m11 +
    tmp3 * m21 +
    tmp4 * m31 -
    (tmp1 * m11 + tmp2 * m21 + tmp5 * m31);
  const t1 =
    tmp1 * m01 +
    tmp6 * m21 +
    tmp9 * m31 -
    (tmp0 * m01 + tmp7 * m21 + tmp8 * m31);
  const t2 =
    tmp2 * m01 +
    tmp7 * m11 +
    tmp10 * m31 -
    (tmp3 * m01 + tmp6 * m11 + tmp11 * m31);
  const t3 =
    tmp5 * m01 +
    tmp8 * m11 +
    tmp11 * m21 -
    (tmp4 * m01 + tmp9 * m11 + tmp10 * m21);
  return m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3;
}

/**
 * Full inverse of a 4x4 matrix, via the 2x2-cofactor (Laplace) expansion — the
 * fastest known general scheme, with shared sub-determinants. A singular matrix
 * yields a non-finite result (`1/0`); callers that care guard with
 * {@link determinant} first. For affine transforms prefer {@link invertAffine}.
 */
export function inverse(mIn: NumArray, dst?: Float32Array): Mat4 {
  const m = mIn as unknown as T16;
  const d = allocMat4(dst);
  const a00 = m[0];
  const a01 = m[1];
  const a02 = m[2];
  const a03 = m[3];
  const a10 = m[4];
  const a11 = m[5];
  const a12 = m[6];
  const a13 = m[7];
  const a20 = m[8];
  const a21 = m[9];
  const a22 = m[10];
  const a23 = m[11];
  const a30 = m[12];
  const a31 = m[13];
  const a32 = m[14];
  const a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const det =
    1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);

  d[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  d[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  d[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  d[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  d[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  d[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  d[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  d[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  d[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  d[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  d[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  d[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  d[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  d[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  d[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  d[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return d;
}

export { inverse as invert };

/**
 * Inverse of an affine matrix (bottom row [0,0,0,1]). Inverts the upper 3x3
 * linear part and re-derives the translation, which is far cheaper than the
 * general cofactor expansion. Returns `null` when the linear part is singular.
 */
export function invertAffine(mIn: NumArray, dst?: Float32Array): Mat4 | null {
  const m = mIn as unknown as T16;
  const a00 = m[0];
  const a01 = m[1];
  const a02 = m[2];
  const a10 = m[4];
  const a11 = m[5];
  const a12 = m[6];
  const a20 = m[8];
  const a21 = m[9];
  const a22 = m[10];
  const tx = m[12];
  const ty = m[13];
  const tz = m[14];

  // Cofactors of the 3x3 linear part.
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (det === 0) {
    return null;
  }
  det = 1 / det;

  // Inverse 3x3 (column-major), written into the mat4 linear columns.
  const i00 = b01 * det;
  const i01 = (-a22 * a01 + a02 * a21) * det;
  const i02 = (a12 * a01 - a02 * a11) * det;
  const i10 = b11 * det;
  const i11 = (a22 * a00 - a02 * a20) * det;
  const i12 = (-a12 * a00 + a02 * a10) * det;
  const i20 = b21 * det;
  const i21 = (-a21 * a00 + a01 * a20) * det;
  const i22 = (a11 * a00 - a01 * a10) * det;

  const d = allocMat4(dst);
  d[0] = i00;
  d[1] = i01;
  d[2] = i02;
  d[3] = 0;
  d[4] = i10;
  d[5] = i11;
  d[6] = i12;
  d[7] = 0;
  d[8] = i20;
  d[9] = i21;
  d[10] = i22;
  d[11] = 0;
  // translation' = -Ainv * t
  d[12] = -(i00 * tx + i10 * ty + i20 * tz);
  d[13] = -(i01 * tx + i11 * ty + i21 * tz);
  d[14] = -(i02 * tx + i12 * ty + i22 * tz);
  d[15] = 1;
  return d;
}

/** Builds a rotation matrix from a quaternion [x, y, z, w]. */
export function fromQuat(qIn: NumArray, dst?: Float32Array): Mat4 {
  const q = qIn as unknown as T4;
  const d = allocMat4(dst);
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  d[0] = 1 - (yy + zz);
  d[1] = xy + wz;
  d[2] = xz - wy;
  d[3] = 0;
  d[4] = xy - wz;
  d[5] = 1 - (xx + zz);
  d[6] = yz + wx;
  d[7] = 0;
  d[8] = xz + wy;
  d[9] = yz - wx;
  d[10] = 1 - (xx + yy);
  d[11] = 0;
  d[12] = 0;
  d[13] = 0;
  d[14] = 0;
  d[15] = 1;
  return d;
}

/** Scales the columns of `m` by `v`: dst = m * scale(v). */
export function scale(mIn: NumArray, vIn: NumArray, dst?: Float32Array): Mat4 {
  const m = mIn as unknown as T16;
  const v = vIn as unknown as T3;
  const d = allocMat4(dst);
  const v0 = v[0];
  const v1 = v[1];
  const v2 = v[2];
  d[0] = v0 * m[0];
  d[1] = v0 * m[1];
  d[2] = v0 * m[2];
  d[3] = v0 * m[3];
  d[4] = v1 * m[4];
  d[5] = v1 * m[5];
  d[6] = v1 * m[6];
  d[7] = v1 * m[7];
  d[8] = v2 * m[8];
  d[9] = v2 * m[9];
  d[10] = v2 * m[10];
  d[11] = v2 * m[11];
  if ((mIn as unknown) !== (d as unknown)) {
    d[12] = m[12];
    d[13] = m[13];
    d[14] = m[14];
    d[15] = m[15];
  }
  return d;
}

/** Sets the translation column of `m`. */
export function setTranslation(mIn: NumArray, vIn: NumArray, dst?: Float32Array): Mat4 {
  const m = mIn as unknown as T16;
  const v = vIn as unknown as T3;
  const d = allocMat4(dst);
  if ((mIn as unknown) !== (d as unknown)) {
    d[0] = m[0];
    d[1] = m[1];
    d[2] = m[2];
    d[3] = m[3];
    d[4] = m[4];
    d[5] = m[5];
    d[6] = m[6];
    d[7] = m[7];
    d[8] = m[8];
    d[9] = m[9];
    d[10] = m[10];
    d[11] = m[11];
  }
  d[12] = v[0];
  d[13] = v[1];
  d[14] = v[2];
  d[15] = 1;
  return d;
}

/** Reads the translation column into a vec3. */
export function getTranslation(mIn: NumArray, dst?: Float32Array): Vec3 {
  const m = mIn as unknown as T16;
  const d = allocVec3(dst);
  d[0] = m[12];
  d[1] = m[13];
  d[2] = m[14];
  return d;
}

/**
 * Fused translation * rotation * scale composition. Equivalent to
 * `setTranslation(scale(fromQuat(q), s), t)` but computed in a single pass with
 * no intermediate matrices — the engine's per-entity transform hot path.
 */
export function composeTRS(
  tIn: NumArray,
  qIn: NumArray,
  sIn: NumArray,
  dst?: Float32Array,
): Mat4 {
  const t = tIn as unknown as T3;
  const q = qIn as unknown as T4;
  const s = sIn as unknown as T3;
  const d = allocMat4(dst);
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const sx = s[0];
  const sy = s[1];
  const sz = s[2];
  d[0] = (1 - (yy + zz)) * sx;
  d[1] = (xy + wz) * sx;
  d[2] = (xz - wy) * sx;
  d[3] = 0;
  d[4] = (xy - wz) * sy;
  d[5] = (1 - (xx + zz)) * sy;
  d[6] = (yz + wx) * sy;
  d[7] = 0;
  d[8] = (xz + wy) * sz;
  d[9] = (yz - wx) * sz;
  d[10] = (1 - (xx + yy)) * sz;
  d[11] = 0;
  d[12] = t[0];
  d[13] = t[1];
  d[14] = t[2];
  d[15] = 1;
  return d;
}

/**
 * WebGPU perspective projection (clip-space z in [0, 1]). Pass `Infinity` for
 * `zFar` to build an infinite-far projection.
 */
export function perspective(
  fovyRadians: number,
  aspect: number,
  zNear: number,
  zFar: number,
  dst?: Float32Array,
): Mat4 {
  const d = allocMat4(dst);
  const f = Math.tan(Math.PI * 0.5 - 0.5 * fovyRadians);
  d[0] = f / aspect;
  d[1] = 0;
  d[2] = 0;
  d[3] = 0;
  d[4] = 0;
  d[5] = f;
  d[6] = 0;
  d[7] = 0;
  d[8] = 0;
  d[9] = 0;
  d[11] = -1;
  d[12] = 0;
  d[13] = 0;
  d[15] = 0;
  if (Number.isFinite(zFar)) {
    const rangeInv = 1 / (zNear - zFar);
    d[10] = zFar * rangeInv;
    d[14] = zFar * zNear * rangeInv;
  } else {
    d[10] = -1;
    d[14] = -zNear;
  }
  return d;
}

/** WebGPU orthographic projection (clip-space z in [0, 1]). */
export function ortho(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
  dst?: Float32Array,
): Mat4 {
  const d = allocMat4(dst);
  d[0] = 2 / (right - left);
  d[1] = 0;
  d[2] = 0;
  d[3] = 0;
  d[4] = 0;
  d[5] = 2 / (top - bottom);
  d[6] = 0;
  d[7] = 0;
  d[8] = 0;
  d[9] = 0;
  d[10] = 1 / (near - far);
  d[11] = 0;
  d[12] = (right + left) / (left - right);
  d[13] = (top + bottom) / (bottom - top);
  d[14] = near / (near - far);
  d[15] = 1;
  return d;
}
